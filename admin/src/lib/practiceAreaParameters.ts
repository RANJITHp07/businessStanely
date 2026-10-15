/**
 * Practice areas and their parameters: the services the firm offers on the
 * public (blue-theme) website, and the fields a client fills in for them. A
 * visitor only picks practice areas on the "Tell us what you need" form; once
 * signed in to the client portal, they answer the parameters on the request's
 * page.
 *
 * This module is shared by admin pages and admin API routes, so it must stay
 * free of server-only imports such as Prisma. The website validates answers
 * with its own copy of the value rules
 * (business-plus(blue theme)/lib/practiceAreaParameters.ts); the parameter
 * types and attachment modes below must stay in step with that file.
 *
 * Answers live on Enquiry.parameterValues and snapshot the area and parameter
 * titles, so renaming or removing a definition never changes what an existing
 * enquiry shows.
 */

export const PARAMETER_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Long Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "BOOLEAN", label: "Yes / No" },
  { value: "SELECT", label: "Dropdown" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone Number" },
  { value: "FILE", label: "Attachments Only" },
] as const;

export type ParameterType = (typeof PARAMETER_TYPES)[number]["value"];

export const ATTACHMENT_MODES = [
  { value: "DISABLED", label: "Disabled" },
  { value: "OPTIONAL", label: "Optional" },
  { value: "REQUIRED", label: "Required" },
] as const;

export type AttachmentMode = (typeof ATTACHMENT_MODES)[number]["value"];

/** Icons the website can draw on a practice area card. */
export const PRACTICE_AREA_ICONS = [
  { value: "building", label: "Building" },
  { value: "landmark", label: "Landmark" },
  { value: "globe", label: "Globe" },
  { value: "users", label: "People" },
  { value: "receipt", label: "Receipt" },
  { value: "fileText", label: "Document" },
  { value: "trending", label: "Growth" },
  { value: "gavel", label: "Gavel" },
] as const;

export const MAX_ATTACHMENTS_LIMIT = 10;
export const MAX_SELECT_OPTIONS = 50;
export const MAX_TITLE_LENGTH = 100;
export const MAX_OPTION_LENGTH = 100;
export const MAX_AREA_TITLE_LENGTH = 120;
export const MAX_AREA_DESCRIPTION_LENGTH = 500;

const TYPE_SET: ReadonlySet<string> = new Set(PARAMETER_TYPES.map((t) => t.value));
const MODE_SET: ReadonlySet<string> = new Set(ATTACHMENT_MODES.map((m) => m.value));
const ICON_SET: ReadonlySet<string> = new Set(PRACTICE_AREA_ICONS.map((i) => i.value));

export function parameterTypeLabel(type: string): string {
  return PARAMETER_TYPES.find((t) => t.value === type)?.label ?? type;
}

export interface PracticeAreaParameterDefinition {
  id: string;
  practiceAreaId: string;
  title: string;
  type: ParameterType;
  required: boolean;
  options: string[];
  attachmentMode: AttachmentMode;
  maxAttachments: number | null;
  sortOrder: number;
}

export interface ParameterAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

/** Shape stored on Enquiry.parameterValues. */
export interface EnquiryParameterValue {
  practiceAreaId: string;
  practiceAreaTitle: string;
  parameterId: string;
  title: string;
  type: string;
  value: string | null;
  attachments: ParameterAttachment[];
}

/** The attachment mode that actually applies: FILE parameters always take files. */
export function effectiveAttachmentMode(def: {
  type: string;
  required: boolean;
  attachmentMode: string;
}): AttachmentMode {
  if (def.type === "FILE") return def.required ? "REQUIRED" : "OPTIONAL";
  return MODE_SET.has(def.attachmentMode)
    ? (def.attachmentMode as AttachmentMode)
    : "DISABLED";
}

type Parsed<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Practice areas
// ---------------------------------------------------------------------------

export interface PracticeAreaInput {
  title: string;
  description: string | null;
  icon: string;
  active: boolean;
}

export function parsePracticeAreaInput(body: Record<string, unknown>): Parsed<PracticeAreaInput> {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { ok: false, error: "Practice area title is required" };
  if (title.length > MAX_AREA_TITLE_LENGTH) {
    return { ok: false, error: `Title must be ${MAX_AREA_TITLE_LENGTH} characters or fewer` };
  }

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;
  if (description && description.length > MAX_AREA_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Description must be ${MAX_AREA_DESCRIPTION_LENGTH} characters or fewer`,
    };
  }

  const icon = typeof body.icon === "string" && ICON_SET.has(body.icon) ? body.icon : "building";

  return {
    ok: true,
    data: { title, description, icon, active: body.active !== false },
  };
}

/**
 * The list the website shipped with before practice areas moved to the
 * database (business-plus(blue theme)/lib/content.ts, features.items). The
 * Practice Areas page offers to import these while the collection is empty,
 * because the website shows only database areas once any exist.
 */
export const DEFAULT_PRACTICE_AREAS: { icon: string; title: string; description: string }[] = [
  {
    icon: "building",
    title: "Company & LLP incorporation",
    description:
      "Entity formation and post-incorporation registrations, in India and for foreign-owned structures.",
  },
  {
    icon: "landmark",
    title: "RBI & STPI compliances",
    description: "Regulatory filings and periodic returns for regulated and export-oriented entities.",
  },
  {
    icon: "globe",
    title: "FEMA & foreign exchange filings",
    description: "Reporting for inbound and outbound investment and cross-border transactions.",
  },
  {
    icon: "users",
    title: "Labour law compliance",
    description:
      "Registrations, statutory registers and periodic returns under applicable labour legislation.",
  },
  {
    icon: "receipt",
    title: "Taxation advisory",
    description: "Direct and indirect tax positions, filings and representation.",
  },
  {
    icon: "fileText",
    title: "Drafting & document review",
    description: "Commercial contracts, shareholder documents and agreements drafted and reviewed.",
  },
  {
    icon: "trending",
    title: "Corporate investment & M&A",
    description:
      "Transaction structuring, diligence support and documentation for investments and acquisitions.",
  },
  {
    icon: "gavel",
    title: "Company & business litigation",
    description: "Representation in corporate disputes and proceedings before the relevant forums.",
  },
];

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export interface DefinitionInput {
  title: string;
  type: ParameterType;
  required: boolean;
  options: string[];
  attachmentMode: AttachmentMode;
  maxAttachments: number | null;
}

/**
 * Validates and normalizes a parameter definition from a request body.
 * Returns the cleaned definition or a single user-facing error.
 */
export function parseDefinitionInput(body: Record<string, unknown>): Parsed<DefinitionInput> {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { ok: false, error: "Parameter title is required" };
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Parameter title must be ${MAX_TITLE_LENGTH} characters or fewer` };
  }

  const type = typeof body.type === "string" ? body.type.toUpperCase() : "";
  if (!TYPE_SET.has(type)) return { ok: false, error: "Choose a valid parameter type" };

  const required = body.required === true;

  const options: string[] = [];
  if (type === "SELECT") {
    const raw = Array.isArray(body.options) ? body.options : [];
    const seen = new Set<string>();
    for (const entry of raw) {
      if (typeof entry !== "string") continue;
      const option = entry.trim();
      if (!option) continue;
      if (option.length > MAX_OPTION_LENGTH) {
        return { ok: false, error: `Dropdown options must be ${MAX_OPTION_LENGTH} characters or fewer` };
      }
      const key = option.toLowerCase();
      if (seen.has(key)) return { ok: false, error: `Duplicate dropdown option "${option}"` };
      seen.add(key);
      options.push(option);
    }
    if (options.length === 0) return { ok: false, error: "A dropdown needs at least one option" };
    if (options.length > MAX_SELECT_OPTIONS) {
      return { ok: false, error: `A dropdown can have at most ${MAX_SELECT_OPTIONS} options` };
    }
  }

  const requestedMode =
    typeof body.attachmentMode === "string" ? body.attachmentMode.toUpperCase() : "DISABLED";
  if (type !== "FILE" && !MODE_SET.has(requestedMode)) {
    return { ok: false, error: "Choose a valid attachment option" };
  }
  const attachmentMode = effectiveAttachmentMode({ type, required, attachmentMode: requestedMode });

  let maxAttachments: number | null = null;
  if (attachmentMode !== "DISABLED") {
    const parsed = Number(body.maxAttachments);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_ATTACHMENTS_LIMIT) {
      return {
        ok: false,
        error: `Maximum files must be a whole number from 1 to ${MAX_ATTACHMENTS_LIMIT}`,
      };
    }
    maxAttachments = parsed;
  }

  return {
    ok: true,
    data: { title, type: type as ParameterType, required, options, attachmentMode, maxAttachments },
  };
}

export const MAX_PARAMETERS_PER_AREA = 50;

/** One entry of the parameter list the create/edit form saves in one go.
    `id` is null for a parameter added in this save. */
export interface ParameterListItem extends DefinitionInput {
  id: string | null;
}

/**
 * Validates the whole parameter list sent with a practice area. Order in the
 * list is the order the client portal shows them in.
 */
export function parseParameterList(raw: unknown): Parsed<ParameterListItem[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Parameters must be a list" };
  if (raw.length > MAX_PARAMETERS_PER_AREA) {
    return { ok: false, error: `A parameter area can have at most ${MAX_PARAMETERS_PER_AREA} parameters` };
  }

  const out: ParameterListItem[] = [];
  const titles = new Set<string>();
  const ids = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: `Parameter ${i + 1} is invalid` };
    }
    const parsed = parseDefinitionInput(entry as Record<string, unknown>);
    if (!parsed.ok) return { ok: false, error: `Parameter ${i + 1}: ${parsed.error}` };

    const titleKey = parsed.data.title.toLowerCase();
    if (titles.has(titleKey)) {
      return { ok: false, error: `Two parameters are called "${parsed.data.title}"` };
    }
    titles.add(titleKey);

    const rawId = (entry as Record<string, unknown>).id;
    const id = typeof rawId === "string" && rawId ? rawId : null;
    if (id) {
      if (ids.has(id)) return { ok: false, error: `Parameter ${i + 1} is listed twice` };
      ids.add(id);
    }
    out.push({ id, ...parsed.data });
  }
  return { ok: true, data: out };
}

/** Human-readable rendering of a stored answer for read-only views. */
export function formatParameterValue(type: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "BOOLEAN") return value === "true" ? "Yes" : value === "false" ? "No" : value;
  if (type === "DATE" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return value;
}
