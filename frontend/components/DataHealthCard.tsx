'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, Calendar, Columns, Rows, CheckCircle2 } from 'lucide-react';
import { DataHealthCard as DataHealthCardType } from '@/lib/types';

interface DataHealthCardProps {
  healthCard: DataHealthCardType;
  starterQuestions: string[];
  onQuestionClick: (question: string) => void;
}

export function DataHealthCard({
  healthCard,
  starterQuestions,
  onQuestionClick
}: DataHealthCardProps) {
  return (
    <Card className="mb-6 border-green-500/30 bg-green-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-green-500" />
          {healthCard.filename}
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Rows className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{healthCard.rowCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Rows</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Columns className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{healthCard.columnCount}</p>
              <p className="text-xs text-muted-foreground">Columns</p>
            </div>
          </div>
          {healthCard.dateRange && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {healthCard.dateRange.from} - {healthCard.dateRange.to}
                </p>
                <p className="text-xs text-muted-foreground">Date Range</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{healthCard.completeness}%</p>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </div>
        </div>

        {/* Column types */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Detected columns:</p>
          <div className="flex flex-wrap gap-2">
            {healthCard.columns.map((col, index) => (
              <span
                key={index}
                className={`text-xs px-2 py-1 rounded-full ${
                  col.type === 'Numeric'
                    ? 'bg-blue-500/20 text-blue-400'
                    : col.type === 'Date'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {col.name} ({col.type})
              </span>
            ))}
          </div>
        </div>

        {/* Starter questions */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {starterQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => onQuestionClick(question)}
                className="text-xs px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-full transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
