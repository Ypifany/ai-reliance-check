/**
 * AI Reliance Check assessment definition.
 *
 * The definitions are data, rather than UI markup, so the assessment can be
 * rendered consistently in the browser, a printable form, or a future API.
 */

export const METHOD_VERSION = "0.1";

export const DIMENSIONS = Object.freeze({
  capabilityFit: {
    label: "Capability Fit",
    description:
      "Whether this configured system has demonstrated the ability to perform this task.",
  },
  behavioralFit: {
    label: "Behavioral Fit",
    description:
      "Whether the system behaves as the role requires, including when it should challenge, qualify, or stop.",
  },
  humanAssurance: {
    label: "Human Assurance",
    description:
      "Whether a capable person can recognize, correct, and stop material errors before consequence.",
  },
  workflowControl: {
    label: "Workflow Control",
    description:
      "Whether access, checks, approvals, records, stopping, and recovery match the authority being granted.",
  },
  outcomeTestability: {
    label: "Outcome Testability",
    description:
      "Whether success and harm are defined clearly enough to observe, measure, and revisit.",
  },
});

export const AUTHORITY_LEVELS = Object.freeze({
  A0: {
    label: "Advise or draft privately",
    description: "The system explores, advises, or drafts without creating an external consequence.",
  },
  A1: {
    label: "Produce for human approval",
    description: "The system produces work, but a person approves every use that creates a consequence.",
  },
  A2: {
    label: "Take a reversible approved action",
    description: "The system performs a defined, reversible action only after human approval.",
  },
  A3: {
    label: "Operate without item-by-item approval",
    description: "The system may publish, send, change, spend, or operate within approved limits.",
  },
});

export const EVIDENCE_BASES = Object.freeze({
  confirmed: {
    label: "Confirmed",
    description: "Directly observed or supported by a current result, record, or link.",
  },
  reported: {
    label: "Reported",
    description: "Intended, recalled, or asserted without a current supporting record.",
  },
  unknown: {
    label: "Unknown",
    description: "There is not enough information to determine this yet.",
  },
});

const option = (value, label, description) => ({ value, label, description });

const CAP1_OPTIONS = [
  option(0, "No task-specific evidence", "The belief rests on the model name, reputation, or an assumption."),
  option(25, "One informal example", "A single example looked acceptable, without stated acceptance criteria."),
  option(50, "One representative case", "One representative case met stated acceptance criteria."),
  option(75, "Several representative cases", "Several cases passed, including a difficult case."),
  option(100, "Repeated normal, edge, and failure cases", "Repeated tests under the same configuration passed normal, edge, and failure cases."),
];

const CAP2_OPTIONS = [
  option(0, "Failure paths not examined", "No likely task-specific failure has been identified or checked."),
  option(25, "Only generic limitations", "General AI limitations are known, but the likely failures in this project are not."),
  option(50, "Important failures identified", "The most likely material failures are named and at least one has been checked."),
  option(75, "Failure cases tested", "Important failure cases were tested and a stopping or correction response is defined."),
  option(100, "Limits and recovery repeatedly demonstrated", "Normal limits, failure recognition, stopping, and recovery have been demonstrated repeatedly."),
];

const BEH1_OPTIONS = [
  option(0, "Assumed or prompted only", "The behavior is assumed or appears only in an instruction."),
  option(25, "Behavior and test defined", "The required behavior and a deliberate test are defined, but not yet observed."),
  option(50, "One deliberate test passed", "The configured system passed one relevant behavior test."),
  option(75, "Several meaningful tests passed", "It passed several tests, including a case that tempted it to agree or continue."),
  option(100, "Repeated calibrated behavior", "Repeated tests show appropriate agreement, disagreement, uncertainty, and stopping."),
];

const HUM1_OPTIONS = [
  option(0, "No capable reviewer", "No person can recognize and correct a material error before consequence."),
  option(25, "Reviewer lacks coverage", "A reviewer exists but lacks enough knowledge, access, authority, or time."),
  option(50, "Partial capable review", "A capable person can inspect samples or some important parts."),
  option(75, "All material parts covered", "Every material part has a capable reviewer at the correct checkpoint."),
  option(100, "Independent high-impact checks", "Material work is covered, high-impact items receive a different-method or independent check, and the reviewer can stop or correct it."),
];

const WF1_OPTIONS = [
  option(0, "Unknown, broad, or uncontrolled", "The system's access or authority is unknown, broader than needed, or uncontrolled."),
  option(25, "Informal boundaries", "Boundaries are intended or assumed but not established."),
  option(50, "Boundaries partly confirmed", "Boundaries exist, but some access or enforcement is not confirmed."),
  option(75, "Least-needed access with approval", "Least-needed access and human approval before consequence are confirmed."),
  option(100, "Controls demonstrated", "Boundaries, approvals, logs, stopping, revocation, and rollback have been demonstrated where applicable."),
];

const WF2_OPTIONS = [
  option(0, "No independent check", "Nothing happens before use, or the AI only checks its own work."),
  option(25, "Quick final look", "A person gives the result a quick final look."),
  option(50, "Defined check", "A defined human or automated check occurs before use."),
  option(75, "Risk-matched stop gate", "Checks cover material risks and a failed check stops progress."),
  option(100, "Recorded checks and proven recovery", "Results are recorded, high-risk work uses a different verification method, and correction or rollback has been demonstrated."),
];

const OUT_PLAN_OPTIONS = [
  option(0, "Outcome is vague", "The desired result is not specific enough to assess."),
  option(25, "Outcome stated", "The outcome is stated but cannot yet be measured."),
  option(50, "Success and harm defined", "The intended result and likely harm are both named."),
  option(75, "Measurement plan defined", "Measures, thresholds, timing, data source, and owner are defined."),
  option(100, "Pilot and reassessment defined", "A baseline, pilot, stop threshold, and reassessment point are also defined."),
];

const OUT_LIVE_OPTIONS = [
  option(0, "No outcome observations", "No evidence exists about what happened after use."),
  option(25, "Activity only", "Only completion, traffic, or output volume is known."),
  option(50, "One side of the outcome observed", "Either intended results or harm signals are being collected."),
  option(75, "Results and harms compared", "Intended results and harm signals are both compared with stated targets."),
  option(100, "Repeated evidence changed decisions", "Repeated observations led to documented continuation, correction, limitation, or stopping decisions."),
];

const HUM2_OPTIONS = [
  option(0, "Not checked", "Material claims were not checked, or the AI checked itself."),
  option(25, "Links collected", "Links exist but were not meaningfully reviewed."),
  option(50, "Important sample checked", "A sample of important claims was checked."),
  option(75, "Every material claim addressed", "Every material claim was checked or clearly labeled uncertain."),
  option(100, "Independent high-consequence verification", "The highest-consequence claims received qualified independent verification."),
];

const BEH2_OPTIONS = [
  option(0, "Not deliberately tested", "The behavior appears in instructions only."),
  option(25, "Challenge test designed", "A flawed premise or stop case is defined but has not been run."),
  option(50, "One challenge test", "The system was deliberately tested once with a premise it should question or a situation in which it should stop."),
  option(75, "Several agreement and disagreement tests", "Several tests required both appropriate agreement and appropriate disagreement."),
  option(100, "Repeated useful challenge", "Repeated tests show useful challenge without needless contradiction."),
];

const WF3_OPTIONS = [
  option(0, "No technical checks", "No relevant technical check has been completed."),
  option(25, "Visual review only", "The result was inspected visually but its behavior was not tested."),
  option(50, "Build and key path checked", "The build and primary user path were checked."),
  option(75, "Relevant release checks saved", "Relevant build, test, lint, link, mobile, accessibility, and deployment checks were completed and saved."),
  option(100, "Failure, security, and rollback tested", "Failure cases, relevant security checks, and rollback were also tested; results were saved."),
];

const WF4_OPTIONS = [
  option(0, "Cannot be controlled while running", "The activity cannot be reliably seen, stopped, limited, or reversed, or this is unknown."),
  option(25, "Logs only", "Activity is recorded, but intervention is not demonstrated."),
  option(50, "Monitoring and manual stop", "A person can observe and manually stop the activity."),
  option(75, "Threshold stop and rollback tested", "Threshold-based stopping and rollback have been tested."),
  option(100, "Full operating controls demonstrated", "Least privilege, monitoring, incident response, rollback, and reauthorization are demonstrated."),
];

/**
 * `trigger` is declarative so the UI can explain why an adaptive question was
 * added. `getActiveQuestionDefinitions` is the canonical trigger evaluator.
 */
export const QUESTION_DEFINITIONS = Object.freeze([
  {
    id: "CAP1",
    dimension: "capabilityFit",
    prompt: "What supports the belief that this exact AI setup can perform this task?",
    why: "A model's reputation is not evidence that the configured system can do this particular work.",
    options: CAP1_OPTIONS,
  },
  {
    id: "CAP2",
    dimension: "capabilityFit",
    prompt: "Have the likely ways this could fail been identified and checked?",
    why: "Reliance depends on knowing where performance ends and what happens when it fails.",
    options: CAP2_OPTIONS,
  },
  {
    id: "BEH1",
    dimension: "behavioralFit",
    prompt: "What evidence shows that the system performs the behaviors this role requires?",
    why: "An instruction to challenge, verify, or stop does not show that the behavior will occur when it matters.",
    options: BEH1_OPTIONS,
  },
  {
    id: "HUM1",
    dimension: "humanAssurance",
    prompt: "Who can recognize and correct a material error before it creates a consequence?",
    why: "Your real ability to inspect the work is part of the reliance calculation.",
    options: HUM1_OPTIONS,
  },
  {
    id: "WF1",
    dimension: "workflowControl",
    prompt: "Are the system's access and authority limited to what this task requires?",
    why: "Authority should not exceed what the evidence, human capacity, and recovery controls can support.",
    options: WF1_OPTIONS,
  },
  {
    id: "WF2",
    dimension: "workflowControl",
    prompt: "What actually happens before the result is used?",
    why: "A check changes the boundary only when it can detect a problem and stop or correct the work.",
    options: WF2_OPTIONS,
  },
  {
    id: "OUT1",
    dimension: "outcomeTestability",
    prompt: "How will you know whether the intended result occurred—and whether harm occurred?",
    why: "An output can look complete without producing the outcome you are betting on.",
    options: OUT_PLAN_OPTIONS,
    optionsByStage: {
      plan: OUT_PLAN_OPTIONS,
      release: OUT_PLAN_OPTIONS,
      live: OUT_LIVE_OPTIONS,
    },
  },
  {
    id: "HUM2",
    dimension: "humanAssurance",
    prompt: "How were material claims verified?",
    why: "Material claims need verification outside the same system that produced them.",
    options: HUM2_OPTIONS,
    trigger: {
      description: "Asked when the work contains factual or consequential claims.",
      projectFlag: "materialClaims",
      workTypes: ["factual", "decision", "training"],
    },
  },
  {
    id: "BEH2",
    dimension: "behavioralFit",
    prompt: "Was the system tested with a flawed premise or a situation in which it should disagree or stop?",
    why: "Agreeable output is not evidence that a system can serve as a critic, verifier, or stop gate.",
    options: BEH2_OPTIONS,
    trigger: {
      description: "Asked when challenge, comparison, uncertainty, or stopping is required.",
      requiredBehaviors: ["compare", "challenge", "uncertainty", "stop"],
    },
  },
  {
    id: "WF3",
    dimension: "workflowControl",
    prompt: "Which technical checks were completed and saved?",
    why: "Visible review alone cannot establish that software, links, accessibility, or deployment behavior works.",
    options: WF3_OPTIONS,
    trigger: {
      description: "Asked for software, website, code, or configuration work.",
      projectFlag: "productionCodeOrConfiguration",
      workTypes: ["software", "website", "code", "configuration"],
    },
  },
  {
    id: "WF4",
    dimension: "workflowControl",
    prompt: "Can the activity be seen, stopped, limited, and reversed while it is running?",
    why: "Repeated or autonomous operation needs controls that work during execution, not only a review afterward.",
    options: WF4_OPTIONS,
    trigger: {
      description: "Asked for repeated or autonomous activity, including unattended operation.",
      projectFlag: "repeatedOrAutonomous",
      workTypes: ["automation", "agent"],
      authority: "A3",
    },
  },
]);

const CORE_IDS = new Set(["CAP1", "CAP2", "BEH1", "HUM1", "WF1", "WF2", "OUT1"]);

function normalizedTerms(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
}

function termMatches(value, target) {
  return value === target || value.includes(target) || target.includes(value);
}

function hasAnyTerm(values, targets) {
  const normalizedValues = normalizedTerms(values);
  return targets.some((target) => normalizedValues.some((value) => termMatches(value, target)));
}

export function isQuestionActive(question, assessment = {}) {
  if (!question.trigger) return true;

  const project = assessment.project || {};
  const trigger = question.trigger;

  if (trigger.projectFlag && project[trigger.projectFlag] === true) return true;
  if (trigger.workTypes && hasAnyTerm(project.workTypes, trigger.workTypes)) return true;
  if (trigger.requiredBehaviors && hasAnyTerm(project.requiredBehaviors, trigger.requiredBehaviors)) return true;
  if (trigger.authority && project.proposedAuthority === trigger.authority) return true;

  return false;
}

export function getActiveQuestionDefinitions(assessment = {}) {
  const stage = ["plan", "release", "live"].includes(assessment.stage)
    ? assessment.stage
    : "plan";

  return QUESTION_DEFINITIONS.filter((question) =>
    CORE_IDS.has(question.id) || isQuestionActive(question, assessment),
  ).map((question) => ({
    ...question,
    options: question.optionsByStage?.[stage] || question.options,
  }));
}

export function getActiveQuestionIds(assessment = {}) {
  return getActiveQuestionDefinitions(assessment).map(({ id }) => id);
}

export function getQuestionDefinition(id, assessment = {}) {
  return getActiveQuestionDefinitions(assessment).find((question) => question.id === id) || null;
}

