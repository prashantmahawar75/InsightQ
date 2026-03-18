import { QueryResponse, DemoCacheEntry } from '../types.js';
import demoCache from '../data/demoCache.json' assert { type: 'json' };

interface CacheData {
  entries: Array<{
    query: string;
    keywords: string[];
    response: QueryResponse;
  }>;
}

const cache = demoCache as CacheData;

export function findBestMatch(userQuery: string): QueryResponse | null {
  const queryWords = userQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2);

  let bestMatch: { entry: typeof cache.entries[0]; score: number } | null = null;

  for (const entry of cache.entries) {
    let score = 0;

    // Score based on keyword overlap
    for (const keyword of entry.keywords) {
      for (const queryWord of queryWords) {
        if (queryWord.includes(keyword) || keyword.includes(queryWord)) {
          score += 2;
        }
      }
    }

    // Score based on query text similarity
    const entryWords = entry.query.toLowerCase().split(/\s+/);
    for (const entryWord of entryWords) {
      if (queryWords.includes(entryWord)) {
        score += 1;
      }
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { entry, score };
    }
  }

  // Return best match if score is above threshold, otherwise return first entry
  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.entry.response;
  }

  // Default to first entry
  return cache.entries[0]?.response || null;
}

export function getDemoResponse(userQuery: string): QueryResponse {
  const match = findBestMatch(userQuery);

  if (match) {
    // Mark as fallback
    return {
      ...match,
      narrative: match.narrative + ' (Demo Mode - using cached response)'
    };
  }

  // Fallback response if no cache available
  return {
    chartConfigs: [{
      type: 'bar',
      title: 'Sample Data',
      xAxis: 'category',
      yAxis: ['value'],
      data: [
        { category: 'A', value: 100 },
        { category: 'B', value: 200 },
        { category: 'C', value: 150 }
      ]
    }],
    narrative: 'Demo mode is active. This is sample data shown because the AI service is unavailable.',
    followUps: [
      'Show me total revenue by category',
      'What are the monthly trends?',
      'Which region performs best?'
    ],
    confidence: 'MEDIUM',
    sqlHealth: 'first_try',
    rowCount: 3,
    sql: 'SELECT category, value FROM sample_data'
  };
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === 'TIMEOUT';
}
