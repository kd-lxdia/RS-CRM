/**
 * Format number in Indian numbering system (lakhs and crores)
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted string
 */
export function formatIndianNumber(value: number, decimals: number = 0): string {
  const parts = value.toFixed(decimals).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian numbering system: last 3 digits, then groups of 2
  const lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + 
    (otherNumbers ? ',' : '') + lastThree;

  return decimalPart ? `${formatted}.${decimalPart}` : formatted;
}

/**
 * Format currency in Indian Rupees
 * @param value - Amount to format
 * @param showSymbol - Whether to show ₹ symbol (default: true)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export function formatIndianCurrency(
  value: number,
  showSymbol: boolean = true,
  decimals: number = 2
): string {
  const formatted = formatIndianNumber(value, decimals);
  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Format number in lakhs
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with "L" suffix
 */
export function formatLakhs(value: number, decimals: number = 2): string {
  const lakhs = value / 100000;
  return `${formatIndianNumber(lakhs, decimals)}L`;
}

/**
 * Format number in crores
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with "Cr" suffix
 */
export function formatCrores(value: number, decimals: number = 2): string {
  const crores = value / 10000000;
  return `${formatIndianNumber(crores, decimals)}Cr`;
}

/**
 * Format number intelligently (lakhs or crores based on magnitude)
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with appropriate suffix
 */
export function formatIndianNumberShort(value: number, decimals: number = 2): string {
  if (value >= 10000000) {
    // 1 crore or more
    return formatCrores(value, decimals);
  } else if (value >= 100000) {
    // 1 lakh or more
    return formatLakhs(value, decimals);
  } else {
    return formatIndianNumber(value, decimals);
  }
}

/**
 * Format currency intelligently (lakhs or crores based on magnitude)
 * @param value - Amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string with appropriate suffix
 */
export function formatIndianCurrencyShort(value: number, decimals: number = 2): string {
  if (value >= 10000000) {
    // 1 crore or more
    return `₹${formatCrores(value, decimals)}`;
  } else if (value >= 100000) {
    // 1 lakh or more
    return `₹${formatLakhs(value, decimals)}`;
  } else {
    return formatIndianCurrency(value, true, decimals);
  }
}

/**
 * Format date in DD/MM/YYYY format
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatIndianDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format date and time in Indian format
 * @param date - Date to format
 * @returns Formatted date-time string
 */
export function formatIndianDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatIndianDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}
