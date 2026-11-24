import { useState, type FormEvent } from "react";
import type { ModuleDef } from "../db/modules";
import type { FarmRecord } from "../db/db";
import { useI18n } from "../i18n";
import { fieldLabel, moduleTitle, unitLabel } from "../i18n/labels";

interface Props {
  module: ModuleDef;
  initial?: FarmRecord;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function RecordForm({ module, initial, onSave, onCancel }: Props) {
  const { t, tOption } = useI18n();
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...(initial ?? {}) }));
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean: Record<string, unknown> = {};
    for (const f of module.fields) {
      const v = values[f.key];
      clean[f.key] = f.type === "number" && v !== "" && v != null ? Number(v) : v ?? "";
    }
    onSave(clean);
  };

  const heading = t(initial ? "track.editEntry" : "track.newEntry", { section: moduleTitle(module) });

  return (
    <form className="track-sheet" onSubmit={submit} aria-labelledby="track-sheet-title">
      <div className="track-sheet-bar">
        <button type="button" className="btn-plain track-sheet-cancel" onClick={onCancel}>{t("common.cancel")}</button>
        <h2 id="track-sheet-title" className="t-headline track-sheet-title">{heading}</h2>
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
    </form>
  );
}
