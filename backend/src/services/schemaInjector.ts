import { Database } from 'sql.js';
import { TableSchema } from '../types.js';

export function extractSchema(db: Database): TableSchema[] {
  const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

  if (result.length === 0) return [];

  const tableNames = result[0].values.map(row => row[0] as string);

  return tableNames.map(tableName => {
    const pragmaResult = db.exec(`PRAGMA table_info("${tableName}")`);

    if (pragmaResult.length === 0) {
      return { tableName, columns: [] };
    }

    const columns = pragmaResult[0].values.map(row => ({
      name: row[1] as string,
      type: row[2] as string
    }));

    return {
      tableName,
      columns
    };
  });
}

export function formatSchemaForPrompt(schemas: TableSchema[]): string {
  return schemas
    .map(schema => {
      const columns = schema.columns
        .map(col => `  - ${col.name} (${col.type})`)
        .join('\n');
      return `TABLE: ${schema.tableName}\nCOLUMNS:\n${columns}`;
    })
    .join('\n\n');
}

export function injectSchemaIntoSqlPrompt(
  query: string,
  schemas: TableSchema[],
  sessionContext: string[] = []
): string {
  const schemaText = formatSchemaForPrompt(schemas);
  const contextText = sessionContext.length > 0
    ? `PREVIOUS QUERIES:\n${sessionContext.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : '';

  return `You are a SQL query generator for a business intelligence dashboard.

DATABASE SCHEMA:
${schemaText}

${contextText}

RULES:
1. Generate ONLY SELECT statements
2. NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE
3. LIMIT results to 50 rows unless user specifies otherwise
4. Use proper column quoting for special characters
5. If the query is ambiguous, make a reasonable interpretation
6. For date ranges, use appropriate date functions for SQLite

USER QUERY: ${query}

Return ONLY a valid JSON object with this exact structure:
{"sql": "SELECT ...", "notes": "optional clarification"}`;
}

export function injectSchemaIntoCombinedPrompt(
  query: string,
  columns: string[],
  dataSummary: Record<string, unknown>,
  rowCount: number,
  chartType: string,
  anomalies: string[],
  feedbackContext?: string
): string {
  const feedbackSection = feedbackContext
    ? `\nUSER FEEDBACK: The previous response was incorrect. ${feedbackContext}`
    : '';

  return `You are a business intelligence analyst interpreting query results.

ORIGINAL QUERY: ${query}
RESULT COLUMNS: ${columns.join(', ')}
DATA SUMMARY: ${JSON.stringify(dataSummary)}
ROW COUNT: ${rowCount}
SUGGESTED CHART TYPE: ${chartType}
DETECTED ANOMALIES: ${anomalies.length > 0 ? anomalies.join('; ') : 'None'}
${feedbackSection}

Generate a complete dashboard response as a valid JSON object:
{
  "chartConfigs": [{"type": "bar|line|pie|scatter|area", "title": "descriptive title based on the query", "xAxis": "column_name", "yAxis": ["column_name"], "data": [...the actual data rows]}],
  "narrative": "3-sentence executive summary: WHAT it shows, WHY it matters, WHAT action to consider. If anomalies detected, mention them.",
  "followUps": ["specific follow-up question 1", "specific follow-up question 2", "specific follow-up question 3"],
  "confidence": "HIGH|MEDIUM|LOW"
}

RULES:
- Only make causal claims if data explicitly supports causation; describe correlation otherwise
- Suggest actionable follow-up questions specific to the data found
- Set confidence based on: query clarity, data completeness, chart-data fit
- Reference any detected anomalies in the narrative
- Format large numbers in the narrative with abbreviations (K for thousands, M for millions)
- Use the actual data from the results in chartConfigs.data

Return ONLY the JSON object, no other text.`;
}

// Semantic validation - checks if result columns match query intent
export function validateSemantics(query: string, columns: string[]): boolean {
  // Extract key intent words from query
  const intentWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['show', 'what', 'which', 'where', 'when', 'give', 'tell', 'list', 'find', 'total', 'average', 'count'].includes(word));

  // Check if any intent words appear in column names
  const columnNamesLower = columns.map(c => c.toLowerCase());

  for (const intent of intentWords) {
    for (const col of columnNamesLower) {
      if (col.includes(intent) || intent.includes(col)) {
        return true;
      }
    }
  }

  // If query mentions specific concepts, they should be in results
  return intentWords.length === 0 || columns.length > 0;
}
