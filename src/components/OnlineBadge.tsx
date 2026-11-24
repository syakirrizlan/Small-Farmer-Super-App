import { useEffect, useState } from "react";

export default function OnlineBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return <span className={`pill ${online ? "ok" : "warn"}`}>{online ? "Online" : "Offline — saved on device"}</span>;
}
