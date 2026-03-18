// Query request from frontend to backend
export interface QueryRequest {
  query: string;
  sessionContext: string[];
  dataSource: 'demo' | 'csv';
  tableName?: string;
  feedbackContext?: string;
}

// Combined response from backend to frontend
export interface QueryResponse {
  chartConfigs: ChartConfig[];
  narrative: string;
  followUps: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sqlHealth: 'first_try' | 'retry' | 'failed';
  rowCount: number;
  sql: string;
}

// Individual chart configuration
export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  title: string;
  xAxis: string;
  yAxis: string[];
  data: Record<string, unknown>[];
}

// Anomaly result attached to chart data
export interface AnomalyResult {
  index: number;
  value: number;
  deviationMultiple: number;
  isAnomaly: boolean;
}

// Confidence scoring inputs
export interface ConfidenceInputs {
  sqlHealth: 'first_try' | 'retry' | 'failed';
  rowCount: number;
  chartDataMatch: boolean;
  semanticValidation: boolean;
}

// CSV upload response
export interface UploadResponse {
  tableName: string;
  schema: ColumnSchema[];
  healthCard: DataHealthCard;
  starterQuestions: string[];
}

export interface ColumnSchema {
  name: string;
  type: 'Date' | 'Numeric' | 'Categorical';
  uniqueValues?: number;
  min?: number | string;
  max?: number | string;
}

export interface DataHealthCard {
  filename: string;
  rowCount: number;
  columnCount: number;
  dateRange?: { from: string; to: string };
  completeness: number;
  columns: ColumnSchema[];
}

// Error response
export interface ErrorResponse {
  error: true;
  message: string;
  retryable: boolean;
  fallbackUsed: boolean;
}

// Demo cache entry
export interface DemoCacheEntry {
  query: string;
  response: QueryResponse;
}

// Database schema for prompt injection
export interface TableSchema {
  tableName: string;
  columns: {
    name: string;
    type: string;
  }[];
}
