/** Shared display formatting (Malaysian conventions, follows the app language). */
import { locale } from "../i18n";

/** Ringgit amount, e.g. "RM 1,250" or "RM 1,250.50"; `signed` adds +/− for net figures. */
export function formatMoney(value: unknown, opts: { signed?: boolean } = {}): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  const whole = Number.isInteger(n);
  const s = new Intl.NumberFormat(locale(), {
    style: "currency", currency: "MYR", currencyDisplay: "symbol",
    minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(n);
  // Normalise "RM1,250" → "RM 1,250" and use a true minus sign.
  return s.replace(/RM\s?/, "RM ").replace("-", "−");
}

/** Plain number with locale grouping. */
export const formatNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n) : String(value ?? "");
};
