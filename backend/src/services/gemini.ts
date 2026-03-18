import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChartConfig, QueryResponse } from '../types.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.3,
    topP: 0.8,
    maxOutputTokens: 4096,
  }
});

// Timeout wrapper for Gemini calls
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), ms)
  );
  return Promise.race([promise, timeout]);
}

export interface SqlGenerationResult {
  sql: string;
  notes?: string;
  error?: string;
}

export async function generateSql(prompt: string): Promise<SqlGenerationResult> {
  try {
    const result = await withTimeout(model.generateContent(prompt), 8000);
    const text = result.response.text();

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { sql: '', error: 'Failed to extract SQL from response' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      sql: parsed.sql || '',
      notes: parsed.notes
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'TIMEOUT') {
      throw error; // Re-throw timeout for demo mode fallback
    }
    return { sql: '', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface CombinedResponseResult {
  chartConfigs: ChartConfig[];
  narrative: string;
  followUps: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  error?: string;
}

export async function generateCombinedResponse(prompt: string): Promise<CombinedResponseResult> {
  try {
    const result = await withTimeout(model.generateContent(prompt), 8000);
    const text = result.response.text();

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        chartConfigs: [],
        narrative: '',
        followUps: [],
        confidence: 'LOW',
        error: 'Failed to parse response'
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      chartConfigs: parsed.chartConfigs || [],
      narrative: parsed.narrative || '',
      followUps: parsed.followUps || [],
      confidence: parsed.confidence || 'MEDIUM'
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'TIMEOUT') {
      throw error;
    }
    return {
      chartConfigs: [],
      narrative: '',
      followUps: [],
      confidence: 'LOW',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function generateStarterQuestions(
  tableName: string,
  columns: { name: string; type: string }[]
): Promise<string[]> {
  const prompt = `Given a data table called "${tableName}" with the following columns:
${columns.map(c => `- ${c.name} (${c.type})`).join('\n')}

Generate exactly 5 business intelligence questions that a non-technical user might ask about this data.
Make the questions specific to the column names and data types available.

Return ONLY a JSON array of 5 question strings, like:
["question 1", "question 2", "question 3", "question 4", "question 5"]`;

  try {
    const result = await withTimeout(model.generateContent(prompt), 8000);
    const text = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]).slice(0, 5);
    }
    return getDefaultStarterQuestions(columns);
  } catch {
    return getDefaultStarterQuestions(columns);
  }
}

function getDefaultStarterQuestions(columns: { name: string; type: string }[]): string[] {
  const numericCols = columns.filter(c =>
    c.type.toLowerCase().includes('int') ||
    c.type.toLowerCase().includes('decimal') ||
    c.type.toLowerCase().includes('numeric') ||
    c.type.toLowerCase().includes('real')
  );
  const dateCols = columns.filter(c =>
    c.type.toLowerCase().includes('date') ||
    c.name.toLowerCase().includes('date')
  );

  const questions: string[] = [];

  if (numericCols.length > 0) {
    questions.push(`What is the total ${numericCols[0].name}?`);
    questions.push(`Show me the average ${numericCols[0].name}`);
  }

  if (dateCols.length > 0) {
    questions.push(`What are the trends over time?`);
  }

  questions.push(`How many records are in the data?`);
  questions.push(`Show me a summary of all columns`);

  return questions.slice(0, 5);
}

// Self-correction prompt for failed SQL
export function buildSelfCorrectionPrompt(
  originalQuery: string,
  failedSql: string,
  errorMessage: string,
  schema: string
): string {
  return `The following SQL query failed to execute.

ORIGINAL USER QUERY: ${originalQuery}

FAILED SQL:
${failedSql}

ERROR MESSAGE: ${errorMessage}

DATABASE SCHEMA:
${schema}

Please generate a corrected SQL query that properly handles this error.
Return ONLY a valid JSON object: {"sql": "SELECT ...", "notes": "what was fixed"}`;
}

// Simple SQL generator that works without Gemini API
export function generateSimpleSql(
  query: string,
  tableName: string,
  columns: { name: string; type: string }[]
): SqlGenerationResult {
  const queryLower = query.toLowerCase();
  const columnNames = columns.map(c => c.name);
  const numericCols = columns.filter(c =>
    c.type.toLowerCase().includes('real') ||
    c.type.toLowerCase().includes('int') ||
    c.type.toLowerCase().includes('numeric')
  );
  const categoricalCols = columns.filter(c =>
    c.type.toLowerCase().includes('text') &&
    !c.name.toLowerCase().includes('date')
  );

  // Pattern matching for common queries
  if (queryLower.includes('how many') || queryLower.includes('count') || queryLower.includes('total records')) {
    return { sql: `SELECT COUNT(*) as count FROM "${tableName}"` };
  }

  if (queryLower.includes('show all') || queryLower.includes('all data') || queryLower.includes('all records')) {
    return { sql: `SELECT * FROM "${tableName}" LIMIT 100` };
  }

  if (queryLower.includes('first') || queryLower.includes('top')) {
    const numMatch = queryLower.match(/(\d+)/);
    const limit = numMatch ? parseInt(numMatch[1]) : 10;
    return { sql: `SELECT * FROM "${tableName}" LIMIT ${limit}` };
  }

  // Check for aggregate + GROUP BY pattern FIRST (e.g., "average X by Y", "total X by Y")
  const hasGroupBy = queryLower.includes(' by ') || queryLower.includes(' per ') || queryLower.includes(' each ');
  const hasAverage = queryLower.includes('average') || queryLower.includes('avg') || queryLower.includes('mean');
  const hasSum = queryLower.includes('total') || queryLower.includes('sum');

  if (hasGroupBy && (hasAverage || hasSum) && numericCols.length > 0 && categoricalCols.length > 0) {
    const groupCol = findMatchingColumn(queryLower, categoricalCols) || categoricalCols[0];
    const valueCol = findMatchingColumn(queryLower, numericCols) || numericCols[0];
    const aggFunc = hasAverage ? 'AVG' : 'SUM';
    const aggName = hasAverage ? 'average' : 'total';
    return {
      sql: `SELECT "${groupCol.name}", ${aggFunc}("${valueCol.name}") as ${aggName} FROM "${tableName}" GROUP BY "${groupCol.name}" ORDER BY ${aggName} DESC LIMIT 20`
    };
  }

  // Simple Sum/Total queries (without GROUP BY)
  if (hasSum && numericCols.length > 0) {
    const targetCol = findMatchingColumn(queryLower, numericCols) || numericCols[0];
    return { sql: `SELECT SUM("${targetCol.name}") as total FROM "${tableName}"` };
  }

  // Simple Average queries (without GROUP BY)
  if (hasAverage && numericCols.length > 0) {
    const targetCol = findMatchingColumn(queryLower, numericCols) || numericCols[0];
    return { sql: `SELECT AVG("${targetCol.name}") as average FROM "${tableName}"` };
  }

  // Group by queries (count by category)
  if (hasGroupBy && categoricalCols.length > 0) {
    const groupCol = findMatchingColumn(queryLower, categoricalCols) || categoricalCols[0];
    if (numericCols.length > 0) {
      const valueCol = findMatchingColumn(queryLower, numericCols) || numericCols[0];
      return {
        sql: `SELECT "${groupCol.name}", SUM("${valueCol.name}") as total FROM "${tableName}" GROUP BY "${groupCol.name}" ORDER BY total DESC LIMIT 20`
      };
    } else {
      return {
        sql: `SELECT "${groupCol.name}", COUNT(*) as count FROM "${tableName}" GROUP BY "${groupCol.name}" ORDER BY count DESC LIMIT 20`
      };
    }
  }

  // Unique values
  if (queryLower.includes('unique') || queryLower.includes('distinct')) {
    const targetCol = findMatchingColumn(queryLower, columns) || columns[0];
    return { sql: `SELECT DISTINCT "${targetCol.name}" FROM "${tableName}" LIMIT 50` };
  }

  // Distribution queries
  if (queryLower.includes('distribution') || queryLower.includes('breakdown')) {
    if (categoricalCols.length > 0) {
      const groupCol = findMatchingColumn(queryLower, categoricalCols) || categoricalCols[0];
      return {
        sql: `SELECT "${groupCol.name}", COUNT(*) as count FROM "${tableName}" GROUP BY "${groupCol.name}" ORDER BY count DESC`
      };
    }
  }

  // Compare queries
  if (queryLower.includes('compare') && categoricalCols.length > 0 && numericCols.length > 0) {
    const groupCol = findMatchingColumn(queryLower, categoricalCols) || categoricalCols[0];
    const valueCol = findMatchingColumn(queryLower, numericCols) || numericCols[0];
    return {
      sql: `SELECT "${groupCol.name}", AVG("${valueCol.name}") as average, SUM("${valueCol.name}") as total, COUNT(*) as count FROM "${tableName}" GROUP BY "${groupCol.name}" ORDER BY average DESC`
    };
  }

  // Default: show sample data
  return { sql: `SELECT * FROM "${tableName}" LIMIT 50` };
}

function findMatchingColumn(
  query: string,
  columns: { name: string; type: string }[]
): { name: string; type: string } | null {
  const queryWords = query.toLowerCase().split(/\s+/);

  for (const col of columns) {
    const colNameLower = col.name.toLowerCase();
    for (const word of queryWords) {
      if (word.length > 2 && (colNameLower.includes(word) || word.includes(colNameLower))) {
        return col;
      }
    }
  }

  return null;
}
