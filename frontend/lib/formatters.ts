export function formatNumber(value: number): string {
  if (value === 0) return '0';

  const absValue = Math.abs(value);

  if (absValue >= 10000000) {
    // Crores (Indian numbering)
    return (value / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
  }

  if (absValue >= 100000) {
    // Lakhs (Indian numbering)
    return (value / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  }

  if (absValue >= 1000000) {
    // Millions
    return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }

  if (absValue >= 1000) {
    // Thousands
    return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }

  // Small numbers
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2);
}

export function formatCurrency(value: number, currency: string = '₹'): string {
  return currency + formatNumber(value);
}

export function formatPercentage(value: number): string {
  return value.toFixed(1) + '%';
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function formatChartValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';

  if (typeof value === 'number') {
    return formatNumber(value);
  }

  if (typeof value === 'string') {
    // Check if it's a date
    const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      return formatDate(value);
    }
    return value;
  }

  return String(value);
}

// Format value for tooltip display
export function formatTooltipValue(value: unknown, prefix: string = ''): string {
  if (typeof value === 'number') {
    if (value >= 1000) {
      return prefix + value.toLocaleString('en-IN');
    }
    return prefix + value.toFixed(2);
  }
  return String(value);
}
