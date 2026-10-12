import test from "node:test";
import assert from "node:assert/strict";

import {
  QUESTION_DEFINITIONS,
  getActiveQuestionDefinitions,
} from "../src/questions.js";
import {
  AUTHORITY_LABELS,
  METHOD_VERSION,
  getBand,
  scoreAssessment,
} from "../src/scoring.js";

const CORE_IDS = ["CAP1", "CAP2", "BEH1", "HUM1", "WF1", "WF2", "OUT1"];

function answers(level = 100, basis = "confirmed", additions = {}) {
  return {
    ...Object.fromEntries(CORE_IDS.map((id) => [id, { level, basis }])),
    ...additions,
  };
}

function assessment(overrides = {}) {
  const projectOverrides = overrides.project || {};
  return {
    stage: "release",
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      outcomeDataActive: true,
      workTypes: [],
      requiredBehaviors: [],
      ...projectOverrides,
    },
    answers: answers(),
    ...overrides,
    project: {
      consequence: "low",
      proposedAuthority: "A1",
      outcomeDataActive: true,
      workTypes: [],
      requiredBehaviors: [],
      ...projectOverrides,
    },
  };
}

test("question definitions expose renderable prompts, reasons, and five scored options", () => {
  assert.equal(METHOD_VERSION, "0.1");
  assert.ok(QUESTION_DEFINITIONS.length >= 11);

  for (const question of QUESTION_DEFINITIONS) {
    assert.match(question.id, /^[A-Z]+\d+$/);
    assert.ok(question.dimension);
    assert.ok(question.prompt.length > 10);
    assert.ok(question.why.length > 10);
    assert.deepEqual(
      question.options.map(({ value }) => value),
      [0, 25, 50, 75, 100],
    );
    for (const option of question.options) {
      assert.ok(option.label);
      assert.ok(option.description);
    }
  }
});

test("adaptive questions activate only for relevant project conditions", () => {
  const core = getActiveQuestionDefinitions(assessment()).map(({ id }) => id);
  assert.deepEqual(core, CORE_IDS);

  const adaptive = getActiveQuestionDefinitions(
    assessment({
      project: {
        consequence: "moderate",
        proposedAuthority: "A3",
        materialClaims: true,
        workTypes: ["website"],
        requiredBehaviors: ["Challenge assumptions"],
      },
    }),
  ).map(({ id }) => id);

  assert.ok(adaptive.includes("HUM2"));
  assert.ok(adaptive.includes("BEH2"));
  assert.ok(adaptive.includes("WF3"));
  assert.ok(adaptive.includes("WF4"));
});

test("a fully demonstrated low-consequence arrangement can support A3", () => {
  const result = scoreAssessment(
    assessment({
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
    }),
  );

  assert.equal(result.overallScore, 100);
  assert.equal(result.publicScore, 100);
  assert.equal(result.band, "Exceptional current assurance");
  assert.equal(result.evidenceConfidence, "High");
  assert.equal(result.validationStatus, "Sustained");
  assert.equal(result.maxAuthority, "A3");
  assert.equal(result.proposedAuthoritySupported, true);
  assert.deepEqual(result.gates, []);
});

test("reported evidence receives a 0.75 score multiplier but a 0.5 confidence value", () => {
  const result = scoreAssessment(assessment({ answers: answers(100, "reported") }));

  assert.equal(result.overallScore, 75);
  assert.equal(result.publicScore, 75);
  assert.equal(result.band, "Controlled");
  assert.equal(result.evidenceIndex, 0.5);
  assert.equal(result.evidenceConfidence, "Medium");
  assert.equal(result.itemScores.CAP1.multiplier, 0.75);
});

test("unknown evidence receives no credit and cannot produce NaN", () => {
  const unknown = scoreAssessment(assessment({ answers: {} }));
  const malformed = scoreAssessment(
    assessment({ answers: { CAP1: { level: "not-a-score", basis: "unsupported-basis" } } }),
  );

  assert.equal(unknown.overallScore, 0);
  assert.equal(unknown.publicScore, 0);
  assert.equal(unknown.band, "Unsupported");
  assert.equal(unknown.evidenceConfidence, "Low");
  assert.equal(unknown.maxAuthority, "A0");
  assert.ok(unknown.gates.some(({ id }) => id === "outcome_not_observable"));
  assert.equal(Number.isNaN(malformed.overallScore), false);
  assert.equal(malformed.itemScores.CAP1.score, 0);
});

test("Plan Check caps capability evidence and confidence unless matched prior evidence exists", () => {
  const projected = scoreAssessment(
    assessment({
      stage: "plan",
      project: { consequence: "low", proposedAuthority: "A1" },
    }),
  );

  assert.equal(projected.itemScores.CAP1.rawLevel, 100);
  assert.equal(projected.itemScores.CAP1.level, 50);
  assert.equal(projected.itemScores.CAP1.wasCapped, true);
  assert.equal(projected.dimensions.capabilityFit, 70);
  assert.equal(projected.overallScore, 94);
  assert.equal(projected.publicScore, 95);
  assert.equal(projected.evidenceConfidence, "Medium");

  const withPriorEvidence = scoreAssessment(
    assessment({
      stage: "plan",
      project: {
        consequence: "low",
        proposedAuthority: "A1",
        priorMatchedEvidence: true,
      },
    }),
  );
  assert.equal(withPriorEvidence.itemScores.CAP1.level, 100);
  assert.equal(withPriorEvidence.evidenceConfidence, "High");
});

test("Release Check caps outcome claims when data collection is not active", () => {
  const result = scoreAssessment(
    assessment({
      project: {
        consequence: "low",
        proposedAuthority: "A1",
        outcomeDataActive: false,
      },
    }),
  );

  assert.equal(result.itemScores.OUT1.level, 50);
  assert.equal(result.dimensions.outcomeTestability, 50);
});

test("adaptive branches use the specified dimension weights", () => {
  const result = scoreAssessment(
    assessment({
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
    }),
  );

  assert.equal(result.dimensions.behavioralFit, 60);
  assert.equal(result.dimensions.humanAssurance, 60);
  assert.equal(result.dimensions.workflowControl, 60);
  assert.equal(result.overallScore, 76);
  assert.ok(result.gates.some(({ id }) => id === "unverified_material_claims"));
  assert.ok(result.gates.some(({ id }) => id === "untested_production_change"));
});

test("a hard gate limits authority even when the average score is exceptional", () => {
  const result = scoreAssessment(
    assessment({
      project: {
        consequence: "low",
        proposedAuthority: "A2",
        productionCodeOrConfiguration: true,
      },
      answers: answers(100, "confirmed", {
        WF3: { level: 50, basis: "confirmed" },
      }),
    }),
  );

  assert.equal(result.overallScore, 96);
  assert.equal(result.publicScore, 95);
  assert.ok(result.gates.some(({ id }) => id === "untested_production_change"));
  assert.equal(result.maxAuthority, "A1");
  assert.equal(result.proposedAuthoritySupported, false);
});

test("reported permission boundaries do not satisfy a connected-access hard gate", () => {
  const result = scoreAssessment(
    assessment({
      project: {
        consequence: "low",
        proposedAuthority: "A2",
        connectedAccess: true,
        permissionsConfirmed: false,
        humanApprovalBeforeConsequence: true,
      },
      answers: answers(100, "confirmed", {
        WF1: { level: 100, basis: "reported" },
      }),
    }),
  );

  assert.ok(result.gates.some(({ id }) => id === "unknown_or_broad_permissions"));
  assert.equal(result.maxAuthority, "A1");
});

test("critical unknowns cap evidence confidence at Low", () => {
  const result = scoreAssessment(
    assessment({
      project: { consequence: "high", proposedAuthority: "A1" },
      answers: answers(100, "confirmed", {
        HUM1: { level: 100, basis: "unknown" },
      }),
    }),
  );

  assert.ok(result.evidenceIndex >= 0.75);
  assert.equal(result.evidenceConfidence, "Low");
  assert.ok(result.criticalUnknowns.some(({ id }) => id === "qualified_review"));
});

test("validation status is separate from the score", () => {
  const untested = scoreAssessment(assessment()).validationStatus;
  const pilot = scoreAssessment(
    assessment({ validation: { observedRuns: 2 } }),
  ).validationStatus;
  const repeated = scoreAssessment(
    assessment({
      validation: {
        observedRuns: 3,
        representativeConditions: true,
        atLeastOneEdgeOrFailureCase: true,
        controlsActuallyOperated: true,
      },
    }),
  ).validationStatus;
  const sustained = scoreAssessment(
    assessment({
      validation: {
        observedRuns: 8,
        representativeConditions: true,
        atLeastOneEdgeOrFailureCase: true,
        controlsActuallyOperated: true,
        observedInRealUseForFullOperatingCycle: true,
        outcomeDataCollected: true,
        materialFailuresResolved: true,
      },
    }),
  ).validationStatus;

  assert.equal(untested, "Untested");
  assert.equal(pilot, "Pilot observed");
  assert.equal(repeated, "Repeated");
  assert.equal(sustained, "Sustained");
});

test("required assurance reflects both consequence and proposed authority", () => {
  assert.equal(
    scoreAssessment(assessment({ project: { consequence: "low", proposedAuthority: "A0" } }))
      .requiredScore,
    40,
  );
  assert.equal(
    scoreAssessment(
      assessment({ project: { consequence: "moderate", proposedAuthority: "A2" } }),
    ).requiredScore,
    65,
  );
  assert.equal(
    scoreAssessment(assessment({ project: { consequence: "critical", proposedAuthority: "A3" } }))
      .requiredScore,
    95,
  );
});

test("high-consequence work cannot receive unattended A3 authority", () => {
  const result = scoreAssessment(
    assessment({
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
    }),
  );

  assert.equal(result.maxAuthority, "A2");
  assert.equal(result.proposedAuthoritySupported, false);
});

test("critical consequence requires qualified independent review even with a perfect score", () => {
  const withoutIndependentReview = scoreAssessment(
    assessment({
      stage: "live",
      project: { consequence: "critical", proposedAuthority: "A2" },
      answers: answers(100, "confirmed", {
        HUM1: { level: 75, basis: "confirmed" },
      }),
    }),
  );
  const withIndependentReview = scoreAssessment(
    assessment({
      stage: "live",
      project: {
        consequence: "critical",
        proposedAuthority: "A2",
        qualifiedIndependentReview: true,
      },
    }),
  );

  assert.equal(withoutIndependentReview.proposedAuthoritySupported, false);
  assert.equal(withIndependentReview.proposedAuthoritySupported, true);
});

test("an explicitly unknown connected permission state blocks external authority", () => {
  const result = scoreAssessment(
    assessment({
      project: {
        consequence: "low",
        proposedAuthority: "A2",
        connectedAccess: null,
        permissionsConfirmed: null,
        humanApprovalBeforeConsequence: true,
      },
    }),
  );

  assert.equal(result.evidenceConfidence, "Low");
  assert.ok(result.gates.some(({ id }) => id === "unknown_or_broad_permissions"));
  assert.equal(result.maxAuthority, "A0");
});

test("sensitive-data and known-failure gates cannot be averaged away", () => {
  const sensitive = scoreAssessment(
    assessment({
      project: {
        consequence: "low",
        proposedAuthority: "A2",
        sensitiveData: true,
      },
    }),
  );
  assert.ok(sensitive.gates.some(({ id }) => id === "sensitive_data_handling_unknown"));
  assert.equal(sensitive.maxAuthority, "A0");

  const failed = scoreAssessment(
    assessment({
      project: {
        consequence: "low",
        proposedAuthority: "A2",
        unresolvedMaterialFailure: true,
      },
    }),
  );
  assert.ok(failed.gates.some(({ id }) => id === "known_material_failure"));
  assert.equal(failed.maxAuthority, "A0");
});

test("actions prioritize hard gates, contain at most two per period, and do not award credit", () => {
  const result = scoreAssessment(
    assessment({
      project: {
        consequence: "high",
        proposedAuthority: "A2",
        connectedAccess: true,
        productionCodeOrConfiguration: true,
      },
      answers: answers(25, "reported", {
        WF3: { level: 0, basis: "unknown" },
      }),
    }),
  );

  for (const period of ["now", "within24h", "days", "weeks"]) {
    assert.ok(result.actions[period].length > 0);
    assert.ok(result.actions[period].length <= 2);
  }
  assert.match(result.actions.note, /only after.*evidence/i);
  assert.equal(result.publicScore, 15);
});

test("public scores round to five and band boundaries are deterministic", () => {
  assert.equal(getBand(0), "Unsupported");
  assert.equal(getBand(19), "Unsupported");
  assert.equal(getBand(20), "Limited");
  assert.equal(getBand(40), "Conditional");
  assert.equal(getBand(60), "Controlled");
  assert.equal(getBand(80), "Strong but bounded");
  assert.equal(getBand(95), "Exceptional current assurance");
  assert.equal(getBand(101), "Exceptional current assurance");
  assert.equal(getBand("not-a-number"), "Unsupported");

  const result = scoreAssessment(
    assessment({
      answers: answers(50, "confirmed", { CAP1: { level: 75, basis: "confirmed" } }),
    }),
  );
  assert.equal(result.overallScore, 53);
  assert.equal(result.publicScore, 55);
  assert.equal(result.band, "Conditional");
});

test("the result exposes UI-ready authority and decision sections", () => {
  const result = scoreAssessment(assessment());

  assert.equal(AUTHORITY_LABELS.A1, "Produce for human approval");
  assert.equal(result.supportedAuthority, result.maxAuthority);
  assert.ok(Array.isArray(result.authorization.delegate));
  assert.ok(Array.isArray(result.authorization.relyOn));
  assert.ok(Array.isArray(result.authorization.verify));
  assert.ok(Array.isArray(result.authorization.doNotAuthorize));
  assert.equal(result.activeQuestionIds.length, CORE_IDS.length);
});

