'use client';

import { useState, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X, Download, ThumbsDown, ThumbsUp, AlertTriangle } from 'lucide-react';
import { ChartConfigWithId, AnomalyResult } from '@/lib/types';
import { detectAnomalies, getAnomalyThreshold } from '@/lib/anomalyDetector';
import { getConfidenceColor, getConfidenceDescription } from '@/lib/confidenceScorer';
import { formatChartValue, formatTooltipValue } from '@/lib/formatters';
import html2canvas from 'html2canvas';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface ChartCardProps {
  config: ChartConfigWithId;
  onRemove: (id: string) => void;
  onFeedback: (id: string, feedback: string) => void;
}

export function ChartCard({ config, onRemove, onFeedback }: ChartCardProps) {
  const [chartType, setChartType] = useState(config.type);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const chartRef = useRef<HTMLDivElement>(null);

  // Detect anomalies in numeric columns
  const numericColumns = config.yAxis.filter(col => {
    return config.data.some(row => typeof row[col] === 'number');
  });

  const anomalyData: Record<string, AnomalyResult[]> = {};
  const thresholds: Record<string, { mean: number; threshold: number } | null> = {};

  numericColumns.forEach(col => {
    anomalyData[col] = detectAnomalies(config.data, col);
    thresholds[col] = getAnomalyThreshold(config.data, col);
  });

  const hasAnomalies = Object.values(anomalyData).some(arr =>
    arr.some(a => a.isAnomaly)
  );

  const handleExport = async () => {
    if (chartRef.current) {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2
      });
      const link = document.createElement('a');
      link.download = `${config.title.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleFeedbackSubmit = () => {
    if (feedbackText.trim()) {
      onFeedback(config.id, feedbackText.trim());
      setShowFeedback(false);
      setFeedbackText('');
    }
  };

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-1">{formatChartValue(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatTooltipValue(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data: config.data,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey={config.xAxis} tick={{ fontSize: 12 }} tickFormatter={formatChartValue} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={formatChartValue} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {config.yAxis.map((key, index) => (
                <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
              ))}
              {/* Anomaly reference lines */}
              {numericColumns.map(col => {
                const threshold = thresholds[col];
                if (threshold && hasAnomalies) {
                  return (
                    <ReferenceLine
                      key={col}
                      y={threshold.threshold}
                      stroke="#EF4444"
                      strokeDasharray="5 5"
                      label={{ value: 'Anomaly threshold', position: 'top', fill: '#EF4444', fontSize: 10 }}
                    />
                  );
                }
                return null;
              })}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey={config.xAxis} tick={{ fontSize: 12 }} tickFormatter={formatChartValue} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={formatChartValue} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {config.yAxis.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={(props: any) => {
                    const anomaly = anomalyData[key]?.find(a => a.index === props.index && a.isAnomaly);
                    if (anomaly) {
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={6}
                          fill="#EF4444"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    }
                    return <circle cx={props.cx} cy={props.cy} r={4} fill={props.stroke} />;
                  }}
                />
              ))}
              {numericColumns.map(col => {
                const threshold = thresholds[col];
                if (threshold && hasAnomalies) {
                  return (
                    <ReferenceLine
                      key={col}
                      y={threshold.threshold}
                      stroke="#EF4444"
                      strokeDasharray="5 5"
                    />
                  );
                }
                return null;
              })}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={config.data}
                dataKey={config.yAxis[0]}
                nameKey={config.xAxis}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {config.data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey={config.xAxis} tick={{ fontSize: 12 }} tickFormatter={formatChartValue} name={config.xAxis} />
              <YAxis dataKey={config.yAxis[0]} tick={{ fontSize: 12 }} tickFormatter={formatChartValue} name={config.yAxis[0]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Scatter name="Data Points" data={config.data} fill={COLORS[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey={config.xAxis} tick={{ fontSize: 12 }} tickFormatter={formatChartValue} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={formatChartValue} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {config.yAxis.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <Card className="chart-card relative" ref={chartRef}>
      {/* Confidence Badge */}
      <div className={`absolute top-4 right-4 px-2 py-1 rounded text-xs font-medium border ${getConfidenceColor(config.confidence)}`}>
        {config.confidence}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between pr-16">
          <CardTitle className="text-lg">{config.title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(config.id)}
            className="h-8 w-8 -mt-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Low confidence warning */}
        {config.confidence === 'LOW' && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Low confidence result. Please clarify your question or verify the data.</span>
          </div>
        )}

        {/* Chart type selector */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-muted-foreground">Chart type:</span>
          <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Bar</SelectItem>
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="pie">Pie</SelectItem>
              <SelectItem value="scatter">Scatter</SelectItem>
              <SelectItem value="area">Area</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {renderChart()}

        {/* Narrative */}
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm leading-relaxed">{config.narrative}</p>
          <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <span>⚡</span>
            AI-generated interpretation — verify before acting
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export PNG
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFeedback(!showFeedback)}
            >
              <ThumbsDown className="h-4 w-4 mr-1" />
              Feedback
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            {config.data.length} rows
          </span>
        </div>

        {/* Feedback input */}
        {showFeedback && (
          <div className="mt-4 flex gap-2">
            <Input
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="What was wrong with this result?"
              className="flex-1"
            />
            <Button onClick={handleFeedbackSubmit} disabled={!feedbackText.trim()}>
              Re-run
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
