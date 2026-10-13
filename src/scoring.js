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
  { min: 0, max: 39, id: "not_supported", label: "Not supported for the proposed role" },
  { min: 40, max: 59, id: "smaller_role", label: "Supported only in a smaller role" },
  { min: 60, max: 79, id: "conditional", label: "Supported with named conditions" },
  { min: 80, max: 100, id: "strong", label: "Strongly supported under current conditions" },
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
    roleEffect: "May support a larger production role if the tests pass.",
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
    roleEffect: "May support roles that depend on challenge, uncertainty, or stopping if the tests pass.",
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
    roleEffect: "May support the requested role when the missing knowledge, access, authority, time, or review coverage is added.",
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
    roleEffect: "May support repeated use after scope, pace, staffing, or the AI role is adjusted.",
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
    roleEffect: "May support external or reversible action after access is narrowed and confirmed.",
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
    roleEffect: "May support consequential action when checks can stop or correct the work.",
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
    roleEffect: "May support continued or expanded use after results and harms can be recognized.",
    now: "Define one success signal, one harm signal, who will check them, and when.",
    within24h: "Add a completion signal and a short feedback or observation method.",
    days: "Observe at least three intended users or use cycles.",
    weeks: "Compare results with the target and publish an updated work check.",
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
  const stage = STAGES.has(assessment?.stage) ? assessment.stage : "plan";
  if (
    questionId === "CAP1" &&
    stage === "plan" &&
    !isConfirmed(projectValue(assessment, "priorMatchedEvidence", false)) &&
    !isConfirmed(projectValue(assessment, "priorEvidenceFromSameConfiguration", false))
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
      evidenceBasis: normalizeBasis(value.evidenceBasis ?? value.basis),
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
  if (
    (connectedAccess === true && (permissions == null || isUnknown("WF1"))) ||
    (connectedAccess === null && authorityRank(proposedAuthority) >= authorityRank("A2"))
  ) unknowns.push({ id: "permissions", label: "Connected permissions are unknown." });
  if (consequenceAtLeast(consequence, "high") && isUnknown("HUM1")) {
    unknowns.push({ id: "qualified_review", label: "Your ability to catch and correct a serious error is not documented." });
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
        label: `${system.name}${system.model ? ` (${system.model})` : ""} does not have a confirmed or reported setup record.`,
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
  const independent = isConfirmed(projectValue(assessment, "qualifiedIndependentReview", false));
  let id = "not_enough_information";
  let label = "Not enough information";
  if (independent && criticalUnknowns.length === 0 && evidenceIndex >= 0.75) {
    id = "independently_checked";
    label = "Independently checked";
  } else if (criticalUnknowns.length === 0 && evidenceIndex >= 0.75) {
    id = "key_steps_documented";
    label = "Key steps documented";
  } else if (basisCounts.confirmed > 0 && evidenceIndex >= 0.3) {
    id = "partly_documented";
    label = "Partly documented";
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
      label = "Partly documented";
    }
  }
  const description = {
    not_enough_information: "Important claims about the relationship do not yet have enough supporting information.",
    self_described: "The relationship is described by the person completing the check, without records confirming the key steps.",
    partly_documented: "Some records support the account, but important steps or controls are still missing.",
    key_steps_documented: "Current records support the important parts of the relationship, workflow, and result.",
    independently_checked: "A named independent reviewer checked the important records within a stated scope.",
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
        title: `${system.name}${suffix} has an unresolved material failure`,
        effect: "Remove the affected part from scope or resolve and retest it before relying on this system.",
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
        effect: "Keep this system from external action until its access is known, narrowed, and tested.",
        actionTrigger: "permission_gap",
        blocking: true,
        authorityCap: "A1",
      }));
    }
    if (system.capabilityLevel !== null && system.capabilityLevel < 50) {
      gates.push(buildGate({
        id: `system_capability:${system.id}`,
        systemId: system.id,
        title: `${system.name}${suffix} has not demonstrated its assigned role`,
        effect: "Use this system only to explore or draft until the exact setup passes task-specific tests.",
        actionTrigger: "capability_gap",
        blocking: authorityRank(system.proposedAuthority) >= authorityRank("A2"),
        authorityCap: "A1",
      }));
    }
    if (system.behaviorLevel !== null && system.behaviorLevel < 50) {
      gates.push(buildGate({
        id: `system_behavior:${system.id}`,
        systemId: system.id,
        title: `${system.name}${suffix} has not demonstrated the behavior its role requires`,
        effect: "Do not depend on this system to challenge, verify, identify uncertainty, or stop until that behavior is tested.",
        actionTrigger: "behavior_gap",
        authorityCap: "A1",
      }));
    }
    if (system.reviewSustainable === false) {
      gates.push(buildGate({
        id: `system_review_load:${system.id}`,
        systemId: system.id,
        title: `${system.name}${suffix} creates more review than can be sustained`,
        effect: "Reduce this system's role, pace, or volume, or add capable review coverage.",
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
          title: `${system.name}${suffix} supports a smaller role than proposed`,
          effect: `Limit this system to ${AUTHORITY_LABELS[cap].toLowerCase()}.`,
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
  const wf1Confirmed = itemScores.WF1?.basis === "confirmed" && itemScores.WF1.level >= 75;
  const approvalConfirmed = hasProjectValue(assessment, "humanApprovalBeforeConsequence")
    ? isConfirmed(projectValue(assessment, "humanApprovalBeforeConsequence", false))
    : wf1Confirmed;
  const wf2RecoveryConfirmed = itemScores.WF2?.basis === "confirmed" && itemScores.WF2.level >= 100;
  const reversibilityConfirmed = hasProjectValue(assessment, "actionsAreReversible")
    ? isConfirmed(projectValue(assessment, "actionsAreReversible", false))
    : wf2RecoveryConfirmed;
  const permissionsConfirmed = hasProjectValue(assessment, "permissionsConfirmed")
    ? isConfirmed(projectValue(assessment, "permissionsConfirmed", false))
    : wf1Confirmed;
  const connectedAccess = projectValue(assessment, "connectedAccess", undefined);
  const productionWork = activeIds.has("WF3") || projectValue(assessment, "productionCodeOrConfiguration", false) === true;
  const materialClaims = activeIds.has("HUM2") || projectValue(assessment, "materialClaims", false) === true;
  const challengeRequired = activeIds.has("BEH2");
  const repeated = activeIds.has("WF4") || projectValue(assessment, "repeatedOrAutonomous", false) === true;

  if (itemScores.HUM1?.level < 50 && authorityRank(proposedAuthority) >= authorityRank("A1")) {
    gates.push(buildGate({
      id: "human_capacity_gap",
      title: "You cannot yet cover every serious error this role could create",
      effect: "Keep the AI in private exploration until you add the missing knowledge, access, authority, time, or capable human help.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  } else if (itemScores.HUM1?.level < 75 && authorityRank(proposedAuthority) >= authorityRank("A2")) {
    gates.push(buildGate({
      id: "human_capacity_gap",
      title: "Your current review capacity does not cover the proposed authority",
      effect: "Limit AI to producing work for capable human approval until every important part can be judged and corrected.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  }
  if (itemScores.HUM3?.level < 50 && (repeated || authorityRank(proposedAuthority) >= authorityRank("A2"))) {
    gates.push(buildGate({
      id: "review_not_sustainable",
      title: "The required human review cannot be sustained",
      effect: "Reduce the AI role, pace, or volume, or add capable review coverage before consequential or repeated use.",
      actionTrigger: "sustainability_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  } else if (itemScores.HUM3?.level < 75 && authorityRank(proposedAuthority) >= authorityRank("A3")) {
    gates.push(buildGate({
      id: "review_not_sustainable",
      title: "Sustained review for unattended operation is not demonstrated",
      effect: "Keep item-by-item approval until the review process holds up at the expected volume and pace.",
      actionTrigger: "sustainability_gap",
      blocking: true,
      authorityCap: "A2",
    }));
  }
  if (projectValue(assessment, "humanAccessConfirmed", true) === false) {
    gates.push(buildGate({
      id: "human_access_missing",
      title: "You do not have access to inspect the important work",
      effect: "Do not rely on the proposed role until you or a named capable reviewer can inspect the important work.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  }
  if (projectValue(assessment, "humanAuthorityConfirmed", true) === false) {
    gates.push(buildGate({
      id: "human_authority_missing",
      title: "You cannot require a correction or stop the work",
      effect: "Do not authorize consequential AI action until a capable person has real authority to intervene.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  }
  if (authorityRank(proposedAuthority) >= authorityRank("A1") && !approvalConfirmed) {
    gates.push(buildGate({
      id: "external_action_without_approval",
      title: "Approval before consequence is not confirmed",
      effect: "Keep the AI in private advising or drafting until a human approval point is confirmed before consequence.",
      actionTrigger: "workflow_gap",
      blocking: true,
      authorityCap: "A0",
    }));
  }
  if (authorityRank(proposedAuthority) >= authorityRank("A2") && !reversibilityConfirmed) {
    gates.push(buildGate({
      id: "reversibility_not_confirmed",
      title: "Reversibility is not confirmed for the proposed action",
      effect: "Limit the AI to producing work for human approval until the action can be reversed or rolled back.",
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
      effect: "Block sensitive, external, or autonomous action until access is confirmed and narrowed.",
      actionTrigger: "permission_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  }
  if (consequenceAtLeast(consequence, "high") && dimensions.humanAssurance < 75) {
    gates.push(buildGate({
      id: "insufficient_human_coverage",
      title: "Your current capacity is below what the consequences require",
      effect: "Block consequential release or decision authority until capable review covers every important part.",
      actionTrigger: "human_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  }
  const materialClaimsConfirmed = itemScores.HUM2?.basis === "confirmed" && itemScores.HUM2?.level >= 75;
  if (materialClaims && !materialClaimsConfirmed) {
    const highStakes = consequenceAtLeast(consequence, "high");
    gates.push(buildGate({
      id: "unverified_material_claims",
      title: "Material claims are not fully verified",
      effect: highStakes
        ? "Do not use the unverified claims in the high-consequence decision or release."
        : "Do not present material claims as verified. Check them or label their uncertainty.",
      actionTrigger: "human_gap",
      blocking: highStakes,
      authorityCap: highStakes ? "A1" : null,
    }));
  }
  const technicalChecksConfirmed = itemScores.WF3?.basis === "confirmed" && itemScores.WF3?.level >= 75;
  if (productionWork && !technicalChecksConfirmed) {
    gates.push(buildGate({
      id: "untested_production_change",
      title: "Production change is not technically demonstrated",
      effect: "Block unsupervised production release until relevant checks and recovery are demonstrated.",
      actionTrigger: "workflow_gap",
      blocking: true,
      authorityCap: "A1",
    }));
  }
  if (dimensions.outcomeTestability < 50) {
    gates.push(buildGate({
      id: "outcome_not_observable",
      title: "The expected result and warning signs are not visible yet",
      effect: "A limited pilot may proceed, but do not claim effectiveness or scale the relationship.",
      actionTrigger: "outcome_gap",
    }));
  }
  if (challengeRequired && dimensions.behavioralFit < 50) {
    gates.push(buildGate({
      id: "critic_not_demonstrated",
      title: "Challenge behavior is not demonstrated",
      effect: "Do not rely on the AI as critic, verifier, or approver.",
      actionTrigger: "behavior_gap",
    }));
  }
  if (projectValue(assessment, "unresolvedMaterialFailure", false) === true) {
    gates.push(buildGate({
      id: "known_material_failure",
      title: "A material failure remains unresolved",
      effect: "Block the affected action until the failure is resolved or removed from scope.",
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
      effect: "Do not provide the sensitive information to the AI system.",
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
  const wf1Confirmed = itemScores.WF1?.basis === "confirmed" && itemScores.WF1.level >= 75;
  const wf2RecoveryConfirmed = itemScores.WF2?.basis === "confirmed" && itemScores.WF2.level >= 100;
  const approvalConfirmed = hasProjectValue(assessment, "humanApprovalBeforeConsequence")
    ? isConfirmed(projectValue(assessment, "humanApprovalBeforeConsequence", false))
    : wf1Confirmed;
  const reversibilityConfirmed = hasProjectValue(assessment, "actionsAreReversible")
    ? isConfirmed(projectValue(assessment, "actionsAreReversible", false))
    : wf2RecoveryConfirmed;
  let authority = "A0";
  if (overallScore >= 40 && approvalConfirmed) authority = "A1";
  if (
    overallScore >= 60 && dimensions.humanAssurance >= 60 &&
    dimensions.workflowControl >= 60 && approvalConfirmed && reversibilityConfirmed &&
    !hasBlockingGates
  ) authority = "A2";
  const minimumCoreDimension = Math.min(
    dimensions.capabilityFit,
    dimensions.behavioralFit,
    dimensions.humanAssurance,
    dimensions.workflowControl,
  );
  if (
    overallScore >= 80 && minimumCoreDimension >= 75 &&
    ["Repeated", "Sustained"].includes(validationStatus) &&
    !consequenceAtLeast(consequence, "high") &&
    approvalConfirmed && reversibilityConfirmed &&
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

function evidenceAuthorityCeiling(evidenceConfidence, consequence, assessment, itemScores) {
  if (evidenceConfidence === "Low") return "A0";
  if (evidenceConfidence === "Medium") return consequenceAtLeast(consequence, "high") ? "A1" : "A2";
  if (
    consequence === "critical" &&
    !isConfirmed(projectValue(assessment, "qualifiedIndependentReview", false)) &&
    !(itemScores.HUM1?.basis === "confirmed" && itemScores.HUM1?.level >= 100)
  ) return "A1";
  return "A3";
}

function minimumEvidenceMet(proposedAuthority, consequence, evidenceConfidence, assessment, itemScores) {
  if (proposedAuthority === "A0") return true;
  if (evidenceConfidence === "Low") return false;
  if (proposedAuthority === "A3" || consequenceAtLeast(consequence, "high")) {
    if (evidenceConfidence !== "High") return false;
  }
  if (consequence === "critical") {
    return (
      isConfirmed(projectValue(assessment, "qualifiedIndependentReview", false)) ||
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
    note: "A planned action adds no points. Recalculate only after the action is completed and its result is recorded.",
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
    condition: "Only if the action is completed, the stronger condition is demonstrated, and the check is recalculated.",
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
            : "Addresses a limiting part of the relationship.",
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
      action: `Limit the AI to ${AUTHORITY_LABELS[operationalMaxAuthority].toLowerCase()} for now.`,
      scoreEffect: {
        automaticChange: 0,
        projectedChange: 0,
        projectedScore: publicScore,
        condition: "This lowers the trust required. It does not raise the relationship score.",
      },
      evidenceEffect: "No evidence change.",
      blocker: { couldRemove: [], statement: "Works around current limits instead of removing them." },
      roleEffect: `Changes the proposed role from ${AUTHORITY_LABELS[proposedAuthority]} to ${AUTHORITY_LABELS[operationalMaxAuthority]}.`,
      evidenceRequired: "Record the revised AI role, authority, and approval boundary.",
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
        condition: "Documentation changes Evidence Strength, not operational performance.",
      },
      evidenceEffect: "May raise Evidence Strength after the records are reviewed.",
      blocker: { couldRemove: [], statement: "Reduces uncertainty but does not fix an operational weakness." },
      roleEffect: "May allow a stronger conclusion about the same reported relationship.",
      evidenceRequired: "Current records that support the important claims made in the check.",
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
      roleEffect: "May reduce the review burden or support the proposed role if the tested model performs better.",
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
  if (dimensions.capabilityFit >= 60) relyOn.push("Outputs within the demonstrated cases, setup, and stated limits.");
  else relyOn.push("Outputs only as leads or drafts until task-specific performance is demonstrated.");
  if (activeIds.has("HUM2")) verify.push("Material factual or consequential claims.");
  if (activeIds.has("WF3")) verify.push("Build, links, key behavior, mobile, accessibility, deployment, and relevant security checks.");
  if (activeIds.has("WF4")) verify.push("Monitoring, stop controls, limits, and rollback during operation.");
  if (dimensions.humanAssurance < 75) verify.push("Every important part not yet covered by your capacity or a named capable reviewer.");
  if (dimensions.outcomeTestability < 75) verify.push("The intended result and likely harm after release or use.");
  if (authorityRank(proposedAuthority) > authorityRank(maxAuthority)) {
    doNotAuthorize.unshift(`${AUTHORITY_LABELS[proposedAuthority]} is above the currently supported ${maxAuthority} boundary.`);
  }
  if (authorityRank(operationalMaxAuthority) > authorityRank(maxAuthority)) {
    doNotAuthorize.unshift(`${AUTHORITY_LABELS[operationalMaxAuthority]} appears operationally possible, but the available evidence does not yet support that conclusion.`);
  }
  return { delegate, relyOn, verify, doNotAuthorize };
}

function getDecisionStatus(context) {
  const {
    publicScore, proposedAuthority, operationalMaxAuthority, conclusionAuthority,
    proposedRoleOperationallySupported, proposedAuthoritySupported,
    evidenceConfidence, gates,
  } = context;
  const supportedAuthority = lowerAuthority(operationalMaxAuthority, conclusionAuthority);
  if (
    publicScore >= 40 &&
    authorityRank(supportedAuthority) < authorityRank(proposedAuthority)
  ) {
    return {
      id: "smaller_role",
      label: "Supported only in a smaller role",
      description: `Your current capacity, evidence about this AI setup, controls, and workflow support ${AUTHORITY_LABELS[supportedAuthority].toLowerCase()}, not the role you proposed.`,
    };
  }
  if (!proposedRoleOperationallySupported) {
    return {
      id: "not_supported",
      label: "Not supported for the proposed role",
      description: "Your current capacity, evidence about this AI setup, controls, and workflow do not support the role you proposed under the current stakes.",
    };
  }
  if (proposedAuthoritySupported && publicScore >= 80 && evidenceConfidence === "High" && !gates.length) {
    return {
      id: "strong",
      label: "Strongly supported under current conditions",
      description: "Your current capacity, evidence about this AI setup, controls, and workflow strongly support the proposed role under the current conditions.",
    };
  }
  const evidenceSentence = evidenceConfidence === "Low"
    ? " The reported arrangement may fit, but the available evidence is not strong enough to confirm it."
    : " The named limits and checks must remain in place.";
  return {
    id: "conditional",
    label: "Supported with named conditions",
    description: `Your current capacity, evidence about this AI setup, controls, and workflow can support the proposed role only under the named conditions.${evidenceSentence}`,
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
    evidenceConfidence, consequence, normalizedAssessment, itemScores,
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
    actions,
    recommendations,
  };
}
