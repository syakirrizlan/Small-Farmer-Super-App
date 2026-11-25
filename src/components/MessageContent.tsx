import { splitMessage } from "../lib/charts/spec";
import { useI18n } from "../i18n";
import ChartBlock from "./ChartView";

/** Assistant message: plain text with any ```chart blocks drawn as real charts. */
export default function MessageContent({ content }: { content: string }) {
  const { t } = useI18n();
  const segments = splitMessage(content);
  if (segments.length === 1 && segments[0].kind === "text") return <>{segments[0].text}</>;
  return (
    <>
      {segments.map((s, i) =>
        s.kind === "text" ? <span key={i} className="asst-text">{s.text}</span>
        : s.kind === "chart" ? <ChartBlock key={i} raw={s.raw} />
        : <p key={i} className="asst-chart-note asst-chart-pending">{t("assistant.chartPreparing")}</p>,
      )}
    </>
  );
}
