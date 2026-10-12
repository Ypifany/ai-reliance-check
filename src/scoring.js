import {
  AUTHORITY_LEVELS,
  DIMENSIONS,
  METHOD_VERSION as QUESTION_METHOD_VERSION,
  getActiveQuestionDefinitions,
} from "./questions.js";

export const METHOD_VERSION = QUESTION_METHOD_VERSION;

export const AUTHORITY_LABELS = Object.freeze(
  Object.fromEntries(
    Object.entries(AUTHORITY_LEVELS).map(([id, definition]) => [id, definition.label]),
  ),
);

export const EVIDENCE_MULTIPLIERS = Object.freeze({
  confirmed: 1,
  reported: 0.75,
  unknown: 0,
});

const EVIDENCE_VALUES = Object.freeze({
  confirmed: 1,
  reported: 0.5,
  unknown: 0,
});

export const BAND_DEFINITIONS = Object.freeze([
  { min: 0, max: 19, label: "Unsupported" },
  { min: 20, max: 39, label: "Limited" },
  { min: 40, max: 59, label: "Conditional" },
  { min: 60, max: 79, label: "Controlled" },
  { min: 80, max: 94, label: "Strong but bounded" },
  { min: 95, max: 100, label: "Exceptional current assurance" },
]);

const DIMENSION_KEYS = Object.keys(DIMENSIONS);
const AUTHORITY_ORDER = ["A0", "A1", "A2", "A3"];
const CONSEQUENCE_ORDER = ["low", "moderate", "high", "critical"];
const ALLOWED_LEVELS = new Set([0, 25, 50, 75, 100]);

const ACTION_LIBRARY = Object.freeze({
  capability_gap: {
    now: "Run one normal case, one difficult case, and one likely failure case. Record pass or fail against three acceptance criteria.",
    within24h: "Run three to five representative cases under the exact configuration.",
    days: "Repeat the test with another reviewer or comparison method.",
    weeks: "Build a reusable regression set and rerun it after system changes.",
  },
  behavior_gap: {
    now: "Give the system a flawed premise and record whether it agrees, challenges, asks, or stops.",
    within24h: "Test the required behavior across several agreement and disagreement cases.",
    days: "Separate builder, challenger, and verifier passes and compare the results.",
    weeks: "Create a reusable behavior test set for this role.",
  },
  human_gap: {
    now: "List every material part and name who can judge it. Remove uncovered parts from the release.",
    within24h: "Find a capable reviewer for the highest-risk uncovered part.",
    days: "Complete the targeted review and record accepted, rejected, and unresolved findings.",
    weeks: "Establish a reusable review role for future projects.",
  },
  permission_gap: {
    now: "Inspect connected access and remove anything this task does not require.",
    within24h: "Confirm repository, data, publishing, and approval permissions in writing or screenshots.",
    days: "Test revocation, stopping, and rollback.",
    weeks: "Add periodic access reviews.",
  },
  workflow_gap: {
    now: "Add a human approval point before the first real consequence and preserve a rollback copy.",
    within24h: "Run and save the relevant build, link, behavior, mobile, accessibility, or deployment checks.",
    days: "Automate the checks that should block release.",
    weeks: "Review failures and update the release gate.",
  },
  outcome_gap: {
    now: "Define one success signal, one harm signal, who will check them, and when.",
    within24h: "Add a completion signal and a short feedback or observation method.",
    days: "Observe at least three intended users or use cycles.",
    weeks: "Compare results with the target and publish an updated Reliance Card.",
  },
});

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundOne(value) {
  return Number(value.toFixed(1));
}

function roundToNearestFive(value) {
  return clamp(Math.round(value / 5) * 5);
}

function normalizeLevel(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && ALLOWED_LEVELS.has(numeric) ? numeric : 0;
}

function normalizeBasis(value) {
  return Object.hasOwn(EVIDENCE_MULTIPLIERS, value) ? value : "unknown";
}

function normalizeAuthority(value) {
  return AUTHORITY_ORDER.includes(value) ? value : "A0";
}

function normalizeConsequence(value) {
  return CONSEQUENCE_ORDER.includes(value) ? value : "low";
}

function authorityRank(value) {
  return AUTHORITY_ORDER.indexOf(normalizeAuthority(value));
}

function lowerAuthority(first, second) {
  return authorityRank(first) <= authorityRank(second) ? first : second;
}

function isConfirmed(value) {
  return value === true || value === "confirmed";
}

function projectValue(assessment, name, fallback) {
  if (assessment?.project && assessment.project[name] !== undefined) {
    return assessment.project[name];
  }
  if (assessment?.[name] !== undefined) return assessment[name];
  return fallback;
}

function hasProjectValue(assessment, name) {
  return Boolean(assessment?.project) && Object.hasOwn(assessment.project, name);
}

function validationValue(assessment, name, fallback) {
  if (assessment?.validation && assessment.validation[name] !== undefined) {
    return assessment.validation[name];
  }
  return projectValue(assessment, name, fallback);
}

function consequenceAtLeast(consequence, comparison) {
  return CONSEQUENCE_ORDER.indexOf(consequence) >= CONSEQUENCE_ORDER.indexOf(comparison);
}

function weightedMean(entries) {
  const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);
  if (totalWeight === 0) return 0;
  return entries.reduce((total, entry) => total + entry.value * entry.weight, 0) / totalWeight;
}

function getDimensionWeights(activeIds) {
  const weights = {
    capabilityFit: { CAP1: 0.6, CAP2: 0.4 },
    behavioralFit: activeIds.has("BEH2")
      ? { BEH1: 0.6, BEH2: 0.4 }
      : { BEH1: 1 },
    humanAssurance: activeIds.has("HUM2")
      ? { HUM1: 0.6, HUM2: 0.4 }
      : { HUM1: 1 },
    workflowControl:
      activeIds.has("WF3") && activeIds.has("WF4")
        ? { WF1: 0.3, WF2: 0.3, WF3: 0.2, WF4: 0.2 }
        : activeIds.has("WF3")
          ? { WF1: 0.3, WF2: 0.3, WF3: 0.4 }
          : activeIds.has("WF4")
            ? { WF1: 0.3, WF2: 0.3, WF4: 0.4 }
            : { WF1: 0.5, WF2: 0.5 },
    outcomeTestability: { OUT1: 1 },
  };

  return weights;
}

function stageAdjustedLevel(questionId, level, assessment) {
  const stage = ["plan", "release", "live"].includes(assessment?.stage)
    ? assessment.stage
    : "plan";

  if (
    questionId === "CAP1" &&
    stage === "plan" &&
    !isConfirmed(projectValue(assessment, "priorMatchedEvidence", false)) &&
    !isConfirmed(projectValue(assessment, "priorEvidenceFromSameConfiguration", false))
  ) {
    return Math.min(level, 50);
  }

  if (
    questionId === "OUT1" &&
    stage === "release" &&
    projectValue(assessment, "outcomeDataActive", undefined) === false
  ) {
    return Math.min(level, 50);
  }

  return level;
}

function scoreItems(assessment, activeQuestions) {
  return Object.fromEntries(
    activeQuestions.map((question) => {
      const answer = assessment?.answers?.[question.id] || {};
      const rawLevel = normalizeLevel(answer.level ?? answer.value);
      const level = stageAdjustedLevel(question.id, rawLevel, assessment);
      const basis = normalizeBasis(answer.basis);
      const multiplier = EVIDENCE_MULTIPLIERS[basis];

      return [
        question.id,
        {
          questionId: question.id,
          dimension: question.dimension,
          rawLevel,
          level,
          basis,
          multiplier,
          score: roundOne(level * multiplier),
          wasCapped: level !== rawLevel,
        },
      ];
    }),
  );
}

function scoreDimensions(itemScores, dimensionWeights) {
  return Object.fromEntries(
    DIMENSION_KEYS.map((dimension) => {
      const entries = Object.entries(dimensionWeights[dimension]).map(([id, weight]) => ({
        value: itemScores[id]?.score || 0,
        weight,
      }));
      return [dimension, roundOne(weightedMean(entries))];
    }),
  );
}

function findCriticalUnknowns(assessment, itemScores, activeIds, consequence) {
  const unknowns = [];
  const isUnknown = (id) => itemScores[id]?.basis === "unknown";
  const proposedAuthority = normalizeAuthority(projectValue(assessment, "proposedAuthority", "A0"));
  const connectedAccess = projectValue(assessment, "connectedAccess", undefined);
  const permissions = projectValue(assessment, "permissionsConfirmed", undefined);
  const sensitiveData = projectValue(assessment, "sensitiveData", undefined);
  const dataAuthorization = projectValue(assessment, "dataAuthorizationConfirmed", undefined);

  if (
    (connectedAccess === true && (permissions == null || isUnknown("WF1"))) ||
    (connectedAccess === null && authorityRank(proposedAuthority) >= authorityRank("A2"))
  ) {
    unknowns.push({ id: "permissions", label: "Connected permissions are unknown." });
  }

  if (consequenceAtLeast(consequence, "high") && isUnknown("HUM1")) {
    unknowns.push({ id: "qualified_review", label: "Capable human coverage is unknown." });
  }

  if (isUnknown("WF2") || (activeIds.has("WF4") && isUnknown("WF4"))) {
    unknowns.push({ id: "stopping_recovery", label: "Stopping, checking, or recovery controls are unknown." });
  }

  if (sensitiveData === true && dataAuthorization == null) {
    unknowns.push({ id: "sensitive_data", label: "Authorization to provide sensitive data is unknown." });
  }

  return unknowns;
}

function evidenceConfidenceFor(assessment, itemScores, dimensionWeights, criticalUnknowns) {
  const weightedValues = [];

  for (const weights of Object.values(dimensionWeights)) {
    for (const [id, weight] of Object.entries(weights)) {
      weightedValues.push({
        value: EVIDENCE_VALUES[itemScores[id]?.basis || "unknown"],
        weight: weight / DIMENSION_KEYS.length,
      });
    }
  }

  const evidenceIndex = roundOne(weightedMean(weightedValues));
  let confidence = "Low";

  if (criticalUnknowns.length === 0 && evidenceIndex >= 0.75) confidence = "High";
  else if (criticalUnknowns.length === 0 && evidenceIndex >= 0.45) confidence = "Medium";

  const priorMatchedEvidence =
    isConfirmed(projectValue(assessment, "priorMatchedEvidence", false)) ||
    isConfirmed(projectValue(assessment, "priorEvidenceFromSameConfiguration", false));

  if (assessment?.stage === "plan" && !priorMatchedEvidence && confidence === "High") {
    confidence = "Medium";
  }

  return { evidenceIndex, confidence };
}

function getValidationStatus(assessment) {
  if (validationValue(assessment, "noEndToEndObservedRun", false) === true) {
    return "Untested";
  }

  const observedRuns = Math.max(0, Number(validationValue(assessment, "observedRuns", 0)) || 0);
  if (observedRuns === 0) return "Untested";
  if (observedRuns <= 2) return "Pilot observed";

  const repeated =
    validationValue(assessment, "representativeConditions", false) === true &&
    validationValue(assessment, "atLeastOneEdgeOrFailureCase", false) === true &&
    validationValue(assessment, "controlsActuallyOperated", false) === true;

  if (!repeated) return "Pilot observed";

  const sustained =
    validationValue(assessment, "observedInRealUseForFullOperatingCycle", false) === true &&
    validationValue(assessment, "outcomeDataCollected", false) === true &&
    validationValue(assessment, "materialFailuresResolved", false) === true;

  return sustained ? "Sustained" : "Repeated";
}

function getRequiredScore(consequence, proposedAuthority) {
  const stakeMinimum = { low: 40, moderate: 60, high: 75, critical: 85 };
  const authorityAddition = { A0: 0, A1: 0, A2: 5, A3: 10 };
  return Math.min(95, stakeMinimum[consequence] + authorityAddition[proposedAuthority]);
}

function buildGate({ id, title, effect, actionTrigger, blocking = false, authorityCap = null }) {
  return { id, title, effect, actionTrigger, blocking, authorityCap };
}

function evaluateGates(assessment, context) {
  const {
    activeIds,
    consequence,
    dimensions,
    itemScores,
    proposedAuthority,
  } = context;
  const gates = [];

  const wf1Confirmed = itemScores.WF1?.basis === "confirmed" && itemScores.WF1.score >= 75;
  const approvalConfirmed = hasProjectValue(assessment, "humanApprovalBeforeConsequence")
    ? isConfirmed(projectValue(assessment, "humanApprovalBeforeConsequence", false))
    : wf1Confirmed;
  const permissionsConfirmed = hasProjectValue(assessment, "permissionsConfirmed")
    ? isConfirmed(projectValue(assessment, "permissionsConfirmed", false))
    : wf1Confirmed;
  const connectedAccess = projectValue(assessment, "connectedAccess", undefined);
  const productionWork =
    activeIds.has("WF3") || projectValue(assessment, "productionCodeOrConfiguration", false) === true;
  const materialClaims =
    activeIds.has("HUM2") || projectValue(assessment, "materialClaims", false) === true;
  const challengeRequired = activeIds.has("BEH2");

  if (authorityRank(proposedAuthority) >= authorityRank("A2") && !approvalConfirmed) {
    gates.push(
      buildGate({
        id: "external_action_without_approval",
        title: "Approval before consequence is not confirmed",
        effect: "Block external or autonomous action; limit the system to proposing or drafting.",
        actionTrigger: "workflow_gap",
        blocking: true,
        authorityCap: "A1",
      }),
    );
  }

  if (
    (connectedAccess === true ||
      (connectedAccess === null && authorityRank(proposedAuthority) >= authorityRank("A2"))) &&
    !permissionsConfirmed
  ) {
    gates.push(
      buildGate({
        id: "unknown_or_broad_permissions",
        title: "Connected permissions are unknown or too broad",
        effect: "Block sensitive, external, or autonomous action until access is confirmed and narrowed.",
        actionTrigger: "permission_gap",
        blocking: true,
        authorityCap: "A1",
      }),
    );
  }

  if (consequenceAtLeast(consequence, "high") && dimensions.humanAssurance < 75) {
    gates.push(
      buildGate({
        id: "insufficient_human_coverage",
        title: "Human coverage is below the consequence level",
        effect: "Block consequential release or decision authority until capable review covers every material part.",
        actionTrigger: "human_gap",
        blocking: true,
        authorityCap: "A1",
      }),
    );
  }

  if (materialClaims && (itemScores.HUM2?.score || 0) < 75) {
    const highStakes = consequenceAtLeast(consequence, "high");
    gates.push(
      buildGate({
        id: "unverified_material_claims",
        title: "Material claims are not fully verified",
        effect: highStakes
          ? "Do not use the unverified claims in the high-consequence decision or release."
          : "Do not present material claims as verified; check them or label their uncertainty.",
        actionTrigger: "human_gap",
        blocking: highStakes,
        authorityCap: highStakes ? "A1" : null,
      }),
    );
  }

  if (productionWork && (itemScores.WF3?.score || 0) < 75) {
    gates.push(
      buildGate({
        id: "untested_production_change",
        title: "Production change is not technically demonstrated",
        effect: "Block unsupervised production release until relevant checks and recovery are demonstrated.",
        actionTrigger: "workflow_gap",
        blocking: true,
        authorityCap: "A1",
      }),
    );
  }

  if (dimensions.outcomeTestability < 50) {
    gates.push(
      buildGate({
        id: "outcome_not_observable",
        title: "The outcome is not yet observable",
        effect: "A limited pilot may proceed, but do not claim effectiveness or scale the arrangement.",
        actionTrigger: "outcome_gap",
      }),
    );
  }

  if (challengeRequired && dimensions.behavioralFit < 50) {
    gates.push(
      buildGate({
        id: "critic_not_demonstrated",
        title: "Challenge behavior is not demonstrated",
        effect: "Do not rely on the system as critic, verifier, or approver.",
        actionTrigger: "behavior_gap",
      }),
    );
  }

  if (projectValue(assessment, "unresolvedMaterialFailure", false) === true) {
    gates.push(
      buildGate({
        id: "known_material_failure",
        title: "A material failure remains unresolved",
        effect: "Block the affected action until the failure is resolved or explicitly removed from scope.",
        actionTrigger: "workflow_gap",
        blocking: true,
        authorityCap: "A0",
      }),
    );
  }

  if (
    projectValue(assessment, "sensitiveData", false) === true &&
    !isConfirmed(projectValue(assessment, "dataAuthorizationConfirmed", false))
  ) {
    gates.push(
      buildGate({
        id: "sensitive_data_handling_unknown",
        title: "Sensitive-data authorization is not confirmed",
        effect: "Do not provide the sensitive information to the system.",
        actionTrigger: "permission_gap",
        blocking: true,
        authorityCap: "A0",
      }),
    );
  }

  return gates;
}

function confidenceAtLeast(confidence, required) {
  const ranks = { Low: 0, Medium: 1, High: 2 };
  return ranks[confidence] >= ranks[required];
}

function determineMaxAuthority(assessment, context) {
  const {
    consequence,
    dimensions,
    evidenceConfidence,
    gates,
    overallScore,
    validationStatus,
  } = context;

  const hasBlockingGates = gates.some((gate) => gate.blocking);
  let authority = "A0";

  if (overallScore >= 40 && evidenceConfidence !== "Low") authority = "A1";

  if (
    overallScore >= 60 &&
    dimensions.humanAssurance >= 60 &&
    dimensions.workflowControl >= 60 &&
    !hasBlockingGates
  ) {
    authority = "A2";
  }

  const minimumCoreDimension = Math.min(
    dimensions.capabilityFit,
    dimensions.behavioralFit,
    dimensions.humanAssurance,
    dimensions.workflowControl,
  );

  if (
    overallScore >= 80 &&
    minimumCoreDimension >= 75 &&
    evidenceConfidence === "High" &&
    ["Repeated", "Sustained"].includes(validationStatus) &&
    !consequenceAtLeast(consequence, "high") &&
    isConfirmed(projectValue(assessment, "actionsAreReversible", false)) &&
    isConfirmed(projectValue(assessment, "monitoringConfirmed", false)) &&
    !hasBlockingGates
  ) {
    authority = "A3";
  }

  for (const gate of gates) {
    if (gate.authorityCap) authority = lowerAuthority(authority, gate.authorityCap);
  }

  return authority;
}

function minimumEvidenceMet(consequence, evidenceConfidence, assessment, itemScores) {
  if (consequence === "low") return true;
  if (consequence === "moderate") return confidenceAtLeast(evidenceConfidence, "Medium");
  if (!confidenceAtLeast(evidenceConfidence, "High")) return false;

  if (consequence === "critical") {
    return (
      isConfirmed(projectValue(assessment, "qualifiedIndependentReview", false)) ||
      (itemScores.HUM1?.basis === "confirmed" && itemScores.HUM1?.score >= 100)
    );
  }

  return true;
}

function actionTriggerForDimension(dimension) {
  return {
    capabilityFit: "capability_gap",
    behavioralFit: "behavior_gap",
    humanAssurance: "human_gap",
    workflowControl: "workflow_gap",
    outcomeTestability: "outcome_gap",
  }[dimension];
}

function actionTriggerForUnknown(id) {
  return {
    permissions: "permission_gap",
    qualified_review: "human_gap",
    stopping_recovery: "workflow_gap",
    sensitive_data: "permission_gap",
  }[id];
}

function buildActions(gates, dimensions, criticalUnknowns) {
  const triggers = [];
  const addTrigger = (trigger) => {
    if (trigger && ACTION_LIBRARY[trigger] && !triggers.includes(trigger) && triggers.length < 2) {
      triggers.push(trigger);
    }
  };

  for (const gate of gates) addTrigger(gate.actionTrigger);
  for (const unknown of criticalUnknowns) addTrigger(actionTriggerForUnknown(unknown.id));

  if (triggers.length < 2) {
    Object.entries(dimensions)
      .filter(([, score]) => score < 80)
      .sort((left, right) => left[1] - right[1])
      .forEach(([dimension]) => addTrigger(actionTriggerForDimension(dimension)));
  }

  return {
    now: triggers.map((trigger) => ACTION_LIBRARY[trigger].now),
    within24h: triggers.map((trigger) => ACTION_LIBRARY[trigger].within24h),
    days: triggers.map((trigger) => ACTION_LIBRARY[trigger].days),
    weeks: triggers.map((trigger) => ACTION_LIBRARY[trigger].weeks),
    note: "Completing an action may raise the score only after the resulting evidence is recorded.",
  };
}

function buildAuthorizationSummary(assessment, context) {
  const { activeIds, dimensions, gates, maxAuthority, proposedAuthority } = context;
  const delegate = [];
  const relyOn = [];
  const verify = [];
  const doNotAuthorize = gates.map((gate) => gate.effect);

  if (maxAuthority === "A0") {
    delegate.push("Private exploration, brainstorming, and draft suggestions with no direct consequence.");
  } else {
    delegate.push("Defined production work within the tested task and configuration.");
  }

  if (authorityRank(maxAuthority) >= authorityRank("A1")) {
    delegate.push("Drafts or recommendations that a capable person reviews before use.");
  }
  if (authorityRank(maxAuthority) >= authorityRank("A2")) {
    delegate.push("Defined reversible actions after the required human approval.");
  }
  if (maxAuthority === "A3") {
    delegate.push("Bounded unattended operation with monitoring, stopping, and rollback active.");
  }

  if (dimensions.capabilityFit >= 60) {
    relyOn.push("Outputs within the demonstrated cases, configuration, and stated limits.");
  } else {
    relyOn.push("Outputs only as leads or drafts until task-specific performance is demonstrated.");
  }

  if (activeIds.has("HUM2")) verify.push("Material factual or consequential claims.");
  if (activeIds.has("WF3")) verify.push("Build, links, key behavior, mobile, accessibility, deployment, and relevant security checks.");
  if (activeIds.has("WF4")) verify.push("Monitoring, stop controls, limits, and rollback during operation.");
  if (dimensions.humanAssurance < 75) verify.push("Every material part not yet covered by a capable reviewer.");
  if (dimensions.outcomeTestability < 75) verify.push("The intended result and likely harm after release or use.");

  if (authorityRank(proposedAuthority) > authorityRank(maxAuthority)) {
    doNotAuthorize.unshift(
      `${AUTHORITY_LABELS[proposedAuthority]} is above the currently supported ${maxAuthority} boundary.`,
    );
  }

  return { delegate, relyOn, verify, doNotAuthorize };
}

export function getBand(score) {
  const normalized = clamp(Number.isFinite(Number(score)) ? Number(score) : 0);
  return BAND_DEFINITIONS.find(({ min, max }) => normalized >= min && normalized <= max)?.label || "Unsupported";
}

/**
 * Deterministically score one task-specific human–AI arrangement.
 *
 * The model name never receives points. Only evidence about the configured
 * system, human coverage, workflow, and observable outcome does.
 */
export function scoreAssessment(assessment = {}) {
  const stage = ["plan", "release", "live"].includes(assessment.stage)
    ? assessment.stage
    : "plan";
  const normalizedAssessment = { ...assessment, stage };
  const activeQuestions = getActiveQuestionDefinitions(normalizedAssessment);
  const activeQuestionIds = activeQuestions.map(({ id }) => id);
  const activeIds = new Set(activeQuestionIds);
  const itemScores = scoreItems(normalizedAssessment, activeQuestions);
  const dimensionWeights = getDimensionWeights(activeIds);
  const dimensions = scoreDimensions(itemScores, dimensionWeights);
  const overallScore = roundOne(
    DIMENSION_KEYS.reduce((total, dimension) => total + dimensions[dimension], 0) /
      DIMENSION_KEYS.length,
  );
  const publicScore = roundToNearestFive(overallScore);
  const band = getBand(publicScore);

  const project = normalizedAssessment.project || {};
  const consequence = normalizeConsequence(project.consequence);
  const proposedAuthority = normalizeAuthority(project.proposedAuthority);
  const criticalUnknowns = findCriticalUnknowns(
    normalizedAssessment,
    itemScores,
    activeIds,
    consequence,
  );
  const { evidenceIndex, confidence: evidenceConfidence } = evidenceConfidenceFor(
    normalizedAssessment,
    itemScores,
    dimensionWeights,
    criticalUnknowns,
  );
  const validationStatus = getValidationStatus(normalizedAssessment);
  const requiredScore = getRequiredScore(consequence, proposedAuthority);
  const gates = evaluateGates(normalizedAssessment, {
    activeIds,
    consequence,
    dimensions,
    itemScores,
    proposedAuthority,
  });
  const maxAuthority = determineMaxAuthority(normalizedAssessment, {
    consequence,
    dimensions,
    evidenceConfidence,
    gates,
    overallScore,
    validationStatus,
  });
  const minimumEvidence = minimumEvidenceMet(
    consequence,
    evidenceConfidence,
    normalizedAssessment,
    itemScores,
  );
  const proposedAuthoritySupported =
    authorityRank(proposedAuthority) <= authorityRank(maxAuthority) &&
    overallScore >= requiredScore &&
    minimumEvidence;
  const actions = buildActions(gates, dimensions, criticalUnknowns);
  const authorization = buildAuthorizationSummary(normalizedAssessment, {
    activeIds,
    dimensions,
    gates,
    maxAuthority,
    proposedAuthority,
  });

  return {
    methodVersion: METHOD_VERSION,
    stage,
    overallScore,
    publicScore,
    band,
    dimensions,
    itemScores,
    activeQuestionIds,
    evidenceConfidence,
    evidenceIndex,
    criticalUnknowns,
    validationStatus,
    consequence,
    proposedAuthority,
    requiredScore,
    scoreGap: Math.max(0, roundOne(requiredScore - overallScore)),
    maxAuthority,
    supportedAuthority: maxAuthority,
    proposedAuthoritySupported,
    gates,
    authorization,
    actions,
  };
}

