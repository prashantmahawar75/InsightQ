interface ConfidenceInputs {
  sqlHealth: 'first_try' | 'retry' | 'failed';
  rowCount: number;
  chartDataMatch: boolean;
  semanticValidation: boolean;
}

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

export function getConfidenceColor(confidence: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (confidence) {
    case 'HIGH':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'MEDIUM':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'LOW':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

export function getConfidenceDescription(confidence: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (confidence) {
    case 'HIGH':
      return 'High confidence - data and interpretation are reliable';
    case 'MEDIUM':
      return 'Medium confidence - results may need verification';
    case 'LOW':
      return 'Low confidence - please verify results or rephrase your question';
  }
}
