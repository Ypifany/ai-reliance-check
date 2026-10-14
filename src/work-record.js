export const WORK_RECORD_SCHEMA_VERSION = 3;

export const WORK_RECORD_STATUS_OPTIONS = Object.freeze([
  Object.freeze(["in-progress", "Draft or in progress"]),
  Object.freeze(["private", "Private work"]),
  Object.freeze(["ready", "Ready to share"]),
  Object.freeze(["public-prototype", "Public prototype, unfinished"]),
  Object.freeze(["released", "Published or live"]),
  Object.freeze(["retired", "Retired or replaced"]),
]);

export const AI_USE_OPTIONS = Object.freeze([
  Object.freeze(["yes", "AI was used"]),
  Object.freeze(["uncertain", "AI use is uncertain or incomplete"]),
  Object.freeze(["no-ai-reported", "No AI use was reported"]),
]);

export const CONTRIBUTIONS = Object.freeze([
  Object.freeze(["idea", "Originating idea"]),
  Object.freeze(["method", "Core method, argument, or design"]),
  Object.freeze(["sources", "Sources and context"]),
  Object.freeze(["structure", "Structure and organization"]),
  Object.freeze(["production", "Draft or technical production"]),
  Object.freeze(["review", "Reviewed suggestions and decided what to keep, change, or leave out"]),
  Object.freeze(["revision", "Revision and final meaning"]),
  Object.freeze(["verification", "Verification and testing"]),
  Object.freeze(["release", "Final release decision"]),
]);

export const CONTRIBUTION_OPTIONS = Object.freeze([
  Object.freeze(["Human-led", "I did this"]),
  Object.freeze(["Shared", "I did this with AI"]),
  Object.freeze(["AI-reviewed", "AI produced it, then I reviewed and changed it"]),
  Object.freeze(["AI-accepted", "AI produced it, and I accepted it without material change"]),
  Object.freeze(["Other-person", "Another person did this"]),
  Object.freeze(["Unknown", "Unknown"]),
  Object.freeze(["Not applicable", "Not applicable"]),
]);

export const CLAIM_CATEGORY_OPTIONS = Object.freeze([
  Object.freeze(["origination", "Origination"]),
  Object.freeze(["development", "Development of the method or work"]),
  Object.freeze(["direction", "Direction and decisions"]),
  Object.freeze(["evaluation", "Ability to evaluate the work"]),
  Object.freeze(["authorship", "Authorship"]),
  Object.freeze(["other", "Other claim"]),
]);

export const CLAIM_SUPPORT_OPTIONS = Object.freeze([
  Object.freeze(["self-described", "Self-described"]),
  Object.freeze(["documented", "Documented"]),
  Object.freeze(["corroborated", "Corroborated"]),
  Object.freeze(["independently-reviewed", "Independently reviewed"]),
  Object.freeze(["not-established", "Not established"]),
  Object.freeze(["contradicted", "Contradicted"]),
]);

export const EVIDENCE_VISIBILITY_OPTIONS = Object.freeze([
  Object.freeze(["public", "Public"]),
  Object.freeze(["private", "Private"]),
  Object.freeze(["redacted", "Redacted in the public record"]),
]);

export const EVIDENCE_INTEGRITY_OPTIONS = Object.freeze([
  Object.freeze(["unlinked", "Unlinked"]),
  Object.freeze(["version-linked", "Version-linked"]),
  Object.freeze(["tamper-evident", "Tamper-evident"]),
]);

export const EVIDENCE_RELATIONSHIP_OPTIONS = Object.freeze([
  Object.freeze(["unknown", "Choose relationship"]),
  Object.freeze(["supports", "Supports the claim"]),
  Object.freeze(["corroborates", "Corroborates the claim"]),
  Object.freeze(["contradicts", "Contradicts the claim"]),
  Object.freeze(["context", "Provides context only"]),
]);

export const REVIEW_STATUS_OPTIONS = Object.freeze([
  Object.freeze(["self-reviewed", "Self-reviewed"]),
  Object.freeze(["independently-checked", "Independently checked"]),
]);

const WORK_RECORD_STATUSES = new Set(WORK_RECORD_STATUS_OPTIONS.map(([value]) => value));
const AI_USE_VALUES = new Set([...AI_USE_OPTIONS.map(([value]) => value), "unknown"]);
const CONTRIBUTION_VALUES = new Set(CONTRIBUTION_OPTIONS.map(([value]) => value));
const CLAIM_CATEGORIES = new Set(CLAIM_CATEGORY_OPTIONS.map(([value]) => value));
const EVIDENCE_VISIBILITIES = new Set(EVIDENCE_VISIBILITY_OPTIONS.map(([value]) => value));
const EVIDENCE_INTEGRITIES = new Set(EVIDENCE_INTEGRITY_OPTIONS.map(([value]) => value));
const EVIDENCE_RELATIONSHIPS = new Set(EVIDENCE_RELATIONSHIP_OPTIONS.map(([value]) => value));
const REVIEW_STATUSES = new Set(REVIEW_STATUS_OPTIONS.map(([value]) => value));

const LEGACY_CONTRIBUTION_KEYS = Object.freeze({
  idea: ["idea", "Originating idea", "Main idea and purpose", "Purpose and originating idea"],
  method: ["method", "Core method, argument, or design", "Concept development"],
  sources: ["sources", "Sources and context"],
  structure: ["structure", "Structure and organization"],
  production: ["production", "Draft or technical production"],
  review: ["review", "Reviewed suggestions and decided what to keep, change, or leave out", "Evaluation and rejection"],
  revision: ["revision", "Revision and final meaning"],
  verification: ["verification", "Verification and testing"],
  release: ["release", "Final release decision", "Final approval"],
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function oneOf(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function nowISO(now) {
  const supplied = typeof now === "function" ? now() : now;
  if (supplied instanceof Date) return supplied.toISOString();
  if (typeof supplied === "string" && supplied.trim()) return supplied;
  return new Date().toISOString();
}

function defaultId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const SAFE_TOKEN = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/;

function safeGeneratedToken(value, prefix) {
  let candidate = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!/^[A-Za-z]/.test(candidate)) candidate = `${prefix}-${candidate || "id"}`;
  return candidate.slice(0, 128);
}

function idMaker(options = {}) {
  let sequence = 0;
  const used = new Set();
  return (prefix, preferred = "") => {
    const imported = text(preferred);
    if (SAFE_TOKEN.test(imported) && !used.has(imported)) {
      used.add(imported);
      return imported;
    }

    const generated = typeof options.idFactory === "function"
      ? options.idFactory(prefix, sequence++)
      : defaultId(prefix);
    const base = safeGeneratedToken(generated, prefix);
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function referenceMap(sourceItems, normalizedItems) {
  const map = new Map();
  normalizedItems.forEach((item, index) => {
    const importedId = text(sourceItems[index]?.id);
    if (importedId && !map.has(importedId)) map.set(importedId, item.id);
    map.set(item.id, item.id);
  });
  return map;
}

function remapReferences(values, map) {
  return unique(list(values).map(text).map((id) => map.get(id)).filter(Boolean));
}

function normalizeSystem(system, makeId) {
  const value = system && typeof system === "object" ? system : {};
  return {
    id: makeId("system", value.id),
    product: text(value.product || value.name),
    model: text(value.model),
    role: text(value.role),
    setup: text(value.setup),
    evidenceBasis: oneOf(value.evidenceBasis, new Set(["confirmed", "reported", "unknown"]), "unknown"),
    evidence: text(value.evidence),
    modelHistory: oneOf(value.modelHistory, new Set(["complete", "incomplete", "unknown"]), "unknown"),
  };
}

function normalizeContributor(contributor, makeId) {
  const value = contributor && typeof contributor === "object" ? contributor : {};
  return {
    id: makeId("contributor", value.id),
    name: text(value.name),
    role: text(value.role),
    contribution: text(value.contribution || value.credit),
    visibility: oneOf(value.visibility, EVIDENCE_VISIBILITIES, "private"),
  };
}

function normalizeEvidenceItem(item, makeId, defaultVisibility = "private") {
  const value = item && typeof item === "object" ? item : {};
  return {
    id: makeId("evidence", value.id),
    label: text(value.label || value.title),
    description: text(value.description || value.note),
    url: safeHttpUrl(value.url),
    version: text(value.version || value.commit || value.release),
    date: text(value.date),
    visibility: oneOf(value.visibility, EVIDENCE_VISIBILITIES, defaultVisibility),
    integrity: oneOf(value.integrity, EVIDENCE_INTEGRITIES, "unlinked"),
    relationship: oneOf(value.relationship, EVIDENCE_RELATIONSHIPS, "unknown"),
    claimIds: unique(list(value.claimIds || value.supports).map(text)),
  };
}

function normalizeClaim(claim, makeId) {
  const value = claim && typeof claim === "object" ? claim : {};
  // Positive support is calculated from linked evidence and review. Only the
  // two adverse dispositions can be set explicitly, so a record cannot claim
  // independent review merely by selecting a label.
  const explicitSupport = ["not-established", "contradicted"].includes(value.support) ? value.support : "auto";
  return {
    id: makeId("claim", value.id),
    statement: text(value.statement || value.label),
    category: oneOf(value.category, CLAIM_CATEGORIES, "other"),
    evidenceIds: unique(list(value.evidenceIds).map(text)),
    support: explicitSupport,
  };
}

function normalizeReview(review, record, makeId) {
  const value = review && typeof review === "object" ? review : {};
  const legacyReviewerName = text(record.reviewerName);
  const legacyReviewerRole = text(record.reviewerRole);
  const legacyReviewerScope = text(record.reviewerScope);
  const legacyReviewerDate = text(record.reviewerDate);
  const reviewerName = text(value.reviewerName || value.name) || legacyReviewerName;
  const reviewerRole = text(value.reviewerRole || value.role) || legacyReviewerRole;
  const scope = text(value.scope) || legacyReviewerScope;
  const date = text(value.date) || legacyReviewerDate;
  const claimIds = unique(list(value.claimIds).map(text));
  const allClaims = Boolean(value.allClaims);
  const requestedStatus = oneOf(value.status, REVIEW_STATUSES, "self-reviewed");
  const completeIndependentReview = Boolean(
    reviewerName && reviewerRole && scope && date && (allClaims || claimIds.length),
  );

  return {
    id: makeId("review", value.id),
    status: requestedStatus === "independently-checked" && completeIndependentReview
      ? "independently-checked"
      : "self-reviewed",
    reviewerName,
    reviewerRole,
    scope,
    date,
    claimIds,
    allClaims,
    visibility: oneOf(value.visibility, EVIDENCE_VISIBILITIES, "private"),
  };
}

function normalizeFinalDecision(finalDecision, record) {
  const value = finalDecision && typeof finalDecision === "object" ? finalDecision : {};
  return {
    name: text(value.name) || text(record.finalDecisionName || record.accountability),
    role: text(value.role) || text(record.finalDecisionRole),
    date: text(value.date) || text(record.finalDecisionDate),
  };
}

function normalizeContributions(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(CONTRIBUTIONS.map(([key]) => {
    const legacyKeys = LEGACY_CONTRIBUTION_KEYS[key];
    const found = legacyKeys.map((candidate) => source[candidate]).find((candidate) => candidate != null);
    const migrated = found === "AI-led" ? "Unknown" : found;
    return [key, oneOf(migrated, CONTRIBUTION_VALUES, "Unknown")];
  }));
}

function legacyEvidence(record, makeId) {
  const entries = [];
  const addLines = (value, kind) => {
    String(value || "").split("\n").map((line) => line.trim()).filter(Boolean).forEach((line) => {
      const url = safeHttpUrl(line);
      entries.push(normalizeEvidenceItem({
        label: kind === "interaction" ? "AI conversation or work record" : "Supporting record",
        description: url ? "" : line,
        url,
        visibility: "private",
        integrity: "unlinked",
        relationship: "unknown",
      }, makeId, "private"));
    });
  };
  addLines(record.interactionEvidence, "interaction");
  addLines(record.otherEvidence || record.evidenceLinks, "other");
  return entries;
}

function linkClaimsAndEvidence(claims, evidence) {
  const claimIds = new Set(claims.map(({ id }) => id));
  const evidenceIds = new Set(evidence.map(({ id }) => id));
  const evidenceToClaims = new Map(evidence.map((item) => [item.id, item.claimIds.filter((id) => claimIds.has(id))]));

  const linkedClaims = claims.map((claim) => {
    const fromEvidence = evidence.filter((item) => evidenceToClaims.get(item.id).includes(claim.id)).map(({ id }) => id);
    return { ...claim, evidenceIds: unique([...claim.evidenceIds.filter((id) => evidenceIds.has(id)), ...fromEvidence]) };
  });

  const claimToEvidence = new Map(linkedClaims.map((claim) => [claim.id, claim.evidenceIds]));
  const linkedEvidence = evidence.map((item) => ({
    ...item,
    claimIds: unique([
      ...evidenceToClaims.get(item.id),
      ...linkedClaims.filter((claim) => claimToEvidence.get(claim.id).includes(item.id)).map(({ id }) => id),
    ]),
  }));

  return { claims: linkedClaims, evidence: linkedEvidence };
}

export function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function hasSubstantiveEvidence(item) {
  return Boolean(safeHttpUrl(item?.url) || text(item?.description) || text(item?.version));
}

export function createWorkRecord(options = {}) {
  const makeId = idMaker(options);
  const timestamp = nowISO(options.now);
  const recordId = makeId("record", options.id);
  return {
    schemaVersion: WORK_RECORD_SCHEMA_VERSION,
    id: recordId,
    projectId: text(options.projectId),
    status: "in-progress",
    title: "",
    description: "",
    creator: { name: "", role: "" },
    artifact: { url: "", version: "", date: "" },
    voiceRequired: "unknown",
    capabilityDemonstration: "unknown",
    aiUse: "unknown",
    modelHistoryCompleteness: "unknown",
    ideaSource: "",
    humanActions: "",
    aiContributions: "",
    systems: [],
    contributorStatus: "unknown",
    contributors: [],
    publicEvidenceLevel: "selected",
    contributions: normalizeContributions({}),
    claims: [],
    evidence: [],
    review: normalizeReview({}, {}, makeId),
    finalDecision: { name: "", role: "", date: "" },
    outcome: { intended: "", failureScenario: "", failureImpact: "", severity: "" },
    readiness: { workCheckId: "", stage: "", decision: "", checkedAt: "" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeWorkRecord(input = {}, options = {}) {
  const record = input && typeof input === "object" ? input : {};
  const makeId = idMaker(options);
  const timestamp = nowISO(options.now);
  const recordId = makeId("record", record.id || options.id);
  const sourceSchemaVersion = Number(record.schemaVersion) || 1;
  const systemsSource = list(record.systems).length
    ? list(record.systems)
    : (text(record.system) ? [{ product: record.system, setup: record.system }] : []);
  const systems = systemsSource.map((system) => normalizeSystem(system, makeId));
  const contributorSource = list(record.contributors);
  const contributors = contributorSource.map((contributor) => normalizeContributor(contributor, makeId));
  const claimSource = list(record.claims);
  let claims = claimSource.map((claim) => normalizeClaim(claim, makeId));
  const evidenceSource = list(record.evidence);
  let evidence = evidenceSource.length
    ? evidenceSource.map((item) => normalizeEvidenceItem(item, makeId))
    : legacyEvidence(record, makeId);
  const claimIds = referenceMap(claimSource, claims);
  const evidenceIds = referenceMap(evidenceSource.length ? evidenceSource : evidence, evidence);
  claims = claims.map((claim, index) => ({
    ...claim,
    evidenceIds: remapReferences(claimSource[index]?.evidenceIds, evidenceIds),
  }));
  evidence = evidence.map((item, index) => ({
    ...item,
    claimIds: remapReferences(
      evidenceSource.length ? (evidenceSource[index]?.claimIds || evidenceSource[index]?.supports) : item.claimIds,
      claimIds,
    ),
  }));
  const linked = linkClaimsAndEvidence(claims, evidence);
  const creatorValue = record.creator && typeof record.creator === "object" ? record.creator : {};
  const artifactValue = record.artifact && typeof record.artifact === "object" ? record.artifact : {};
  const legacyNotes = [];

  if (sourceSchemaVersion < WORK_RECORD_SCHEMA_VERSION && Object.values(record.contributions || {}).includes("AI-led")) {
    legacyNotes.push("An earlier record used an ambiguous AI-led contribution label. Review that contribution before publishing this record.");
  }
  if (text(record.legacyNotes)) legacyNotes.push(text(record.legacyNotes));

  return {
    schemaVersion: WORK_RECORD_SCHEMA_VERSION,
    sourceSchemaVersion,
    id: recordId,
    projectId: text(record.projectId || options.projectId),
    status: oneOf(record.status, WORK_RECORD_STATUSES, "in-progress"),
    title: text(record.title),
    description: text(record.description),
    creator: {
      name: text(creatorValue.name || record.creatorName),
      role: text(creatorValue.role || record.creatorRole),
    },
    artifact: {
      url: safeHttpUrl(artifactValue.url || record.artifactUrl),
      version: text(artifactValue.version || record.artifactVersion || record.commitId || record.releaseId),
      date: text(artifactValue.date || record.artifactDate),
    },
    voiceRequired: oneOf(record.voiceRequired, new Set(["yes", "partly", "no", "not-applicable", "unknown"]), "unknown"),
    capabilityDemonstration: oneOf(record.capabilityDemonstration, new Set(["yes", "partly", "no", "mixed", "unknown"]), "unknown"),
    aiUse: oneOf(record.aiUse, AI_USE_VALUES, "unknown"),
    modelHistoryCompleteness: oneOf(record.modelHistoryCompleteness, new Set(["complete", "incomplete", "unknown"]), "unknown"),
    ideaSource: text(record.ideaSource),
    humanActions: text(record.humanActions),
    aiContributions: text(record.aiContributions),
    systems,
    contributorStatus: oneOf(record.contributorStatus, new Set(["none", "listed", "unknown"]), "unknown"),
    contributors,
    publicEvidenceLevel: oneOf(record.publicEvidenceLevel, new Set(["selected", "full", "summary", "private"]), "selected"),
    contributions: normalizeContributions(record.contributions),
    claims: linked.claims,
    evidence: linked.evidence,
    review: (() => {
      const review = normalizeReview(record.review, record, makeId);
      return { ...review, claimIds: remapReferences(review.claimIds, claimIds) };
    })(),
    finalDecision: normalizeFinalDecision(record.finalDecision, record),
    outcome: {
      intended: text(record.outcome?.intended),
      failureScenario: text(record.outcome?.failureScenario),
      failureImpact: text(record.outcome?.failureImpact),
      severity: text(record.outcome?.severity),
    },
    readiness: {
      workCheckId: text(record.readiness?.workCheckId || record.projectId),
      stage: text(record.readiness?.stage),
      decision: text(record.readiness?.decision),
      checkedAt: text(record.readiness?.checkedAt),
    },
    legacyNotes: legacyNotes.join("\n"),
    createdAt: text(record.createdAt) || timestamp,
    updatedAt: text(record.updatedAt) || timestamp,
  };
}

function claimFrom(record, claimOrId) {
  if (claimOrId && typeof claimOrId === "object") return claimOrId;
  return record.claims.find(({ id }) => id === claimOrId);
}

function visibleEvidence(evidence, publicOnly) {
  return publicOnly ? evidence.filter(({ visibility }) => visibility !== "private") : evidence;
}

export function getClaimSupport(recordInput, claimOrId, options = {}) {
  const record = normalizeWorkRecord(recordInput, options);
  const claim = claimFrom(record, claimOrId);
  if (!claim || !claim.statement) {
    return { level: "not-established", label: "Not established", evidenceCount: 0, withheldEvidenceCount: 0 };
  }
  if (claim.support === "not-established" || claim.support === "contradicted") {
    const label = claim.support === "contradicted" ? "Contradicted" : "Not established";
    return { level: claim.support, label, evidenceCount: 0, withheldEvidenceCount: 0 };
  }

  const allLinked = record.evidence.filter((item) => claim.evidenceIds.includes(item.id) && hasSubstantiveEvidence(item));
  // A reader can inspect only public evidence. Redacted and private evidence
  // can still preserve an adverse finding, but cannot raise public support.
  const considered = options.publicOnly
    ? allLinked.filter(({ visibility }) => visibility === "public")
    : allLinked;
  const supporting = considered.filter(({ relationship }) => ["supports", "corroborates"].includes(relationship));
  const contradiction = allLinked.some(({ relationship }) => relationship === "contradicts");
  const withheldEvidenceCount = options.publicOnly
    ? allLinked.filter(({ visibility }) => visibility !== "public").length
    : 0;

  if (contradiction || claim.support === "contradicted") {
    return { level: "contradicted", label: "Contradicted", evidenceCount: considered.length, withheldEvidenceCount };
  }

  const review = getReviewStatus(record);
  const independentlyReviewed = review.level === "independently-checked"
    && (record.review.allClaims || record.review.claimIds.includes(claim.id));
  let level = "self-described";
  if (supporting.length) level = "documented";
  if (supporting.length >= 2 && supporting.some(({ relationship }) => relationship === "corroborates")) level = "corroborated";
  if (independentlyReviewed && supporting.length) level = "independently-reviewed";
  return {
    level,
    label: CLAIM_SUPPORT_OPTIONS.find(([value]) => value === level)?.[1] || level,
    evidenceCount: supporting.length,
    withheldEvidenceCount,
  };
}

export function getEvidenceIntegrity(recordInput, options = {}) {
  const record = normalizeWorkRecord(recordInput, options);
  const evidence = visibleEvidence(record.evidence, Boolean(options.publicOnly)).filter(hasSubstantiveEvidence);
  const counts = Object.fromEntries(EVIDENCE_INTEGRITY_OPTIONS.map(([value]) => [value, 0]));
  evidence.forEach(({ integrity }) => { counts[integrity] += 1; });
  if (!evidence.length) return { level: "unlinked", label: "Unlinked", counts, evidenceCount: 0 };

  const rank = { unlinked: 0, "version-linked": 1, "tamper-evident": 2 };
  const level = evidence.reduce((weakest, item) => rank[item.integrity] < rank[weakest] ? item.integrity : weakest, "tamper-evident");
  return {
    level,
    label: EVIDENCE_INTEGRITY_OPTIONS.find(([value]) => value === level)?.[1] || level,
    counts,
    evidenceCount: evidence.length,
  };
}

export function getReviewStatus(recordInput, options = {}) {
  const record = recordInput?.schemaVersion === WORK_RECORD_SCHEMA_VERSION && recordInput?.review
    ? recordInput
    : normalizeWorkRecord(recordInput, options);
  const review = record.review || {};
  const complete = Boolean(
    review.reviewerName
    && review.reviewerRole
    && review.scope
    && review.date
    && (review.allClaims || list(review.claimIds).length),
  );
  const level = review.status === "independently-checked" && complete
    ? "independently-checked"
    : "self-reviewed";
  return {
    level,
    label: level === "independently-checked" ? "Independently checked" : "Self-reviewed",
    complete,
  };
}

export function getWorkRecordCompleteness(recordInput, options = {}) {
  const record = normalizeWorkRecord(recordInput, options);
  const minimumMissing = [];
  const publicMissing = [];

  if (!record.title) minimumMissing.push("Project title");
  if (!record.creator.name) minimumMissing.push("Creator name");
  if (!record.humanActions) minimumMissing.push("What the human did");
  if (!record.claims.some(({ statement }) => statement)) minimumMissing.push("At least one claim");
  if (!Object.values(record.contributions).some((value) => !["Unknown", "Not applicable"].includes(value))) {
    minimumMissing.push("Contribution map");
  }
  if (record.aiUse === "unknown") {
    minimumMissing.push("Whether AI was used");
  } else if (record.aiUse !== "no-ai-reported") {
    if (!record.aiContributions) minimumMissing.push("What AI contributed");
    if (!record.systems.some(({ product, model }) => product || model)) minimumMissing.push("AI product or model");
  }

  publicMissing.push(...minimumMissing);
  if (!record.artifact.url) publicMissing.push("Artifact link");
  if (!record.artifact.version && !record.artifact.date) publicMissing.push("Artifact version, commit, release, or date");
  const mappedEvidence = record.claims.some((claim) => claim.evidenceIds.some((id) => record.evidence.some((item) => (
    item.id === id
    && item.relationship !== "unknown"
    && hasSubstantiveEvidence(item)
  ))));
  if (!mappedEvidence) publicMissing.push("Evidence linked to a claim");
  const isPrivateStage = ["in-progress", "private"].includes(record.status);
  if (!isPrivateStage && !(record.finalDecision.name && record.finalDecision.role && record.finalDecision.date)) {
    publicMissing.push("Final release decision");
  }

  const missing = unique(isPrivateStage ? minimumMissing : publicMissing);
  return {
    complete: missing.length === 0,
    state: missing.length === 0 ? (isPrivateStage ? "draft-complete" : "publishable") : "incomplete",
    missing,
    minimumMissing: unique(minimumMissing),
    publicMissing: unique(publicMissing),
    minimumComplete: minimumMissing.length === 0,
    publicReady: unique(publicMissing).length === 0,
  };
}

export function isWorkRecordComplete(recordInput, options = {}) {
  return getWorkRecordCompleteness(recordInput, options).complete;
}

function publicContributor(contributor) {
  if (contributor.visibility === "redacted") {
    return { id: contributor.id, name: "Redacted contributor", role: "", contribution: "Contribution details are redacted.", visibility: "redacted" };
  }
  return { ...contributor };
}

function publicEvidenceItem(item) {
  if (item.visibility === "redacted") {
    return {
      id: item.id,
      label: "Redacted supporting evidence",
      description: "Details are withheld from the public record.",
      url: "",
      version: "",
      date: "",
      visibility: "redacted",
      integrity: item.integrity,
      relationship: item.relationship === "contradicts" ? "contradicts" : "unknown",
      claimIds: [...item.claimIds],
    };
  }
  return { ...item };
}

export function toPublicWorkRecord(recordInput, options = {}) {
  const record = normalizeWorkRecord(recordInput, options);
  const substantiveEvidence = record.evidence.filter(hasSubstantiveEvidence);
  const publishEvidence = !["summary", "private"].includes(record.publicEvidenceLevel);
  const evidence = publishEvidence
    ? substantiveEvidence
      .filter(({ visibility }) => visibility !== "private")
      .map(publicEvidenceItem)
    : [];
  const allowedEvidenceIds = new Set(evidence.map(({ id }) => id));
  const claims = record.claims.map((claim) => ({
    ...claim,
    support: getClaimSupport(record, claim.id).level === "contradicted" ? "contradicted" : claim.support,
    evidenceIds: claim.evidenceIds.filter((id) => allowedEvidenceIds.has(id)),
  }));
  const reviewStatus = getReviewStatus(record);
  const reviewPublic = record.review.visibility === "public";

  return {
    schemaVersion: WORK_RECORD_SCHEMA_VERSION,
    id: record.id,
    projectId: record.projectId,
    status: record.status,
    title: record.title,
    description: record.description,
    creator: { ...record.creator },
    artifact: { ...record.artifact },
    voiceRequired: record.voiceRequired,
    capabilityDemonstration: record.capabilityDemonstration,
    aiUse: record.aiUse,
    modelHistoryCompleteness: record.modelHistoryCompleteness,
    ideaSource: record.ideaSource,
    humanActions: record.humanActions,
    aiContributions: record.aiContributions,
    systems: record.systems.map(({ id, product, model, role, evidenceBasis, modelHistory }) => ({
      id, product, model, role, evidenceBasis, modelHistory,
    })),
    contributorStatus: record.contributorStatus,
    contributors: record.contributors.filter(({ visibility }) => visibility !== "private").map(publicContributor),
    publicEvidenceLevel: record.publicEvidenceLevel,
    contributions: { ...record.contributions },
    claims,
    evidence,
    evidenceSummary: {
      total: substantiveEvidence.length,
      public: substantiveEvidence.filter(({ visibility }) => visibility === "public").length,
      redacted: substantiveEvidence.filter(({ visibility }) => visibility === "redacted").length,
      private: substantiveEvidence.filter(({ visibility }) => visibility === "private").length,
    },
    review: {
      status: reviewStatus.level,
      reviewerName: reviewPublic ? record.review.reviewerName : "",
      reviewerRole: reviewPublic ? record.review.reviewerRole : "",
      scope: reviewPublic ? record.review.scope : "",
      date: reviewPublic ? record.review.date : "",
      claimIds: [...record.review.claimIds],
      allClaims: record.review.allClaims,
      visibility: record.review.visibility,
    },
    finalDecision: { ...record.finalDecision },
    outcome: { ...record.outcome },
    readiness: { ...record.readiness },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function buildCredits(recordInput, options = {}) {
  const record = normalizeWorkRecord(recordInput, options);
  const human = [];
  if (record.creator.name || record.creator.role || record.humanActions) {
    human.push({
      name: record.creator.name || "Creator not named",
      role: record.creator.role || "Creator",
      credit: record.humanActions || "Human contribution not yet described.",
    });
  }
  record.contributors.forEach((contributor) => {
    if (options.publicOnly && contributor.visibility === "private") return;
    human.push({
      name: contributor.visibility === "redacted" ? "Redacted contributor" : (contributor.name || "Contributor not named"),
      role: contributor.visibility === "redacted" ? "" : contributor.role,
      credit: contributor.visibility === "redacted" ? "Contribution details are redacted." : contributor.contribution,
    });
  });

  const ai = ["no-ai-reported", "unknown"].includes(record.aiUse) ? [] : record.systems.map((system) => ({
    name: [system.product, system.model].filter(Boolean).join(" ") || "AI system not fully identified",
    role: system.role || record.aiContributions || "AI contribution not yet described.",
    evidenceBasis: system.evidenceBasis,
  }));
  if (!["no-ai-reported", "unknown"].includes(record.aiUse) && !ai.length) {
    ai.push({ name: "AI system not fully identified", role: record.aiContributions || "AI contribution not yet described.", evidenceBasis: "unknown" });
  }

  return {
    headline: record.aiUse === "no-ai-reported"
      ? "No AI use was reported. Here are the credits and the evidence."
      : record.aiUse === "unknown"
        ? "AI use was not answered or established. Here are the credits and the evidence."
        : record.aiUse === "uncertain"
          ? "AI use is uncertain or incompletely documented. Here are the credits and the evidence."
          : "Here are the credits and the evidence.",
    human,
    ai,
    finalAuthority: { ...record.finalDecision },
    modelHistoryNote: record.modelHistoryCompleteness === "complete"
      ? "The known AI model history is reported as complete."
      : "The complete AI model history has not been verified.",
  };
}

export function buildDisclosure(recordInput, options = {}) {
  const record = normalizeWorkRecord(recordInput, options);
  if (record.aiUse === "unknown") {
    return "AI disclosure: Whether AI was used has not been answered or established in this Work Record.";
  }
  if (record.aiUse === "no-ai-reported") {
    return "Process note: No AI use was reported in the documented workflow for this work.";
  }
  if (record.aiUse === "uncertain") {
    return "AI disclosure: AI use in this workflow is uncertain or not fully documented. See the Work Record for the evidence currently available.";
  }

  const systems = record.systems.map((system) => [system.product, system.model].filter(Boolean).join(" ")).filter(Boolean);
  const systemText = systems.length ? systems.join(", ") : "an AI system that has not been fully identified";
  const creator = record.creator.name || "The creator";
  const roles = record.systems.map(({ role }) => role).filter(Boolean).join("; ") || record.aiContributions || "the contributions described in the Work Record";
  const decider = record.finalDecision.name || creator;
  const finalDecision = record.finalDecision.name && record.finalDecision.date
    ? ` ${decider} reviewed the documented version and made the final release decision on ${record.finalDecision.date}.`
    : "";
  const modelHistory = record.modelHistoryCompleteness === "complete"
    ? ""
    : " The complete AI model history has not been verified.";
  return `Human + AI disclosure: ${creator} records the human contribution and direction described in the Work Record. ${systemText} assisted with ${roles}.${finalDecision} View the Work Record for credits and selected evidence.${modelHistory}`;
}
