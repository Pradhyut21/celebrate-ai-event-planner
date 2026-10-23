export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
}
export function formatDate(value: string, short = false): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: short ? 'short' : 'long',
    ...(short ? {} : { year: 'numeric' }),
  });
}
export function money(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
export function remainingDays(date: string): number {
  // Interpret both local calendar labels as UTC midnights, so DST never adds a day.
  const today = new Date(`${localDate()}T00:00:00Z`).getTime();
  return (new Date(`${date}T00:00:00Z`).getTime() - today) / 86_400_000;
}
