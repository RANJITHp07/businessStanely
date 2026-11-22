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
  { value: "GROUP", label: "Title (heading with sub-parameters)" },
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

/** Kinds of document a parameter can ask for. Empty selection = any. */
export const FILE_TYPE_GROUPS = [
  { value: "PDF", label: "PDF" },
  { value: "IMAGE", label: "Image (JPG, PNG, GIF, WebP)" },
  { value: "WORD", label: "Word (DOC, DOCX)" },
  { value: "EXCEL", label: "Excel / CSV (XLS, XLSX, CSV)" },
  { value: "TEXT", label: "Text (TXT)" },
] as const;

export type FileTypeGroup = (typeof FILE_TYPE_GROUPS)[number]["value"];
export const MAX_HELP_TEXT_LENGTH = 300;
const FILE_TYPE_SET: ReadonlySet<string> = new Set(FILE_TYPE_GROUPS.map((t) => t.value));

/** How often the client answers a parameter (or fills in a group). */
export const REPEAT_MODES = [
  { value: "NONE", label: "Once" },
  { value: "FIXED", label: "A fixed number of times" },
  { value: "MULTIPLE", label: "As many as the client adds" },
  { value: "COUNT", label: "As many as a number question says" },
] as const;

export type RepeatMode = (typeof REPEAT_MODES)[number]["value"];

/** Hard cap on entries of one repeating parameter, whatever maxEntries says. */
export const MAX_ENTRIES_LIMIT = 50;
/** How many levels of groups may sit inside each other (a top-level group is level 1). */
export const MAX_GROUP_DEPTH = 3;

export const MAX_ATTACHMENTS_LIMIT = 10;
export const MAX_SELECT_OPTIONS = 50;
export const MAX_TITLE_LENGTH = 100;
export const MAX_OPTION_LENGTH = 100;
export const MAX_AREA_TITLE_LENGTH = 120;
export const MAX_AREA_DESCRIPTION_LENGTH = 500;

const TYPE_SET: ReadonlySet<string> = new Set(PARAMETER_TYPES.map((t) => t.value));
const MODE_SET: ReadonlySet<string> = new Set(ATTACHMENT_MODES.map((m) => m.value));
const REPEAT_SET: ReadonlySet<string> = new Set(REPEAT_MODES.map((m) => m.value));
const ICON_SET: ReadonlySet<string> = new Set(PRACTICE_AREA_ICONS.map((i) => i.value));

export function parameterTypeLabel(type: string): string {
  return PARAMETER_TYPES.find((t) => t.value === type)?.label ?? type;
}

export interface PracticeAreaParameterDefinition {
  id: string;
  practiceAreaId: string;
  title: string;
  type: ParameterType;
  /** GROUP only: what the group itself asks for, null = nothing but files. */
  valueType: ParameterType | null;
  required: boolean;
  options: string[];
  attachmentMode: AttachmentMode;
  maxAttachments: number | null;
  helpText: string | null;
  fileTypes: FileTypeGroup[];
  parentId: string | null;
  repeat: RepeatMode;
  countParameterId: string | null;
  maxEntries: number | null;
  sortOrder: number;
}

export type ParameterTree<T> = T & { children: ParameterTree<T>[] };

/** Groups flat rows (any order) into a tree: top-level parameters, each with
    its sub-parameters in display order. A row whose parent is gone is dropped. */
export function buildParameterTree<T extends { id: string; parentId: string | null; sortOrder: number }>(
  rows: T[],
): ParameterTree<T>[] {
  const byId = new Map<string, ParameterTree<T>>(rows.map((row) => [row.id, { ...row, children: [] }]));
  const roots: ParameterTree<T>[] = [];
  for (const row of rows) {
    const node = byId.get(row.id) as ParameterTree<T>;
    if (!row.parentId) roots.push(node);
    else byId.get(row.parentId)?.children.push(node);
  }
  const sort = (list: ParameterTree<T>[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function repeatLabel(repeat: string): string {
  return REPEAT_MODES.find((m) => m.value === repeat)?.label ?? repeat;
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
  /** Entry index of each repeating ancestor and of the parameter itself. */
  path?: number[];
  /** Heading of the group(s) the answer sits in, e.g. "Directors #2". */
  group?: string | null;
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
  valueType: ParameterType | null;
  required: boolean;
  options: string[];
  attachmentMode: AttachmentMode;
  maxAttachments: number | null;
  helpText: string | null;
  fileTypes: FileTypeGroup[];
  repeat: RepeatMode;
  /** Most entries a repeating parameter may have; null = the global cap. */
  maxEntries: number | null;
  /** COUNT only: reference (id or form key) of the sibling NUMBER parameter. */
  countRef: string | null;
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

  // A group can ask for an answer of its own (text, date, files...) above its
  // sub-parameters. "FILE" there just means files only, i.e. no value type.
  let valueType: ParameterType | null = null;
  let groupFilesOnly = false;
  if (type === "GROUP" && typeof body.valueType === "string" && body.valueType) {
    const requested = body.valueType.toUpperCase();
    if (!TYPE_SET.has(requested) || requested === "GROUP") {
      return { ok: false, error: "Choose a valid type for the group's own answer" };
    }
    if (requested === "FILE") groupFilesOnly = true;
    else valueType = requested as ParameterType;
  }
  const inputType = type === "GROUP" ? valueType : type;

  const options: string[] = [];
  if (inputType === "SELECT") {
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
    typeof body.attachmentMode !== "string" ? "DISABLED" : body.attachmentMode.toUpperCase();
  if (type !== "FILE" && !groupFilesOnly && !MODE_SET.has(requestedMode)) {
    return { ok: false, error: "Choose a valid attachment option" };
  }
  const attachmentMode: AttachmentMode = groupFilesOnly
    ? required
      ? "REQUIRED"
      : "OPTIONAL"
    : effectiveAttachmentMode({ type, required, attachmentMode: requestedMode });

  const helpText =
    typeof body.helpText === "string" && body.helpText.trim() ? body.helpText.trim() : null;
  if (helpText && helpText.length > MAX_HELP_TEXT_LENGTH) {
    return { ok: false, error: `Instructions must be ${MAX_HELP_TEXT_LENGTH} characters or fewer` };
  }

  const repeat = typeof body.repeat === "string" ? body.repeat.toUpperCase() : "NONE";
  if (!REPEAT_SET.has(repeat)) return { ok: false, error: "Choose how often it is answered" };

  let maxEntries: number | null = null;
  // For a group: the parameter it belongs to (and, for COUNT, takes its
  // number from). Kept whatever the repeat mode so the form can pair a
  // parameter with its sub-parameter group again.
  let countRef: string | null =
    type === "GROUP" && typeof body.countRef === "string" && body.countRef ? body.countRef : null;
  if (repeat !== "NONE") {
    if (body.maxEntries !== null && body.maxEntries !== undefined && body.maxEntries !== "") {
      const parsedMax = Number(body.maxEntries);
      if (!Number.isInteger(parsedMax) || parsedMax < 1 || parsedMax > MAX_ENTRIES_LIMIT) {
        return {
          ok: false,
          error: `Maximum entries must be a whole number from 1 to ${MAX_ENTRIES_LIMIT}`,
        };
      }
      maxEntries = parsedMax;
    }
    if (repeat === "FIXED" && maxEntries === null) {
      return { ok: false, error: "Enter how many times it is filled in" };
    }
    if (repeat === "COUNT") {
      if (!countRef) {
        return { ok: false, error: "Choose the number question that sets how many entries there are" };
      }
    }
  }

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

  const fileTypes: FileTypeGroup[] = [];
  if (attachmentMode !== "DISABLED" && Array.isArray(body.fileTypes)) {
    for (const entry of body.fileTypes) {
      const value = typeof entry === "string" ? entry.toUpperCase() : "";
      if (!FILE_TYPE_SET.has(value)) return { ok: false, error: "Choose valid file types" };
      if (!fileTypes.includes(value as FileTypeGroup)) fileTypes.push(value as FileTypeGroup);
    }
  }

  return {
    ok: true,
    data: {
      title,
      type: type as ParameterType,
      valueType,
      required,
      options,
      attachmentMode,
      maxAttachments,
      helpText,
      fileTypes,
      repeat: repeat as RepeatMode,
      maxEntries,
      countRef,
    },
  };
}

export const MAX_PARAMETERS_PER_AREA = 50;

/** One entry of the parameter list the create/edit form saves in one go.
    `id` is null for a parameter added in this save. `ref` is how siblings
    point at it (a COUNT parameter's countRef): its id, or the form's key for
    a new one. A GROUP carries its sub-parameters in `children`. */
export interface ParameterListItem extends DefinitionInput {
  id: string | null;
  ref: string;
  children: ParameterListItem[];
}

/**
 * Validates the whole parameter tree sent with a practice area. Order in each
 * list is the order the client portal shows them in.
 */
export function parseParameterList(raw: unknown): Parsed<ParameterListItem[]> {
  const state = { total: 0, refs: new Set<string>(), ids: new Set<string>(), auto: 0 };
  return parseLevel(raw, 1, "Parameter", state);
}

function parseLevel(
  raw: unknown,
  depth: number,
  where: string,
  state: { total: number; refs: Set<string>; ids: Set<string>; auto: number },
): Parsed<ParameterListItem[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Parameters must be a list" };

  const out: ParameterListItem[] = [];
  const titles = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const label = depth === 1 ? `${where} ${i + 1}` : `${where} › ${i + 1}`;
    const entry = raw[i];
    if (!entry || typeof entry !== "object") return { ok: false, error: `${label} is invalid` };
    const body = entry as Record<string, unknown>;

    state.total += 1;
    if (state.total > MAX_PARAMETERS_PER_AREA) {
      return {
        ok: false,
        error: `A parameter area can have at most ${MAX_PARAMETERS_PER_AREA} parameters, sub-parameters included`,
      };
    }

    const parsed = parseDefinitionInput(body);
    if (!parsed.ok) return { ok: false, error: `${label}: ${parsed.error}` };

    const titleKey = parsed.data.title.toLowerCase();
    if (titles.has(titleKey)) {
      return {
        ok: false,
        error:
          depth === 1
            ? `Two parameters are called "${parsed.data.title}"`
            : `Two sub-parameters of "${where}" are called "${parsed.data.title}"`,
      };
    }
    titles.add(titleKey);

    const rawId = body.id;
    const id = typeof rawId === "string" && rawId ? rawId : null;
    if (id) {
      if (state.ids.has(id)) return { ok: false, error: `${label} is listed twice` };
      state.ids.add(id);
    }
    const rawKey = body.key;
    let ref = id ?? (typeof rawKey === "string" && rawKey ? rawKey : "");
    if (!ref) {
      state.auto += 1;
      ref = `auto-${state.auto}`;
    }
    if (state.refs.has(ref)) return { ok: false, error: `${label} is listed twice` };
    state.refs.add(ref);

    let children: ParameterListItem[] = [];
    if (parsed.data.type === "GROUP") {
      const rawChildren = Array.isArray(body.children) ? body.children : [];
      if (rawChildren.length === 0) {
        return { ok: false, error: `${label}: a group needs at least one sub-parameter` };
      }
      if (depth >= MAX_GROUP_DEPTH) {
        return { ok: false, error: `${label}: groups can only be nested ${MAX_GROUP_DEPTH} levels deep` };
      }
      const nested = parseLevel(rawChildren, depth + 1, parsed.data.title, state);
      if (!nested.ok) return nested;
      children = nested.data;
    }

    out.push({ id, ref, ...parsed.data, children });
  }

  // A COUNT parameter points at a number question beside it that is answered once.
  for (const item of out) {
    if (item.repeat !== "COUNT") continue;
    const source = out.find((other) => other.ref === item.countRef || other.id === item.countRef);
    if (!source || source === item) {
      return {
        ok: false,
        error: `"${item.title}": pick another number question in the same list to set how many entries there are`,
      };
    }
    if (source.type !== "NUMBER" || source.repeat !== "NONE") {
      return {
        ok: false,
        error: `"${item.title}": "${source.title}" must be a single Number parameter to set the count`,
      };
    }
  }
  return { ok: true, data: out };
}

/** Every item of a parameter tree with its parent, in save order. */
export function flattenParameterList(
  items: ParameterListItem[],
  parent: ParameterListItem | null = null,
): { item: ParameterListItem; parent: ParameterListItem | null; index: number }[] {
  return items.flatMap((item, index) => [
    { item, parent, index },
    ...flattenParameterList(item.children, item),
  ]);
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
