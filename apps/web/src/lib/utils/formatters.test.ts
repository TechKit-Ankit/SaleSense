import { formatPaise, formatCurrency, formatIsoDateLabel } from './formatters';

describe('formatters', () => {
  it('formatPaise renders integer paise as INR', () => {
    expect(formatPaise(10000)).toBe('₹100.00');
    expect(formatPaise(5)).toBe('₹0.05');
    expect(formatPaise(123456789)).toBe('₹12,34,567.89'); // Indian grouping
  });

  it('formatCurrency renders rupees as INR', () => {
    expect(formatCurrency(1234.5)).toBe('₹1,234.50');
  });

  it('formatIsoDateLabel formats ISO keys without timezone shifts', () => {
    expect(formatIsoDateLabel('2026-07-11')).toBe('11 Jul');
    expect(formatIsoDateLabel('2026-01-01')).toBe('1 Jan');
    // malformed input falls through untouched
    expect(formatIsoDateLabel('garbage')).toBe('garbage');
  });
});
