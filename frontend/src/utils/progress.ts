export function estimateProgress(status: string | undefined, elapsedMs: number): number {
  if (status === 'ready' || status === 'needs_review') return 100;
  if (status === 'queued') {
    return clamp(1 + Math.min(12, elapsedMs / 250), 1, 13);
  }
  if (status === 'extracting') {
    const eased = 1 - Math.exp(-elapsedMs / 9000);
    return clamp(14 + eased * 78, 14, 92);
  }
  return 1;
}

export function progressLabel(percent: number): string {
  if (percent < 18) return 'Reading PDF…';
  if (percent < 40) return 'Pulling text…';
  if (percent < 88) return 'Extracting fields…';
  if (percent < 100) return 'Checking totals…';
  return 'Done';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
