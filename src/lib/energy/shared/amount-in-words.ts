// Converts a rupee amount into words using the Indian numbering system
// (Lakh/Crore, not Million/Billion) — the convention Indian tax invoices are
// printed with, e.g. 733997 -> "Seven Lakh Thirty Three Thousand Nine Hundred
// Ninety Seven".

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return [TENS[tens], ONES[ones]].filter(Boolean).join(" ");
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

// Splits into Crore / Lakh / Thousand / Hundred groups (2-2-3 digit grouping,
// not the 3-3-3 grouping Million/Billion numbering uses).
function integerToWords(n: number): string {
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(" ");
}

// `unit`/`subunit` name the whole/fractional parts (default Rupees/Paise) so
// this can also render a plain quantity or a different currency if ever
// needed — every current caller uses the defaults.
export function amountInWords(
  amount: number,
  { unit = "Rupees", subunit = "Paise" }: { unit?: string; subunit?: string } = {}
): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const whole = Math.floor(rounded);
  const fraction = Math.round((rounded - whole) * 100);

  const wholeWords = `${integerToWords(whole)} ${unit}`;
  if (fraction === 0) return `${wholeWords} Only`;
  return `${wholeWords} and ${integerToWords(fraction)} ${subunit} Only`;
}
