import { ConfidenceInputs } from '../types.js';

export function computeConfidence(inputs: ConfidenceInputs): 'HIGH' | 'MEDIUM' | 'LOW' {
  const { sqlHealth, rowCount, chartDataMatch, semanticValidation } = inputs;

  // Hard overrides - always return LOW
  if (sqlHealth === 'failed') return 'LOW';
  if (!semanticValidation) return 'LOW';
  if (rowCount === 0) return 'LOW';
  if (rowCount > 500) return 'LOW';

  // Medium conditions
  if (sqlHealth === 'retry') return 'MEDIUM';
  if (!chartDataMatch) return 'MEDIUM';

  // All signals clean
  return 'HIGH';
}

// Determine chart type based on result schema
export function selectChartType(
  columns: string[],
  data: Record<string, unknown>[]
): 'bar' | 'line' | 'pie' | 'scatter' | 'area' {
  if (data.length === 0 || columns.length === 0) {
    return 'bar';
  }

  // Analyze column types from data
  const columnTypes: Map<string, 'date' | 'numeric' | 'categorical'> = new Map();

  for (const col of columns) {
    const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);

    // Check if date column
    const isDate = values.some(v => {
      if (typeof v === 'string') {
        const dateTest = /^\d{4}-\d{2}-\d{2}|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
        return dateTest.test(v);
      }
      return false;
    }) || col.toLowerCase().includes('date') || col.toLowerCase().includes('month') || col.toLowerCase().includes('year');

    // Check if numeric
    const isNumeric = values.every(v =>
      typeof v === 'number' ||
      (typeof v === 'string' && !isNaN(parseFloat(v)))
    );

    if (isDate) {
      columnTypes.set(col, 'date');
    } else if (isNumeric) {
      columnTypes.set(col, 'numeric');
    } else {
      columnTypes.set(col, 'categorical');
    }
  }

  const dateColumns = columns.filter(c => columnTypes.get(c) === 'date');
  const numericColumns = columns.filter(c => columnTypes.get(c) === 'numeric');
  const categoricalColumns = columns.filter(c => columnTypes.get(c) === 'categorical');

  // 1 date + numeric columns → Line chart (time series)
  if (dateColumns.length >= 1 && numericColumns.length >= 1) {
    return 'line';
  }

  // 2 numeric columns → Scatter plot
  if (numericColumns.length >= 2 && categoricalColumns.length === 0) {
    return 'scatter';
  }

  // 1 categorical + 1 numeric with ≤7 categories → Pie chart
  if (categoricalColumns.length === 1 && numericColumns.length === 1) {
    const uniqueCategories = new Set(data.map(row => row[categoricalColumns[0]]));
    if (uniqueCategories.size <= 7) {
      return 'pie';
    }
  }

  // Default: Bar chart
  return 'bar';
}

// Generate data summary for LLM prompt
export function generateDataSummary(
  columns: string[],
  data: Record<string, unknown>[]
): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    totalRows: data.length,
    columns: {}
  };

  for (const col of columns) {
    const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
    const numericValues = values
      .map(v => typeof v === 'number' ? v : parseFloat(String(v)))
      .filter(v => !isNaN(v));

    if (numericValues.length > 0) {
      (summary.columns as Record<string, unknown>)[col] = {
        type: 'numeric',
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length
      };
    } else {
      const uniqueValues = new Set(values.map(v => String(v)));
      (summary.columns as Record<string, unknown>)[col] = {
        type: 'categorical',
        uniqueValues: uniqueValues.size,
        sample: Array.from(uniqueValues).slice(0, 5)
      };
    }
  }

  return summary;
}

// Detect anomalies in numeric data (2 standard deviations)
export function detectAnomalies(
  data: Record<string, unknown>[],
  numericColumn: string
): { index: number; value: number; deviation: number }[] {
  const values = data
    .map((row, index) => ({
      index,
      value: typeof row[numericColumn] === 'number'
        ? row[numericColumn] as number
        : parseFloat(String(row[numericColumn]))
    }))
    .filter(item => !isNaN(item.value));

  if (values.length < 3) return [];

  const numericValues = values.map(v => v.value);
  const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
  const squaredDiffs = numericValues.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / numericValues.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return [];

  const threshold = 2 * stdDev;
  const anomalies: { index: number; value: number; deviation: number }[] = [];

  for (const item of values) {
    const deviation = Math.abs(item.value - mean);
    if (deviation > threshold) {
      anomalies.push({
        index: item.index,
        value: item.value,
        deviation: deviation / stdDev
      });
    }
  }

  return anomalies;
}
