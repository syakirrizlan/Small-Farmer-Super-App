import { splitMessage } from "../lib/charts/spec";
import { useI18n } from "../i18n";
import ChartBlock from "./ChartView";
import Markdown from "./Markdown";

/** Assistant message: formatted text (Markdown) with any ```chart blocks drawn as real charts. */
export default function MessageContent({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const { t } = useI18n();
  const segments = splitMessage(content, streaming);
  return (
    <>
      {segments.map((s, i) =>
        s.kind === "text" ? <Markdown key={i} text={s.text} />
        : s.kind === "chart" ? <ChartBlock key={i} raw={s.raw} />
        : <p key={i} className="asst-chart-note asst-chart-pending">{t("assistant.chartPreparing")}</p>,
      )}
    </>
  );
}
