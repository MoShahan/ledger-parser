export function formatWhen(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return { date: 'Unknown date', time: '' };
  return {
    date: new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(value),
    time: new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(value),
  };
}
