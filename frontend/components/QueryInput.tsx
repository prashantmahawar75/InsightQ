'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Mic, MicOff, Send } from 'lucide-react';
import { isSpeechSupported, startVoiceInput } from '@/lib/voiceInput';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  exampleQueries?: string[];
  showExamples?: boolean;
}

export function QueryInput({
  onSubmit,
  isLoading,
  exampleQueries = [
    'Show me total revenue by product category for 2024',
    'Compare monthly revenue trends across all regions',
    'Which sales reps had the highest discount rates?',
    'What are the top 5 products by revenue?'
  ],
  showExamples = true
}: QueryInputProps) {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const stopListeningRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSpeechSupported(isSpeechSupported());
  }, []);

  // Handle Ctrl+M keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        toggleMic();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isListening]);

  const handleSubmit = useCallback(() => {
    if (query.trim() && !isLoading) {
      onSubmit(query.trim());
      setQuery('');
    }
  }, [query, isLoading, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleMic = useCallback(() => {
    if (isListening && stopListeningRef.current) {
      stopListeningRef.current();
      setIsListening(false);
      stopListeningRef.current = null;
      return;
    }

    const stopFn = startVoiceInput({
      onInterimResult: (transcript) => {
        setQuery(transcript);
      },
      onFinalResult: (transcript) => {
        setQuery(transcript);
        // Auto-submit after final result
        setTimeout(() => {
          if (transcript.trim()) {
            onSubmit(transcript.trim());
            setQuery('');
          }
        }, 500);
      },
      onError: (error) => {
        console.error('Voice error:', error);
        setIsListening(false);
      },
      onStart: () => {
        setIsListening(true);
      },
      onEnd: () => {
        setIsListening(false);
        stopListeningRef.current = null;
      }
    });

    if (stopFn) {
      stopListeningRef.current = stopFn;
    }
  }, [isListening, onSubmit]);

  const handleExampleClick = (example: string) => {
    setQuery(example);
    onSubmit(example);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask in plain English..."
            disabled={isLoading}
            className="pr-10 h-12 text-base"
          />
          {isListening && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            </div>
          )}
        </div>

        <TooltipProvider>
          {speechSupported ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isListening ? 'destructive' : 'outline'}
                  size="icon"
                  onClick={toggleMic}
                  disabled={isLoading}
                  className="h-12 w-12"
                >
                  {isListening ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isListening ? 'Stop listening (Ctrl+M)' : 'Voice input (Ctrl+M)'}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" disabled className="h-12 w-12 opacity-50">
                  <Mic className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voice input available in Chrome/Edge</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>

        <Button
          onClick={handleSubmit}
          disabled={isLoading || !query.trim()}
          className="h-12 px-6"
        >
          <Send className="h-5 w-5 mr-2" />
          Ask
        </Button>
      </div>

      {showExamples && (
        <div className="flex flex-wrap gap-2">
          {exampleQueries.map((example, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(example)}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-full transition-colors disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
