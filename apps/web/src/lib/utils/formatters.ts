export function formatPaise(paise: number | bigint): string {
  const rs = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rs);
}

export function formatCurrency(rupees: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats an ISO `yyyy-mm-dd` key (from the analytics API) as a short label
 * like "11 Jul". Parses the string directly — never via `new Date()` — so the
 * browser timezone cannot shift the day.
 */
export function formatIsoDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  if (!month || !day) return isoDate;
  return `${Number(day)} ${MONTH_LABELS[Number(month) - 1] ?? month}`;
}
