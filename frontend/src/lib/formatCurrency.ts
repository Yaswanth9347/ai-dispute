export function formatINR(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : Number(value);
  if (isNaN(num)) return '';
  // Use Intl.NumberFormat for India locale
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num);
}
