import { parse } from 'csv-parse/sync';
import { Database } from 'sql.js';
import { createCsvDatabase } from './sqlExecutor.js';
import { ColumnSchema, DataHealthCard } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface CsvProcessingResult {
  success: boolean;
  tableName?: string;
  schema?: ColumnSchema[];
  healthCard?: DataHealthCard;
  error?: string;
}

export function validateCsvFile(
  filename: string,
  size: number
): { valid: boolean; error?: string } {
  // Check extension
  const ext = filename.toLowerCase();
  if (!ext.endsWith('.csv')) {
    return { valid: false, error: 'File must have .csv extension' };
  }

  // Check size
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File exceeds 10MB limit' };
  }

  return { valid: true };
}

export function inferColumnType(values: string[]): 'Date' | 'Numeric' | 'Categorical' {
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v.trim() !== '');

  if (nonEmptyValues.length === 0) {
    return 'Categorical';
  }

  // Check if all values are valid dates
  const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{2}[\/\-]\d{2}[\/\-]\d{4}$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/;
  const allDates = nonEmptyValues.every(v => {
    if (dateRegex.test(v)) return true;
    const parsed = Date.parse(v);
    return !isNaN(parsed);
  });
  if (allDates) return 'Date';

  // Check if all values are numeric
  const allNumeric = nonEmptyValues.every(v => {
    const cleaned = v.replace(/[,$₹]/g, '').trim();
    return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
  });
  if (allNumeric) return 'Numeric';

  return 'Categorical';
}

export async function processCsv(
  fileContent: string,
  filename: string
): Promise<CsvProcessingResult> {
  try {
    // Clean the content - handle WebArchive wrapped files
    let cleanedContent = fileContent;

    // Check if this is a Safari WebArchive (starts with bplist or contains WebMainResource)
    if (fileContent.includes('bplist') || fileContent.includes('WebMainResource')) {
      // Extract CSV content from WebArchive
      // Find the CSV header pattern (comma-separated column names)
      const csvMatch = fileContent.match(/([a-zA-Z_][a-zA-Z0-9_]*(?:,[a-zA-Z_][a-zA-Z0-9_]*){2,}[\r\n][\s\S]*)/);
      if (csvMatch) {
        cleanedContent = csvMatch[1];
        // Remove any trailing binary data
        const lines = cleanedContent.split(/\r?\n/);
        const validLines = lines.filter(line => {
          // Keep header or lines that start with valid data
          return line.match(/^[a-zA-Z0-9"'\-_]/) && !line.includes('bplist') && !line.includes('\x00');
        });
        cleanedContent = validLines.join('\n');
      } else {
        return { success: false, error: 'Could not extract CSV data from WebArchive file. Please save the file as a proper CSV.' };
      }
    }

    // Parse CSV
    const records = parse(cleanedContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
      relaxQuotes: true
    }) as Record<string, string>[];

    if (records.length === 0) {
      return { success: false, error: 'CSV file is empty or has no data rows' };
    }

    const columns = Object.keys(records[0]);

    // Infer column types
    const schemaColumns: ColumnSchema[] = columns.map(colName => {
      const values = records.map(r => r[colName] || '');
      const type = inferColumnType(values);

      const schema: ColumnSchema = { name: colName, type };

      if (type === 'Numeric') {
        const numericValues = values
          .map(v => parseFloat(v.replace(/[,$₹]/g, '')))
          .filter(v => !isNaN(v));
        if (numericValues.length > 0) {
          schema.min = Math.min(...numericValues);
          schema.max = Math.max(...numericValues);
        }
      } else if (type === 'Categorical') {
        const uniqueValues = new Set(values.filter(v => v.trim() !== ''));
        schema.uniqueValues = uniqueValues.size;
      } else if (type === 'Date') {
        const dates = values
          .map(v => new Date(v))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        if (dates.length > 0) {
          schema.min = dates[0].toISOString().split('T')[0];
          schema.max = dates[dates.length - 1].toISOString().split('T')[0];
        }
      }

      return schema;
    });

    // Calculate data completeness
    let totalCells = records.length * columns.length;
    let filledCells = 0;
    for (const record of records) {
      for (const col of columns) {
        if (record[col] && record[col].trim() !== '') {
          filledCells++;
        }
      }
    }
    const completeness = Math.round((filledCells / totalCells) * 100);

    // Create table name from filename
    const baseName = filename
      .replace(/\.csv$/i, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    const tableName = `csv_${baseName}_${uuidv4().slice(0, 8)}`;

    // Create in-memory SQLite table
    const db = await createCsvDatabase(tableName);
    createTableFromSchema(db, tableName, schemaColumns, records);

    // Build health card
    const dateColumn = schemaColumns.find(c => c.type === 'Date');
    const healthCard: DataHealthCard = {
      filename,
      rowCount: records.length,
      columnCount: columns.length,
      completeness,
      columns: schemaColumns,
      dateRange: dateColumn && dateColumn.min && dateColumn.max
        ? { from: String(dateColumn.min), to: String(dateColumn.max) }
        : undefined
    };

    return {
      success: true,
      tableName,
      schema: schemaColumns,
      healthCard
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process CSV file'
    };
  }
}

function createTableFromSchema(
  db: Database,
  tableName: string,
  columns: ColumnSchema[],
  records: Record<string, string>[]
): void {
  // Map column types to SQLite types
  const columnDefs = columns.map(col => {
    let sqlType: string;
    switch (col.type) {
      case 'Numeric':
        sqlType = 'REAL';
        break;
      case 'Date':
        sqlType = 'TEXT';
        break;
      default:
        sqlType = 'TEXT';
    }
    return `"${col.name}" ${sqlType}`;
  });

  // Create table
  const createSql = `CREATE TABLE "${tableName}" (${columnDefs.join(', ')})`;
  db.run(createSql);

  // Insert data one row at a time
  for (const record of records) {
    const values = columns.map(col => {
      const value = record[col.name];
      if (col.type === 'Numeric' && value) {
        const cleaned = value.replace(/[,$₹]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      }
      return value || null;
    });

    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO "${tableName}" VALUES (${placeholders})`;
    db.run(insertSql, values);
  }
}
