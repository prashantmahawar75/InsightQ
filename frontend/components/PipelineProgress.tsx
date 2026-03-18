'use client';

import { useEffect, useState } from 'react';
import { Loader2, Database, Brain, CheckCircle, XCircle } from 'lucide-react';
import { PipelineProgress as PipelineProgressType } from '@/lib/types';

interface PipelineProgressProps {
  progress: PipelineProgressType;
}

const stages = [
  { key: 'generating_sql', label: 'Generating SQL', icon: Brain },
  { key: 'executing_sql', label: 'Executing Query', icon: Database },
  { key: 'generating_response', label: 'Analyzing Results', icon: Brain },
];

export function PipelineProgress({ progress }: PipelineProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (progress.stage === 'idle' || progress.stage === 'complete' || progress.stage === 'error') {
      return;
    }

    const interval = setInterval(() => {
      if (progress.startTime) {
        setElapsed(Math.floor((Date.now() - progress.startTime) / 1000));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [progress.stage, progress.startTime]);

  if (progress.stage === 'idle') {
    return null;
  }

  const currentStageIndex = stages.findIndex(s => s.key === progress.stage);

  return (
    <div className="bg-card border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Processing your query...</span>
        <span className="text-sm text-muted-foreground">{elapsed}s</span>
      </div>

      <div className="flex items-center gap-2">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          let status: 'pending' | 'active' | 'complete' | 'error' = 'pending';

          if (progress.stage === 'error' && index <= currentStageIndex) {
            status = index === currentStageIndex ? 'error' : 'complete';
          } else if (progress.stage === 'complete' || index < currentStageIndex) {
            status = 'complete';
          } else if (index === currentStageIndex) {
            status = 'active';
          }

          return (
            <div key={stage.key} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                  status === 'complete'
                    ? 'bg-green-500/20 text-green-400'
                    : status === 'active'
                    ? 'bg-primary/20 text-primary'
                    : status === 'error'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {status === 'complete' ? (
                  <CheckCircle className="h-3 w-3" />
                ) : status === 'active' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : status === 'error' ? (
                  <XCircle className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                {stage.label}
              </div>
              {index < stages.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 ${
                    status === 'complete' ? 'bg-green-500' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {progress.error && (
        <p className="mt-3 text-sm text-red-400">{progress.error}</p>
      )}
    </div>
  );
}
