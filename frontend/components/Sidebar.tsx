'use client';

import { History, Database, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  queryHistory: string[];
  recentDatasets: string[];
  onQueryClick: (query: string) => void;
  onClearHistory: () => void;
}

export function Sidebar({
  queryHistory,
  recentDatasets,
  onQueryClick,
  onClearHistory
}: SidebarProps) {
  return (
    <aside className="w-64 bg-card border-r h-full overflow-y-auto">
      <div className="p-4">
        {/* Query History */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4" />
              Query History
            </h3>
            {queryHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearHistory}
                className="h-6 px-2 text-xs"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {queryHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No queries yet</p>
          ) : (
            <ul className="space-y-1">
              {queryHistory.slice().reverse().map((query, index) => (
                <li key={index}>
                  <button
                    onClick={() => onQueryClick(query)}
                    className="w-full text-left text-xs p-2 rounded hover:bg-muted truncate transition-colors"
                    title={query}
                  >
                    {query}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Datasets */}
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Database className="h-4 w-4" />
            Recent Datasets
          </h3>

          {recentDatasets.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              <p>Demo dataset active</p>
              <p className="mt-1 opacity-70">Upload a CSV to add your own data</p>
            </div>
          ) : (
            <ul className="space-y-1">
              <li className="text-xs p-2 rounded bg-primary/10 border border-primary/20">
                Demo Dataset (active)
              </li>
              {recentDatasets.map((dataset, index) => (
                <li
                  key={index}
                  className="text-xs p-2 rounded hover:bg-muted truncate"
                  title={dataset}
                >
                  {dataset}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
