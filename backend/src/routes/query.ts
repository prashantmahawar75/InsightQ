import { Router, Request, Response } from 'express';
import { QueryRequest, QueryResponse, ErrorResponse } from '../types.js';
import {
  getDatabase,
  executeSql,
  hasModificationIntent
} from '../services/sqlExecutor.js';
import {
  extractSchema,
  formatSchemaForPrompt,
  injectSchemaIntoSqlPrompt,
  injectSchemaIntoCombinedPrompt,
  validateSemantics
} from '../services/schemaInjector.js';
import {
  generateSql,
  generateCombinedResponse,
  buildSelfCorrectionPrompt,
  generateSimpleSql
} from '../services/gemini.js';
import {
  computeConfidence,
  selectChartType,
  generateDataSummary,
  detectAnomalies
} from '../services/confidenceSignals.js';
import { getDemoResponse, isTimeoutError } from '../services/demoCache.js';

export const queryRouter = Router();

queryRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as QueryRequest;
    const { query, sessionContext = [], dataSource = 'demo', tableName, feedbackContext } = body;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({
        error: true,
        message: 'Please enter a question to analyze your data.',
        retryable: false,
        fallbackUsed: false
      } as ErrorResponse);
      return;
    }

    // Check for modification intent
    if (hasModificationIntent(query)) {
      res.status(400).json({
        error: true,
        message: 'Only read queries are supported',
        retryable: false,
        fallbackUsed: false
      } as ErrorResponse);
      return;
    }

    // Get database and schema
    const db = await getDatabase(dataSource, tableName);
    const schemas = extractSchema(db);
    const schemaText = formatSchemaForPrompt(schemas);

    let sqlHealth: 'first_try' | 'retry' | 'failed' = 'first_try';
    let finalSql = '';
    let sqlResult: ReturnType<typeof executeSql> | null = null;

    try {
      // CALL 1: Generate SQL
      const sqlPrompt = injectSchemaIntoSqlPrompt(query, schemas, sessionContext.slice(-3));
      const sqlGenResult = await generateSql(sqlPrompt);

      if (sqlGenResult.error || !sqlGenResult.sql) {
        throw new Error(sqlGenResult.error || 'Failed to generate SQL');
      }

      finalSql = sqlGenResult.sql;
      sqlResult = executeSql(db, finalSql);

      // Self-correction if SQL fails
      if (!sqlResult.success && sqlResult.error) {
        sqlHealth = 'retry';
        const correctionPrompt = buildSelfCorrectionPrompt(
          query,
          finalSql,
          sqlResult.error,
          schemaText
        );
        const correctedResult = await generateSql(correctionPrompt);

        if (correctedResult.sql) {
          finalSql = correctedResult.sql;
          sqlResult = executeSql(db, finalSql);
        }

        if (!sqlResult.success) {
          sqlHealth = 'failed';
          throw new Error(sqlResult.error || 'SQL execution failed after retry');
        }
      }
    } catch (error) {
      // If using CSV data, don't fall back to demo - try simple SQL generator
      if (dataSource === 'csv' && tableName) {
        try {
          // Get column info for the simple SQL generator
          const tableSchema = schemas.find(s => s.tableName === tableName);
          const columns = tableSchema?.columns || [];

          // Generate a simple SQL query based on the user's question
          const simpleSqlResult = generateSimpleSql(query, tableName, columns);
          const simpleResult = executeSql(db, simpleSqlResult.sql);

          if (simpleResult.success && simpleResult.data && simpleResult.data.length > 0) {
            const resultColumns = simpleResult.columns || [];
            const data = simpleResult.data;

            // Determine a basic chart type
            const numericCols = resultColumns.filter(col =>
              typeof data[0]?.[col] === 'number'
            );
            const chartType = numericCols.length > 0 ? 'bar' : 'bar';

            const response: QueryResponse = {
              chartConfigs: [{
                type: chartType,
                title: `Results: ${query.slice(0, 50)}`,
                xAxis: resultColumns[0] || 'x',
                yAxis: numericCols.length > 0 ? numericCols.slice(0, 3) : [resultColumns[1] || 'y'],
                data
              }],
              narrative: `Showing results from your uploaded CSV. Add a GEMINI_API_KEY in backend/.env for AI-powered insights.`,
              followUps: ['Show all data', 'Count total records', 'Show unique values'],
              confidence: 'MEDIUM',
              sqlHealth: 'first_try',
              rowCount: data.length,
              sql: simpleSqlResult.sql
            };

            res.json(response);
            return;
          }
        } catch {
          // Fall through to error response
        }

        // Return error for CSV mode if basic query also fails
        res.status(500).json({
          error: true,
          message: 'Could not query your CSV data. Please check the file format and try again.',
          retryable: true,
          fallbackUsed: false
        } as ErrorResponse);
        return;
      }

      // Check for timeout - use demo mode only for demo data source
      if (isTimeoutError(error)) {
        const demoResponse = getDemoResponse(query);
        res.json({ ...demoResponse, fallbackUsed: true });
        return;
      }

      // If SQL failed completely, try demo mode
      sqlHealth = 'failed';
      const demoResponse = getDemoResponse(query);
      res.json({ ...demoResponse, fallbackUsed: true });
      return;
    }

    // Successfully executed SQL
    const data = sqlResult!.data || [];
    const columns = sqlResult!.columns || [];
    const rowCount = data.length;

    // Detect anomalies in numeric columns
    const numericColumns = columns.filter(col => {
      const values = data.map(row => row[col]);
      return values.some(v => typeof v === 'number');
    });

    const anomalies: string[] = [];
    for (const col of numericColumns) {
      const detected = detectAnomalies(data, col);
      for (const anomaly of detected) {
        anomalies.push(`${col} at index ${anomaly.index}: ${anomaly.deviation.toFixed(1)}x deviation`);
      }
    }

    // Select initial chart type
    const chartType = selectChartType(columns, data);

    // Generate data summary
    const dataSummary = generateDataSummary(columns, data);

    try {
      // CALL 2: Generate combined response
      const combinedPrompt = injectSchemaIntoCombinedPrompt(
        query,
        columns,
        dataSummary,
        rowCount,
        chartType,
        anomalies,
        feedbackContext
      );

      const combinedResult = await generateCombinedResponse(combinedPrompt);

      if (combinedResult.error) {
        throw new Error(combinedResult.error);
      }

      // Semantic validation
      const semanticValid = validateSemantics(query, columns);

      // Compute final confidence
      const finalConfidence = computeConfidence({
        sqlHealth,
        rowCount,
        chartDataMatch: combinedResult.chartConfigs.length > 0,
        semanticValidation: semanticValid
      });

      // Override confidence if semantic validation fails
      const confidence = semanticValid ? finalConfidence : 'LOW';

      // If LLM didn't return data in chartConfigs, inject the actual data
      const chartConfigs = combinedResult.chartConfigs.map(config => ({
        ...config,
        data: config.data && config.data.length > 0 ? config.data : data
      }));

      const response: QueryResponse = {
        chartConfigs,
        narrative: combinedResult.narrative,
        followUps: combinedResult.followUps.slice(0, 3),
        confidence,
        sqlHealth,
        rowCount,
        sql: finalSql
      };

      res.json(response);
    } catch (error) {
      // Handle timeout or error in combined response - use actual data, not demo
      const errorMessage = isTimeoutError(error)
        ? 'AI insights timed out. Showing your actual data.'
        : 'Data retrieved successfully. AI-powered insights are temporarily unavailable.';

      // Return partial response with actual data (not demo data)
      const response: QueryResponse = {
        chartConfigs: [{
          type: chartType,
          title: `Results for: ${query.slice(0, 50)}`,
          xAxis: columns[0] || 'x',
          yAxis: columns.slice(1) || ['y'],
          data
        }],
        narrative: errorMessage,
        followUps: ['Show me more details', 'Break this down by category', 'What are the trends?'],
        confidence: 'MEDIUM',
        sqlHealth,
        rowCount,
        sql: finalSql
      };

      res.json(response);
    }
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({
      error: true,
      message: 'Something went wrong. Please try again.',
      retryable: true,
      fallbackUsed: false
    } as ErrorResponse);
  }
});
