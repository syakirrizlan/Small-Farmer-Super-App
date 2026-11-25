/**
 * Draws a validated chart block in the app's own style (inline SVG, theme tokens, no library).
 * Records charts are computed live from IndexedDB; AI charts are labelled as estimates.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { runQuery, type QueryResult } from "../lib/charts/query";
import { parseChartSpec, type ChartSpec, type DataPoint } from "../lib/charts/spec";
import { formatMoney, formatNumber } from "../lib/format";
import { useI18n } from "../i18n";
import Icon from "./Icon";

const PALETTE = ["var(--tint)", "var(--blue)", "var(--orange)", "var(--purple)", "var(--teal)", "var(--indigo)", "var(--brown)", "var(--gray)"];
const W = 320;

export default function ChartBlock({ raw }: { raw: string }) {
  const { t } = useI18n();
  const spec = parseChartSpec(raw);
  if (!spec) return <p className="asst-chart-note">{t("assistant.chartError")}</p>;
  return <ChartCard spec={spec} />;
}

function ChartCard({ spec }: { spec: ChartSpec }) {
  const { t, lang } = useI18n();
  const records = spec.source === "records";
  const result = useLiveQuery<QueryResult | null>(
    () => (records ? runQuery(spec.query) : Promise.resolve(null)),
    [JSON.stringify(spec), lang],
  );
  const data: DataPoint[] | undefined = records ? result?.points : spec.data;
  const unit = (records ? result?.unit : undefined) ?? spec.unit;
  const fmt = (v: number) => (unit === "RM" ? formatMoney(v) : `${formatNumber(v)}${unit ? ` ${unit}` : ""}`);
  const empty = data && (data.length === 0 || data.every((p) => p.value === 0));
  const summary = data ? `${spec.title}: ${data.map((p) => `${p.label} ${fmt(p.value)}`).join(", ")}` : spec.title;

  return (
    <figure className="asst-chart">
      <figcaption className="asst-chart-head">
        <span className="asst-chart-title">{spec.title}</span>
        {records
          ? <span className="badge badge-green"><Icon name="checkmark" size={12} />{t("assistant.chartFromRecords")}</span>
          : <span className="badge badge-orange"><Icon name="sparkles" size={12} />{t("assistant.chartEstimate")}</span>}
      </figcaption>
      {!data ? <div className="asst-chart-loading" aria-hidden="true" />
        : empty ? <p className="asst-chart-note">{t("assistant.chartNoData")}</p>
        : <div className="asst-chart-svg" role="img" aria-label={summary}>{draw(spec.type, data, fmt, records && !!result?.time)}</div>}
    </figure>
  );
}

function draw(type: ChartSpec["type"], data: DataPoint[], fmt: (v: number) => string, time: boolean) {
  if (type === "line") return <Line data={data} fmt={fmt} />;
  if (type === "donut") return <Donut data={data} fmt={fmt} />;
  if (type === "progress") return <Progress data={data} fmt={fmt} />;
  return time || data.length > 8 ? <Columns data={data} fmt={fmt} /> : <Bars data={data} fmt={fmt} />;
}

type P = { data: DataPoint[]; fmt: (v: number) => string };
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Horizontal bars — categories. */
function Bars({ data, fmt }: P) {
  const rowH = 30, left = 86, right = 82, H = data.length * rowH + 4;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {data.map((d, i) => {
        const y = i * rowH + 4, w = Math.max(((W - left - right) * Math.abs(d.value)) / max, 2);
        return (
          <g key={i}>
            <text x={left - 8} y={y + 15} textAnchor="end" className="c-label">{clip(d.label, 14)}</text>
            <rect x={left} y={y + 3} width={W - left - right} height={17} rx={5} className="c-track" />
            <rect x={left} y={y + 3} width={w} height={17} rx={5} style={{ fill: d.value < 0 ? "var(--red)" : PALETTE[0] }} />
            <text x={W} y={y + 16} textAnchor="end" className="c-val">{fmt(d.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const short = (v: number) => (Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : `${+v.toFixed(1)}`);

/** Vertical columns — time buckets or many categories. */
function Columns({ data, fmt }: P) {
  const H = 170, l = 38, r = 6, t = 18, b = 24;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const y = (v: number) => t + (H - t - b) * (1 - Math.max(v, 0) / max);
  const step = (W - l - r) / data.length, bw = Math.min(28, step * 0.64);
  const every = Math.ceil(data.length / 7);
  const last = data.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {[0, max / 2, max].map((v) => (
        <g key={v}><line x1={l} x2={W - r} y1={y(v)} y2={y(v)} className="c-grid" /><text x={l - 6} y={y(v) + 4} textAnchor="end" className="c-label">{short(v)}</text></g>
      ))}
      {data.map((d, i) => {
        const cx = l + step * i + step / 2;
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={y(d.value)} width={bw} height={Math.max(y(0) - y(d.value), 1)} rx={4}
              style={{ fill: PALETTE[0], opacity: i === last ? 1 : 0.55 }} />
            {(i % every === 0 || i === last) && <text x={cx} y={H - 7} textAnchor="middle" className="c-label">{clip(d.label, 7)}</text>}
          </g>
        );
      })}
      <text x={Math.min(l + step * last + step / 2, W - 30)} y={Math.max(y(data[last].value) - 5, 11)} textAnchor="middle" className="c-val">{fmt(data[last].value)}</text>
    </svg>
  );
}

/** Line with soft area — trends. */
function Line({ data, fmt }: P) {
  const H = 170, l = 38, r = 14, t = 20, b = 24;
  const lo = Math.min(0, ...data.map((d) => d.value));
  const hi = niceMax(Math.max(...data.map((d) => d.value), 0) - lo) + lo;
  const x = (i: number) => (data.length === 1 ? (l + W - r) / 2 : l + ((W - l - r) * i) / (data.length - 1));
  const y = (v: number) => t + (H - t - b) * (1 - (v - lo) / (hi - lo || 1));
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const last = data.length - 1, every = Math.ceil(data.length / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}><line x1={l} x2={W - r} y1={y(v)} y2={y(v)} className="c-grid" /><text x={l - 6} y={y(v) + 4} textAnchor="end" className="c-label">{short(v)}</text></g>
      ))}
      {data.map((d, i) => (i % every === 0 || i === last) && <text key={i} x={x(i)} y={H - 7} textAnchor="middle" className="c-label">{clip(d.label, 7)}</text>)}
      <polygon points={`${x(0)},${y(lo)} ${pts} ${x(last)},${y(lo)}`} style={{ fill: PALETTE[0], opacity: 0.13 }} />
      <polyline points={pts} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: PALETTE[0] }} />
      <circle cx={x(last)} cy={y(data[last].value)} r={4.5} style={{ fill: PALETTE[0] }} />
      <text x={x(last) - 8} y={Math.max(y(data[last].value) - 9, 11)} textAnchor="end" className="c-val">{fmt(data[last].value)}</text>
    </svg>
  );
}

function topParts(data: DataPoint[], n: number): DataPoint[] {
  const pos = data.filter((d) => d.value > 0);
  if (pos.length <= n) return pos;
  const sorted = [...pos].sort((a, b) => b.value - a.value);
  return [...sorted.slice(0, n - 1), { label: "…", value: sorted.slice(n - 1).reduce((s, d) => s + d.value, 0) }];
}

/** Donut — parts of a whole (max 6). */
function Donut({ data, fmt }: P) {
  const parts = topParts(data, 6), total = parts.reduce((s, d) => s + d.value, 0) || 1;
  const R = 48, C = 2 * Math.PI * R, H = Math.max(124, parts.length * 32 + 12);
  let off = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <g transform={`translate(66 ${H / 2}) rotate(-90)`}>
        {parts.map((d, i) => {
          const len = (C * d.value) / total, gap = parts.length > 1 ? 2.5 : 0;
          const el = <circle key={i} r={R} fill="none" strokeWidth={17} strokeDasharray={`${Math.max(len - gap, 0.5)} ${C}`} strokeDashoffset={-off} style={{ stroke: PALETTE[i % PALETTE.length] }} />;
          off += len;
          return el;
        })}
      </g>
      {parts.map((d, i) => {
        const y = H / 2 - (parts.length * 32) / 2 + i * 32 + 12;
        return (
          <g key={i}>
            <rect x={136} y={y - 9} width={10} height={10} rx={3} style={{ fill: PALETTE[i % PALETTE.length] }} />
            <text x={152} y={y} className="c-label">{clip(d.label, 18)} · {Math.round((d.value / total) * 100)}%</text>
            <text x={152} y={y + 15} className="c-val">{fmt(d.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Stacked bar — status counts. */
function Progress({ data, fmt }: P) {
  const parts = topParts(data, 6), total = parts.reduce((s, d) => s + d.value, 0) || 1;
  const rows = Math.ceil(parts.length / 2), H = 44 + rows * 22;
  let x = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <text x={0} y={14} className="c-val">{fmt(parts[0]?.value ?? 0)} / {fmt(total)}</text>
      {parts.map((d, i) => {
        const w = ((W - 2) * d.value) / total;
        const el = <rect key={i} x={x} y={24} width={Math.max(w - 2.5, 2)} height={14} rx={5} style={{ fill: PALETTE[i % PALETTE.length] }} />;
        x += w;
        return el;
      })}
      {parts.map((d, i) => (
        <g key={`l${i}`} transform={`translate(${(i % 2) * 160} ${54 + Math.floor(i / 2) * 22})`}>
          <rect y={-9} width={10} height={10} rx={3} style={{ fill: PALETTE[i % PALETTE.length] }} />
          <text x={16} y={0} className="c-label">{clip(d.label, 14)} · {fmt(d.value)}</text>
        </g>
      ))}
    </svg>
  );
}
