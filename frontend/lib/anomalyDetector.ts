import { AnomalyResult } from './types';

export function detectAnomalies(
  data: Record<string, unknown>[],
  numericColumn: string
): AnomalyResult[] {
  const values = data
    .map((row, index) => ({
      index,
      value: typeof row[numericColumn] === 'number'
        ? row[numericColumn] as number
        : parseFloat(String(row[numericColumn]))
    }))
    .filter(item => !isNaN(item.value));

  if (values.length < 3) {
    return values.map(v => ({
      index: v.index,
      value: v.value,
      deviationMultiple: 0,
      isAnomaly: false
    }));
  }

  const numericValues = values.map(v => v.value);
  const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
  const squaredDiffs = numericValues.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / numericValues.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return values.map(v => ({
      index: v.index,
      value: v.value,
      deviationMultiple: 0,
      isAnomaly: false
    }));
  }

  const threshold = 2;
  const results: AnomalyResult[] = [];

  for (const item of values) {
    const deviation = (item.value - mean) / stdDev;
    const isAnomaly = Math.abs(deviation) > threshold;

    results.push({
      index: item.index,
      value: item.value,
      deviationMultiple: Math.abs(deviation),
      isAnomaly
    });
  }

  return results;
}

export function getAnomalyThreshold(
  data: Record<string, unknown>[],
  numericColumn: string
): { mean: number; threshold: number } | null {
  const values = data
    .map(row => {
      const val = row[numericColumn];
      return typeof val === 'number' ? val : parseFloat(String(val));
    })
    .filter(v => !isNaN(v));

  if (values.length < 3) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    threshold: mean + 2 * stdDev
  };
}
