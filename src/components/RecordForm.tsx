import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ModuleDef } from "../db/modules";
import type { FarmRecord } from "../db/db";
import { useI18n } from "../i18n";
import { fieldLabel, unitLabel } from "../i18n/labels";

interface Props {
  module: ModuleDef;
  initial?: FarmRecord;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
  /** Shown as a destructive row at the bottom when editing an existing entry. */
  onDelete?: () => void;
}

export default function RecordForm({ module, initial, onSave, onCancel, onDelete }: Props) {
  const { t, tOption } = useI18n();
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...(initial ?? {}) }));
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Bring the sheet into view (it opens above the list) and move focus into it. A new entry
  // focuses its first field; an edit focuses the title so phones don't pop the keyboard.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    form.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    const target = initial ? titleRef.current : form.querySelector<HTMLElement>(".field-input");
    target?.focus({ preventScroll: true });
  }, [initial]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean: Record<string, unknown> = {};
    for (const f of module.fields) {
      const v = values[f.key];
      clean[f.key] = f.type === "number" && v !== "" && v != null ? Number(v) : v ?? "";
    }
    onSave(clean);
  };

  const heading = t(initial ? "track.editEntry" : "track.newEntry");

  return (
    <form ref={formRef} className="track-sheet" onSubmit={submit} onKeyDown={onKeyDown} aria-labelledby="track-sheet-title">
      <div className="track-sheet-bar">
        <button type="button" className="btn-plain track-sheet-cancel" onClick={onCancel}>{t("common.cancel")}</button>
        <h2 id="track-sheet-title" ref={titleRef} tabIndex={-1} className="t-headline track-sheet-title">{heading}</h2>
        <button type="submit" className="btn-plain track-sheet-save">{t("common.save")}</button>
      </div>

      <div className="group track-fields">
        {module.fields.map((f) => {
          const v = (values[f.key] ?? "") as string | number;
          const common = { id: f.key, required: f.required, value: v, className: "field-input" };
          return (
            <label key={f.key} htmlFor={f.key} className={`field track-field track-field-${f.type}`}>
              <span className="field-label track-label">
                <span>{fieldLabel(module, f)}</span>
                {f.unit && <span className="track-unit">({unitLabel(f.unit)})</span>}
                {f.required && <span className="track-req">{t("track.required")}</span>}
              </span>
              {f.type === "textarea" ? (
                <textarea {...common} rows={3} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === "select" ? (
                <select {...common} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">—</option>
                  {f.options!.map((o) => <option key={o} value={o}>{tOption(o)}</option>)}
                </select>
              ) : (
                <input {...common} type={f.type} inputMode={f.type === "number" ? "decimal" : undefined} step="any"
                  onChange={(e) => set(f.key, e.target.value)} />
              )}
            </label>
          );
        })}
      </div>

      {onDelete && (
        <div className="group track-sheet-actions">
          <button type="button" className="cell cell-link btn-destructive track-sheet-delete"
            aria-label={t("common.delete")} onClick={onDelete}>
            {t("common.delete")}
          </button>
        </div>
      )}
    </form>
  );
}
