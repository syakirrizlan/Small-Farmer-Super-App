import { useState, type CSSProperties } from "react";
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

/** Settings section body: install row (button or status) with explanatory footnotes. */
export function InstallCard() {
  const { t } = useI18n();
  const state = useInstallState();
  const [result, setResult] = useState<TKey | null>(null);

  const install = async () => setResult((await promptInstall()) ? "install.done" : "install.dismissed");
  const installed = state === "installed" || state === "installed-elsewhere";

  return (
    <>
      <ul className="group">
        <li className="cell set-install-row">
          <span className="tile tile-lg set-install-tile" style={{ "--tile": installed ? "var(--green)" : "var(--tint)" } as CSSProperties}>
            <Icon name={installed ? "checkmark" : "download"} />
          </span>
          <span className="cell-body">
            <span className="cell-title t-headline">{t("app.brand")}</span>
            <span className="cell-sub">
              {installed ? t("install.statusInstalled") : state === "available" ? t("install.statusReady") : t("install.statusBrowser")}
            </span>
          </span>
          {state === "available" && (
            <button type="button" className="btn btn-sm" onClick={install}>{t("install.button")}</button>
          )}
        </li>
      </ul>
      {state === "installed" ? (
        <p className="section-foot">{t("install.installed")}</p>
      ) : state === "installed-elsewhere" ? (
        <p className="section-foot">{t("install.installedElsewhere")}</p>
      ) : (
        <>
          <p className="section-foot">{t("install.help")}</p>
          {state !== "available" && <p className="section-foot">{t("install.manual")}</p>}
        </>
      )}
      {result && !installed && <p className="section-foot set-status" role="status">{t(result)}</p>}
    </>
  );
}
