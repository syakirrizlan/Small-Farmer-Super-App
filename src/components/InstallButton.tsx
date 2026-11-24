import { useState } from "react";
import { promptInstall, useInstallState } from "../lib/install";
import { useI18n, type TKey } from "../i18n";
import Icon from "./Icon";

/** Install button for the top bar (icon only on phones) or the sidebar (full label). */
export function InstallButton({ variant = "bar" }: { variant?: "bar" | "sidebar" }) {
  const { t } = useI18n();
  const state = useInstallState();
  if (state !== "available") return null;
  return (
    <button type="button" className={`install-btn ${variant === "sidebar" ? "btn-tinted btn-sm" : "icon-btn"}`}
      title={t("install.buttonTitle")} aria-label={t("install.button")} onClick={() => { promptInstall(); }}>
      <Icon name="download" size={variant === "sidebar" ? 18 : 20} />
      {variant === "sidebar" && <span className="install-label">{t("install.button")}</span>}
    </button>
  );
}

/** Settings card: install button, "installed" status, or manual steps. */
export function InstallCard() {
  const { t } = useI18n();
  const state = useInstallState();
  const [result, setResult] = useState<TKey | null>(null);

  const install = async () => setResult((await promptInstall()) ? "install.done" : "install.dismissed");

  return (
    <div className="card">
      {state === "installed" ? (
        <p>{t("install.installed")}</p>
      ) : state === "installed-elsewhere" ? (
        <p>{t("install.installedElsewhere")}</p>
      ) : (
        <>
          <p className="muted">{t("install.help")}</p>
          {state === "available"
            ? <button type="button" onClick={install}>⬇ {t("install.button")}</button>
            : <p className="small">{t("install.manual")}</p>}
        </>
      )}
      {result && state !== "installed" && state !== "installed-elsewhere" && <p className="small">{t(result)}</p>}
    </div>
  );
}
