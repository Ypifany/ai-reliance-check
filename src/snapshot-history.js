export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_HISTORY_SCHEMA_VERSION = 1;

export const FINDING_STATUS = Object.freeze({
  SHOWN_IN_RECORDS: "shown-in-records",
  CONFIRMED_BY_CREATOR: "confirmed-by-creator",
  UNKNOWN: "unknown",
});

export const FINDING_LABELS = Object.freeze({
  [FINDING_STATUS.SHOWN_IN_RECORDS]: "Shown in records",
  [FINDING_STATUS.CONFIRMED_BY_CREATOR]: "Confirmed by creator",
  [FINDING_STATUS.UNKNOWN]: "Unknown",
});

export const AI_SETUP_OPTIONS = Object.freeze([
  "regular-chat",
  "context-enabled-chat",
  "custom-ai",
  "multiple",
  "unknown",
]);

const AI_SETUP_VALUES = new Set(AI_SETUP_OPTIONS);
const INTENT_VALUES = new Set(["intentional", "not-intentional", "unsure", "not-answered"]);
const FINDING_STATUS_VALUES = new Set(Object.values(FINDING_STATUS));
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_HISTORY_BYTES = 2_000_000;
const MAX_SNAPSHOTS = 500;
const MAX_LIST_ITEMS = 100;
const MAX_SHORT_TEXT = 240;
const MAX_SUMMARY_TEXT = 1_000;
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/;

function cleanText(value, maxLength = MAX_SHORT_TEXT) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function list(value) {
  return Array.isArray(value) ? value.slice(0, MAX_LIST_ITEMS) : [];
}

function cleanList(value, maxLength = MAX_SHORT_TEXT) {
  const seen = new Set();
  return list(value)
    .map((item) => cleanText(item, maxLength))
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function suppliedNow(options = {}) {
  const value = typeof options.now === "function" ? options.now() : options.now;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function validDate(value, fallback) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

function safeToken(value, prefix = "snapshot") {
  const supplied = cleanText(value, 128);
  if (SAFE_ID.test(supplied)) return supplied;
  let token = supplied
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!/^[A-Za-z]/.test(token)) token = `${prefix}-${token || "id"}`;
  return token.slice(0, 128);
}

function makeIdFactory(options = {}) {
  let sequence = 0;
  const used = new Set();
  return (prefix, preferred = "") => {
    const supplied = cleanText(preferred, 128);
    if (SAFE_ID.test(supplied) && !used.has(supplied)) {
      used.add(supplied);
      return supplied;
    }

    const generated = typeof options.idFactory === "function"
      ? options.idFactory(prefix, sequence++)
      : globalThis.crypto?.randomUUID
        ? `${prefix}-${globalThis.crypto.randomUUID()}`
        : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const base = safeToken(generated, prefix);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      const ending = `-${suffix++}`;
      candidate = `${base.slice(0, 128 - ending.length)}${ending}`;
    }
    used.add(candidate);
    return candidate;
  };
}

function safeUrl(value) {
  const candidate = cleanText(value, 2_048);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return HTTP_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function normalizeAiSetup(value) {
  const normalized = cleanText(value).toLocaleLowerCase();
  const aliases = {
    "regular chat": "regular-chat",
    "regular-chat": "regular-chat",
    chat: "regular-chat",
    "just this conversation": "regular-chat",
    "context enabled chat": "context-enabled-chat",
    "context-enabled-chat": "context-enabled-chat",
    "saved context": "context-enabled-chat",
    "saved instructions": "context-enabled-chat",
    memory: "context-enabled-chat",
    "custom ai": "custom-ai",
    "custom-ai": "custom-ai",
    "custom gpt": "custom-ai",
    assistant: "custom-ai",
    agent: "custom-ai",
    multiple: "multiple",
    "more than one": "multiple",
    unknown: "unknown",
    "not sure": "unknown",
  };
  const candidate = aliases[normalized] || normalized;
  return AI_SETUP_VALUES.has(candidate) ? candidate : "unknown";
}

function normalizeIntent(value) {
  const normalized = cleanText(value).toLocaleLowerCase();
  const aliases = {
    yes: "intentional",
    intentional: "intentional",
    intended: "intentional",
    no: "not-intentional",
    "not intentional": "not-intentional",
    "not-intentional": "not-intentional",
    unsure: "unsure",
    uncertain: "unsure",
    unknown: "unsure",
    "not answered": "not-answered",
    "not-answered": "not-answered",
  };
  const candidate = aliases[normalized] || normalized;
  return INTENT_VALUES.has(candidate) ? candidate : "not-answered";
}

function normalizeAiSystem(value) {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    product: cleanText(item.product || item.system || item.name),
    model: cleanText(item.model),
  };
}

function aiSystemKey(system) {
  return `${system.product}\u0000${system.model}`.toLocaleLowerCase();
}

function normalizeAiSystems(value) {
  const seen = new Set();
  return list(value)
    .map(normalizeAiSystem)
    .filter((system) => {
      const key = aiSystemKey(system);
      if ((!system.product && !system.model) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function referenceFromString(value) {
  const url = safeUrl(value);
  if (url) return { label: "Linked record", url, summary: "", date: "", version: "", digest: "" };
  // A short filename or record name is a reference. Multiline or long text is
  // likely pasted source content, which snapshots intentionally do not retain.
  if (typeof value !== "string" || value.includes("\n") || value.trim().length > MAX_SHORT_TEXT) return null;
  // Do not turn a rejected protocol into an innocent-looking evidence label.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value.trim())) return null;
  const label = cleanText(value);
  return label ? { label, url: "", summary: "", date: "", version: "", digest: "" } : null;
}

function normalizeReference(value, makeId, prefix = "evidence") {
  const fromString = typeof value === "string" ? referenceFromString(value) : null;
  const item = fromString || (value && typeof value === "object" && !Array.isArray(value) ? value : null);
  if (!item) return null;
  const normalized = {
    id: makeId(prefix, item.id),
    label: cleanText(item.label || item.name || item.title),
    url: safeUrl(item.url || item.href),
    summary: cleanText(item.summary || item.description || item.note, MAX_SUMMARY_TEXT),
    date: cleanText(item.date),
    version: cleanText(item.version || item.commit),
    digest: cleanText(item.digest || item.hash, 256),
  };
  return normalized.label || normalized.url || normalized.summary || normalized.version || normalized.digest
    ? normalized
    : null;
}

function normalizeReferences(value, makeId, prefix) {
  return list(value)
    .map((item) => normalizeReference(item, makeId, prefix))
    .filter(Boolean);
}

function normalizeFindingStatus(value) {
  const normalized = cleanText(value).toLocaleLowerCase();
  const aliases = {
    "shown in records": FINDING_STATUS.SHOWN_IN_RECORDS,
    "shown-in-records": FINDING_STATUS.SHOWN_IN_RECORDS,
    documented: FINDING_STATUS.SHOWN_IN_RECORDS,
    "confirmed by creator": FINDING_STATUS.CONFIRMED_BY_CREATOR,
    "confirmed-by-creator": FINDING_STATUS.CONFIRMED_BY_CREATOR,
    confirmed: FINDING_STATUS.CONFIRMED_BY_CREATOR,
    reported: FINDING_STATUS.CONFIRMED_BY_CREATOR,
    unknown: FINDING_STATUS.UNKNOWN,
    unclear: FINDING_STATUS.UNKNOWN,
  };
  const candidate = aliases[normalized] || normalized;
  return FINDING_STATUS_VALUES.has(candidate) ? candidate : FINDING_STATUS.UNKNOWN;
}

function normalizeFinding(value, makeId) {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const evidenceRefs = cleanList(item.evidenceRefs || item.referenceIds || item.references, 2_048);
  let status = normalizeFindingStatus(item.status || item.basis || item.label);
  // A record-backed finding must point to at least one record. This prevents a
  // label from claiming stronger support than the saved snapshot contains.
  if (status === FINDING_STATUS.SHOWN_IN_RECORDS && evidenceRefs.length === 0) {
    status = FINDING_STATUS.UNKNOWN;
  }
  return {
    id: makeId("finding", item.id),
    topic: cleanText(item.topic || item.key || item.name),
    summary: cleanText(item.summary || item.statement, MAX_SUMMARY_TEXT),
    status,
    label: FINDING_LABELS[status],
    evidenceRefs,
  };
}

function normalizeFindings(value, makeId) {
  return list(value)
    .map((item) => normalizeFinding(item, makeId))
    .filter((item) => item.topic || item.summary);
}

/**
 * Convert a snapshot into the current, storage-safe schema. Unknown fields are
 * discarded. In particular, raw prompts, messages, transcripts, and generated
 * output are never copied into the normalized snapshot.
 */
export function normalizeSnapshot(input = {}, options = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const now = suppliedNow(options);
  const makeId = makeIdFactory(options);
  const preferredId = options.id || source.id;
  const chatReference = normalizeReference(source.chatReference, makeId, "chat");
  const sourceReferences = normalizeReferences(source.sourceReferences, makeId, "source");
  const otherEvidence = normalizeReferences(source.otherEvidence, makeId, "evidence");
  const artifactUrl = safeUrl(source.artifactUrl);
  const githubUrl = safeUrl(source.githubUrl);
  const evidenceKeys = new Set([
    chatReference?.id,
    chatReference?.url,
    ...sourceReferences.flatMap(({ id, url }) => [id, url]),
    ...otherEvidence.flatMap(({ id, url }) => [id, url]),
    githubUrl ? "github" : "",
    githubUrl ? "githubUrl" : "",
    githubUrl,
    artifactUrl ? "artifact" : "",
    artifactUrl ? "artifactUrl" : "",
    artifactUrl,
  ].filter(Boolean));
  const findings = normalizeFindings(source.findings, makeId).map((finding) => {
    if (finding.status !== FINDING_STATUS.SHOWN_IN_RECORDS) return finding;
    const hasLinkedRecord = finding.evidenceRefs.some((reference) => evidenceKeys.has(reference));
    return hasLinkedRecord ? finding : {
      ...finding,
      status: FINDING_STATUS.UNKNOWN,
      label: FINDING_LABELS[FINDING_STATUS.UNKNOWN],
    };
  });

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sourceSchemaVersion: Number.isInteger(source.schemaVersion) ? source.schemaVersion : 0,
    id: makeId("snapshot", preferredId),
    createdAt: validDate(source.createdAt, now),
    projectName: cleanText(source.projectName),
    workType: cleanText(source.workType),
    stage: cleanText(source.stage || "unknown").toLocaleLowerCase() || "unknown",
    artifactUrl,
    aiSystems: normalizeAiSystems(source.aiSystems),
    aiSetup: normalizeAiSetup(source.aiSetup),
    chatReference,
    sourceReferences,
    githubUrl,
    otherEvidence,
    beforeAi: cleanList(source.beforeAi, MAX_SUMMARY_TEXT),
    aiRoles: cleanList(source.aiRoles, MAX_SUMMARY_TEXT),
    humanRoles: cleanList(source.humanRoles, MAX_SUMMARY_TEXT),
    finalAuthority: cleanText(source.finalAuthority, MAX_SUMMARY_TEXT),
    findings,
    intent: normalizeIntent(source.intent),
  };
}

export function createSnapshot(input = {}, options = {}) {
  return normalizeSnapshot(input, options);
}

function comparisonText(value) {
  return cleanText(value, MAX_SUMMARY_TEXT).toLocaleLowerCase();
}

/**
 * Snapshots are comparable when they represent the same named project, or
 * when they represent the same type of work at the same stage. A missing stage
 * is treated as unknown rather than as a mismatch.
 */
export function isComparableSnapshot(a, b) {
  if (!a || !b) return false;
  const left = normalizeSnapshot(a);
  const right = normalizeSnapshot(b);
  const sameNamedProject = comparisonText(left.projectName)
    && comparisonText(left.projectName) === comparisonText(right.projectName);
  if (sameNamedProject) return true;

  const sameWorkType = comparisonText(left.workType)
    && comparisonText(left.workType) === comparisonText(right.workType);
  if (!sameWorkType) return false;
  const leftStage = comparisonText(left.stage);
  const rightStage = comparisonText(right.stage);
  return leftStage === rightStage || leftStage === "unknown" || rightStage === "unknown";
}

export function evidenceCoverage(snapshot) {
  const normalized = normalizeSnapshot(snapshot);
  const counts = {
    [FINDING_STATUS.SHOWN_IN_RECORDS]: 0,
    [FINDING_STATUS.CONFIRMED_BY_CREATOR]: 0,
    [FINDING_STATUS.UNKNOWN]: 0,
  };
  normalized.findings.forEach(({ status }) => {
    counts[status] += 1;
  });
  const totalFindings = normalized.findings.length;
  const coveredFindings = counts[FINDING_STATUS.SHOWN_IN_RECORDS]
    + counts[FINDING_STATUS.CONFIRMED_BY_CREATOR];
  return {
    totalFindings,
    coveredFindings,
    percent: totalFindings ? Math.round((coveredFindings / totalFindings) * 100) : null,
    shownInRecords: counts[FINDING_STATUS.SHOWN_IN_RECORDS],
    confirmedByCreator: counts[FINDING_STATUS.CONFIRMED_BY_CREATOR],
    unknown: counts[FINDING_STATUS.UNKNOWN],
    labels: { ...FINDING_LABELS },
  };
}

function comparableList(values) {
  return cleanList(values, MAX_SUMMARY_TEXT)
    .map((value) => value.toLocaleLowerCase())
    .sort();
}

function displayAiSystems(systems) {
  return normalizeAiSystems(systems).map(({ product, model }) => [product, model].filter(Boolean).join(", "));
}

function listChange(key, label, beforeValues, afterValues) {
  const beforeDisplay = cleanList(beforeValues, MAX_SUMMARY_TEXT);
  const afterDisplay = cleanList(afterValues, MAX_SUMMARY_TEXT);
  const beforeKeys = comparableList(beforeDisplay);
  const afterKeys = comparableList(afterDisplay);
  const beforeMap = new Map(beforeDisplay.map((value) => [value.toLocaleLowerCase(), value]));
  const afterMap = new Map(afterDisplay.map((value) => [value.toLocaleLowerCase(), value]));
  const added = afterKeys.filter((value) => !beforeKeys.includes(value)).map((value) => afterMap.get(value));
  const removed = beforeKeys.filter((value) => !afterKeys.includes(value)).map((value) => beforeMap.get(value));
  return {
    key,
    label,
    changed: added.length > 0 || removed.length > 0,
    before: beforeDisplay,
    after: afterDisplay,
    added,
    removed,
  };
}

function valueChange(key, label, before, after) {
  return {
    key,
    label,
    changed: comparisonText(before) !== comparisonText(after),
    before,
    after,
  };
}

/**
 * Compare two snapshots without producing a human-versus-AI score. The first
 * saved snapshot is treated as a baseline. Later comparisons report only what
 * changed in the relationship and in the supporting record.
 */
export function compareSnapshots(previous, current) {
  const after = normalizeSnapshot(current);
  const afterCoverage = evidenceCoverage(after);
  if (!previous) {
    return {
      baseline: true,
      comparable: false,
      reason: "This is the first snapshot. It is the baseline for future comparisons.",
      previousId: null,
      currentId: after.id,
      changes: [],
      unchanged: [],
      evidenceCoverage: { before: null, after: afterCoverage, delta: null },
      intent: after.intent,
    };
  }

  const before = normalizeSnapshot(previous);
  const beforeCoverage = evidenceCoverage(before);
  if (!isComparableSnapshot(before, after)) {
    return {
      baseline: false,
      comparable: false,
      reason: "These snapshots describe different kinds or stages of work, so a direct comparison could mislead.",
      previousId: before.id,
      currentId: after.id,
      changes: [],
      unchanged: [],
      evidenceCoverage: { before: beforeCoverage, after: afterCoverage, delta: null },
      intent: after.intent,
    };
  }

  const coverageChange = {
    key: "evidence-coverage",
    label: "Basis for findings",
    changed: JSON.stringify(beforeCoverage) !== JSON.stringify(afterCoverage),
    before: beforeCoverage,
    after: afterCoverage,
    delta: beforeCoverage.percent === null || afterCoverage.percent === null
      ? null
      : afterCoverage.percent - beforeCoverage.percent,
  };
  const dimensions = [
    listChange("ai-systems", "AI systems and models", displayAiSystems(before.aiSystems), displayAiSystems(after.aiSystems)),
    valueChange("ai-setup", "What AI started with", before.aiSetup, after.aiSetup),
    listChange("ai-entry-point", "What happened before AI entered", before.beforeAi, after.beforeAi),
    listChange("ai-roles", "What AI did", before.aiRoles, after.aiRoles),
    listChange("human-roles-checking", "What the human did and checked", before.humanRoles, after.humanRoles),
    valueChange("authorization", "What AI could do before human review", before.finalAuthority, after.finalAuthority),
    coverageChange,
  ];
  const changes = dimensions.filter(({ changed }) => changed);

  return {
    baseline: false,
    comparable: true,
    reason: changes.length ? "Something changed." : "No tracked changes were found.",
    previousId: before.id,
    currentId: after.id,
    changes,
    unchanged: dimensions.filter(({ changed }) => !changed).map(({ key }) => key),
    evidenceCoverage: {
      before: beforeCoverage,
      after: afterCoverage,
      delta: coverageChange.delta,
    },
    intent: after.intent,
  };
}

function historySource(value) {
  if (Array.isArray(value)) return { snapshots: value };
  if (value && typeof value === "object") {
    if (Array.isArray(value.snapshots)) return value;
    if (value.projectName || value.workType || value.id) return { snapshots: [value] };
  }
  return { snapshots: [] };
}

function normalizeHistory(value, options = {}) {
  const source = historySource(value);
  if (source.snapshots.length > MAX_SNAPSHOTS) {
    throw new RangeError(`A snapshot history may contain at most ${MAX_SNAPSHOTS} snapshots.`);
  }
  const snapshots = [];
  const indexes = new Map();
  let idSequence = 0;
  const childOptions = {
    ...options,
    id: undefined,
    idFactory: (prefix) => typeof options.idFactory === "function"
      ? options.idFactory(prefix, idSequence++)
      : `${prefix}-${Date.now()}-${idSequence++}-${Math.random().toString(36).slice(2, 8)}`,
  };
  source.snapshots.forEach((snapshot) => {
    const normalized = normalizeSnapshot(snapshot, childOptions);
    const index = indexes.get(normalized.id);
    if (index === undefined) {
      indexes.set(normalized.id, snapshots.length);
      snapshots.push(normalized);
    } else {
      snapshots[index] = normalizeSnapshot({ ...snapshots[index], ...snapshot, id: normalized.id }, childOptions);
    }
  });
  const requestedBaseline = cleanText(source.baselineId, 128);
  const baselineId = snapshots.some(({ id }) => id === requestedBaseline)
    ? requestedBaseline
    : snapshots[0]?.id || null;
  return {
    schemaVersion: SNAPSHOT_HISTORY_SCHEMA_VERSION,
    baselineId,
    snapshots,
  };
}

/**
 * Append a new snapshot. Supplying an existing id updates that snapshot using
 * only the fields supplied, which supports local draft saves without creating
 * duplicate timeline entries.
 */
export function appendSnapshot(history, snapshot, options = {}) {
  const normalizedHistory = normalizeHistory(history, options);
  const source = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {};
  const suppliedId = cleanText(source.id, 128);
  const existingIndex = suppliedId
    ? normalizedHistory.snapshots.findIndex(({ id }) => id === suppliedId)
    : -1;

  if (existingIndex >= 0) {
    const existing = normalizedHistory.snapshots[existingIndex];
    normalizedHistory.snapshots[existingIndex] = normalizeSnapshot(
      { ...existing, ...source, id: existing.id, createdAt: existing.createdAt },
      options,
    );
    return normalizedHistory;
  }

  if (normalizedHistory.snapshots.length >= MAX_SNAPSHOTS) {
    throw new RangeError(`A snapshot history may contain at most ${MAX_SNAPSHOTS} snapshots.`);
  }
  const normalized = normalizeSnapshot(source, options);
  normalizedHistory.snapshots.push(normalized);
  if (!normalizedHistory.baselineId) normalizedHistory.baselineId = normalized.id;
  return normalizedHistory;
}

export function exportSnapshotHistory(history, options = {}) {
  const normalized = normalizeHistory(history, options);
  return JSON.stringify({
    ...normalized,
    exportedAt: suppliedNow(options),
  }, null, 2);
}

export function importSnapshotHistory(value, options = {}) {
  let parsed = value;
  if (typeof value === "string") {
    if (new TextEncoder().encode(value).byteLength > MAX_HISTORY_BYTES) {
      throw new RangeError("The snapshot history file is too large to import safely.");
    }
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new TypeError("The snapshot history is not valid JSON.");
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new TypeError("The snapshot history must be a JSON object or array.");
  }
  const schemaVersion = Array.isArray(parsed) ? 0 : Number(parsed.schemaVersion || 0);
  if (schemaVersion > SNAPSHOT_HISTORY_SCHEMA_VERSION) {
    throw new RangeError("This snapshot history was created by a newer, unsupported schema version.");
  }
  return normalizeHistory(parsed, options);
}
