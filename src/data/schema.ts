import { z } from "zod";

export const MAP_IDS = [
  "ancient",
  "anubis",
  "cache",
  "dust2",
  "inferno",
  "mirage",
  "nuke",
] as const;
export type MapId = (typeof MAP_IDS)[number];

export const SIDES = ["T", "CT"] as const;
export type Side = (typeof SIDES)[number];

export const AREAS = ["A", "B", "Mid", "Other"] as const;
export type Area = (typeof AREAS)[number];

export const MOVEMENTS = ["stand", "crouch", "walk", "run"] as const;
export const CLICKS = ["left", "right", "both"] as const;

export const STATUSES = ["unreviewed", "ok", "broken"] as const;
export type Status = (typeof STATUSES)[number];

export const LEVELS = ["upper", "lower"] as const;
export type Level = (typeof LEVELS)[number];

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRIMMED = /^\S(.*\S)?$/;

export function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const idSchema = z.string().regex(KEBAB, "must be kebab-case (a-z, 0-9 and hyphens)");
export const dateSchema = z.string().refine(isRealDate, "must be a real date written YYYY-MM-DD");

const labelSchema = z
  .string()
  .max(40, "must be at most 40 characters")
  .regex(TRIMMED, "must not be empty or start or end with a space");
const notesSchema = z.string().max(280, "must be at most 280 characters");

export const positionSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  level: z.enum(LEVELS).optional(),
});

export const throwSchema = z.strictObject({
  movement: z.enum(MOVEMENTS),
  jump: z.boolean(),
  click: z.enum(CLICKS),
});

export const videoSchema = z.strictObject({
  url: z.string().refine(isHttpsUrl, "must be an absolute https URL"),
  start: z.number().int().min(0).optional(),
  end: z.number().int().min(1).optional(),
});

export const lineupSchema = z.strictObject({
  id: idSchema,
  name: labelSchema,
  from: labelSchema,
  side: z.enum(SIDES),
  area: z.enum(AREAS),
  throw: throwSchema,
  stand: positionSchema,
  land: positionSchema,
  video: videoSchema,
  notes: notesSchema.optional(),
  status: z.enum(STATUSES),
  checkedOn: dateSchema,
});

export const executeSchema = z.strictObject({
  id: idSchema,
  name: labelSchema,
  side: z.enum(SIDES),
  lineupIds: z.array(idSchema).min(2, "needs at least 2 smokes").max(8, "allows at most 8 smokes"),
  notes: notesSchema.optional(),
});

export const mapFileSchema = z.strictObject({
  map: z.enum(MAP_IDS),
  lineups: z.array(lineupSchema),
  executes: z.array(executeSchema),
});

export type Position = z.infer<typeof positionSchema>;
export type Throw = z.infer<typeof throwSchema>;
export type Video = z.infer<typeof videoSchema>;
export type Lineup = z.infer<typeof lineupSchema>;
export type Execute = z.infer<typeof executeSchema>;
export type MapFile = z.infer<typeof mapFileSchema>;
