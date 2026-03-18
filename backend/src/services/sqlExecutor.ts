import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Demo database path
const DEMO_DB_PATH = path.join(__dirname, '..', 'data', 'demo.db');

// Store for databases
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let demoDb: Database | null = null;
const csvDatabases: Map<string, Database> = new Map();

async function initSQL(): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
}

export async function getDemoDatabase(): Promise<Database> {
  await initSQL();

  if (!demoDb) {
    // Try to load existing database
    if (fs.existsSync(DEMO_DB_PATH)) {
      const buffer = fs.readFileSync(DEMO_DB_PATH);
      demoDb = new SQL!.Database(buffer);
    } else {
      demoDb = new SQL!.Database();
    }
  }
  return demoDb;
}

export async function createCsvDatabase(tableName: string): Promise<Database> {
  await initSQL();
  const db = new SQL!.Database();
  csvDatabases.set(tableName, db);
  return db;
}

export function getCsvDatabase(tableName: string): Database | null {
  return csvDatabases.get(tableName) || null;
}

export async function getDatabase(dataSource: 'demo' | 'csv', tableName?: string): Promise<Database> {
  if (dataSource === 'csv' && tableName) {
    const csvDb = getCsvDatabase(tableName);
    if (csvDb) return csvDb;
    throw new Error(`CSV database not found: ${tableName}`);
  }
  return getDemoDatabase();
}

// SQL regex guard - blocks dangerous statements
const DANGEROUS_KEYWORDS = /\b(DROP|DELETE|INSERT|UPDATE|ALTER|TRUNCATE|CREATE|EXEC|EXECUTE)\b/i;

export function validateSql(sql: string): { valid: boolean; error?: string } {
  // Check for dangerous keywords
  if (DANGEROUS_KEYWORDS.test(sql)) {
    return { valid: false, error: 'Only read queries are supported' };
  }

  // Ensure it's a SELECT statement
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT')) {
    return { valid: false, error: 'Only SELECT queries are supported' };
  }

  return { valid: true };
}

export interface SqlExecutionResult {
  success: boolean;
  data?: Record<string, unknown>[];
  columns?: string[];
  error?: string;
  rowCount?: number;
}

export function executeSql(
  db: Database,
  sql: string
): SqlExecutionResult {
  // Validate first
  const validation = validateSql(sql);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const result = db.exec(sql);

    if (result.length === 0) {
      return {
        success: true,
        data: [],
        columns: [],
        rowCount: 0
      };
    }

    const columns = result[0].columns;
    const values = result[0].values;

    // Convert to array of objects
    const data = values.map(row => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, index) => {
        obj[col] = row[index];
      });
      return obj;
    });

    return {
      success: true,
      data,
      columns,
      rowCount: data.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'SQL execution failed';
    return { success: false, error: errorMessage };
  }
}

// Check if user query contains modification intent
const MODIFICATION_KEYWORDS = /\b(insert|update|delete|drop|create|alter|add|remove|modify|change|set)\b.*\b(data|record|row|table|column|value)\b/i;

export function hasModificationIntent(query: string): boolean {
  return MODIFICATION_KEYWORDS.test(query);
}

export function saveDemoDatabase(): void {
  if (demoDb) {
    const data = demoDb.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DEMO_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DEMO_DB_PATH, buffer);
  }
}

export function closeDatabases(): void {
  if (demoDb) {
    demoDb.close();
    demoDb = null;
  }
  csvDatabases.forEach(db => db.close());
  csvDatabases.clear();
}
