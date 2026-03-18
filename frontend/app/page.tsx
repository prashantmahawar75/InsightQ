'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { QueryInput } from '@/components/QueryInput';
import { ChartCard } from '@/components/ChartCard';
import { Sidebar } from '@/components/Sidebar';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { PipelineProgress } from '@/components/PipelineProgress';
import { DataHealthCard } from '@/components/DataHealthCard';
import { FollowUpChips } from '@/components/FollowUpChips';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FileUpload } from '@/components/FileUpload';
import { Button } from '@/components/ui/button';
import {
  QueryRequest,
  QueryResponse,
  ChartConfigWithId,
  PipelineProgress as PipelineProgressType,
  UploadResponse,
  DataHealthCard as DataHealthCardType
} from '@/lib/types';
import {
  loadState,
  saveState,
  addQuery,
  addChartConfig,
  removeChartConfig,
  addDataset
} from '@/lib/localStorage';

export default function Dashboard() {
  const [charts, setCharts] = useState<ChartConfigWithId[]>([]);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [recentDatasets, setRecentDatasets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<PipelineProgressType>({ stage: 'idle' });
  const [currentFollowUps, setCurrentFollowUps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'demo' | 'csv'>('demo');
  const [tableName, setTableName] = useState<string | undefined>();
  const [healthCard, setHealthCard] = useState<DataHealthCardType | null>(null);
  const [starterQuestions, setStarterQuestions] = useState<string[]>([]);

  // Load persisted state on mount
  useEffect(() => {
    const state = loadState();
    setCharts(state.chartConfigs);
    setQueryHistory(state.queryHistory);
    setRecentDatasets(state.recentDatasets);
  }, []);

  // Save state when it changes
  useEffect(() => {
    const state = loadState();
    saveState({
      ...state,
      chartConfigs: charts,
      queryHistory,
      recentDatasets
    });
  }, [charts, queryHistory, recentDatasets]);

  const handleQuery = useCallback(async (query: string, feedbackContext?: string) => {
    setIsLoading(true);
    setError(null);
    setProgress({ stage: 'generating_sql', startTime: Date.now() });

    // Add to history
    addQuery(query);
    setQueryHistory(prev => {
      const filtered = prev.filter(q => q !== query);
      return [...filtered, query].slice(-10);
    });

    try {
      const request: QueryRequest = {
        query,
        sessionContext: queryHistory.slice(-3),
        dataSource,
        tableName,
        feedbackContext
      };

      setProgress({ stage: 'executing_sql', startTime: Date.now() });

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      setProgress({ stage: 'generating_response', startTime: Date.now() });

      const data = await response.json();

      if (data.error) {
        setError(data.message);
        setProgress({ stage: 'error', error: data.message });
        return;
      }

      const result = data as QueryResponse;

      // Add chart configs with IDs
      const newCharts: ChartConfigWithId[] = result.chartConfigs.map((config, index) => ({
        ...config,
        id: `${Date.now()}-${index}`,
        query,
        narrative: result.narrative,
        followUps: result.followUps,
        confidence: result.confidence,
        timestamp: Date.now()
      }));

      setCharts(prev => [...prev, ...newCharts]);
      setCurrentFollowUps(result.followUps);
      setProgress({ stage: 'complete' });

      // Persist
      newCharts.forEach(chart => addChartConfig(chart));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setProgress({ stage: 'error', error: message });
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress({ stage: 'idle' }), 2000);
    }
  }, [queryHistory, dataSource, tableName]);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.error) {
        setError(data.message);
        return;
      }

      const result = data as UploadResponse;

      setDataSource('csv');
      setTableName(result.tableName);
      setHealthCard(result.healthCard);
      setStarterQuestions(result.starterQuestions);

      // Add to recent datasets
      addDataset(result.healthCard.filename);
      setRecentDatasets(prev => [result.healthCard.filename, ...prev.filter(d => d !== result.healthCard.filename)].slice(0, 5));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleRemoveChart = useCallback((id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id));
    removeChartConfig(id);
  }, []);

  const handleFeedback = useCallback((id: string, feedback: string) => {
    const chart = charts.find(c => c.id === id);
    if (chart) {
      handleQuery(chart.query, feedback);
    }
  }, [charts, handleQuery]);

  const handleClearHistory = useCallback(() => {
    setQueryHistory([]);
    const state = loadState();
    saveState({ ...state, queryHistory: [] });
  }, []);

  const handleClearCharts = useCallback(() => {
    setCharts([]);
    const state = loadState();
    saveState({ ...state, chartConfigs: [] });
  }, []);

  const showEmptyState = charts.length === 0 && !isLoading && !healthCard;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar
        queryHistory={queryHistory}
        recentDatasets={recentDatasets}
        onQueryClick={(query) => handleQuery(query)}
        onClearHistory={handleClearHistory}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">InsightQ</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full">
              Powered by Gemini
            </span>
            <ThemeToggle />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* File Upload */}
          <FileUpload onUpload={handleFileUpload} isUploading={isUploading} />

          {/* Data Health Card */}
          {healthCard && (
            <DataHealthCard
              healthCard={healthCard}
              starterQuestions={starterQuestions}
              onQuestionClick={(q) => handleQuery(q)}
            />
          )}

          {/* Query Input */}
          <QueryInput
            onSubmit={(query) => handleQuery(query)}
            isLoading={isLoading}
            showExamples={showEmptyState}
          />

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
              <p className="text-sm text-red-400">{error}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    if (queryHistory.length > 0) {
                      handleQuery(queryHistory[queryHistory.length - 1]);
                    }
                  }}
                >
                  Try again
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Pipeline Progress */}
          {progress.stage !== 'idle' && (
            <div className="mt-4">
              <PipelineProgress progress={progress} />
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="mt-6">
              <SkeletonLoader />
            </div>
          )}

          {/* Charts Grid */}
          {charts.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">Your Insights</h2>
                <Button variant="outline" size="sm" onClick={handleClearCharts}>
                  Clear All
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {charts.map((chart) => (
                  <ChartCard
                    key={chart.id}
                    config={chart}
                    onRemove={handleRemoveChart}
                    onFeedback={handleFeedback}
                  />
                ))}
              </div>

              {/* Follow-up Chips */}
              {currentFollowUps.length > 0 && (
                <FollowUpChips
                  followUps={currentFollowUps}
                  onChipClick={(q) => handleQuery(q)}
                />
              )}
            </div>
          )}

          {/* Empty State */}
          {showEmptyState && (
            <div className="mt-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-medium mb-2">Ask anything about your data</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Type a question in plain English or upload a CSV file to get started.
                Try one of the example queries above!
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
