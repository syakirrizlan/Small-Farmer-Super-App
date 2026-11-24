/** Translated display names for registry items (modules, fields, providers). */
import type { FieldDef, ModuleDef } from "../db/modules";
import type { ProviderDef } from "../lib/providers";
import { tDynamic } from "./index";

export const moduleTitle = (m: ModuleDef) => tDynamic(`modules.${m.id}.title`, m.title);
export const moduleDescription = (m: ModuleDef) => tDynamic(`modules.${m.id}.description`, m.description);
export const fieldLabel = (m: ModuleDef, f: FieldDef) => tDynamic(`modules.${m.id}.fields.${f.key}`, f.label);
export const unitLabel = (unit: string) => tDynamic(`units.${unit}`, unit);
export const providerName = (p: ProviderDef) => tDynamic(`providers.${p.id}.name`, p.name);
export const providerKeyPlaceholder = (p: ProviderDef) => tDynamic(`providers.${p.id}.keyPlaceholder`, p.keyPlaceholder);
export const providerNote = (p: ProviderDef) => tDynamic(`providers.${p.id}.note`, p.note ?? "") || undefined;
