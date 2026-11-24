import { useState, type FormEvent } from "react";
import type { ModuleDef } from "../db/modules";
import type { FarmRecord } from "../db/db";

interface Props {
  module: ModuleDef;
  initial?: FarmRecord;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function RecordForm({ module, initial, onSave, onCancel }: Props) {
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

  return (
    <form className="card form" onSubmit={submit}>
      <h3>{initial ? "Edit" : "New"} {module.title.toLowerCase()} entry</h3>
      {module.fields.map((f) => {
        const v = (values[f.key] ?? "") as string | number;
        const common = { id: f.key, required: f.required, value: v };
        return (
          <label key={f.key} htmlFor={f.key}>
            <span>{f.label}{f.unit ? ` (${f.unit})` : ""}{f.required ? " *" : ""}</span>
            {f.type === "textarea" ? (
              <textarea {...common} rows={3} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === "select" ? (
              <select {...common} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">—</option>
                {f.options!.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input {...common} type={f.type} inputMode={f.type === "number" ? "decimal" : undefined} step="any"
                onChange={(e) => set(f.key, e.target.value)} />
            )}
          </label>
        );
      })}
      <div className="row">
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit">Save</button>
      </div>
    </form>
  );
}
