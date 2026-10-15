import test from "node:test";
import assert from "node:assert/strict";

import {
  DIMENSIONS,
  QUESTION_DEFINITIONS,
  getActiveQuestionDefinitions,
} from "../src/questions.js";
import {
  AUTHORITY_LABELS,
  BAND_DEFINITIONS,
  EVIDENCE_MULTIPLIERS,
  METHOD_VERSION,
  getBand,
  scoreAssessment,
} from "../src/scoring.js";

const CORE_IDS = ["HUM1", "HUM3", "CAP1", "CAP2", "BEH1", "WF1", "WF2", "OUT1"];

function answers(level = 100, basis = "confirmed", additions = {}) {
  const entries = {
    ...Object.fromEntries(CORE_IDS.map((id) => [id, { level, basis }])),
    ...additions,
  };
  return Object.fromEntries(Object.entries(entries).map(([id, answer]) => [id, {
    ...answer,
    ...(answer.basis === "confirmed" && !answer.evidenceNote && !answer.evidenceUrl
      ? { evidenceNote: `Current record for ${id}` }
      : {}),
  }]));
}

function assessment(overrides = {}) {
  const projectOverrides = overrides.project || {};
  return {
    stage: "release",
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      humanApprovalBeforeConsequence: true,
      actionsAreReversible: true,
      reviewEvidenceBasis: "confirmed",
      reviewEvidenceNote: "Current safeguard review record",
      workTypes: [],
      requiredBehaviors: [],
      ...projectOverrides,
    },
    answers: answers(),
    ...overrides,
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      humanApprovalBeforeConsequence: true,
      actionsAreReversible: true,
      reviewEvidenceBasis: "confirmed",
      reviewEvidenceNote: "Current safeguard review record",
      workTypes: [],
      requiredBehaviors: [],
      ...projectOverrides,
    },
  };
}

test("v0.3 questions put human capacity first and expose renderable options and evidence guidance", () => {
  assert.equal(METHOD_VERSION, "0.3");
  assert.equal(Object.keys(DIMENSIONS)[0], "humanAssurance");
  assert.deepEqual(QUESTION_DEFINITIONS.slice(0, 2).map(({ id }) => id), ["HUM1", "HUM3"]);
  assert.ok(QUESTION_DEFINITIONS.length >= 12);

  for (const question of QUESTION_DEFINITIONS) {
    assert.match(question.id, /^[A-Z]+\d+$/);
    assert.ok(question.dimension);
    assert.ok(question.prompt.length > 10);
    assert.ok(question.why.length > 10);
    assert.ok(question.evidenceGuidance.length > 10);
    assert.deepEqual(question.options.map(({ value }) => value), [0, 25, 50, 75, 100]);
  }
});

test("planning, release, and live checks use stage-specific tense", () => {
  const plan = getActiveQuestionDefinitions(assessment({ stage: "plan" }));
  const release = getActiveQuestionDefinitions(assessment({ stage: "release" }));
  const live = getActiveQuestionDefinitions(assessment({ stage: "live" }));
  const byId = (items, id) => items.find((item) => item.id === id);

  assert.match(byId(plan, "HUM1").prompt, /Will you/i);
  assert.match(byId(release, "HUM1").prompt, /finished work/i);
  assert.match(byId(live, "HUM1").prompt, /while this work is in use/i);
  assert.match(byId(plan, "OUT1").prompt, /betting on/i);
  assert.match(byId(release, "OUT1").prompt, /after launch/i);
  assert.match(byId(live, "OUT1").prompt, /result occurred/i);
  assert.notEqual(byId(plan, "OUT1").options[0].label, byId(release, "OUT1").options[0].label);
  assert.notEqual(byId(release, "OUT1").options[0].label, byId(live, "OUT1").options[0].label);
});

test("before-work adaptive questions use plan-ready choices and evidence guidance", () => {
  const plan = getActiveQuestionDefinitions(assessment({
    stage: "plan",
    project: {
      consequence: "low",
      proposedAuthority: "A3",
      materialClaims: true,
      workTypes: ["website", "automation"],
      requiredBehaviors: ["challenge"],
    },
  }));
  const byId = (id) => plan.find((question) => question.id === id);

  assert.equal(byId("HUM2").options[0].label, "No verification plan");
  assert.equal(byId("BEH2").options[1].label, "One challenge case designed");
  assert.equal(byId("WF3").options[3].label, "Risk-matched release gate defined");
  assert.equal(byId("WF4").options[3].label, "Limits, stop thresholds, and rollback defined");
  for (const id of ["HUM2", "BEH2", "WF3", "WF4"]) {
    assert.match(byId(id).evidenceGuidance, /plan|written|checklist|criteria|control/i);
  }
});

test("adaptive questions activate only for relevant work and authority", () => {
  assert.deepEqual(
    getActiveQuestionDefinitions(assessment()).map(({ id }) => id),
    CORE_IDS,
  );
  const active = getActiveQuestionDefinitions(assessment({
    project: {
      consequence: "moderate",
      proposedAuthority: "A3",
      materialClaims: true,
      workTypes: ["website"],
      requiredBehaviors: ["Challenge assumptions"],
    },
  })).map(({ id }) => id);
  for (const id of ["HUM2", "BEH2", "WF3", "WF4"]) assert.ok(active.includes(id));
});

test("evidence basis never multiplies the operational score", () => {
  const confirmed = scoreAssessment(assessment({ answers: answers(100, "confirmed") }));
  const reported = scoreAssessment(assessment({ answers: answers(100, "reported") }));
  const unknownBasis = scoreAssessment(assessment({ answers: answers(100, "unknown") }));

  assert.equal(confirmed.publicScore, 100);
  assert.equal(reported.publicScore, 100);
  assert.equal(unknownBasis.publicScore, 100);
  assert.equal(reported.itemScores.CAP1.multiplier, 1);
  assert.equal(unknownBasis.itemScores.CAP1.score, 100);
  assert.deepEqual(EVIDENCE_MULTIPLIERS, { confirmed: 1, reported: 1, unknown: 1 });
});

test("a confirmed answer without a current record is treated as self-reported", () => {
  const unsupportedConfirmed = Object.fromEntries(
    CORE_IDS.map((id) => [id, { level: 100, basis: "confirmed" }]),
  );
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      reviewEvidenceBasis: "reported",
      reviewEvidenceNote: "Safeguards are described from memory",
    },
    answers: unsupportedConfirmed,
  }));

  assert.equal(result.publicScore, 100);
  assert.ok(Object.values(result.itemScores).every(({ basis }) => basis === "reported"));
  assert.equal(result.evidenceStrength.label, "Self-described");
  assert.equal(result.evidenceConfidence, "Low");
});

test("one safeguard record does not elevate otherwise self-reported claims", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      reviewEvidenceBasis: "confirmed",
      reviewEvidenceNote: "Current approval and safeguard record",
    },
    answers: answers(100, "reported"),
  }));

  assert.equal(result.evidenceStrength.label, "Some supporting records identified");
  assert.equal(result.operationalMaxAuthority, "A1");
  assert.equal(result.conclusionAuthority, "A0");
  assert.equal(result.decisionStatus.id, "not_demonstrated");
  assert.notDeepEqual(
    result.loadSummary.reportedSetupCanCarry,
    result.loadSummary.currentSetupCanCarry,
  );
});

test("role-critical records set the evidence ceiling for a reversible AI action", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A2",
      humanApprovalBeforeConsequence: true,
      actionsAreReversible: true,
    },
    answers: answers(100, "confirmed", {
      CAP1: { level: 100, basis: "reported" },
    }),
  }));

  assert.equal(result.operationalMaxAuthority, "A2");
  assert.equal(result.conclusionAuthority, "A1");
  assert.equal(result.decisionStatus.id, "not_demonstrated");
});

test("evidence strength is separate and limits the conclusion, not capacity scores", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      reviewEvidenceBasis: "reported",
      reviewEvidenceNote: "Safeguards are described from memory",
    },
    answers: answers(100, "reported"),
  }));

  assert.equal(result.operationalScore, 100);
  assert.equal(result.dimensions.humanAssurance, 100);
  assert.equal(result.evidenceStrength.label, "Self-described");
  assert.equal(result.evidenceConfidence, "Low");
  assert.equal(result.operationalMaxAuthority, "A1");
  assert.equal(result.conclusionAuthority, "A0");
  assert.equal(result.proposedRoleOperationallySupported, true);
  assert.equal(result.proposedAuthoritySupported, false);
  assert.equal(result.decisionStatus.id, "not_demonstrated");
  assert.match(result.decisionStatus.description, /evidence gap, not proof/i);
  assert.deepEqual(result.loadSummary.exposedLoad, []);
  assert.ok(result.authorization.doNotAuthorize.some((item) => /available records do not yet show/i.test(item)));
});

test("evidence strength distinguishes missing, partial, key, and independent records", () => {
  const missing = scoreAssessment(assessment({
    project: { consequence: "low", proposedAuthority: "A1", reviewEvidenceBasis: "unknown" },
    answers: answers(100, "unknown"),
  }));
  const partial = scoreAssessment(assessment({
    answers: answers(100, "reported", {
      HUM1: { level: 100, basis: "confirmed" },
      WF1: { level: 100, basis: "confirmed" },
    }),
  }));
  const key = scoreAssessment(assessment({ answers: answers(100, "confirmed") }));
  const independent = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      qualifiedIndependentReview: true,
      independentReviewerName: "Qualified reviewer",
      independentReviewerRole: "Relevant specialist",
      independentReviewScope: "Checked the question records and safeguard records",
      independentReviewDate: "2026-10-15",
      independentReviewEvidence: "Signed review note",
    },
  }));

  assert.equal(missing.evidenceStrength.label, "Not enough information");
  assert.equal(partial.evidenceStrength.label, "Some supporting records identified");
  assert.equal(key.evidenceStrength.label, "Records identified for key steps");
  assert.equal(independent.evidenceStrength.label, "Independent review recorded");
});

test("an independent-review boolean without a complete review record is not enough", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      qualifiedIndependentReview: true,
    },
  }));

  assert.equal(result.evidenceStrength.label, "Records identified for key steps");
  assert.notEqual(result.evidenceStrength.label, "Independent review recorded");
});

test("missing answers score zero without NaN while an unknown basis can retain a reported level", () => {
  const missing = scoreAssessment(assessment({ answers: {} }));
  const malformed = scoreAssessment(assessment({
    answers: { CAP1: { level: "not-a-score", basis: "unsupported-basis" } },
  }));

  assert.equal(missing.operationalScore, 0);
  assert.equal(missing.publicScore, 0);
  assert.equal(missing.decisionStatus.id, "not_supported");
  assert.equal(Number.isNaN(malformed.operationalScore), false);
  assert.equal(malformed.itemScores.CAP1.score, 0);
});

test("human capacity sets a ceiling that a high average cannot erase", () => {
  const result = scoreAssessment(assessment({
    answers: answers(100, "confirmed", { HUM1: { level: 25, basis: "confirmed" } }),
  }));

  assert.ok(result.uncappedOperationalScore > result.operationalScore);
  assert.equal(result.capacityCeiling, 59);
  assert.equal(result.operationalScore, 59);
  assert.equal(result.publicScore, 59);
  assert.equal(result.scoreBand, "A smaller AI role fits the current setup");
  assert.equal(result.operationalMaxAuthority, "A0");
  assert.ok(result.gates.some(({ id }) => id === "human_capacity_gap"));
  assert.ok(result.capacityLimitReasons.length > 0);
});

test("missing human access or authority limits what the current setup can carry", () => {
  const noAccess = scoreAssessment(assessment({
    project: { consequence: "low", proposedAuthority: "A2", humanAccessConfirmed: false },
  }));
  const noAuthority = scoreAssessment(assessment({
    project: { consequence: "low", proposedAuthority: "A2", humanAuthorityConfirmed: false },
  }));

  assert.equal(noAccess.capacityCeiling, 39);
  assert.equal(noAccess.operationalMaxAuthority, "A0");
  assert.ok(noAccess.gates.some(({ id }) => id === "human_access_missing"));
  assert.equal(noAuthority.operationalMaxAuthority, "A0");
  assert.ok(noAuthority.gates.some(({ id }) => id === "human_authority_missing"));
});

test("unsustainable review limits consequential and repeated AI roles", () => {
  const result = scoreAssessment(assessment({
    project: { consequence: "low", proposedAuthority: "A3", repeatedOrAutonomous: true },
    answers: answers(100, "confirmed", {
      HUM3: { level: 25, basis: "confirmed" },
      WF4: { level: 100, basis: "confirmed" },
    }),
  }));

  assert.ok(result.gates.some(({ id }) => id === "review_not_sustainable"));
  assert.equal(result.operationalMaxAuthority, "A1");
  assert.equal(result.decisionStatus.id, "smaller_role");
});

test("a plan keeps reported capability operational while matched records strengthen the conclusion", () => {
  const projected = scoreAssessment(assessment({
    stage: "plan",
    project: { consequence: "low", proposedAuthority: "A1" },
  }));
  const tested = scoreAssessment(assessment({
    stage: "plan",
    project: { consequence: "low", proposedAuthority: "A1", priorMatchedEvidence: true },
  }));

  assert.equal(projected.itemScores.CAP1.rawLevel, 100);
  assert.equal(projected.itemScores.CAP1.level, 100);
  assert.equal(projected.dimensions.capabilityFit, 100);
  assert.equal(projected.operationalScore, 100);
  assert.equal(projected.evidenceConfidence, "Medium");
  assert.equal(tested.itemScores.CAP1.level, 100);
  assert.equal(tested.operationalScore, projected.operationalScore);
  assert.equal(tested.evidenceConfidence, "High");
});

test("self-reported adaptive checks affect the operational result without becoming records", () => {
  const project = {
    consequence: "low",
    proposedAuthority: "A1",
    humanApprovalBeforeConsequence: true,
    actionsAreReversible: true,
    reviewEvidenceBasis: "reported",
    reviewEvidenceNote: "The checks are described from memory",
    materialClaims: true,
    workTypes: ["website"],
    requiredBehaviors: ["challenge"],
  };
  const activeIds = getActiveQuestionDefinitions(assessment({ project })).map(({ id }) => id);
  const reportedAnswers = Object.fromEntries(
    activeIds.map((id) => [id, { level: 100, basis: "reported" }]),
  );
  const result = scoreAssessment(assessment({ project, answers: reportedAnswers }));

  assert.equal(result.operationalScore, 100);
  assert.equal(result.operationalMaxAuthority, "A1");
  assert.equal(result.conclusionAuthority, "A0");
  assert.equal(result.decisionStatus.id, "not_demonstrated");
  assert.ok(!result.gates.some(({ id }) => id === "unverified_material_claims"));
  assert.ok(!result.gates.some(({ id }) => id === "untested_production_change"));
});

test("a release check evaluates readiness for later outcomes without claiming they already occurred", () => {
  const result = scoreAssessment(assessment({
    stage: "release",
    project: { consequence: "low", proposedAuthority: "A1", outcomeDataActive: false },
  }));
  const outQuestion = getActiveQuestionDefinitions(assessment({ stage: "release" }))
    .find(({ id }) => id === "OUT1");

  assert.equal(result.itemScores.OUT1.level, 100);
  assert.match(outQuestion.prompt, /after launch/i);
  assert.doesNotMatch(outQuestion.prompt, /actually happened/i);
});

test("adaptive branches use human-first dimension weights", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A3",
      materialClaims: true,
      workTypes: ["website"],
      requiredBehaviors: ["challenge"],
    },
    answers: answers(100, "confirmed", {
      HUM2: { level: 0, basis: "confirmed" },
      BEH2: { level: 0, basis: "confirmed" },
      WF3: { level: 0, basis: "confirmed" },
      WF4: { level: 0, basis: "confirmed" },
    }),
  }));

  assert.equal(result.dimensions.humanAssurance, 75);
  assert.equal(result.dimensions.behavioralFit, 60);
  assert.equal(result.dimensions.workflowControl, 60);
  assert.equal(result.operationalScore, 79);
  assert.ok(result.gates.some(({ id }) => id === "unverified_material_claims"));
  assert.ok(result.gates.some(({ id }) => id === "untested_production_change"));
});

test("a fully demonstrated low-consequence live setup can carry A3", () => {
  const result = scoreAssessment(assessment({
    stage: "live",
    project: {
      consequence: "low",
      proposedAuthority: "A3",
      repeatedOrAutonomous: true,
      actionsAreReversible: true,
      monitoringConfirmed: true,
    },
    answers: answers(100, "confirmed", { WF4: { level: 100, basis: "confirmed" } }),
    validation: {
      observedRuns: 5,
      representativeConditions: true,
      atLeastOneEdgeOrFailureCase: true,
      controlsActuallyOperated: true,
      observedInRealUseForFullOperatingCycle: true,
      outcomeDataCollected: true,
      materialFailuresResolved: true,
    },
  }));

  assert.equal(result.publicScore, 100);
  assert.equal(result.validationStatus, "Sustained");
  assert.equal(result.operationalMaxAuthority, "A3");
  assert.equal(result.conclusionAuthority, "A3");
  assert.equal(result.proposedAuthoritySupported, true);
  assert.equal(result.decisionStatus.id, "strong");
});

test("high-consequence work cannot receive unattended A3 authority", () => {
  const result = scoreAssessment(assessment({
    stage: "live",
    project: {
      consequence: "high",
      proposedAuthority: "A3",
      repeatedOrAutonomous: true,
      actionsAreReversible: true,
      monitoringConfirmed: true,
    },
    answers: answers(100, "confirmed", { WF4: { level: 100, basis: "confirmed" } }),
    validation: {
      observedRuns: 5,
      representativeConditions: true,
      atLeastOneEdgeOrFailureCase: true,
      controlsActuallyOperated: true,
    },
  }));

  assert.equal(result.operationalMaxAuthority, "A2");
  assert.equal(result.proposedRoleOperationallySupported, false);
  assert.equal(result.decisionStatus.id, "smaller_role");
});

test("permission and production gates cannot be averaged away", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A2",
      connectedAccess: true,
      permissionsConfirmed: false,
      humanApprovalBeforeConsequence: true,
      productionCodeOrConfiguration: true,
    },
    answers: answers(100, "confirmed", { WF3: { level: 50, basis: "confirmed" } }),
  }));

  assert.ok(result.operationalScore > 90);
  assert.ok(result.gates.some(({ id }) => id === "unknown_or_broad_permissions"));
  assert.ok(result.gates.some(({ id }) => id === "untested_production_change"));
  assert.equal(result.operationalMaxAuthority, "A1");
  assert.equal(result.decisionStatus.id, "smaller_role");
});

test("authority levels enforce approval and reversibility invariants", () => {
  const a1WithoutApproval = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      humanApprovalBeforeConsequence: false,
      actionsAreReversible: true,
    },
  }));
  const a2WithoutReversibility = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A2",
      humanApprovalBeforeConsequence: true,
      actionsAreReversible: false,
    },
  }));
  const a2WithRequiredControls = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A2",
      humanApprovalBeforeConsequence: true,
      actionsAreReversible: true,
    },
  }));

  assert.equal(a1WithoutApproval.operationalMaxAuthority, "A0");
  assert.ok(a1WithoutApproval.gates.some(({ id }) => id === "external_action_without_approval"));
  assert.equal(a2WithoutReversibility.operationalMaxAuthority, "A1");
  assert.ok(a2WithoutReversibility.gates.some(({ id }) => id === "reversibility_not_confirmed"));
  assert.equal(a2WithRequiredControls.operationalMaxAuthority, "A2");
});

test("a confirmed zero pre-consequence check cannot qualify for A1", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      humanApprovalBeforeConsequence: true,
    },
    answers: answers(100, "confirmed", {
      WF2: { level: 0, basis: "confirmed" },
    }),
  }));

  assert.equal(result.itemScores.WF2.basis, "confirmed");
  assert.equal(result.itemScores.WF2.level, 0);
  assert.equal(result.operationalMaxAuthority, "A0");
  assert.equal(result.conclusionAuthority, "A0");
  assert.notEqual(result.decisionStatus.id, "strong");
});

test("a confirmed zero task-capability result cannot qualify for A2", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A2",
      humanApprovalBeforeConsequence: true,
      actionsAreReversible: true,
    },
    answers: answers(100, "confirmed", {
      CAP1: { level: 0, basis: "confirmed" },
    }),
  }));

  assert.equal(result.itemScores.CAP1.basis, "confirmed");
  assert.equal(result.itemScores.CAP1.level, 0);
  assert.equal(result.operationalMaxAuthority, "A1");
  assert.equal(result.conclusionAuthority, "A1");
  assert.notEqual(result.decisionStatus.id, "strong");
});

test("a confirmed zero outcome-observation result cannot qualify for A3", () => {
  const result = scoreAssessment(assessment({
    stage: "live",
    project: {
      consequence: "low",
      proposedAuthority: "A3",
      repeatedOrAutonomous: true,
      actionsAreReversible: true,
      monitoringConfirmed: true,
    },
    answers: answers(100, "confirmed", {
      OUT1: { level: 0, basis: "confirmed" },
      WF4: { level: 100, basis: "confirmed" },
    }),
    validation: {
      observedRuns: 5,
      representativeConditions: true,
      atLeastOneEdgeOrFailureCase: true,
      controlsActuallyOperated: true,
      observedInRealUseForFullOperatingCycle: true,
      outcomeDataCollected: true,
      materialFailuresResolved: true,
    },
  }));

  assert.equal(result.validationStatus, "Sustained");
  assert.equal(result.itemScores.OUT1.basis, "confirmed");
  assert.equal(result.itemScores.OUT1.level, 0);
  assert.equal(result.operationalMaxAuthority, "A2");
  assert.equal(result.conclusionAuthority, "A2");
  assert.notEqual(result.decisionStatus.id, "strong");
});

test("inferred authority never exceeds the role being assessed", () => {
  const adviceOnly = scoreAssessment(assessment({
    project: { consequence: "low", proposedAuthority: "A0" },
  }));
  const approvalRole = scoreAssessment(assessment({
    project: { consequence: "low", proposedAuthority: "A1" },
  }));

  assert.equal(adviceOnly.operationalMaxAuthority, "A0");
  assert.equal(adviceOnly.conclusionAuthority, "A0");
  assert.equal(approvalRole.operationalMaxAuthority, "A1");
  assert.equal(approvalRole.conclusionAuthority, "A1");
});

test("an operationally fitting role with weak records is not treated as a smaller-role finding", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A2",
      reviewEvidenceBasis: "reported",
      reviewEvidenceNote: "Safeguards are described from memory",
    },
    answers: answers(100, "reported"),
  }));

  assert.equal(result.operationalMaxAuthority, "A2");
  assert.equal(result.conclusionAuthority, "A0");
  assert.equal(result.proposedRoleOperationallySupported, true);
  assert.equal(result.proposedAuthoritySupported, false);
  assert.equal(result.decisionStatus.id, "not_demonstrated");
  assert.match(result.decisionStatus.description, /records you identified back only/i);
  assert.match(result.decisionStatus.description, /not proof/i);
});

test("per-system evidence basis is used instead of treating every explicit system as unknown", () => {
  const reported = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      systems: [{
        id: "writer",
        product: "Writing system",
        model: "Model A",
        role: "Draft",
        proposedAuthority: "A1",
        connectedAccess: false,
        evidenceBasis: "reported",
      }],
    },
  }));
  const unknown = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      systems: [{
        id: "writer",
        product: "Writing system",
        model: "Model A",
        role: "Draft",
        proposedAuthority: "A1",
        connectedAccess: false,
        evidenceBasis: "unknown",
      }],
    },
  }));

  assert.equal(reported.systemAssessments[0].evidenceBasis, "reported");
  assert.equal(reported.criticalUnknowns.some(({ id }) => id === "system_record:writer"), false);
  assert.equal(unknown.criticalUnknowns.some(({ id }) => id === "system_record:writer"), true);
});

test("a system marked confirmed without a current record is treated as reported", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      systems: [{
        id: "writer",
        product: "Writing system",
        model: "Model A",
        role: "Draft",
        proposedAuthority: "A1",
        connectedAccess: false,
        evidenceBasis: "confirmed",
      }],
    },
  }));

  assert.equal(result.systemAssessments[0].evidenceBasis, "reported");
  assert.equal(result.criticalUnknowns.some(({ id }) => id === "system_record:writer"), false);
});

test("legacy project.system values remain available as a migrated system assessment", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A2",
      system: "Legacy assistant and model",
    },
  }));

  assert.equal(result.systemAssessments.length, 1);
  assert.equal(result.systemAssessments[0].name, "Legacy assistant and model");
  assert.equal(result.systemAssessments[0].proposedAuthority, "A2");
  assert.equal(result.systemAssessments[0].legacy, true);
});

test("multiple AI systems are assessed conservatively instead of averaged", () => {
  const result = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A2",
      aiSystems: [
        {
          id: "writer",
          name: "Writing system",
          model: "Model A",
          proposedAuthority: "A1",
          capabilityLevel: 100,
          permissionsConfirmed: true,
        },
        {
          id: "publisher",
          name: "Publishing system",
          model: "Model B",
          proposedAuthority: "A2",
          connectedAccess: true,
          permissionsConfirmed: false,
          capabilityLevel: 25,
        },
      ],
    },
  }));

  assert.equal(result.systemAssessments.length, 2);
  assert.ok(result.limitingSystemIds.includes("publisher"));
  assert.ok(result.gates.some(({ id }) => id === "system_permissions:publisher"));
  assert.ok(result.gates.some(({ id }) => id === "system_capability:publisher"));
  assert.equal(result.operationalMaxAuthority, "A1");
});

test("decision statuses distinguish operational fit, record strength, and the assigned role", () => {
  const notSupported = scoreAssessment(assessment({ answers: answers(0, "confirmed") }));
  const smaller = scoreAssessment(assessment({
    project: { consequence: "low", proposedAuthority: "A2" },
    answers: answers(100, "confirmed", { HUM1: { level: 50, basis: "confirmed" } }),
  }));
  const notDemonstrated = scoreAssessment(assessment({
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      reviewEvidenceBasis: "reported",
      reviewEvidenceNote: "Safeguards are described from memory",
    },
    answers: answers(100, "reported"),
  }));
  const conditional = scoreAssessment(assessment({ answers: answers(75, "confirmed") }));
  const strong = scoreAssessment(assessment());

  assert.equal(notSupported.decisionStatus.id, "not_supported");
  assert.equal(smaller.decisionStatus.id, "smaller_role");
  assert.equal(notDemonstrated.decisionStatus.id, "not_demonstrated");
  assert.equal(conditional.decisionStatus.id, "conditional");
  assert.equal(strong.decisionStatus.id, "strong");
  for (const result of [notSupported, smaller, notDemonstrated, conditional, strong]) {
    assert.ok(result.decisionStatus.label);
    assert.ok(result.decisionStatus.description);
  }
});

test("the four score bands have deterministic boundaries", () => {
  assert.equal(BAND_DEFINITIONS.length, 4);
  assert.equal(getBand(0), "The load exceeds the current setup");
  assert.equal(getBand(39), "The load exceeds the current setup");
  assert.equal(getBand(39.9), "The load exceeds the current setup");
  assert.equal(getBand(40), "A smaller AI role fits the current setup");
  assert.equal(getBand(59.9), "A smaller AI role fits the current setup");
  assert.equal(getBand(60), "The role depends on named limits");
  assert.equal(getBand(79.9), "The role depends on named limits");
  assert.equal(getBand(80), "Strong alignment under current conditions");
  assert.equal(getBand(101), "Strong alignment under current conditions");
  assert.equal(getBand("not-a-number"), "The load exceeds the current setup");
});

test("actions award no points until completed and structured recommendations state projected effects", () => {
  const result = scoreAssessment(assessment({
    project: { consequence: "high", proposedAuthority: "A2", connectedAccess: true },
    answers: answers(25, "reported"),
  }));

  for (const period of ["now", "within24h", "days", "weeks"]) {
    assert.ok(result.actions[period].length > 0);
    assert.ok(result.actions[period].length <= 2);
  }
  assert.match(result.actions.note, /planned action adds no points/i);
  assert.ok(result.recommendations.length > 0);
  for (const recommendation of result.recommendations) {
    assert.ok(recommendation.action);
    assert.ok(recommendation.timing);
    assert.equal(recommendation.scoreEffect.automaticChange, 0);
    assert.ok(Object.hasOwn(recommendation, "evidenceEffect"));
    assert.ok(Object.hasOwn(recommendation, "blocker"));
    assert.ok(Object.hasOwn(recommendation, "roleEffect"));
  }
});

test("changing models is offered only as a comparison test and never earns automatic points", () => {
  const result = scoreAssessment(assessment({
    answers: answers(100, "confirmed", {
      CAP1: { level: 25, basis: "confirmed" },
      CAP2: { level: 25, basis: "confirmed" },
    }),
  }));
  const modelTest = result.recommendations.find(({ modelChangeTest }) => modelChangeTest);

  assert.ok(modelTest);
  assert.match(modelTest.action, /same instructions.*acceptance criteria/i);
  assert.equal(modelTest.scoreEffect.automaticChange, 0);
  assert.match(modelTest.scoreEffect.condition, /Changing models earns no points/i);
  assert.match(modelTest.blocker.statement, /cannot fix missing human capacity/i);
});

test("role reduction changes required reliance rather than pretending to raise the score", () => {
  const result = scoreAssessment(assessment({
    project: { consequence: "low", proposedAuthority: "A2" },
    answers: answers(100, "confirmed", { HUM1: { level: 50, basis: "confirmed" } }),
  }));
  const adjustment = result.recommendations.find(({ category }) => category === "role_adjustment");

  assert.ok(adjustment);
  assert.equal(adjustment.scoreEffect.projectedChange, 0);
  assert.match(adjustment.scoreEffect.condition, /reduces the reliance required/i);
});

test("validation status remains separate from operational and evidence scores", () => {
  const untested = scoreAssessment(assessment()).validationStatus;
  const pilot = scoreAssessment(assessment({ validation: { observedRuns: 2 } })).validationStatus;
  const repeated = scoreAssessment(assessment({
    validation: {
      observedRuns: 3,
      representativeConditions: true,
      atLeastOneEdgeOrFailureCase: true,
      controlsActuallyOperated: true,
    },
  })).validationStatus;
  const sustained = scoreAssessment(assessment({
    validation: {
      observedRuns: 8,
      representativeConditions: true,
      atLeastOneEdgeOrFailureCase: true,
      controlsActuallyOperated: true,
      observedInRealUseForFullOperatingCycle: true,
      outcomeDataCollected: true,
      materialFailuresResolved: true,
    },
  })).validationStatus;
  const reportedProject = {
    consequence: "low",
    proposedAuthority: "A1",
    reviewEvidenceBasis: "reported",
    reviewEvidenceNote: "Use is recalled without a current operating record",
  };
  const pilotReported = scoreAssessment(assessment({
    project: reportedProject,
    validation: { observedRuns: 2 },
  })).validationStatus;
  const repeatedReported = scoreAssessment(assessment({
    project: reportedProject,
    validation: {
      observedRuns: 3,
      representativeConditions: true,
      atLeastOneEdgeOrFailureCase: true,
      controlsActuallyOperated: true,
    },
  })).validationStatus;
  const sustainedReported = scoreAssessment(assessment({
    project: reportedProject,
    validation: {
      observedRuns: 8,
      representativeConditions: true,
      atLeastOneEdgeOrFailureCase: true,
      controlsActuallyOperated: true,
      observedInRealUseForFullOperatingCycle: true,
      outcomeDataCollected: true,
      materialFailuresResolved: true,
    },
  })).validationStatus;

  assert.equal(untested, "Untested");
  assert.equal(pilot, "Pilot observed");
  assert.equal(repeated, "Repeated");
  assert.equal(sustained, "Sustained");
  assert.equal(pilotReported, "Pilot reported");
  assert.equal(repeatedReported, "Repeated use reported");
  assert.equal(sustainedReported, "Sustained use reported");
});

test("reported real-use claims can fit A3 operationally without establishing it with records", () => {
  const result = scoreAssessment(assessment({
    stage: "live",
    project: {
      consequence: "low",
      proposedAuthority: "A3",
      repeatedOrAutonomous: true,
      actionsAreReversible: true,
      monitoringConfirmed: true,
      reviewEvidenceBasis: "reported",
      reviewEvidenceNote: "The operating history is recalled but no current record is available",
    },
    answers: answers(100, "confirmed", { WF4: { level: 100, basis: "confirmed" } }),
    validation: {
      observedRuns: 8,
      representativeConditions: true,
      atLeastOneEdgeOrFailureCase: true,
      controlsActuallyOperated: true,
      observedInRealUseForFullOperatingCycle: true,
      outcomeDataCollected: true,
      materialFailuresResolved: true,
    },
  }));

  assert.equal(result.validationStatus, "Sustained use reported");
  assert.equal(result.operationalMaxAuthority, "A3");
  assert.notEqual(result.conclusionAuthority, "A3");
  assert.equal(result.proposedRoleOperationallySupported, true);
  assert.equal(result.proposedAuthoritySupported, false);
  assert.equal(result.decisionStatus.id, "not_demonstrated");
});

test("result preserves old UI fields and adds the revised result contract", () => {
  const result = scoreAssessment(assessment());

  assert.equal(AUTHORITY_LABELS.A1, "Produce for human approval");
  assert.equal(result.supportedAuthority, result.maxAuthority);
  assert.equal(result.publicScore, result.operationalScore);
  assert.ok(Array.isArray(result.authorization.delegate));
  assert.ok(Array.isArray(result.authorization.relyOn));
  assert.ok(Array.isArray(result.authorization.verify));
  assert.ok(Array.isArray(result.authorization.doNotAuthorize));
  assert.deepEqual(result.loadSummary.currentSetupCanCarry, result.authorization.delegate);
  assert.ok(Array.isArray(result.loadSummary.reportedSetupCanCarry));
  assert.deepEqual(result.loadSummary.evidenceCovers, result.authorization.relyOn);
  assert.deepEqual(result.loadSummary.stillNeedsCapableReview, result.authorization.verify);
  assert.deepEqual(result.loadSummary.exposedLoad, result.authorization.doNotAuthorize);
  assert.equal(result.activeQuestionIds.length, CORE_IDS.length);
  assert.ok(result.evidenceStrength.label);
  assert.ok(result.decisionStatus.label);
  assert.ok(Array.isArray(result.recommendations));
  assert.ok(Array.isArray(result.systemAssessments));
});
