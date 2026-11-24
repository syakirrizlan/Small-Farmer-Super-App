/**
 * Line icon set (24px grid, 1.75 stroke, currentColor). Original drawings in a
 * simple system-icon style — use these instead of emoji for all UI icons.
 */
import type { SVGProps } from "react";

const P: Record<string, string> = {
  home: "M3.5 10.5 12 3.75l8.5 6.75M5.75 9v10.25c0 .55.45 1 1 1h3.5v-5.5h3.5v5.5h3.5c.55 0 1-.45 1-1V9",
  grid: "M4 4.75h6.25V11H4zM13.75 4.75H20V11h-6.25zM4 13h6.25v6.25H4zM13.75 13H20v6.25h-6.25z",
  sparkles: "M11 3.5l1.6 4.4 4.4 1.6-4.4 1.6L11 15.5l-1.6-4.4L5 9.5l4.4-1.6zM18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z",
  gear: "M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-2.1 1.2L14.7 20.5h-4l-.3-1.9a7.6 7.6 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7.7 7.7 0 0 1 0-2.4L4.4 9.9l2-3.4 1.9.7a7.6 7.6 0 0 1 2.1-1.2l.3-2h4l.3 2a7.6 7.6 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7.7 7.7 0 0 1 0 2.4z",
  map: "M9 4.5 3.75 6.5v13l5.25-2 6 2 5.25-2v-13L15 6.5zM9 4.5v13M15 6.5v13",
  leaf: "M5 19c0-8 5-13.5 14.25-14.25C19.5 14 14 19 6.5 19zM5 19l7.5-7.5",
  paw: "M7.25 10.5a1.75 2.25 0 1 0 0-.01zM10.25 6.75a1.75 2.25 0 1 0 0-.01zM13.75 6.75a1.75 2.25 0 1 0 0-.01zM16.75 10.5a1.75 2.25 0 1 0 0-.01zM12 12c-2.5 0-5 3.25-5 5.25 0 1.75 1.5 2.25 2.75 2 1-.2 1.5-.6 2.25-.6s1.25.4 2.25.6c1.25.25 2.75-.25 2.75-2C17 15.25 14.5 12 12 12z",
  check: "M12 20.75a8.75 8.75 0 1 0 0-17.5 8.75 8.75 0 0 0 0 17.5zM8.25 12.25l2.5 2.5 5-5.5",
  box: "M3.75 7.5 12 3.5l8.25 4v9L12 20.5l-8.25-4zM3.75 7.5 12 11.5l8.25-4M12 11.5v9M7.9 5.5l8.25 4",
  money: "M3.25 6.75h17.5v10.5H3.25zM12 14.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5zM6.25 9.5v5M17.75 9.5v5",
  book: "M4.75 5.25c2.5-1 5-1 7.25.5 2.25-1.5 4.75-1.5 7.25-.5v13.5c-2.5-1-5-1-7.25.5-2.25-1.5-4.75-1.5-7.25-.5zM12 5.75v13.5",
  chevron: "M9.5 5.5 16 12l-6.5 6.5",
  chevronLeft: "M14.5 5.5 8 12l6.5 6.5",
  plus: "M12 5v14M5 12h14",
  search: "M10.75 17.5a6.75 6.75 0 1 0 0-13.5 6.75 6.75 0 0 0 0 13.5zM15.75 15.75 20 20",
  trash: "M4.75 6.75h14.5M9.25 6.5V4.75h5.5V6.5M6.5 6.75l.9 12.5c.05.55.5 1 1.05 1h7.1c.55 0 1-.45 1.05-1l.9-12.5M10 10.5v6M14 10.5v6",
  send: "M12 19V5.5M6.5 11 12 5.5 17.5 11",
  stop: "M8 8h8v8H8z",
  download: "M12 4v11M7.5 10.75 12 15.25l4.5-4.5M5 19.5h14",
  globe: "M12 20.75a8.75 8.75 0 1 0 0-17.5 8.75 8.75 0 0 0 0 17.5zM3.25 12h17.5M12 3.25c2.4 2.4 3.6 5.3 3.6 8.75S14.4 18.35 12 20.75C9.6 18.35 8.4 15.45 8.4 12S9.6 5.65 12 3.25z",
  key: "M14.5 13.25a4.75 4.75 0 1 0-4.6-3.6L3.75 15.8v4.45H8.2v-2.2h2.2v-2.2h2.2l1.2-1.2zM16.25 7.75h.01",
  lock: "M6.25 10.75h11.5v9.5H6.25zM8.5 10.75V8a3.5 3.5 0 0 1 7 0v2.75M12 14.5v2",
  unlock: "M6.25 10.75h11.5v9.5H6.25zM8.5 10.75V8a3.5 3.5 0 0 1 6.75-1.3M12 14.5v2",
  wifiOff: "M3.5 3.5l17 17M8.6 13.2a5 5 0 0 1 5.2-.9M5.4 10a9.5 9.5 0 0 1 3.4-2.1M12 6.25c3 0 5.8 1.2 7.8 3.25M12 18.75h.01",
  alert: "M12 4 3.25 19.25h17.5zM12 10v4.25M12 16.9h.01",
  clock: "M12 20.75a8.75 8.75 0 1 0 0-17.5 8.75 8.75 0 0 0 0 17.5zM12 7.5V12l3 2",
  calendar: "M4.25 6.25h15.5v13.5H4.25zM4.25 10.25h15.5M8.25 3.75v4M15.75 3.75v4",
  chart: "M4.5 19.5h15M7.25 16v-4.5M12 16V8M16.75 16v-6.5",
  pencil: "M14.75 5.25l4 4L9 19H5v-4zM12.75 7.25l4 4",
  xmark: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  checkmark: "M5.5 12.5l4.25 4.25L18.5 7.5",
  cpu: "M7 7h10v10H7zM10 10h4v4h-4zM9.5 3.75V7M14.5 3.75V7M9.5 17v3.25M14.5 17v3.25M3.75 9.5H7M3.75 14.5H7M17 9.5h3.25M17 14.5h3.25",
  info: "M12 20.75a8.75 8.75 0 1 0 0-17.5 8.75 8.75 0 0 0 0 17.5zM12 11v5.25M12 7.75h.01",
  database: "M12 8.25c4.3 0 7.25-1.25 7.25-2.5S16.3 3.25 12 3.25 4.75 4.5 4.75 5.75s2.95 2.5 7.25 2.5zM4.75 5.75v12.5c0 1.25 2.95 2.5 7.25 2.5s7.25-1.25 7.25-2.5V5.75M4.75 12c0 1.25 2.95 2.5 7.25 2.5s7.25-1.25 7.25-2.5",
  upload: "M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14",
};

export type IconName = keyof typeof P;
export const ICON_NAMES = Object.keys(P) as IconName[];

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  /** Accessible name. Omit for decorative icons (they get aria-hidden). */
  label?: string;
}

export default function Icon({ name, size = 22, label, className, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" className={`icon${className ? ` ${className}` : ""}`}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}
