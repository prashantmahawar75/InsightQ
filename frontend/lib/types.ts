// Query request to backend
export interface QueryRequest {
  query: string;
  sessionContext: string[];
  dataSource: 'demo' | 'csv';
  tableName?: string;
  feedbackContext?: string;
}

// Response from backend
export interface QueryResponse {
  chartConfigs: ChartConfig[];
  narrative: string;
  followUps: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sqlHealth: 'first_try' | 'retry' | 'failed';
  rowCount: number;
  sql: string;
  fallbackUsed?: boolean;
}

// Chart configuration
export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  title: string;
  xAxis: string;
  yAxis: string[];
  data: Record<string, unknown>[];
}

// Anomaly detection result
export interface AnomalyResult {
  index: number;
  value: number;
  deviationMultiple: number;
  isAnomaly: boolean;
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

// Persisted state in localStorage
export interface PersistedState {
  chartConfigs: ChartConfigWithId[];
  queryHistory: string[];
  recentDatasets: string[];
  theme: 'dark' | 'light';
}

export interface ChartConfigWithId extends ChartConfig {
  id: string;
  query: string;
  narrative: string;
  followUps: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: number;
}

// Pipeline progress state
export interface PipelineProgress {
  stage: 'idle' | 'generating_sql' | 'executing_sql' | 'generating_response' | 'complete' | 'error';
  startTime?: number;
  error?: string;
}
