import { useState } from "react";
import { promptInstall, useInstallState } from "../lib/install";
import { useI18n, type TKey } from "../i18n";

/** Small top-bar button; only shown when the browser says the app can be installed. */
export function InstallButton() {
  const { t } = useI18n();
  const state = useInstallState();
  if (state !== "available") return null;
  return (
    <button type="button" className="install-btn" title={t("install.buttonTitle")} aria-label={t("install.button")}
      onClick={() => { promptInstall(); }}>
      ⬇<span className="install-label">{t("install.button")}</span>
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
      ) : (
        <>
          <p className="muted">{t("install.help")}</p>
          {state === "available"
            ? <button type="button" onClick={install}>⬇ {t("install.button")}</button>
            : <p className="small">{t("install.manual")}</p>}
        </>
      )}
      {result && state !== "installed" && <p className="small">{t(result)}</p>}
    </div>
  );
}
