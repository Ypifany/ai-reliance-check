import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_USE_OPTIONS,
  EVIDENCE_RELATIONSHIP_OPTIONS,
  WORK_RECORD_SCHEMA_VERSION,
  buildCredits,
  buildDisclosure,
  createWorkRecord,
  getClaimSupport,
  getEvidenceIntegrity,
  getReviewStatus,
  getWorkRecordCompleteness,
  isWorkRecordComplete,
  normalizeWorkRecord,
  safeHttpUrl,
  toPublicWorkRecord,
} from "../src/work-record.js";

const NOW = "2026-10-14T12:00:00.000Z";

function deterministicOptions() {
  let count = 0;
  return {
    now: NOW,
    id: "record-fixed",
    idFactory: (prefix) => `${prefix}-${++count}`,
  };
}

function publishableRecord(overrides = {}) {
  return {
    schemaVersion: 3,
    id: "record-1",
    status: "public-prototype",
    title: "Human + AI Work",
    description: "A public prototype.",
    creator: { name: "Cheryl Abram", role: "Creator" },
    artifact: { url: "https://example.com/work", version: "abc123", date: "2026-10-14" },
    aiUse: "yes",
    modelHistoryCompleteness: "incomplete",
    humanActions: "Originated the method and approved the final work.",
    aiContributions: "Organizing ideas, code, and testing",
    systems: [{ id: "system-1", product: "ChatGPT", model: "5.6 Sol Ultra", role: "Research, drafting, code, and testing" }],
    contributions: { idea: "Human-led", structure: "Shared", production: "Shared", review: "Human-led" },
    claims: [{ id: "claim-1", statement: "Cheryl originated and developed the method.", category: "origination", evidenceIds: ["evidence-1"] }],
    evidence: [{
      id: "evidence-1",
      label: "Development conversation",
      url: "https://example.com/evidence",
      version: "2026-10-14",
      visibility: "public",
      integrity: "version-linked",
      relationship: "supports",
      claimIds: ["claim-1"],
    }],
    review: { status: "self-reviewed" },
    finalDecision: { name: "Cheryl Abram", role: "Creator", date: "2026-10-14" },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

test("createWorkRecord supports deterministic ids and timestamps", () => {
  const record = createWorkRecord(deterministicOptions());

  assert.equal(record.schemaVersion, WORK_RECORD_SCHEMA_VERSION);
  assert.equal(record.id, "record-fixed");
  assert.equal(record.createdAt, NOW);
  assert.equal(record.updatedAt, NOW);
  assert.equal(record.review.id, "review-1");
  assert.deepEqual(record.claims, []);
  assert.deepEqual(record.evidence, []);
});

test("normalization migrates v0.2 fields without inventing authorship claims", () => {
  const legacy = {
    schemaVersion: 2,
    id: "legacy-record",
    title: "Earlier record",
    artifactUrl: "https://example.com/artifact",
    system: "ChatGPT",
    ideaSource: "My notes",
    humanActions: "I directed and reviewed the work.",
    aiContributions: "Drafting",
    interactionEvidence: "https://example.com/chat\nPrivate written note",
    contributions: {
      "Purpose and originating idea": "Human-led",
      "Evaluation and rejection": "AI-led",
    },
    finalDecisionName: "Cheryl Abram",
    finalDecisionRole: "Creator",
    finalDecisionDate: "2026-10-13",
  };

  const record = normalizeWorkRecord(legacy, deterministicOptions());

  assert.equal(record.schemaVersion, 3);
  assert.equal(record.sourceSchemaVersion, 2);
  assert.equal(record.artifact.url, "https://example.com/artifact");
  assert.equal(record.systems[0].product, "ChatGPT");
  assert.equal(record.contributions.idea, "Human-led");
  assert.equal(record.contributions.review, "Unknown");
  assert.match(record.legacyNotes, /ambiguous AI-led/i);
  assert.deepEqual(record.claims, []);
  assert.equal(record.evidence.length, 2);
  assert.ok(record.evidence.every(({ visibility }) => visibility === "private"));
  assert.deepEqual(record.finalDecision, { name: "Cheryl Abram", role: "Creator", date: "2026-10-13" });
  assert.deepEqual(record.creator, { name: "", role: "" });
});

test("normalization links claims and evidence in either direction and removes dangling ids", () => {
  const record = normalizeWorkRecord(publishableRecord({
    claims: [{ id: "claim-1", statement: "A claim", evidenceIds: ["missing"] }],
    evidence: [{ id: "evidence-1", label: "A record", claimIds: ["claim-1", "missing-claim"] }],
  }), deterministicOptions());

  assert.deepEqual(record.claims[0].evidenceIds, ["evidence-1"]);
  assert.deepEqual(record.evidence[0].claimIds, ["claim-1"]);
});

test("public projection omits private evidence and redacts rather than leaks redacted details", () => {
  const record = publishableRecord({
    contributors: [
      { id: "person-public", name: "A Person", role: "Reviewer", contribution: "Reviewed wording", visibility: "public" },
      { id: "person-private", name: "Private Name", role: "Adviser", contribution: "Private advice", visibility: "private" },
      { id: "person-redacted", name: "Secret Name", role: "Expert", contribution: "Secret detail", visibility: "redacted" },
    ],
    claims: [{ id: "claim-1", statement: "A claim", evidenceIds: ["public", "private", "redacted"] }],
    evidence: [
      { id: "public", label: "Public record", description: "Public detail", url: "https://example.com/public", visibility: "public", claimIds: ["claim-1"] },
      { id: "private", label: "Private record", description: "Sensitive detail", url: "https://example.com/private", visibility: "private", claimIds: ["claim-1"] },
      { id: "redacted", label: "Named source", description: "Secret detail", url: "https://example.com/secret", version: "secret-version", visibility: "redacted", claimIds: ["claim-1"] },
    ],
    systems: [{ id: "system", product: "ChatGPT", model: "5.6", role: "Editor", setup: "Contains a private prompt", evidence: "Private system note" }],
  });

  const publicRecord = toPublicWorkRecord(record, deterministicOptions());
  const serialized = JSON.stringify(publicRecord);

  assert.deepEqual(publicRecord.claims[0].evidenceIds, ["public", "redacted"]);
  assert.deepEqual(publicRecord.evidence.map(({ id }) => id), ["public", "redacted"]);
  assert.equal(publicRecord.evidence[1].label, "Redacted supporting evidence");
  assert.equal(publicRecord.evidence[1].url, "");
  assert.deepEqual(publicRecord.contributors.map(({ id }) => id), ["person-public", "person-redacted"]);
  assert.equal(publicRecord.contributors[1].name, "Redacted contributor");
  assert.equal(Object.hasOwn(publicRecord.systems[0], "setup"), false);
  assert.doesNotMatch(serialized, /Sensitive detail|Private Name|Secret Name|secret-version|private prompt|Private system note/i);
});

test("claim support distinguishes self-description, documentation, corroboration, review, and contradiction", () => {
  const base = publishableRecord();
  assert.equal(getClaimSupport({ ...base, evidence: [] }, "claim-1", deterministicOptions()).level, "self-described");
  assert.equal(getClaimSupport(base, "claim-1", deterministicOptions()).level, "documented");

  const corroborated = publishableRecord({
    claims: [{ ...base.claims[0], evidenceIds: ["evidence-1", "evidence-2"] }],
    evidence: [
      base.evidence[0],
      {
        ...base.evidence[0],
        id: "evidence-2",
        url: "https://example.com/independent-evidence",
        relationship: "corroborates",
      },
    ],
  });
  assert.equal(getClaimSupport(corroborated, "claim-1", deterministicOptions()).level, "corroborated");

  const oneSelfMarkedRow = publishableRecord({
    evidence: [{ ...base.evidence[0], relationship: "corroborates" }],
  });
  assert.equal(getClaimSupport(oneSelfMarkedRow, "claim-1", deterministicOptions()).level, "documented");

  const independentlyReviewed = publishableRecord({
    review: {
      status: "independently-checked",
      reviewerName: "Qualified reviewer",
      reviewerRole: "Software engineer",
      scope: "Claim and linked repository history",
      date: "2026-10-14",
      claimIds: ["claim-1"],
    },
  });
  assert.equal(getClaimSupport(independentlyReviewed, "claim-1", deterministicOptions()).level, "independently-reviewed");

  const contradicted = publishableRecord({
    evidence: [{ ...base.evidence[0], relationship: "contradicts" }],
  });
  assert.equal(getClaimSupport(contradicted, "claim-1", deterministicOptions()).level, "contradicted");
});

test("a positive support label cannot bypass the evidence and review checks", () => {
  const record = publishableRecord({
    claims: [{
      id: "claim-1",
      statement: "A claim with no linked evidence",
      support: "independently-reviewed",
      evidenceIds: [],
    }],
    evidence: [],
  });

  const normalized = normalizeWorkRecord(record, deterministicOptions());
  assert.equal(normalized.claims[0].support, "auto");
  assert.equal(getClaimSupport(normalized, "claim-1", deterministicOptions()).level, "self-described");
});

test("public claim support reports withheld evidence without counting it as viewable", () => {
  const record = publishableRecord({
    evidence: [{ ...publishableRecord().evidence[0], visibility: "private" }],
  });

  const support = getClaimSupport(record, "claim-1", { ...deterministicOptions(), publicOnly: true });
  assert.equal(support.level, "self-described");
  assert.equal(support.evidenceCount, 0);
  assert.equal(support.withheldEvidenceCount, 1);
});

test("evidence integrity is conservative and reports all level counts", () => {
  const allVersioned = publishableRecord({
    evidence: [
      { id: "one", label: "One", version: "v1", visibility: "public", integrity: "version-linked" },
      { id: "two", label: "Two", version: "v2", visibility: "public", integrity: "tamper-evident" },
    ],
  });
  const mixed = publishableRecord({
    evidence: [...allVersioned.evidence, { id: "three", label: "Three", description: "A note", visibility: "public", integrity: "unlinked" }],
  });

  assert.equal(getEvidenceIntegrity(allVersioned, deterministicOptions()).level, "version-linked");
  const result = getEvidenceIntegrity(mixed, deterministicOptions());
  assert.equal(result.level, "unlinked");
  assert.deepEqual(result.counts, { unlinked: 1, "version-linked": 1, "tamper-evident": 1 });
});

test("independent review requires a named role, scope, date, and review target", () => {
  const incomplete = publishableRecord({
    review: { status: "independently-checked", reviewerName: "Reviewer", reviewerRole: "Engineer" },
  });
  const complete = publishableRecord({
    review: {
      status: "independently-checked",
      reviewerName: "Reviewer",
      reviewerRole: "Engineer",
      scope: "Code and accessibility",
      date: "2026-10-14",
      allClaims: true,
    },
  });
  const noTarget = publishableRecord({
    review: {
      status: "independently-checked",
      reviewerName: "Reviewer",
      reviewerRole: "Engineer",
      scope: "Code and accessibility",
      date: "2026-10-14",
    },
  });

  assert.deepEqual(getReviewStatus(incomplete, deterministicOptions()), { level: "self-reviewed", label: "Self-reviewed", complete: false });
  assert.deepEqual(getReviewStatus(noTarget, deterministicOptions()), { level: "self-reviewed", label: "Self-reviewed", complete: false });
  assert.deepEqual(getReviewStatus(complete, deterministicOptions()), { level: "independently-checked", label: "Independently checked", complete: true });
});

test("draft completeness does not force a final release decider", () => {
  const draft = publishableRecord({ status: "in-progress", artifact: { url: "", version: "", date: "" }, evidence: [] });
  const released = publishableRecord({ status: "released", finalDecision: { name: "", role: "", date: "" } });

  const draftResult = getWorkRecordCompleteness(draft, deterministicOptions());
  assert.equal(draftResult.complete, true);
  assert.equal(draftResult.state, "draft-complete");
  assert.equal(draftResult.publicReady, false);
  assert.equal(isWorkRecordComplete(draft, deterministicOptions()), true);

  const releasedResult = getWorkRecordCompleteness(released, deterministicOptions());
  assert.equal(releasedResult.complete, false);
  assert.ok(releasedResult.missing.includes("Final release decision"));
});

test("public prototype completeness requires an artifact version and claim-linked evidence", () => {
  const ready = getWorkRecordCompleteness(publishableRecord(), deterministicOptions());
  const noVersion = getWorkRecordCompleteness(publishableRecord({
    artifact: { url: "https://example.com/work", version: "", date: "" },
  }), deterministicOptions());
  const noMappedEvidence = getWorkRecordCompleteness(publishableRecord({ evidence: [] }), deterministicOptions());

  assert.equal(ready.complete, true);
  assert.equal(ready.state, "publishable");
  assert.ok(noVersion.missing.includes("Artifact version, commit, release, or date"));
  assert.ok(noMappedEvidence.missing.includes("Evidence linked to a claim"));
});

test("blank linked evidence cannot document a claim or satisfy public completeness", () => {
  const record = publishableRecord({
    evidence: [{
      id: "evidence-1",
      label: "A label is not evidence by itself",
      visibility: "public",
      integrity: "version-linked",
      relationship: "supports",
      claimIds: ["claim-1"],
    }],
  });

  assert.equal(getClaimSupport(record, "claim-1", deterministicOptions()).level, "self-described");
  assert.equal(getEvidenceIntegrity(record, deterministicOptions()).evidenceCount, 0);
  const completeness = getWorkRecordCompleteness(record, deterministicOptions());
  assert.equal(completeness.complete, false);
  assert.ok(completeness.missing.includes("Evidence linked to a claim"));
  assert.equal(toPublicWorkRecord(record, deterministicOptions()).evidenceSummary.total, 0);
});

test("a private contradiction remains visible as a claim status without exposing the evidence", () => {
  const record = publishableRecord({
    evidence: [{
      id: "evidence-1",
      label: "Private review finding",
      description: "Private contradictory detail",
      visibility: "private",
      relationship: "contradicts",
      claimIds: ["claim-1"],
    }],
  });

  const projected = toPublicWorkRecord(record, deterministicOptions());
  assert.deepEqual(projected.evidence, []);
  assert.equal(projected.claims[0].support, "contradicted");
  assert.equal(getClaimSupport(projected, projected.claims[0].id, { ...deterministicOptions(), publicOnly: true }).level, "contradicted");
  assert.doesNotMatch(JSON.stringify(projected), /Private contradictory detail/);
});

test("redacted evidence is withheld from positive public claim support", () => {
  const base = publishableRecord();
  const record = publishableRecord({
    claims: [{ ...base.claims[0], evidenceIds: ["evidence-1", "evidence-2"] }],
    evidence: [
      base.evidence[0],
      {
        ...base.evidence[0],
        id: "evidence-2",
        url: "https://example.com/redacted",
        visibility: "redacted",
        relationship: "corroborates",
      },
    ],
  });

  const support = getClaimSupport(record, "claim-1", { ...deterministicOptions(), publicOnly: true });
  assert.equal(support.level, "documented");
  assert.equal(support.evidenceCount, 1);
  assert.equal(support.withheldEvidenceCount, 1);

  const projected = toPublicWorkRecord(record, deterministicOptions());
  const redacted = projected.evidence.find(({ id }) => id === "evidence-2");
  assert.equal(redacted.relationship, "unknown");
  assert.equal(getClaimSupport(projected, "claim-1", { ...deterministicOptions(), publicOnly: true }).level, "documented");
});

test("imported claim, evidence, and review ids are remapped to safe tokens with references intact", () => {
  const unsafeClaimId = `claim\" onmouseover=\"alert(1)`;
  const unsafeEvidenceId = `<img src=x onerror=alert(1)>`;
  const unsafeReviewId = `review' data-bad='1`;
  const record = normalizeWorkRecord(publishableRecord({
    claims: [{ id: unsafeClaimId, statement: "A claim", evidenceIds: [unsafeEvidenceId] }],
    evidence: [{
      id: unsafeEvidenceId,
      description: "Substantive evidence",
      relationship: "supports",
      visibility: "public",
      claimIds: [unsafeClaimId],
    }],
    review: {
      id: unsafeReviewId,
      status: "independently-checked",
      reviewerName: "Reviewer",
      reviewerRole: "Engineer",
      scope: "The imported claim",
      date: "2026-10-14",
      claimIds: [unsafeClaimId],
    },
  }), deterministicOptions());

  const safeToken = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/;
  assert.match(record.claims[0].id, safeToken);
  assert.match(record.evidence[0].id, safeToken);
  assert.match(record.review.id, safeToken);
  assert.notEqual(record.claims[0].id, unsafeClaimId);
  assert.notEqual(record.evidence[0].id, unsafeEvidenceId);
  assert.deepEqual(record.claims[0].evidenceIds, [record.evidence[0].id]);
  assert.deepEqual(record.evidence[0].claimIds, [record.claims[0].id]);
  assert.deepEqual(record.review.claimIds, [record.claims[0].id]);
  assert.equal(getClaimSupport(record, record.claims[0].id, deterministicOptions()).level, "independently-reviewed");
});

test("AI use has an internal unknown state and must be answered for completeness", () => {
  const created = createWorkRecord(deterministicOptions());
  const normalized = normalizeWorkRecord({ title: "Imported record" }, deterministicOptions());
  const record = publishableRecord({ aiUse: undefined });

  assert.equal(created.aiUse, "unknown");
  assert.equal(normalized.aiUse, "unknown");
  assert.equal(AI_USE_OPTIONS.some(([value]) => value === "unknown"), false);
  const completeness = getWorkRecordCompleteness(record, deterministicOptions());
  assert.ok(completeness.missing.includes("Whether AI was used"));
  assert.match(buildCredits(record, deterministicOptions()).headline, /not answered or established/i);
  assert.deepEqual(buildCredits(record, deterministicOptions()).ai, []);
  assert.match(buildDisclosure(record, deterministicOptions()), /has not been answered or established/i);
});

test("uncertain AI use stays distinct from a documented AI contribution", () => {
  const record = publishableRecord({ aiUse: "uncertain" });
  assert.match(buildCredits(record, deterministicOptions()).headline, /uncertain or incompletely documented/i);
  assert.doesNotMatch(buildCredits(record, deterministicOptions()).headline, /^Here are the credits/i);
});

test("privacy, evidence relationship, and system evidence basis use conservative defaults", () => {
  const record = normalizeWorkRecord(publishableRecord({
    contributors: [{ id: "person-1", name: "A contributor" }],
    systems: [{ id: "system-1", product: "ChatGPT" }],
    evidence: [{ id: "evidence-1", description: "A note", visibility: "public", claimIds: ["claim-1"] }],
    review: {
      status: "independently-checked",
      reviewerName: "Reviewer",
      reviewerRole: "Engineer",
      scope: "Claim",
      date: "2026-10-14",
      allClaims: true,
    },
  }), deterministicOptions());

  assert.equal(record.contributors[0].visibility, "private");
  assert.equal(record.review.visibility, "private");
  assert.equal(record.systems[0].evidenceBasis, "unknown");
  assert.equal(record.evidence[0].relationship, "unknown");
  assert.deepEqual(EVIDENCE_RELATIONSHIP_OPTIONS[0], ["unknown", "Choose relationship"]);
  assert.equal(getClaimSupport(record, "claim-1", deterministicOptions()).level, "self-described");
  assert.ok(getWorkRecordCompleteness(record, deterministicOptions()).missing.includes("Evidence linked to a claim"));
});

test("credits and disclosure name human and AI roles without a false contribution percentage", () => {
  const record = publishableRecord();
  const credits = buildCredits(record, deterministicOptions());
  const disclosure = buildDisclosure(record, deterministicOptions());

  assert.equal(credits.headline, "Here are the credits and the evidence.");
  assert.equal(credits.human[0].name, "Cheryl Abram");
  assert.equal(credits.ai[0].name, "ChatGPT 5.6 Sol Ultra");
  assert.equal(credits.roles.length, 9);
  assert.equal(credits.roles.find(({ key }) => key === "idea").label, "Originating idea and purpose");
  assert.match(credits.roles.find(({ key }) => key === "idea").credit, /Cheryl Abram led this/i);
  assert.match(credits.roles.find(({ key }) => key === "structure").credit, /Cheryl Abram and ChatGPT 5\.6 Sol Ultra worked on this together/i);
  assert.match(credits.roles.find(({ key }) => key === "verification").credit, /not established/i);
  assert.match(credits.modelHistoryNote, /has not been verified/i);
  assert.match(disclosure, /ChatGPT 5\.6 Sol Ultra assisted with research, drafting, code, and testing/i);
  assert.match(disclosure, /Cheryl Abram records the human contribution/i);
  assert.match(disclosure, /made the final release decision/i);
  assert.doesNotMatch(JSON.stringify({ credits, disclosure }), /\d+%/);
});

test("role credits do not guess which listed person handled an other-person contribution", () => {
  const record = publishableRecord({
    contributions: { production: "Other-person" },
    contributors: [
      { id: "person-1", name: "Developer One", role: "Developer", contribution: "Built the interface", visibility: "public" },
      { id: "person-2", name: "Developer Two", role: "Reviewer", contribution: "Reviewed the code", visibility: "public" },
    ],
  });
  const production = buildCredits(record, deterministicOptions()).roles.find(({ key }) => key === "production");

  assert.match(production.credit, /another human contributor/i);
  assert.doesNotMatch(production.credit, /Developer One|Developer Two/);
});

test("safeHttpUrl rejects unsafe and non-web protocols", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("file:///tmp/private"), "");
  assert.equal(safeHttpUrl("not a url"), "");
  assert.equal(safeHttpUrl("https://example.com/a"), "https://example.com/a");
});

test("summary-only and private public records do not expose evidence details", () => {
  const record = publishableRecord({
    publicEvidenceLevel: "summary",
    evidence: [{
      id: "evidence-1",
      label: "SECRET_LABEL",
      description: "SECRET_DESCRIPTION",
      url: "https://example.com/private-token",
      visibility: "public",
      relationship: "supports",
      integrity: "version-linked",
      claimIds: ["claim-1"],
    }],
  });
  const projected = toPublicWorkRecord(record, deterministicOptions());
  assert.deepEqual(projected.evidence, []);
  assert.equal(projected.evidenceSummary.total, 1);
  assert.doesNotMatch(JSON.stringify(projected), /SECRET_LABEL|SECRET_DESCRIPTION|private-token/);
});

test("Load Test outcome and readiness context survive normalization and public projection", () => {
  const record = publishableRecord({
    outcome: { intended: "Useful learning", failureScenario: "Bad guidance", failureImpact: "Wasted time", severity: "moderate" },
    readiness: { workCheckId: "check-1", stage: "release", decision: "Supported with named conditions", checkedAt: NOW },
  });
  const normalized = normalizeWorkRecord(record, deterministicOptions());
  const projected = toPublicWorkRecord(normalized, deterministicOptions());
  assert.equal(normalized.outcome.failureScenario, "Bad guidance");
  assert.equal(projected.readiness.workCheckId, "check-1");
  assert.equal(projected.readiness.decision, "Supported with named conditions");
});
