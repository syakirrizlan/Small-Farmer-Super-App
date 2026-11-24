import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import Icon from "./Icon";

/** Shown only when offline — state appears when it matters. */
export default function OnlineBadge({ long = false }: { long?: boolean }) {
  const { t } = useI18n();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  if (online) return null;
  return (
    <span className="offline-badge" role="status" title={t("app.offline")}>
      <Icon name="wifiOff" size={15} />
      {long ? t("app.offline") : t("app.offlineShort")}
    </span>
  );
}
