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

/**
 * Retained for v0.1 consumers. Evidence no longer discounts the operational
 * score. It is reported separately and limits the strength of the conclusion.
 */
export const EVIDENCE_MULTIPLIERS = Object.freeze({
  confirmed: 1,
  reported: 1,
  unknown: 1,
});

const EVIDENCE_VALUES = Object.freeze({ confirmed: 1, reported: 0.5, unknown: 0 });

export const BAND_DEFINITIONS = Object.freeze([
  { min: 0, max: 39, id: "not_supported", label: "The load exceeds the current setup" },
  { min: 40, max: 59, id: "smaller_role", label: "A smaller AI role fits the current setup" },
  { min: 60, max: 79, id: "conditional", label: "The role depends on named limits" },
  { min: 80, max: 100, id: "strong", label: "Strong alignment under current conditions" },
]);

const DIMENSION_KEYS = Object.keys(DIMENSIONS);
const AUTHORITY_ORDER = ["A0", "A1", "A2", "A3"];
const CONSEQUENCE_ORDER = ["low", "moderate", "high", "critical"];
const ALLOWED_LEVELS = new Set([0, 25, 50, 75, 100]);
const STAGES = new Set(["plan", "release", "live"]);

const ACTION_LIBRARY = Object.freeze({
  capability_gap: {
    dimension: "capabilityFit",
    target: 75,
    scoreEvidence: "Saved results from normal, difficult, edge, and likely failure cases under the exact setup.",
    evidenceEffect: "Adds task-specific performance records.",
    roleEffect: "Could make a larger production role fit if the tests pass.",
    now: "Run one normal case, one difficult case, and one likely failure case. Record pass or fail against three acceptance criteria.",
    within24h: "Run three to five representative cases under the exact configuration.",
    days: "Repeat the test with another reviewer or comparison method.",
    weeks: "Build a reusable regression set and rerun it after system changes.",
  },
  behavior_gap: {
    dimension: "behavioralFit",
    target: 75,
    scoreEvidence: "Saved tests showing when the AI agreed, challenged, identified uncertainty, asked, or stopped.",
    evidenceEffect: "Adds records of the behavior this role requires.",
    roleEffect: "Could make roles that depend on challenge, uncertainty, or stopping fit if the tests pass.",
    now: "Give the AI a flawed premise and record whether it agrees, challenges, asks, or stops.",
    within24h: "Test the required behavior across several agreement and disagreement cases.",
    days: "Separate builder, challenger, and verifier passes and compare the results.",
    weeks: "Create a reusable behavior test set for this role.",
  },
  human_gap: {
    dimension: "humanAssurance",
    target: 75,
    scoreEvidence: "A named reviewer, the parts they reviewed, their relevant capacity, findings, and authority to require changes or stop release.",
    evidenceEffect: "Documents capable human coverage for important parts of the work.",
    roleEffect: "Could make the requested role fit when the missing knowledge, access, authority, time, or review coverage is added.",
    now: "List every important part and name who can judge it. Remove uncovered parts from the release.",
    within24h: "Add a capable reviewer for the highest-risk uncovered part and give them access and authority to require changes.",
    days: "Complete the targeted review and record what was kept, changed, left out, or remains unresolved.",
    weeks: "Establish a reusable review role and workload limit for future projects.",
  },
  sustainability_gap: {
    dimension: "humanAssurance",
    target: 75,
    scoreEvidence: "A review plan tested at the expected volume and pace, including the time required and backup coverage.",
    evidenceEffect: "Shows whether required human review can be maintained, not merely performed once.",
    roleEffect: "Could make repeated use fit after the amount of work, pace, staffing, or AI role is adjusted.",
    now: "Reduce the volume, pace, or AI role to an amount you can review reliably today.",
    within24h: "Time one complete review cycle and calculate whether it fits the expected workload.",
    days: "Add backup review coverage or automate checks that can reliably block a bad result.",
    weeks: "Test the review process during a full operating cycle and set a workload limit.",
  },
  permission_gap: {
    dimension: "workflowControl",
    target: 75,
    scoreEvidence: "Current permission records or screenshots plus a completed revocation, stop, or rollback check.",
    evidenceEffect: "Confirms what the AI can reach and do.",
    roleEffect: "Could make external or reversible action fit after access is narrowed and checked.",
    now: "Inspect connected access and remove anything this work does not require.",
    within24h: "Confirm repository, data, publishing, and approval permissions in writing or screenshots.",
    days: "Test revocation, stopping, and rollback.",
    weeks: "Add periodic access reviews.",
  },
  workflow_gap: {
    dimension: "workflowControl",
    target: 75,
    scoreEvidence: "Saved approval, test, stop, recovery, and release records from the actual workflow.",
    evidenceEffect: "Documents that the control operated rather than appearing only in a plan.",
    roleEffect: "Could make consequence-creating AI actions fit when the checks can stop or correct the work.",
    now: "Add a human approval point before the first real consequence and preserve a rollback copy.",
    within24h: "Run and save the relevant build, link, behavior, mobile, accessibility, or deployment checks.",
    days: "Automate the checks that should block release.",
    weeks: "Review failures and update the release gate.",
  },
  outcome_gap: {
    dimension: "outcomeTestability",
    target: 75,
    scoreEvidence: "A defined success signal, harm signal, threshold, owner, timing, and data source.",
    evidenceEffect: "Makes the expected result and warning signs visible.",
    roleEffect: "Could make continued or expanded use fit after results and harms can be recognized.",
    now: "Define one success signal, one harm signal, who will check them, and when.",
    within24h: "Add a completion signal and a short feedback or observation method.",
    days: "Observe at least three intended users or use cycles.",
    weeks: "Compare the results with the target, rerun the Load Test, and save the updated result.",
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

function bandDefinitionFor(value) {
  const normalized = clamp(value);
  return [...BAND_DEFINITIONS].reverse().find(({ min }) => normalized >= min)
    || BAND_DEFINITIONS[0];
}

function roundPublicScore(value) {
  const normalized = clamp(value);
  const rounded = roundToNearestFive(normalized);
  const rawBand = bandDefinitionFor(normalized);
  const roundedBand = bandDefinitionFor(rounded);
  return rawBand.id === roundedBand.id ? rounded : rawBand.max;
}

function normalizeLevel(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && ALLOWED_LEVELS.has(numeric) ? numeric : 0;
}

function normalizeFlexibleLevel(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric) : null;
}

function normalizeBasis(value) {
  return Object.hasOwn(EVIDENCE_VALUES, value) ? value : "unknown";
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

function hasIndependentReviewRecord(assessment) {
  return [
    "independentReviewerName",
    "independentReviewerRole",
    "independentReviewScope",
    "independentReviewDate",
    "independentReviewEvidence",
  ].every((name) => String(projectValue(assessment, name, "")).trim());
}

function reviewEvidenceBasisFor(assessment) {
  const requestedBasis = normalizeBasis(projectValue(assessment, "reviewEvidenceBasis", "unknown"));
  const hasCurrentRecord = Boolean(
    String(projectValue(assessment, "reviewEvidenceNote", "")).trim() ||
    String(projectValue(assessment, "reviewEvidenceUrl", "")).trim(),
  );
  return requestedBasis === "confirmed" && !hasCurrentRecord ? "reported" : requestedBasis;
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
  return {
    humanAssurance: activeIds.has("HUM2")
      ? { HUM1: 0.5, HUM3: 0.25, HUM2: 0.25 }
      : { HUM1: 0.7, HUM3: 0.3 },
    capabilityFit: { CAP1: 0.6, CAP2: 0.4 },
    behavioralFit: activeIds.has("BEH2")
      ? { BEH1: 0.6, BEH2: 0.4 }
      : { BEH1: 1 },
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
}

function stageAdjustedLevel(questionId, level, assessment) {
  // Operational answers describe the reported setup. Evidence is evaluated
  // separately and must never lower the operational level selected here.
  void questionId;
  void assessment;
  return level;
}

function scoreItems(assessment, activeQuestions) {
  return Object.fromEntries(
    activeQuestions.map((question) => {
      const answer = assessment?.answers?.[question.id] || {};
      const rawLevel = normalizeLevel(answer.level ?? answer.value);
      const level = stageAdjustedLevel(question.id, rawLevel, assessment);
      const requestedBasis = normalizeBasis(answer.basis);
      const hasCurrentRecord = Boolean(
        String(answer.evidenceNote || "").trim() || String(answer.evidenceUrl || "").trim(),
      );
      const basis = requestedBasis === "confirmed" && !hasCurrentRecord ? "reported" : requestedBasis;
      return [question.id, {
        questionId: question.id,
        dimension: question.dimension,
        rawLevel,
        level,
        basis,
        evidenceValue: EVIDENCE_VALUES[basis],
        multiplier: 1,
        score: level,
        operationalScore: level,
        wasCapped: level !== rawLevel,
        answered: Boolean(assessment?.answers && Object.hasOwn(assessment.answers, question.id)),
      }];
    }),
  );
}

function scoreDimensions(itemScores, dimensionWeights) {
  return Object.fromEntries(
    DIMENSION_KEYS.map((dimension) => {
      const entries = Object.entries(dimensionWeights[dimension]).map(([id, weight]) => ({
        value: itemScores[id]?.operationalScore || 0,
        weight,
      }));
      return [dimension, roundOne(weightedMean(entries))];
    }),
  );
}

function normalizeSystemRecords(assessment) {
  const project = assessment?.project || {};
  const raw = project.aiSystems ?? project.systems ?? assessment?.aiSystems ?? assessment?.systems;
  if (!Array.isArray(raw) || raw.length === 0) {
    if (!project.system) return [];
    return [{
      id: "system-1",
      name: String(project.system),
      model: project.model || "",
      role: project.systemRole || "",
      proposedAuthority: normalizeAuthority(project.proposedAuthority),
      legacy: true,
      material: true,
    }];
  }
  return raw.map((record, index) => {
    const value = record && typeof record === "object" ? record : { name: String(record || "") };
    return {
      id: String(value.id || `system-${index + 1}`),
      name: String(value.name || value.product || value.system || `AI system ${index + 1}`),
      model: String(value.model || value.modelVersion || ""),
      role: String(value.role || value.assignedRole || ""),
      proposedAuthority: normalizeAuthority(value.proposedAuthority ?? value.authority ?? project.proposedAuthority),
      supportedAuthority: AUTHORITY_ORDER.includes(value.supportedAuthority) ? value.supportedAuthority : null,
      capabilityLevel: normalizeFlexibleLevel(value.capabilityLevel ?? value.capabilityScore),
      behaviorLevel: normalizeFlexibleLevel(value.behaviorLevel ?? value.behaviorScore),
      connectedAccess: value.connectedAccess,
      permissionsConfirmed: value.permissionsConfirmed,
      unresolvedMaterialFailure: value.unresolvedMaterialFailure === true,
      reviewSustainable: value.reviewSustainable,
      evidence: String(value.evidence || value.evidenceNote || ""),
      evidenceBasis: normalizeBasis(value.evidenceBasis ?? value.basis) === "confirmed" &&
        !String(value.evidence || value.evidenceNote || "").trim()
        ? "reported"
        : normalizeBasis(value.evidenceBasis ?? value.basis),
      material: value.material !== false,
      legacy: false,
    };
  });
}

function findCriticalUnknowns(assessment, itemScores, activeIds, consequence, systems) {
  const unknowns = [];
  const isUnknown = (id) => itemScores[id]?.basis === "unknown";
  const proposedAuthority = normalizeAuthority(projectValue(assessment, "proposedAuthority", "A0"));
  const connectedAccess = projectValue(assessment, "connectedAccess", undefined);
  const permissions = projectValue(assessment, "permissionsConfirmed", undefined);
  const sensitiveData = projectValue(assessment, "sensitiveData", undefined);
  const dataAuthorization = projectValue(assessment, "dataAuthorizationConfirmed", undefined);
  const reviewEvidenceBasis = reviewEvidenceBasisFor(assessment);
  if (authorityRank(proposedAuthority) >= authorityRank("A1") && reviewEvidenceBasis === "unknown") {
    unknowns.push({ id: "safeguard_evidence", label: "The final safeguard and operating answers do not have a stated evidence basis." });
  }
  if (
    (connectedAccess === true && (permissions == null || isUnknown("WF1"))) ||
    (connectedAccess === null && authorityRank(proposedAuthority) >= authorityRank("A2"))
  ) unknowns.push({ id: "permissions", label: "Connected permissions are unknown." });
  if (consequenceAtLeast(consequence, "high") && isUnknown("HUM1")) {
    unknowns.push({ id: "qualified_review", label: "Your ability to catch and correct a serious error is unknown." });
  }
  if (
    (authorityRank(proposedAuthority) >= authorityRank("A2") || projectValue(assessment, "repeatedOrAutonomous", false)) &&
    isUnknown("HUM3")
  ) {
    unknowns.push({ id: "sustainable_review", label: "Sustainable review at the expected volume and pace is unknown." });
  }
  if (isUnknown("WF2") || (activeIds.has("WF4") && isUnknown("WF4"))) {
    unknowns.push({ id: "stopping_recovery", label: "Stopping, checking, or recovery controls are unknown." });
  }
  if (sensitiveData === true && dataAuthorization == null) {
    unknowns.push({ id: "sensitive_data", label: "Authorization to provide sensitive data is unknown." });
  }
  for (const system of systems) {
    if (!system.legacy && system.material && system.evidenceBasis === "unknown") {
      unknowns.push({
        id: `system_record:${system.id}`,
        systemId: system.id,
        label: `${system.name}${system.model ? ` (${system.model})` : ""} does not have a current supporting record or self-reported setup description.`,
      });
    }
    if (
      !system.legacy && system.material &&
      authorityRank(system.proposedAuthority) >= authorityRank("A2") &&
      system.connectedAccess !== false && !isConfirmed(system.permissionsConfirmed)
    ) {
      unknowns.push({
        id: `system_permissions:${system.id}`,
        systemId: system.id,
        label: `${system.name}${system.model ? ` (${system.model})` : ""} does not have confirmed permission limits.`,
      });
    }
  }
  return unknowns;
}

function evidenceStrengthFor(assessment, itemScores, dimensionWeights, criticalUnknowns, systems) {
  const weightedValues = [];
  const basisCounts = { confirmed: 0, reported: 0, unknown: 0 };
  for (const weights of Object.values(dimensionWeights)) {
    for (const [id, weight] of Object.entries(weights)) {
      const basis = itemScores[id]?.basis || "unknown";
      basisCounts[basis] += 1;
      weightedValues.push({ value: EVIDENCE_VALUES[basis], weight: weight / DIMENSION_KEYS.length });
    }
  }
  let evidenceIndex = roundOne(weightedMean(weightedValues));
  const explicitMaterialSystems = systems.filter((system) => !system.legacy && system.material);
  if (explicitMaterialSystems.length) {
    const weakestSystemEvidence = Math.min(
      ...explicitMaterialSystems.map((system) => EVIDENCE_VALUES[system.evidenceBasis]),
    );
    evidenceIndex = roundOne(Math.min(evidenceIndex, weakestSystemEvidence));
    for (const system of explicitMaterialSystems) basisCounts[system.evidenceBasis] += 1;
  }
  if (hasProjectValue(assessment, "reviewEvidenceBasis")) {
    const reviewBasis = reviewEvidenceBasisFor(assessment);
    basisCounts[reviewBasis] += 1;
    evidenceIndex = roundOne(Math.min(evidenceIndex, EVIDENCE_VALUES[reviewBasis]));
  }
  const independent = isConfirmed(projectValue(assessment, "qualifiedIndependentReview", false)) &&
    hasIndependentReviewRecord(assessment);
  let id = "not_enough_information";
  let label = "Not enough information";
  if (independent && criticalUnknowns.length === 0 && evidenceIndex >= 0.75) {
    id = "independently_checked";
    label = "Independent review recorded";
  } else if (criticalUnknowns.length === 0 && evidenceIndex >= 0.75) {
    id = "key_steps_documented";
    label = "Records identified for key steps";
  } else if (basisCounts.confirmed > 0 && evidenceIndex >= 0.3) {
    id = "partly_documented";
    label = "Some supporting records identified";
  } else if (basisCounts.reported > 0) {
    id = "self_described";
    label = "Self-described";
  }
  let confidence = "Low";
  if (["key_steps_documented", "independently_checked"].includes(id)) confidence = "High";
  else if (id === "partly_documented" && criticalUnknowns.length === 0) confidence = "Medium";
  const priorMatchedEvidence =
    isConfirmed(projectValue(assessment, "priorMatchedEvidence", false)) ||
    isConfirmed(projectValue(assessment, "priorEvidenceFromSameConfiguration", false));
  if (assessment?.stage === "plan" && !priorMatchedEvidence && confidence === "High") {
    confidence = "Medium";
    if (id === "key_steps_documented") {
      id = "partly_documented";
      label = "Some supporting records identified";
    }
  }
  const description = {
    not_enough_information: "Important parts of this human and AI setup do not yet have enough supporting information.",
    self_described: "This setup is described by the person completing the Load Test, without records confirming the key steps.",
    partly_documented: "You identified records for some parts of the account, but important steps or controls still lack a supporting record.",
    key_steps_documented: "You identified current supporting records for the important facts about the AI role, workflow, and result.",
    independently_checked: "You recorded a named independent reviewer, review scope, date, and review record within clearly stated limits.",
  }[id];
  return {
    evidenceIndex,
    confidence,
    strength: { id, label, description, basisCounts, criticalUnknownCount: criticalUnknowns.length },
  };
}

function getValidationStatus(assessment) {
  if (validationValue(assessment, "noEndToEndObservedRun", false) === true) return "Untested";
  const observedRuns = Math.max(0, Number(validationValue(assessment, "observedRuns", 0)) || 0);
  if (observedRuns === 0) return "Untested";
  const reviewEvidenceBasis = reviewEvidenceBasisFor(assessment);
  if (observedRuns <= 2) return reviewEvidenceBasis === "confirmed" ? "Pilot observed" : "Pilot reported";
  const repeated =
    validationValue(assessment, "representativeConditions", false) === true &&
    validationValue(assessment, "atLeastOneEdgeOrFailureCase", false) === true &&
    validationValue(assessment, "controlsActuallyOperated", false) === true;
  if (!repeated) return reviewEvidenceBasis === "confirmed" ? "Pilot observed" : "Pilot reported";
  const sustained =
    validationValue(assessment, "observedInRealUseForFullOperatingCycle", false) === true &&
    validationValue(assessment, "outcomeDataCollected", false) === true &&
    validationValue(assessment, "materialFailuresResolved", false) === true;
  if (reviewEvidenceBasis !== "confirmed") return sustained ? "Sustained use reported" : "Repeated use reported";
  return sustained ? "Sustained" : "Repeated";
}

function getRequiredScore(consequence, proposedAuthority) {
  const stakeMinimum = { low: 40, moderate: 60, high: 75, critical: 85 };
  const authorityAddition = { A0: 0, A1: 0, A2: 5, A3: 10 };
  return Math.min(95, stakeMinimum[consequence] + authorityAddition[proposedAuthority]);
}

function buildGate({ id, title, effect, actionTrigger, blocking = false, authorityCap = null, systemId = null }) {
  return { id, title, effect, actionTrigger, blocking, authorityCap, systemId };
}

function evaluateSystemGates(systems) {
  const gates = [];
  for (const system of systems) {
    if (system.legacy || !system.material) continue;
    const suffix = system.model ? ` (${system.model})` : "";
    if (system.unresolvedMaterialFailure) {
      gates.push(buildGate({
        id: `system_material_failure:${system.id}`,
        systemId: system.id,
        title: `${system.name}${suffix} has an unresolved serious failure`,
        effect: "If unchanged, the unresolved failure can reach the work before it is corrected or contained.",
        actionTrigger: "workflow_gap",
        blocking: true,
        authorityCap: "A0",
      }));
    }
    if (
      authorityRank(system.proposedAuthority) >= authorityRank("A2") &&
      system.connectedAccess !== false && !isConfirmed(system.permissionsConfirmed)
    ) {
      gates.push(buildGate({
        id: `system_permissions:${system.id}`,
        systemId: system.id,
        title: `${system.name}${suffix} does not have confirmed permission limits`,
        effect: "If unchanged, this system can act through access that has not been fully known, narrowed, and tested.",
        actionTrigger: "permission_gap",
        blocking: true,
        authorityCap: "A1",
      }));
    }
    if (system.capabilityLevel !== null && system.capabilityLevel < 50) {
      gates.push(buildGate({
        id: `system_capability:${system.id}`,
        systemId: system.id,
        title: `${system.name}${suffix} has not shown that it can handle its assigned role`,
        effect: "If unchanged, the workflow depends on this system performing work it has not demonstrated under task-specific tests.",
        actionTrigger: "capability_gap",
        blocking: authorityRank(system.proposedAuthority) >= authorityRank("A2"),
        authorityCap: "A1",
      }));
    }
    if (system.behaviorLevel !== null && system.behaviorLevel < 50) {
      gates.push(buildGate({
        id: `system_behavior:${system.id}`,
        systemId: system.id,
        title: `${system.name}${suffix} has not shown the behavior its role requires`,
        effect: "If unchanged, the workflow depends on challenge, verification, uncertainty, or stopping behavior that has not been demonstrated.",
        actionTrigger: "behavior_gap",
        authorityCap: "A1",
      }));
    }
    if (system.reviewSustainable === false) {
      gates.push(buildGate({
        id: `system_review_load:${system.id}`,
        systemId: system.id,
        title: `${system.name}${suffix} creates more review than can be sustained`,
        effect: "At the expected pace or volume, the required review is likely to break down.",
        actionTrigger: "sustainability_gap",
        blocking: authorityRank(system.proposedAuthority) >= authorityRank("A2"),
        authorityCap: "A1",
      }));
    }
    if (system.supportedAuthority) {
      const cap = lowerAuthority(system.proposedAuthority, system.supportedAuthority);
      if (authorityRank(cap) < authorityRank(system.proposedAuthority)) {
        gates.push(buildGate({
          id: `system_authority_limit:${system.id}`,
          systemId: system.id,
          title: `${system.name}${suffix} supports a smaller role than the one assigned`,
          effect: `The current setup carries ${AUTHORITY_LABELS[cap].toLowerCase()}, not the larger role assigned to this system.`,
          actionTrigger: "capability_gap",
          blocking: true,
          authorityCap: cap,
        }));
      }
    }
  }
  return gates;
}

function evaluateGates(assessment, context) {
  const { activeIds, consequence, dimensions, itemScores, proposedAuthority, systems } = context;
  const gates = [];
  const wf1Operational = (itemScores.WF1?.level ?? 0) >= 75;
  const approvalConfirmed = hasProjectValue(assessment, "humanApprovalBeforeConsequence")
    ? isConfirmed(projectValue(assessment, "humanApprovalBeforeConsequence", false))
    : wf1Operational;
  const wf2RecoveryOperational = (itemScores.WF2?.level ?? 0) >= 100;
  const reversibilityConfirmed = hasProjectValue(assessment, "actionsAreReversible")
    ? isConfirmed(projectValue(assessment, "actionsAreReversible", false))
    : wf2RecoveryOperational;
  const permissionsConfirmed = hasProjectValue(assessment, "permissionsConfirmed")
    ? isConfirmed(projectValue(assessment, "permissionsConfirmed", false))
    : wf1Operational;
  const connectedAccess = projectValue(assessment, "connectedAccess", undefined);
  const productionWork = activeIds.has("WF3") || projectValue(assessment, "productionCodeOrConfiguration", false) === true;
  const materialClaims = activeIds.has("HUM2") || projectValue(assessment, "materialClaims", false) === true;
  const challengeRequired = activeIds.has("BEH2");
  const repeated = activeIds.has("WF4") || projectValue(assessment, "repeatedOrAutonomous", false) === true;

  if (itemScores.HUM1?.level < 50 && authorityRank(proposedAuthority) >= authorityRank("A1")) {
    gates.push(buildGate({
      id: "human_capacity_gap",
      title: "You cannot yet cover every serious error this role could create",
      effect: "If unchanged, serious errors may reach use because no capable person can reliably recognize and correct them.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  } else if (itemScores.HUM1?.level < 75 && authorityRank(proposedAuthority) >= authorityRank("A2")) {
    gates.push(buildGate({
      id: "human_capacity_gap",
      title: "Your current review capacity does not cover the authority given to AI",
      effect: "The assigned role creates important work that the current human coverage cannot fully judge and correct.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  }
  if (itemScores.HUM3?.level < 50 && (repeated || authorityRank(proposedAuthority) >= authorityRank("A2"))) {
    gates.push(buildGate({
      id: "review_not_sustainable",
      title: "The required human review cannot be sustained",
      effect: "At the expected pace or volume, required human review is likely to break down before serious consequences can be prevented.",
      actionTrigger: "sustainability_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  } else if (itemScores.HUM3?.level < 75 && authorityRank(proposedAuthority) >= authorityRank("A3")) {
    gates.push(buildGate({
      id: "review_not_sustainable",
      title: "Review has not been shown to keep up while AI operates without item-by-item approval",
      effect: "Without item-by-item approval, the review process has not been shown to keep up at the expected volume and pace.",
      actionTrigger: "sustainability_gap",
      blocking: true,
      authorityCap: "A2",
    }));
  }
  if (projectValue(assessment, "humanAccessConfirmed", true) === false) {
    gates.push(buildGate({
      id: "human_access_missing",
      title: "You do not have access to inspect the important work",
      effect: "If unchanged, important work can pass through the workflow without inspection by someone able to examine it.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  }
  if (projectValue(assessment, "humanAuthorityConfirmed", true) === false) {
    gates.push(buildGate({
      id: "human_authority_missing",
      title: "You cannot require a correction or stop the work",
      effect: "If unchanged, AI can create a real consequence while no capable person has authority to require correction or stop the work.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  }
  if (authorityRank(proposedAuthority) >= authorityRank("A1") && !approvalConfirmed) {
    gates.push(buildGate({
      id: "external_action_without_approval",
      title: "Human approval before AI action is not confirmed",
      effect: "If unchanged, AI output can create an outside consequence before a capable person approves it.",
      actionTrigger: "workflow_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  }
  if (authorityRank(proposedAuthority) >= authorityRank("A2") && !reversibilityConfirmed) {
    gates.push(buildGate({
      id: "reversibility_not_confirmed",
      title: "You have not confirmed that the AI action can be reversed",
      effect: "If unchanged, an AI action can create a consequence that the current workflow has not shown it can reverse or roll back.",
      actionTrigger: "workflow_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  }
  if (
    (connectedAccess === true || (connectedAccess === null && authorityRank(proposedAuthority) >= authorityRank("A2"))) &&
    !permissionsConfirmed
  ) {
    gates.push(buildGate({
      id: "unknown_or_broad_permissions",
      title: "Connected permissions are unknown or too broad",
      effect: "If unchanged, sensitive, external, or autonomous action can occur through access that is unknown or too broad.",
      actionTrigger: "permission_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  }
  if (consequenceAtLeast(consequence, "high") && dimensions.humanAssurance < 75) {
    gates.push(buildGate({
      id: "insufficient_human_coverage",
      title: "Your current capacity is below what the consequences require",
      effect: "At these stakes, serious errors may reach a decision or release because capable review does not cover every important part.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  }
  const materialClaimsChecked = (itemScores.HUM2?.level ?? 0) >= 75;
  if (materialClaims && !materialClaimsChecked) {
    const highStakes = consequenceAtLeast(consequence, "high");
    gates.push(buildGate({
      id: "unverified_material_claims",
      title: "Important factual claims are not fully verified",
      effect: highStakes
        ? "If unchanged, unverified factual claims can affect a decision or release with serious consequences."
        : "If unchanged, important factual claims may be presented more confidently than the current checks support.",
      actionTrigger: "human_gap",
      blocking: highStakes,
      authorityCap: highStakes ? "A1" : null,
    }));
  }
  const technicalChecksCompleted = (itemScores.WF3?.level ?? 0) >= 75;
  if (productionWork && !technicalChecksCompleted) {
    gates.push(buildGate({
      id: "untested_production_change",
      title: "The production change has not passed the required technical checks",
      effect: "If unchanged, a production release can occur without the relevant technical checks or demonstrated recovery steps.",
      actionTrigger: "workflow_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  }
  if (dimensions.outcomeTestability < 50) {
    gates.push(buildGate({
      id: "outcome_not_observable",
      title: "The expected result and warning signs are not visible yet",
      effect: "If unchanged, you may not be able to tell whether the intended result occurred or whether use is creating harm.",
      actionTrigger: "outcome_gap",
    }));
  }
  if (challengeRequired && dimensions.behavioralFit < 50) {
    gates.push(buildGate({
      id: "critic_not_demonstrated",
      title: "Challenge behavior is not demonstrated",
      effect: "If unchanged, the workflow depends on critic, verifier, or stopping behavior that has not been demonstrated.",
      actionTrigger: "behavior_gap",
    }));
  }
  if (projectValue(assessment, "unresolvedMaterialFailure", false) === true) {
    gates.push(buildGate({
      id: "known_material_failure",
      title: "A serious failure remains unresolved",
      effect: "If unchanged, a known serious failure remains on the path to a real consequence.",
      actionTrigger: "workflow_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  }
  if (
    projectValue(assessment, "sensitiveData", false) === true &&
    !isConfirmed(projectValue(assessment, "dataAuthorizationConfirmed", false))
  ) {
    gates.push(buildGate({
      id: "sensitive_data_handling_unknown",
      title: "Sensitive-data authorization is not confirmed",
      effect: "If unchanged, sensitive information may be provided without confirmed authorization.",
      actionTrigger: "permission_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  }
  gates.push(...evaluateSystemGates(systems));
  return gates;
}

function getCapacityCeiling(assessment, itemScores) {
  const reasons = [];
  let score = 100;
  const humanLevel = itemScores.HUM1?.level ?? 0;
  const sustainabilityLevel = itemScores.HUM3?.level ?? 0;
  if (humanLevel < 25) {
    score = Math.min(score, 39);
    reasons.push("You cannot currently recognize and correct a serious error in the important work.");
  } else if (humanLevel < 50) {
    score = Math.min(score, 59);
    reasons.push("Major gaps remain in your knowledge, access, authority, or time.");
  } else if (humanLevel < 75) {
    score = Math.min(score, 79);
    reasons.push("Your current review does not cover every important part.");
  }
  if (sustainabilityLevel < 25) {
    score = Math.min(score, 59);
    reasons.push("The required review cannot be maintained at the expected volume and pace.");
  } else if (sustainabilityLevel < 50) {
    score = Math.min(score, 79);
    reasons.push("The required review is sustainable only with tighter limits.");
  }
  if (projectValue(assessment, "humanAccessConfirmed", true) === false) {
    score = Math.min(score, 39);
    reasons.push("You do not have access to inspect the important work.");
  }
  if (projectValue(assessment, "humanAuthorityConfirmed", true) === false) {
    score = Math.min(score, 39);
    reasons.push("You do not have authority to require a correction or stop the work.");
  }
  if (projectValue(assessment, "humanTimeAdequate", true) === false) {
    score = Math.min(score, 59);
    reasons.push("The available time does not support the required review.");
  }
  return { score, reasons };
}

function determineOperationalAuthority(assessment, context) {
  const {
    consequence, dimensions, gates, overallScore, validationStatus, itemScores, proposedAuthority,
  } = context;
  const hasBlockingGates = gates.some((gate) => gate.blocking);
  const wf1Operational = (itemScores.WF1?.level ?? 0) >= 75;
  const wf2RecoveryOperational = (itemScores.WF2?.level ?? 0) >= 100;
  const approvalConfirmed = hasProjectValue(assessment, "humanApprovalBeforeConsequence")
    ? isConfirmed(projectValue(assessment, "humanApprovalBeforeConsequence", false))
    : wf1Operational;
  const reversibilityConfirmed = hasProjectValue(assessment, "actionsAreReversible")
    ? isConfirmed(projectValue(assessment, "actionsAreReversible", false))
    : wf2RecoveryOperational;
  const a1ConditionsMet =
    overallScore >= 40 && approvalConfirmed &&
    (itemScores.HUM1?.level ?? 0) >= 75 &&
    (itemScores.WF2?.level ?? 0) >= 50;
  let authority = "A0";
  if (a1ConditionsMet) authority = "A1";
  if (
    authorityRank(authority) >= authorityRank("A1") &&
    overallScore >= 60 && dimensions.humanAssurance >= 60 &&
    dimensions.workflowControl >= 60 && approvalConfirmed && reversibilityConfirmed &&
    (itemScores.CAP1?.level ?? 0) >= 50 &&
    (itemScores.WF1?.level ?? 0) >= 75 &&
    !hasBlockingGates
  ) authority = "A2";
  const minimumCoreDimension = Math.min(
    dimensions.capabilityFit,
    dimensions.behavioralFit,
    dimensions.humanAssurance,
    dimensions.workflowControl,
  );
  if (
    authorityRank(authority) >= authorityRank("A2") &&
    overallScore >= 80 && minimumCoreDimension >= 75 &&
    ["Repeated", "Sustained", "Repeated use reported", "Sustained use reported"].includes(validationStatus) &&
    !consequenceAtLeast(consequence, "high") &&
    approvalConfirmed && reversibilityConfirmed &&
    ["HUM3", "CAP2", "BEH1", "OUT1", "WF4"].every(
      (id) => (itemScores[id]?.level ?? 0) >= 75,
    ) &&
    isConfirmed(projectValue(assessment, "monitoringConfirmed", false)) &&
    !hasBlockingGates
  ) authority = "A3";
  if ((itemScores.HUM1?.level ?? 0) < 50) authority = lowerAuthority(authority, "A0");
  else if ((itemScores.HUM1?.level ?? 0) < 75) authority = lowerAuthority(authority, "A1");
  if ((itemScores.HUM3?.level ?? 0) < 50) authority = lowerAuthority(authority, "A1");
  else if ((itemScores.HUM3?.level ?? 0) < 75) authority = lowerAuthority(authority, "A2");
  for (const gate of gates) {
    if (gate.authorityCap) authority = lowerAuthority(authority, gate.authorityCap);
  }
  return lowerAuthority(authority, proposedAuthority);
}

function roleCriticalEvidenceCeiling(assessment, itemScores, validationStatus) {
  const hasRecord = (id, minimumLevel) =>
    itemScores[id]?.basis === "confirmed" && (itemScores[id]?.level ?? 0) >= minimumLevel;
  const activeQuestionHasRecord = (id, minimumLevel) =>
    !itemScores[id] || hasRecord(id, minimumLevel);
  const safeguardsHaveRecord = reviewEvidenceBasisFor(assessment) === "confirmed";
  let authority = "A0";

  // A consequential human-approved output requires records for capable human
  // coverage, a meaningful pre-consequence check, and the safeguard answers.
  if (
    safeguardsHaveRecord &&
    hasRecord("HUM1", 75) &&
    hasRecord("WF2", 50) &&
    activeQuestionHasRecord("HUM2", 75) &&
    activeQuestionHasRecord("WF3", 75) &&
    activeQuestionHasRecord("BEH2", 50)
  ) authority = "A1";

  // A reversible action also requires task-specific performance and bounded
  // access to be supported by current records.
  if (
    authorityRank(authority) >= authorityRank("A1") &&
    hasRecord("CAP1", 50) && hasRecord("WF1", 75)
  ) authority = "A2";

  // Unattended operation requires records for sustainable human coverage,
  // failure handling, system behavior, outcome observation, and live controls.
  if (
    authorityRank(authority) >= authorityRank("A2") &&
    ["HUM3", "CAP2", "BEH1", "OUT1", "WF4"].every((id) => hasRecord(id, 75)) &&
    ["Repeated", "Sustained"].includes(validationStatus)
  ) authority = "A3";

  return authority;
}

function evidenceAuthorityCeiling(evidenceConfidence, consequence, assessment, itemScores, validationStatus) {
  let confidenceCeiling = "A3";
  if (evidenceConfidence === "Low") confidenceCeiling = "A0";
  else if (evidenceConfidence === "Medium") {
    confidenceCeiling = consequenceAtLeast(consequence, "high") ? "A1" : "A2";
  } else if (
    consequence === "critical" &&
    !(isConfirmed(projectValue(assessment, "qualifiedIndependentReview", false)) && hasIndependentReviewRecord(assessment)) &&
    !(itemScores.HUM1?.basis === "confirmed" && itemScores.HUM1?.level >= 100)
  ) {
    confidenceCeiling = "A1";
  }
  return lowerAuthority(
    confidenceCeiling,
    roleCriticalEvidenceCeiling(assessment, itemScores, validationStatus),
  );
}

function minimumEvidenceMet(proposedAuthority, consequence, evidenceConfidence, assessment, itemScores) {
  if (proposedAuthority === "A0") return true;
  if (evidenceConfidence === "Low") return false;
  if (proposedAuthority === "A3" || consequenceAtLeast(consequence, "high")) {
    if (evidenceConfidence !== "High") return false;
  }
  if (consequence === "critical") {
    return (
      (isConfirmed(projectValue(assessment, "qualifiedIndependentReview", false)) && hasIndependentReviewRecord(assessment)) ||
      (itemScores.HUM1?.basis === "confirmed" && itemScores.HUM1?.level >= 100)
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
  if (id.startsWith("system_permissions:")) return "permission_gap";
  return {
    permissions: "permission_gap",
    qualified_review: "human_gap",
    sustainable_review: "sustainability_gap",
    stopping_recovery: "workflow_gap",
    sensitive_data: "permission_gap",
    safeguard_evidence: "workflow_gap",
  }[id];
}

function chooseActionTriggers(gates, dimensions, criticalUnknowns) {
  const triggers = [];
  const add = (trigger) => {
    if (trigger && ACTION_LIBRARY[trigger] && !triggers.includes(trigger) && triggers.length < 2) {
      triggers.push(trigger);
    }
  };
  for (const gate of gates.filter((gate) => gate.blocking)) add(gate.actionTrigger);
  for (const gate of gates.filter((gate) => !gate.blocking)) add(gate.actionTrigger);
  for (const unknown of criticalUnknowns) add(actionTriggerForUnknown(unknown.id));
  if (triggers.length < 2) {
    Object.entries(dimensions)
      .filter(([, score]) => score < 80)
      .sort((left, right) => left[1] - right[1])
      .forEach(([dimension]) => add(actionTriggerForDimension(dimension)));
  }
  return triggers;
}

function buildActions(triggers) {
  return {
    now: triggers.map((trigger) => ACTION_LIBRARY[trigger].now),
    within24h: triggers.map((trigger) => ACTION_LIBRARY[trigger].within24h),
    days: triggers.map((trigger) => ACTION_LIBRARY[trigger].days),
    weeks: triggers.map((trigger) => ACTION_LIBRARY[trigger].weeks),
    note: "A planned action adds no points. Recalculate only after the action is completed. Evidence Strength changes only when a current supporting record is identified.",
  };
}

function projectedScoreFor(trigger, dimensions, publicScore, capacityCeiling, uncappedScore) {
  const definition = ACTION_LIBRARY[trigger];
  const current = dimensions[definition.dimension] ?? 0;
  const improvement = Math.max(0, definition.target - current) / DIMENSION_KEYS.length;
  const projectedUncapped = Math.min(100, uncappedScore + improvement);
  const projectedCeiling = ["human_gap", "sustainability_gap"].includes(trigger) ? 100 : capacityCeiling;
  const projected = roundPublicScore(Math.min(projectedUncapped, projectedCeiling));
  return {
    automaticChange: 0,
    projectedChange: Math.max(0, projected - publicScore),
    projectedScore: projected,
    condition: "Only if the action is completed, the stronger condition is true, and the Load Test is recalculated. A current supporting record strengthens Evidence Strength separately.",
  };
}

function buildRecommendations(context) {
  const {
    triggers, gates, dimensions, evidenceStrength, publicScore, capacityCeiling,
    uncappedOperationalScore, proposedAuthority, operationalMaxAuthority,
  } = context;
  const recommendations = [];
  for (const trigger of triggers) {
    const definition = ACTION_LIBRARY[trigger];
    const blockers = gates.filter((gate) => gate.actionTrigger === trigger).map((gate) => gate.id);
    for (const timing of ["now", "within24h", "days", "weeks"]) {
      recommendations.push({
        id: `${trigger}:${timing}`,
        category: trigger,
        timing,
        action: definition[timing],
        scoreEffect: projectedScoreFor(
          trigger, dimensions, publicScore, capacityCeiling, uncappedOperationalScore,
        ),
        evidenceEffect: definition.evidenceEffect,
        blocker: {
          couldRemove: blockers,
          statement: blockers.length
            ? "May remove the named blocker only after the result is confirmed."
            : "Addresses a weak part of this setup.",
        },
        roleEffect: definition.roleEffect,
        evidenceRequired: definition.scoreEvidence,
        modelChangeTest: false,
      });
    }
  }
  if (authorityRank(operationalMaxAuthority) < authorityRank(proposedAuthority)) {
    recommendations.unshift({
      id: "reduce_ai_role:now",
      category: "role_adjustment",
      timing: "now",
      action: `Reducing the AI role to ${AUTHORITY_LABELS[operationalMaxAuthority].toLowerCase()} would lower the load immediately.`,
      scoreEffect: {
        automaticChange: 0,
        projectedChange: 0,
        projectedScore: publicScore,
        condition: "This reduces the reliance required by giving AI less to do. It does not raise the Load Test score.",
      },
      evidenceEffect: "No evidence change.",
      blocker: { couldRemove: [], statement: "Works around current limits instead of removing them." },
      roleEffect: `Changes the assigned AI role from ${AUTHORITY_LABELS[proposedAuthority]} to ${AUTHORITY_LABELS[operationalMaxAuthority]}.`,
      evidenceRequired: "Record the revised AI role, authority, and approval limit.",
      modelChangeTest: false,
    });
  }
  if (!["key_steps_documented", "independently_checked"].includes(evidenceStrength.id)) {
    recommendations.push({
      id: "document_key_steps:now",
      category: "evidence",
      timing: "now",
      action: "Attach or record the key prompts, drafts, decisions, tests, approvals, and AI conversation or work records that are safe to share or review.",
      scoreEffect: {
        automaticChange: 0,
        projectedChange: 0,
        projectedScore: publicScore,
        condition: "Documentation changes Evidence Strength, not actual performance.",
      },
      evidenceEffect: "May raise Evidence Strength after the records are reviewed.",
      blocker: { couldRemove: [], statement: "Reduces uncertainty but does not fix a weakness in how the work is done." },
      roleEffect: "May allow a stronger conclusion about the same reported setup.",
      evidenceRequired: "Current records that support the important claims made in the Load Test.",
      modelChangeTest: false,
    });
  }
  if (dimensions.capabilityFit < 75 || dimensions.behavioralFit < 75) {
    const trigger = dimensions.capabilityFit <= dimensions.behavioralFit ? "capability_gap" : "behavior_gap";
    recommendations.push({
      id: "test_another_model:within24h",
      category: "model_test",
      timing: "within24h",
      action: "Test another model with the same instructions, sources, normal case, difficult case, flawed premise, and acceptance criteria. Compare errors and required human corrections.",
      scoreEffect: {
        ...projectedScoreFor(trigger, dimensions, publicScore, capacityCeiling, uncappedOperationalScore),
        automaticChange: 0,
        condition: "Changing models earns no points. Recalculate only if the comparison test demonstrates better performance in the exact role.",
      },
      evidenceEffect: "Adds comparative evidence for model selection if the results are saved.",
      blocker: {
        couldRemove: [],
        statement: "May address a model-specific gap. It cannot fix missing human capacity, access, authority, or workflow controls.",
      },
      roleEffect: "May reduce the review burden or make the assigned AI role fit better if the tested model performs better.",
      evidenceRequired: "Side-by-side results from the same cases, criteria, configuration, and reviewer.",
      modelChangeTest: true,
    });
  }
  return recommendations;
}

function buildAuthorizationSummary(context) {
  const { activeIds, dimensions, gates, maxAuthority, proposedAuthority, operationalMaxAuthority } = context;
  const delegate = [];
  const relyOn = [];
  const verify = [];
  const doNotAuthorize = gates.map((gate) => gate.effect);
  if (maxAuthority === "A0") delegate.push("Private exploration, brainstorming, and draft suggestions with no direct consequence.");
  else delegate.push("Defined production work within the tested task and setup.");
  if (authorityRank(maxAuthority) >= authorityRank("A1")) {
    delegate.push("Drafts or recommendations that you or a named capable person reviews before use.");
  }
  if (authorityRank(maxAuthority) >= authorityRank("A2")) {
    delegate.push("Defined reversible actions after the required human approval.");
  }
  if (maxAuthority === "A3") {
    delegate.push("Bounded unattended operation with monitoring, stopping, and rollback active.");
  }
  if (maxAuthority === "A0") {
    relyOn.push("The records identified do not yet back a consequential AI role beyond private exploration or drafting.");
  } else {
    relyOn.push("Human-reviewed outputs within the task, setup, and limits described by the identified records.");
  }
  if (authorityRank(maxAuthority) >= authorityRank("A2")) {
    relyOn.push("The identified records also cover a defined reversible action after human approval.");
  }
  if (maxAuthority === "A3") {
    relyOn.push("The identified records also cover repeated operation, monitoring, stopping, and rollback under the stated conditions.");
  }
  if (activeIds.has("HUM2")) verify.push("Important factual claims or claims that could affect a decision.");
  if (activeIds.has("WF3")) verify.push("Build, links, key behavior, mobile, accessibility, deployment, and relevant security checks.");
  if (activeIds.has("WF4")) verify.push("Monitoring, stop controls, limits, and rollback during operation.");
  if (dimensions.humanAssurance < 75) verify.push("Every important part not yet covered by your capacity or a named capable reviewer.");
  if (dimensions.outcomeTestability < 75) verify.push("The intended result and likely harm after release or use.");
  if (authorityRank(proposedAuthority) > authorityRank(operationalMaxAuthority)) {
    doNotAuthorize.unshift(`${AUTHORITY_LABELS[proposedAuthority]} creates more load than your answers show the current setup can carry. Your answers reach ${AUTHORITY_LABELS[operationalMaxAuthority].toLowerCase()}.`);
  }
  if (authorityRank(operationalMaxAuthority) > authorityRank(maxAuthority)) {
    doNotAuthorize.unshift(`${AUTHORITY_LABELS[operationalMaxAuthority]} may fit the reported setup, but the available records do not yet show that it does.`);
  }
  return { delegate, relyOn, verify, doNotAuthorize };
}

function getDecisionStatus(context) {
  const {
    publicScore, proposedAuthority, operationalMaxAuthority, conclusionAuthority,
    proposedRoleOperationallySupported, proposedAuthoritySupported,
    evidenceConfidence, gates,
  } = context;
  if (
    publicScore >= 40 &&
    authorityRank(operationalMaxAuthority) < authorityRank(proposedAuthority)
  ) {
    return {
      id: "smaller_role",
      label: "A smaller AI role fits the current setup",
      description: `The AI role you assigned requires more than the reported capacity and workflow can carry. A smaller role would reduce the load to ${AUTHORITY_LABELS[operationalMaxAuthority].toLowerCase()}.`,
    };
  }
  if (!proposedRoleOperationallySupported) {
    return {
      id: "not_supported",
      label: "The load exceeds the current setup",
      description: "At these stakes, the assigned AI role places more load on people and the workflow than the current answers show they can carry.",
    };
  }
  if (!proposedAuthoritySupported) {
    return {
      id: "not_demonstrated",
      label: "The setup may fit, but the records do not establish it yet",
      description: `Your answers describe a setup that can carry ${AUTHORITY_LABELS[proposedAuthority].toLowerCase()}, but the records you identified back only ${AUTHORITY_LABELS[conclusionAuthority].toLowerCase()}. This is an evidence gap, not proof that the setup cannot carry the role.`,
    };
  }
  if (proposedAuthoritySupported && publicScore >= 80 && evidenceConfidence === "High" && !gates.length) {
    return {
      id: "strong",
      label: "Strong alignment under current conditions",
      description: "Your answers about human capacity and workflow align with the review, control, correction, and recovery load created by this AI role under the conditions entered here. The required role-critical records were identified. This is not a guarantee.",
    };
  }
  const evidenceSentence = evidenceConfidence === "Low"
    ? " This setup may fit the role, but there is not enough evidence yet to confirm it."
    : " The named limits and checks must remain in place.";
  return {
    id: "conditional",
    label: "The role depends on named limits",
    description: `The current setup can carry this AI role only while the stated limits and checks remain in place.${evidenceSentence}`,
  };
}

export function getBand(score) {
  const normalized = clamp(Number.isFinite(Number(score)) ? Number(score) : 0);
  return bandDefinitionFor(normalized).label;
}

/**
 * Score one task-specific human and AI relationship. `publicScore` is
 * operational. Evidence never multiplies it; Evidence Strength is separate.
 */
export function scoreAssessment(assessment = {}) {
  const stage = STAGES.has(assessment.stage) ? assessment.stage : "plan";
  const normalizedAssessment = { ...assessment, stage };
  const activeQuestions = getActiveQuestionDefinitions(normalizedAssessment);
  const activeQuestionIds = activeQuestions.map(({ id }) => id);
  const activeIds = new Set(activeQuestionIds);
  const itemScores = scoreItems(normalizedAssessment, activeQuestions);
  const dimensionWeights = getDimensionWeights(activeIds);
  const dimensions = scoreDimensions(itemScores, dimensionWeights);
  const uncappedOperationalScore = roundOne(
    DIMENSION_KEYS.reduce((total, dimension) => total + dimensions[dimension], 0) / DIMENSION_KEYS.length,
  );
  const capacity = getCapacityCeiling(normalizedAssessment, itemScores);
  const overallScore = roundOne(Math.min(uncappedOperationalScore, capacity.score));
  const publicScore = roundPublicScore(overallScore);
  const scoreBand = getBand(publicScore);

  const project = normalizedAssessment.project || {};
  const consequence = normalizeConsequence(project.consequence);
  const proposedAuthority = normalizeAuthority(project.proposedAuthority);
  const systemAssessments = normalizeSystemRecords(normalizedAssessment);
  const criticalUnknowns = findCriticalUnknowns(
    normalizedAssessment, itemScores, activeIds, consequence, systemAssessments,
  );
  const { evidenceIndex, confidence: evidenceConfidence, strength: evidenceStrength } = evidenceStrengthFor(
    normalizedAssessment, itemScores, dimensionWeights, criticalUnknowns, systemAssessments,
  );
  const validationStatus = getValidationStatus(normalizedAssessment);
  const requiredScore = getRequiredScore(consequence, proposedAuthority);
  const gates = evaluateGates(normalizedAssessment, {
    activeIds,
    consequence,
    dimensions,
    itemScores,
    proposedAuthority,
    systems: systemAssessments,
  });
  const operationalMaxAuthority = determineOperationalAuthority(normalizedAssessment, {
    consequence,
    dimensions,
    gates,
    overallScore,
    validationStatus,
    itemScores,
    proposedAuthority,
  });
  const conclusionAuthorityCeiling = evidenceAuthorityCeiling(
    evidenceConfidence, consequence, normalizedAssessment, itemScores, validationStatus,
  );
  const conclusionAuthority = lowerAuthority(operationalMaxAuthority, conclusionAuthorityCeiling);
  const minimumEvidence = minimumEvidenceMet(
    proposedAuthority, consequence, evidenceConfidence, normalizedAssessment, itemScores,
  );
  const proposedRoleOperationallySupported =
    authorityRank(proposedAuthority) <= authorityRank(operationalMaxAuthority) &&
    overallScore >= requiredScore;
  const proposedAuthoritySupported =
    proposedRoleOperationallySupported &&
    authorityRank(proposedAuthority) <= authorityRank(conclusionAuthority) &&
    minimumEvidence;
  const decisionStatus = getDecisionStatus({
    publicScore,
    proposedAuthority,
    operationalMaxAuthority,
    conclusionAuthority,
    proposedRoleOperationallySupported,
    proposedAuthoritySupported,
    evidenceConfidence,
    gates,
  });
  const triggers = chooseActionTriggers(gates, dimensions, criticalUnknowns);
  const actions = buildActions(triggers);
  const recommendations = buildRecommendations({
    triggers,
    gates,
    dimensions,
    evidenceStrength,
    publicScore,
    capacityCeiling: capacity.score,
    uncappedOperationalScore,
    proposedAuthority,
    operationalMaxAuthority,
  });
  const authorization = buildAuthorizationSummary({
    activeIds,
    dimensions,
    gates,
    maxAuthority: conclusionAuthority,
    proposedAuthority,
    operationalMaxAuthority,
  });
  const reportedSetupSummary = buildAuthorizationSummary({
    activeIds,
    dimensions,
    gates,
    maxAuthority: operationalMaxAuthority,
    proposedAuthority,
    operationalMaxAuthority,
  });
  const loadSummary = {
    currentSetupCanCarry: authorization.delegate,
    reportedSetupCanCarry: reportedSetupSummary.delegate,
    evidenceCovers: authorization.relyOn,
    stillNeedsCapableReview: authorization.verify,
    exposedLoad: reportedSetupSummary.doNotAuthorize,
  };

  return {
    methodVersion: METHOD_VERSION,
    stage,
    overallScore,
    operationalScore: overallScore,
    uncappedOperationalScore,
    publicScore,
    scoreBand,
    band: decisionStatus.label,
    decisionStatus,
    dimensions,
    itemScores,
    activeQuestionIds,
    evidenceConfidence,
    evidenceIndex,
    evidenceStrength,
    conclusionCertainty: evidenceConfidence,
    criticalUnknowns,
    validationStatus,
    consequence,
    proposedAuthority,
    requiredScore,
    scoreGap: Math.max(0, roundOne(requiredScore - overallScore)),
    capacityCeiling: capacity.score,
    capacityLimitReasons: capacity.reasons,
    operationalMaxAuthority,
    conclusionAuthority,
    conclusionAuthorityCeiling,
    maxAuthority: conclusionAuthority,
    supportedAuthority: conclusionAuthority,
    proposedRoleOperationallySupported,
    proposedAuthoritySupported,
    systemAssessments,
    limitingSystemIds: [...new Set(gates.map((gate) => gate.systemId).filter(Boolean))],
    gates,
    authorization,
    loadSummary,
    actions,
    recommendations,
  };
}
