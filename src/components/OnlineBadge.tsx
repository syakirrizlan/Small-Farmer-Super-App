import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

export default function OnlineBadge() {
  const { t } = useI18n();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return <span className={`pill ${online ? "ok" : "warn"}`}>{online ? t("app.online") : t("app.offline")}</span>;
}
