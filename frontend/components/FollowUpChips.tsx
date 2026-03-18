'use client';

import { Sparkles } from 'lucide-react';

interface FollowUpChipsProps {
  followUps: string[];
  onChipClick: (question: string) => void;
}

export function FollowUpChips({ followUps, onChipClick }: FollowUpChipsProps) {
  if (followUps.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t">
      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        Suggested follow-up questions:
      </p>
      <div className="flex flex-wrap gap-2">
        {followUps.slice(0, 3).map((question, index) => (
          <button
            key={index}
            onClick={() => onChipClick(question)}
            className="px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-full transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
