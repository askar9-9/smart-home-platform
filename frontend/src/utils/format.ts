export function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat('ru', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function chartTime(value: string) {
  return new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(value));
}
