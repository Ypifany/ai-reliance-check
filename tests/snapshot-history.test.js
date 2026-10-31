import test from "node:test";
import assert from "node:assert/strict";

import {
  FINDING_LABELS,
  FINDING_STATUS,
  SNAPSHOT_HISTORY_SCHEMA_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  appendSnapshot,
  compareSnapshots,
  createSnapshot,
  evidenceCoverage,
  exportSnapshotHistory,
  importSnapshotHistory,
  isComparableSnapshot,
  isProjectBaseline,
  normalizeSnapshot,
} from "../src/snapshot-history.js";

const JANUARY = "2026-01-15T12:00:00.000Z";
const APRIL = "2026-04-15T12:00:00.000Z";

function deterministicOptions(now = JANUARY) {
  let count = 0;
  return {
    now,
    idFactory: (prefix) => `${prefix}-${++count}`,
  };
}

function writerSnapshot(overrides = {}) {
  return {
    id: "snapshot-january",
    projectId: "project-monthly-essay",
    createdAt: JANUARY,
    creatorName: "Avery Writer",
    projectName: "Monthly essay",
    workType: "Published writing",
    stage: "release",
    artifactUrl: "https://example.com/essay",
    aiSystems: [{ product: "ChatGPT", model: "6.1 Sol" }],
    aiSetup: "regular-chat",
    startingContext: ["nothing-added"],
    addedContext: ["conversation", "documents"],
    accessLevel: "chat-only",
    approvalMode: "no-external-actions",
    connectedTools: [],
    chatReferences: [{ id: "chat-1", label: "Writing conversation", url: "https://example.com/chat" }],
    sourceReferences: [{ id: "source-1", label: "Interview notes", version: "January" }],
    githubUrl: "",
    otherEvidence: [],
    beforeAi: ["Researched the topic", "Outlined the article", "Wrote the first draft"],
    aiRoles: ["Challenged ideas", "Edited the draft"],
    humanRoles: ["Verified every source", "Revised the final language", "Approved publication"],
    finalAuthority: "The writer approved publication. AI could not publish.",
    findings: [
      {
        id: "finding-1",
        topic: "Starting point",
        summary: "The writer outlined before using AI.",
        status: "shown-in-records",
        evidenceRefs: ["chat-1"],
      },
      {
        id: "finding-2",
        topic: "Offline research",
        summary: "The writer researched before the chat began.",
        status: "confirmed-by-creator",
      },
      {
        id: "finding-3",
        topic: "Model settings",
        summary: "Saved memory may have been active.",
        status: "unknown",
      },
    ],
    intent: "intentional",
    ...overrides,
  };
}

test("createSnapshot creates a versioned, deterministic snapshot", () => {
  const snapshot = createSnapshot({ projectName: "Essay", workType: "Writing" }, {
    ...deterministicOptions(),
    id: "snapshot-fixed",
  });

  assert.equal(snapshot.schemaVersion, SNAPSHOT_SCHEMA_VERSION);
  assert.equal(snapshot.id, "snapshot-fixed");
  assert.match(snapshot.projectId, /^project-/);
  assert.equal(snapshot.createdAt, JANUARY);
  assert.equal(snapshot.projectName, "Essay");
  assert.equal(snapshot.workType, "Writing");
  assert.equal(snapshot.aiSetup, "unknown");
  assert.deepEqual(snapshot.startingContext, ["unknown"]);
  assert.deepEqual(snapshot.addedContext, []);
  assert.equal(snapshot.accessLevel, "unknown");
  assert.equal(snapshot.approvalMode, "unknown");
  assert.deepEqual(snapshot.chatReferences, []);
  assert.equal(snapshot.intent, "not-answered");
  assert.deepEqual(snapshot.findings, []);
});

test("normalization keeps summaries and references but discards raw conversation content", () => {
  const snapshot = normalizeSnapshot({
    ...writerSnapshot(),
    conversation: "RAW CONVERSATION",
    chatHistory: [{ role: "user", content: "RAW MESSAGE" }],
    prompt: "RAW PROMPT",
    response: "RAW RESPONSE",
    chatReferences: [{
      id: "chat-1",
      label: "Development chat",
      url: "https://example.com/chat",
      summary: "The writer set the direction and challenged revisions.",
      content: "RAW CONTENT IN REFERENCE",
      transcript: "RAW TRANSCRIPT IN REFERENCE",
    }],
  }, deterministicOptions());
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.chatReference.summary, "The writer set the direction and challenged revisions.");
  assert.equal(snapshot.chatReferences.length, 1);
  assert.equal(Object.hasOwn(snapshot, "conversation"), false);
  assert.equal(Object.hasOwn(snapshot.chatReference, "content"), false);
  assert.doesNotMatch(serialized, /RAW CONVERSATION|RAW MESSAGE|RAW PROMPT|RAW RESPONSE|RAW CONTENT|RAW TRANSCRIPT/);
});

test("normalization rejects unsafe links and pasted chat text masquerading as a reference", () => {
  const snapshot = normalizeSnapshot({
    artifactUrl: "javascript:alert(1)",
    githubUrl: "file:///private/repository",
    chatReference: "user: first message\nassistant: second message",
    sourceReferences: ["notes.pdf", "data:text/plain,secret"],
  }, deterministicOptions());

  assert.equal(snapshot.artifactUrl, "");
  assert.equal(snapshot.githubUrl, "");
  assert.equal(snapshot.chatReference, null);
  assert.deepEqual(snapshot.chatReferences, []);
  assert.equal(snapshot.sourceReferences.length, 1);
  assert.equal(snapshot.sourceReferences[0].label, "notes.pdf");
});

test("AI setup aliases and repeated role labels normalize consistently", () => {
  const snapshot = normalizeSnapshot({
    aiSetup: "Custom GPT",
    aiSystems: [
      { system: "ChatGPT", model: "6.1" },
      { product: "chatgpt", model: "6.1" },
    ],
    aiRoles: ["Drafted language", " drafted language ", "Compared alternatives"],
    intent: "Yes",
  }, deterministicOptions());

  assert.equal(snapshot.aiSetup, "custom-ai");
  assert.deepEqual(snapshot.startingContext, ["custom-ai"]);
  assert.deepEqual(snapshot.aiSystems, [{ product: "ChatGPT", model: "6.1" }]);
  assert.deepEqual(snapshot.aiRoles, ["Drafted language", "Compared alternatives"]);
  assert.equal(snapshot.intent, "intentional");
});

test("a finding cannot claim that records show it without a record reference", () => {
  const snapshot = normalizeSnapshot({
    chatReference: { id: "chat-1", label: "Development chat" },
    findings: [
      { topic: "Supported", status: "Shown in records", evidenceRefs: ["chat-1"] },
      { topic: "Unsupported label", status: "Shown in records" },
      { topic: "Creator account", status: "Confirmed by creator" },
    ],
  }, deterministicOptions());

  assert.equal(snapshot.findings[0].status, FINDING_STATUS.SHOWN_IN_RECORDS);
  assert.equal(snapshot.findings[0].label, "Record provided");
  assert.equal(snapshot.findings[1].status, FINDING_STATUS.UNKNOWN);
  assert.equal(snapshot.findings[1].label, "Unknown");
  assert.equal(snapshot.findings[2].status, FINDING_STATUS.CONFIRMED_BY_CREATOR);
  assert.deepEqual(snapshot.findings.map(({ label }) => label), [
    FINDING_LABELS[FINDING_STATUS.SHOWN_IN_RECORDS],
    FINDING_LABELS[FINDING_STATUS.UNKNOWN],
    FINDING_LABELS[FINDING_STATUS.CONFIRMED_BY_CREATOR],
  ]);
});

test("multiple conversation records survive normalization and can support a finding", () => {
  const snapshot = normalizeSnapshot({
    chatReferences: [
      { id: "chat-one", label: "Planning chat", url: "https://example.com/chat-one" },
      { id: "chat-two", label: "Revision chat", digest: "sha256:second" },
    ],
    findings: [
      { topic: "Revision decision", status: "record provided", evidenceRefs: ["chat-two"] },
    ],
  }, deterministicOptions());

  assert.deepEqual(snapshot.chatReferences.map(({ id }) => id), ["chat-one", "chat-two"]);
  assert.equal(snapshot.chatReference.id, "chat-one");
  assert.equal(snapshot.findings[0].status, FINDING_STATUS.SHOWN_IN_RECORDS);

  const roundTrip = importSnapshotHistory(exportSnapshotHistory([snapshot], deterministicOptions()), deterministicOptions());
  assert.deepEqual(roundTrip.snapshots[0].chatReferences.map(({ label }) => label), ["Planning chat", "Revision chat"]);
});

test("duplicate imported evidence ids cannot attach a finding to the wrong record", () => {
  const snapshot = normalizeSnapshot({
    chatReferences: [
      { id: "shared-record", label: "Planning conversation" },
    ],
    sourceReferences: [
      { id: "shared-record", label: "Source brief" },
    ],
    findings: [
      { topic: "Origin of the plan", status: "record provided", evidenceRefs: ["shared-record"] },
    ],
  }, deterministicOptions());

  assert.notEqual(snapshot.chatReferences[0].id, snapshot.sourceReferences[0].id);
  assert.equal(snapshot.findings[0].status, FINDING_STATUS.UNKNOWN);
  assert.equal(snapshot.findings[0].label, FINDING_LABELS[FINDING_STATUS.UNKNOWN]);
});

test("schema 2 setup answers migrate without inventing precise context or permissions", () => {
  const imported = importSnapshotHistory({
    schemaVersion: 2,
    snapshots: [
      { id: "broad-context", projectName: "Guide", aiSetup: "context-enabled-chat" },
      { id: "broad-multiple", projectName: "Application", aiSetup: "multiple" },
      { id: "legacy-chat", projectName: "Essay", aiSetup: "regular-chat", chatReference: { id: "legacy-chat-one", label: "Old chat" } },
    ],
  }, deterministicOptions());

  assert.deepEqual(imported.snapshots[0].startingContext, ["legacy-context-enabled"]);
  assert.deepEqual(imported.snapshots[1].startingContext, ["legacy-multiple"]);
  assert.deepEqual(imported.snapshots[2].startingContext, ["nothing-added"]);
  assert.equal(imported.snapshots[2].chatReferences[0].label, "Old chat");
  assert.ok(imported.snapshots.every(({ accessLevel, approvalMode }) => accessLevel === "unknown" && approvalMode === "unknown"));
});

test("structured context removes contradictory exclusive answers", () => {
  const snapshot = normalizeSnapshot({
    startingContext: ["nothing-added", "custom-ai", "unknown", "connected-apps-tools"],
    addedContext: ["nothing-else", "documents", "unknown"],
    accessLevel: "edit",
    approvalMode: "standing permission",
    connectedTools: ["GitHub | read and write", " github | read and write ", "Canva | create"],
  }, deterministicOptions());

  assert.deepEqual(snapshot.startingContext, ["custom-ai", "connected-apps-tools"]);
  assert.deepEqual(snapshot.addedContext, ["documents"]);
  assert.equal(snapshot.accessLevel, "edit-run");
  assert.equal(snapshot.approvalMode, "standing-permission");
  assert.deepEqual(snapshot.connectedTools, ["GitHub | read and write", "Canva | create"]);
});

test("evidenceCoverage reports record, creator, and unknown coverage without a master score", () => {
  const coverage = evidenceCoverage(writerSnapshot());

  assert.deepEqual({
    totalFindings: coverage.totalFindings,
    coveredFindings: coverage.coveredFindings,
    percent: coverage.percent,
    shownInRecords: coverage.shownInRecords,
    confirmedByCreator: coverage.confirmedByCreator,
    unknown: coverage.unknown,
  }, {
    totalFindings: 3,
    coveredFindings: 2,
    percent: 67,
    shownInRecords: 1,
    confirmedByCreator: 1,
    unknown: 1,
  });
  assert.equal(Object.hasOwn(coverage, "score"), false);
  assert.equal(evidenceCoverage({ findings: [] }).percent, null);
});

test("comparability follows stable project identity across names and stages", () => {
  assert.equal(isComparableSnapshot(
    writerSnapshot({ projectName: "Old name", stage: "build" }),
    writerSnapshot({ projectName: "New name", stage: "release", createdAt: APRIL }),
  ), true);
  assert.equal(isComparableSnapshot(
    writerSnapshot({ id: "a", projectId: "project-one", projectName: "Same name" }),
    writerSnapshot({ id: "b", projectId: "project-two", projectName: "Same name" }),
  ), false);
  assert.equal(isComparableSnapshot(
    { id: "legacy-a", projectName: "Legacy essay", workType: "Writing" },
    { id: "legacy-b", projectName: "Legacy essay", workType: "Writing" },
  ), true);
});

test("the first comparison establishes a baseline", () => {
  const result = compareSnapshots(null, writerSnapshot());

  assert.equal(result.baseline, true);
  assert.equal(result.comparable, false);
  assert.match(result.reason, /first snapshot.*baseline/i);
  assert.deepEqual(result.changes, []);
  assert.equal(result.evidenceCoverage.before, null);
  assert.equal(Object.hasOwn(result, "score"), false);
});

test("comparison detects changes in setup, entry point, roles, checking, authorization, and coverage", () => {
  const previous = writerSnapshot();
  const current = writerSnapshot({
    id: "snapshot-april",
    createdAt: APRIL,
    aiSystems: [{ product: "ChatGPT", model: "6.2 Pro" }],
    aiSetup: "context-enabled-chat",
    startingContext: ["custom-ai", "existing-project-workspace"],
    addedContext: ["conversation", "documents", "links"],
    connectedTools: ["GitHub | read and write"],
    accessLevel: "edit-run",
    approvalMode: "before-external-action",
    chatReferences: [{ id: "chat-2", label: "April writing conversation", url: "https://example.com/chat-april" }],
    beforeAi: ["Chose a topic"],
    aiRoles: ["Proposed initial ideas", "Wrote the first draft"],
    humanRoles: ["Spot-checked sources", "Approved publication"],
    finalAuthority: "The writer approved publication, but AI could merge approved changes.",
    findings: [
      { topic: "Starting point", status: "shown-in-records", evidenceRefs: ["chat-2"] },
      { topic: "Source checks", status: "unknown" },
    ],
    intent: "unsure",
  });
  const result = compareSnapshots(previous, current);
  const changedKeys = result.changes.map(({ key }) => key);

  assert.equal(result.baseline, false);
  assert.equal(result.comparable, true);
  assert.equal(result.reason, "Something changed.");
  assert.deepEqual(changedKeys, [
    "ai-systems",
    "starting-context",
    "added-context",
    "connected-tools",
    "access-level",
    "approval-mode",
    "ai-entry-point",
    "ai-roles",
    "human-roles-checking",
    "evidence-coverage",
  ]);
  assert.equal(result.changes.find(({ key }) => key === "ai-roles").added.includes("Wrote the first draft"), true);
  assert.equal(result.evidenceCoverage.before.percent, 67);
  assert.equal(result.evidenceCoverage.after.percent, 50);
  assert.equal(result.evidenceCoverage.delta, -17);
  assert.equal(result.intent, "unsure");
  assert.equal(Object.hasOwn(result, "humanReliance"), false);
  assert.equal(Object.hasOwn(result, "aiPercentage"), false);
});

test("comparison preserves legacy authorization changes when structured permission answers are unavailable", () => {
  const previous = writerSnapshot({
    accessLevel: "unknown",
    approvalMode: "unknown",
    finalAuthority: "AI could draft, but the writer approved publication.",
  });
  const current = writerSnapshot({
    id: "snapshot-april",
    createdAt: APRIL,
    accessLevel: "unknown",
    approvalMode: "unknown",
    finalAuthority: "AI could publish after the writer gave approval.",
  });

  const result = compareSnapshots(previous, current);
  const authorization = result.changes.find(({ key }) => key === "recorded-authorization");

  assert.equal(authorization.label, "Recorded authorization details");
  assert.equal(authorization.before, "AI could draft, but the writer approved publication.");
  assert.equal(authorization.after, "AI could publish after the writer gave approval.");
});

test("comparison distinguishes no tracked change from an invalid comparison", () => {
  const unchanged = compareSnapshots(writerSnapshot(), writerSnapshot({ id: "snapshot-copy", createdAt: APRIL }));
  assert.equal(unchanged.comparable, true);
  assert.equal(unchanged.reason, "No tracked changes were found.");
  assert.deepEqual(unchanged.changes, []);

  const mismatched = compareSnapshots(
    writerSnapshot(),
    writerSnapshot({ id: "snapshot-app", projectId: "project-app", projectName: "Software tool", workType: "Software", createdAt: APRIL }),
  );
  assert.equal(mismatched.comparable, false);
  assert.match(mismatched.reason, /direct comparison could mislead/i);
});

test("appendSnapshot makes the first entry the durable baseline", () => {
  const first = appendSnapshot(null, writerSnapshot(), deterministicOptions());
  const second = appendSnapshot(first, writerSnapshot({
    id: "snapshot-april",
    createdAt: APRIL,
    aiRoles: ["Drafted the article"],
  }), deterministicOptions(APRIL));

  assert.equal(first.schemaVersion, SNAPSHOT_HISTORY_SCHEMA_VERSION);
  assert.equal(first.baselineId, "snapshot-january");
  assert.equal(second.baselineId, "snapshot-january");
  assert.deepEqual(second.snapshots.map(({ id }) => id), ["snapshot-january", "snapshot-april"]);
});

test("each project has its own baseline", () => {
  const firstProject = appendSnapshot(null, writerSnapshot(), deterministicOptions());
  const withSecondProject = appendSnapshot(firstProject, writerSnapshot({
    id: "snapshot-app",
    projectId: "project-app",
    projectName: "Application",
    workType: "Software",
  }), deterministicOptions(APRIL));

  assert.equal(isProjectBaseline(withSecondProject, withSecondProject.snapshots[0], deterministicOptions()), true);
  assert.equal(isProjectBaseline(withSecondProject, withSecondProject.snapshots[1], deterministicOptions()), true);

  const outOfOrder = importSnapshotHistory({
    schemaVersion: SNAPSHOT_HISTORY_SCHEMA_VERSION,
    snapshots: [
      writerSnapshot({ id: "snapshot-april", createdAt: APRIL }),
      writerSnapshot(),
    ],
  }, deterministicOptions());
  assert.equal(isProjectBaseline(outOfOrder, outOfOrder.snapshots[0], deterministicOptions()), false);
  assert.equal(isProjectBaseline(outOfOrder, outOfOrder.snapshots[1], deterministicOptions()), true);
});

test("an imported array of id-less snapshots receives distinct ids", () => {
  const imported = importSnapshotHistory([
    { projectName: "January essay", workType: "Writing" },
    { projectName: "April essay", workType: "Writing" },
  ], deterministicOptions());

  assert.equal(imported.snapshots.length, 2);
  assert.notEqual(imported.snapshots[0].id, imported.snapshots[1].id);
  assert.equal(imported.baselineId, imported.snapshots[0].id);
});

test("schema 1 history receives stable project identities without losing snapshots", () => {
  const imported = importSnapshotHistory({
    schemaVersion: 1,
    snapshots: [
      { id: "legacy-one", projectName: "Renovation plan", workType: "Writing" },
      { id: "legacy-two", projectName: "Renovation plan", workType: "Writing" },
      { id: "legacy-three", projectName: "Another plan", workType: "Writing" },
    ],
  }, deterministicOptions());

  assert.equal(imported.snapshots.length, 3);
  assert.equal(imported.snapshots[0].projectId, imported.snapshots[1].projectId);
  assert.notEqual(imported.snapshots[0].projectId, imported.snapshots[2].projectId);
});

test("appendSnapshot merges a draft with an existing id instead of duplicating it", () => {
  const history = appendSnapshot(null, writerSnapshot(), deterministicOptions());
  const updated = appendSnapshot(history, {
    id: "snapshot-january",
    aiRoles: ["Challenged the argument", "Edited the draft"],
    intent: "unsure",
  }, deterministicOptions(APRIL));

  assert.equal(updated.snapshots.length, 1);
  assert.equal(updated.snapshots[0].createdAt, JANUARY);
  assert.deepEqual(updated.snapshots[0].aiRoles, ["Challenged the argument", "Edited the draft"]);
  assert.equal(updated.snapshots[0].projectName, "Monthly essay");
  assert.equal(updated.snapshots[0].intent, "unsure");
});

test("export and import produce a safe, versioned round trip", () => {
  const history = appendSnapshot(null, writerSnapshot(), deterministicOptions());
  const exported = exportSnapshotHistory(history, deterministicOptions(APRIL));
  const parsed = JSON.parse(exported);
  const imported = importSnapshotHistory(exported, deterministicOptions(APRIL));

  assert.equal(parsed.schemaVersion, SNAPSHOT_HISTORY_SCHEMA_VERSION);
  assert.equal(parsed.exportedAt, APRIL);
  assert.equal(imported.baselineId, "snapshot-january");
  assert.equal(imported.snapshots.length, 1);
  assert.equal(imported.snapshots[0].projectName, "Monthly essay");
  assert.equal(imported.snapshots[0].sourceReferences[0].label, "Interview notes");
  assert.equal(Object.hasOwn(imported, "exportedAt"), false);
});

test("imports merge duplicate ids, remove unknown fields, and prevent prototype pollution", () => {
  const value = `{
    "schemaVersion": 1,
    "baselineId": "same",
    "snapshots": [
      {"id":"same","projectName":"Original","workType":"Writing","stage":"release"},
      {"id":"same","projectName":"Revised","rawConversation":"secret","__proto__":{"polluted":true}}
    ]
  }`;
  const imported = importSnapshotHistory(value, deterministicOptions());

  assert.equal(imported.snapshots.length, 1);
  assert.equal(imported.snapshots[0].projectName, "Revised");
  assert.equal(imported.snapshots[0].workType, "Writing");
  assert.equal(Object.hasOwn(imported.snapshots[0], "rawConversation"), false);
  assert.equal({}.polluted, undefined);
});

test("invalid and unsupported imports fail with clear errors", () => {
  assert.throws(() => importSnapshotHistory("not json"), /not valid JSON/i);
  assert.throws(() => importSnapshotHistory(null), /JSON object or array/i);
  assert.throws(
    () => importSnapshotHistory({ schemaVersion: SNAPSHOT_HISTORY_SCHEMA_VERSION + 1, snapshots: [] }),
    /newer, unsupported schema/i,
  );
  assert.throws(
    () => importSnapshotHistory({ snapshots: Array.from({ length: 501 }, () => ({})) }),
    /at most 500/i,
  );
});

test("exported history cannot leak discarded raw conversation fields", () => {
  const raw = {
    ...writerSnapshot(),
    messages: [{ role: "user", content: "PRIVATE CHAT BODY" }],
    transcript: "PRIVATE TRANSCRIPT",
    chatReferences: [{
      label: "Chat record",
      url: "https://example.com/chat",
      summary: "Project decisions and revisions.",
      content: "PRIVATE REFERENCE BODY",
    }],
  };
  const exported = exportSnapshotHistory([raw], deterministicOptions());

  assert.doesNotMatch(exported, /PRIVATE CHAT BODY|PRIVATE TRANSCRIPT|PRIVATE REFERENCE BODY/);
  assert.match(exported, /Project decisions and revisions/);
  assert.doesNotMatch(exported, /human.?vs.?ai|humanReliance|aiPercentage|masterScore/i);
});
