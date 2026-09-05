import type { ChipStatus } from '../types';

const LABELS: Partial<Record<string, string>> = {
  trusted: 'Trusted',
  needs_review: 'Needs review',
  ready: 'Ready',
  failed: 'Failed',
  queued: 'Queued',
  extracting: 'Extracting',
};

export default function StatusChip({ status }: { status: ChipStatus }) {
  return <span className={`chip chip-${status}`}>{LABELS[status] || status}</span>;
}
