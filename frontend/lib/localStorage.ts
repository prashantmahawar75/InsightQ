import { PersistedState, ChartConfigWithId } from './types';

const STORAGE_KEY = 'insightq_state';
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_QUERY_HISTORY = 10;

const defaultState: PersistedState = {
  chartConfigs: [],
  queryHistory: [],
  recentDatasets: [],
  theme: 'dark'
};

export function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;

    const parsed = JSON.parse(stored) as PersistedState;
    return {
      ...defaultState,
      ...parsed
    };
  } catch {
    return defaultState;
  }
}

export function saveState(state: PersistedState): void {
  if (typeof window === 'undefined') return;

  try {
    const prunedState = pruneIfNeeded(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedState));
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

function pruneIfNeeded(state: PersistedState): PersistedState {
  let currentState = { ...state };

  const getSize = (s: PersistedState): number => {
    return new Blob([JSON.stringify(s)]).size;
  };

  // First, limit query history
  if (currentState.queryHistory.length > MAX_QUERY_HISTORY) {
    currentState.queryHistory = currentState.queryHistory.slice(-MAX_QUERY_HISTORY);
  }

  // Check size and prune if needed
  while (getSize(currentState) >= MAX_SIZE_BYTES && currentState.chartConfigs.length > 0) {
    currentState.chartConfigs = currentState.chartConfigs.slice(1);
  }

  while (getSize(currentState) >= MAX_SIZE_BYTES && currentState.queryHistory.length > 0) {
    currentState.queryHistory = currentState.queryHistory.slice(1);
  }

  return currentState;
}

export function addChartConfig(config: ChartConfigWithId): void {
  const state = loadState();
  state.chartConfigs.push(config);
  saveState(state);
}

export function removeChartConfig(id: string): void {
  const state = loadState();
  state.chartConfigs = state.chartConfigs.filter(c => c.id !== id);
  saveState(state);
}

export function addQuery(query: string): void {
  const state = loadState();
  // Remove duplicate if exists
  state.queryHistory = state.queryHistory.filter(q => q !== query);
  state.queryHistory.push(query);

  // Keep only last 10
  if (state.queryHistory.length > MAX_QUERY_HISTORY) {
    state.queryHistory = state.queryHistory.slice(-MAX_QUERY_HISTORY);
  }

  saveState(state);
}

export function addDataset(filename: string): void {
  const state = loadState();
  // Remove duplicate if exists
  state.recentDatasets = state.recentDatasets.filter(d => d !== filename);
  state.recentDatasets.unshift(filename);

  // Keep only last 5
  if (state.recentDatasets.length > 5) {
    state.recentDatasets = state.recentDatasets.slice(0, 5);
  }

  saveState(state);
}

export function getTheme(): 'dark' | 'light' {
  const state = loadState();
  return state.theme;
}

export function setTheme(theme: 'dark' | 'light'): void {
  const state = loadState();
  state.theme = theme;
  saveState(state);
}

export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
