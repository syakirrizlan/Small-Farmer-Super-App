/**
 * Module registry — the single place that defines what the farmer can track.
 * Each module gets its own IndexedDB table, list page and add/edit form for free.
 * To add a new module (e.g. "Irrigation"), add an entry here and bump the DB version in db.ts.
 */
import type { IconName } from "../components/Icon";

export type FieldType = "text" | "number" | "date" | "select" | "textarea";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  unit?: string;
}

export interface ModuleDef {
  id: string;
  title: string;
  /** Line icon name (see components/Icon.tsx). */
  glyph: IconName;
  /** CSS colour (a token like var(--green)) for the icon tile. */
  color: string;
  description: string;
  titleField: string; // field used as the row headline
  subtitleFields: string[];
  fields: FieldDef[];
}

export const MODULES: ModuleDef[] = [
  {
    id: "plots",
    title: "Plots & Fields",
    glyph: "map",
    color: "var(--brown)",
    description: "Land parcels, beds and greenhouses",
    titleField: "name",
    subtitleFields: ["area", "soil"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "area", label: "Area", type: "number", unit: "acre" },
      { key: "soil", label: "Soil type", type: "select", options: ["Clay", "Loam", "Sandy", "Peat", "Other"] },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "crops",
    title: "Crops",
    glyph: "leaf",
    color: "var(--green)",
    description: "What is planted, where and when",
    titleField: "name",
    subtitleFields: ["status", "plot", "plantedOn"],
    fields: [
      { key: "name", label: "Crop", type: "text", required: true },
      { key: "variety", label: "Variety", type: "text" },
      { key: "plot", label: "Plot", type: "text" },
      { key: "plantedOn", label: "Planted on", type: "date" },
      { key: "expectedHarvest", label: "Expected harvest", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Planned", "Growing", "Harvested", "Failed"] },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "livestock",
    title: "Livestock",
    glyph: "paw",
    color: "var(--orange)",
    description: "Animals, health and breeding",
    titleField: "tag",
    subtitleFields: ["species", "status"],
    fields: [
      { key: "tag", label: "Tag / name", type: "text", required: true },
      { key: "species", label: "Species", type: "select", options: ["Cattle", "Goat", "Sheep", "Chicken", "Duck", "Fish", "Other"] },
      { key: "breed", label: "Breed", type: "text" },
      { key: "birthDate", label: "Birth date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Healthy", "Sick", "Pregnant", "Sold", "Deceased"] },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "tasks",
    title: "Tasks",
    glyph: "check",
    color: "var(--blue)",
    description: "Daily jobs and reminders",
    titleField: "title",
    subtitleFields: ["status", "due"],
    fields: [
      { key: "title", label: "Task", type: "text", required: true },
      { key: "due", label: "Due", type: "date" },
      { key: "category", label: "Category", type: "select", options: ["Planting", "Watering", "Fertilising", "Spraying", "Harvest", "Animals", "Maintenance", "Other"] },
      { key: "status", label: "Status", type: "select", options: ["To do", "In progress", "Done"] },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    glyph: "box",
    color: "var(--indigo)",
    description: "Seeds, feed, fertiliser, tools",
    titleField: "item",
    subtitleFields: ["quantity", "unit", "category"],
    fields: [
      { key: "item", label: "Item", type: "text", required: true },
      { key: "category", label: "Category", type: "select", options: ["Seed", "Fertiliser", "Pesticide", "Feed", "Medicine", "Tool", "Other"] },
      { key: "quantity", label: "Quantity", type: "number" },
      { key: "unit", label: "Unit", type: "text" },
      { key: "reorderAt", label: "Reorder when below", type: "number" },
    ],
  },
  {
    id: "finance",
    title: "Money",
    glyph: "money",
    color: "var(--teal)",
    description: "Income and expenses",
    titleField: "category",
    subtitleFields: ["type", "amount", "date"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "type", label: "Type", type: "select", options: ["Income", "Expense"], required: true },
      { key: "category", label: "Category", type: "text", required: true },
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "note", label: "Note", type: "textarea" },
    ],
  },
  {
    id: "journal",
    title: "Farm Journal",
    glyph: "book",
    color: "var(--purple)",
    description: "Observations, weather, harvest notes",
    titleField: "title",
    subtitleFields: ["date", "kind"],
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "date", label: "Date", type: "date" },
      { key: "kind", label: "Kind", type: "select", options: ["Observation", "Weather", "Harvest", "Pest/Disease", "Other"] },
      { key: "body", label: "Details", type: "textarea" },
    ],
  },
];

export const getModule = (id: string) => MODULES.find((m) => m.id === id);
