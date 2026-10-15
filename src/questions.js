/**
 * Human + AI Load Test assessment definition.
 *
 * The definitions are data, rather than UI markup, so the assessment can be
 * rendered consistently in the browser, a printable form, or a future API.
 */

export const METHOD_VERSION = "0.2";

export const DIMENSIONS = Object.freeze({
  humanAssurance: {
    label: "Your Capacity",
    description:
      "Whether you have the knowledge, access, authority, time, and sustainable attention to recognize, correct, or stop a serious error.",
  },
  capabilityFit: {
    label: "AI Role Fit",
    description:
      "Whether this exact AI setup has demonstrated the ability to perform the role you are giving it.",
  },
  behavioralFit: {
    label: "Working Relationship",
    description:
      "Whether the system behaves as you need it to, including when it should challenge, qualify, ask questions, or stop.",
  },
  workflowControl: {
    label: "Workflow and Controls",
    description:
      "Whether access, checks, approvals, records, stopping, and recovery match the authority being granted.",
  },
  outcomeTestability: {
    label: "Outcome and Stakes",
    description:
      "Whether the result you are counting on, possible harm, and warning signs are clear enough to observe and revisit.",
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
    label: "Take an approved, reversible action",
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

const CAP1_PLAN_OPTIONS = [
  option(0, "No task-specific evidence", "The plan rests on the model name, reputation, or an assumption."),
  option(25, "One informal example", "A single example looked acceptable, without stated acceptance criteria."),
  option(50, "One representative case", "One representative case met stated acceptance criteria."),
  option(75, "Several representative cases", "Several cases passed under the proposed setup, including a difficult case."),
  option(100, "Repeated matched tests", "The same setup repeatedly passed normal, difficult, edge, and failure cases for this role."),
];

const CAP1_LIVE_OPTIONS = [
  option(0, "No task-specific observations", "There is no record showing how this setup performs in actual use."),
  option(25, "One informal observation", "One result looked acceptable, without stated acceptance criteria."),
  option(50, "Representative use observed", "At least one representative use met stated acceptance criteria."),
  option(75, "Normal and difficult use observed", "Several uses passed, including a difficult or unusual case."),
  option(100, "Repeated performance demonstrated", "Repeated use under the same setup passed normal, edge, and failure cases."),
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
  option(0, "You cannot catch or correct a serious error", "You lack the knowledge, access, authority, or time needed to examine the important work."),
  option(25, "Major gaps limit your review", "You can review some of the work, but an important gap remains in your knowledge, access, authority, or time."),
  option(50, "You can review some important parts", "You can judge and correct part of the work, but not every part that could create a serious consequence."),
  option(75, "You can cover every important part", "You can examine every important part at the right checkpoint and require a correction or stop."),
  option(100, "You can cover every part and use independent checks", "You can examine every important part, and the highest-impact work also receives a different-method or independent check."),
];

const HUM3_OPTIONS = [
  option(0, "The required review cannot be maintained", "The work moves too quickly, lasts too long, or is too large for the available attention and time."),
  option(25, "The review will probably break down", "The review can happen briefly or occasionally, but not at the expected volume and pace."),
  option(50, "The review is possible with limits", "The review can be maintained only if scope, pace, volume, or the AI role stays limited."),
  option(75, "The review can be maintained", "Enough time, attention, and backup are available for the expected volume and pace."),
  option(100, "Sustainable review has been demonstrated", "The review has held up at the expected volume and pace, including during busy or difficult periods."),
];

const WF1_OPTIONS = [
  option(0, "Unknown, broad, or uncontrolled", "The system's access or authority is unknown, broader than needed, or uncontrolled."),
  option(25, "Informal boundaries", "Boundaries are intended or assumed but not established."),
  option(50, "Boundaries partly confirmed", "Boundaries exist, but some access or enforcement is not confirmed."),
  option(75, "Least-needed access with approval", "Least-needed access and human approval before consequence are confirmed."),
  option(100, "Controls demonstrated", "Boundaries, approvals, logs, stopping, revocation, and rollback have been demonstrated where applicable."),
];

const WF2_OPTIONS = [
  option(0, "No independent check", "No check occurs before use, or the AI only checks its own work."),
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

const OUT_RELEASE_OPTIONS = [
  option(0, "No result or warning signs defined", "The work may be finished, but success, failure, and likely harm have not been defined."),
  option(25, "The finished output was checked", "The output was reviewed, but post-launch success or harm cannot yet be recognized."),
  option(50, "Success and warning signs are defined", "The intended result, likely failure, and important warning signs are named."),
  option(75, "Post-launch check is ready", "Measures, thresholds, timing, data source, and the person who will check them are defined."),
  option(100, "Pilot, stop point, and reassessment are ready", "A baseline, pilot, stop threshold, and reassessment point are defined before launch."),
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
    id: "HUM1",
    dimension: "humanAssurance",
    prompt: "Can you recognize and correct a serious error in this work? Do you have the knowledge, access, authority, and time?",
    promptByStage: {
      plan: "Will you be able to recognize and correct a serious error? Will you have the knowledge, access, authority, and time?",
      release: "Could you recognize and correct a serious error in the finished work? Did you have the knowledge, access, authority, and time?",
      live: "Can you recognize and correct a serious error while this work is in use? Do you have the knowledge, access, authority, and time?",
    },
    why: "The role you give AI cannot be larger than your own reliable ability to examine the important work and intervene. If you need another person to close a gap, the result should name that as a condition rather than count it as your capacity.",
    options: HUM1_OPTIONS,
  },
  {
    id: "HUM3",
    dimension: "humanAssurance",
    prompt: "Can you keep performing the required review at the expected volume and pace?",
    promptByStage: {
      plan: "Will you be able to keep performing the required review at the expected volume and pace?",
      release: "Was the required review completed, and can it be maintained after launch at the expected volume and pace?",
      live: "Can you keep performing the required review at the actual volume and pace?",
    },
    why: "A relationship that depends on more attention than you can sustain may work once and still fail during normal use.",
    options: HUM3_OPTIONS,
  },
  {
    id: "CAP1",
    dimension: "capabilityFit",
    prompt: "What shows that this exact AI setup can perform the role you gave it?",
    promptByStage: {
      plan: "What supports your belief that this exact AI setup can perform the role you plan to give it?",
      release: "What shows that this exact AI setup performed the role you gave it in the finished work?",
      live: "What shows that this exact AI setup keeps performing its assigned role in actual use?",
    },
    why: "A model's reputation is not evidence that the configured system can do this particular work.",
    options: CAP1_OPTIONS,
    optionsByStage: {
      plan: CAP1_PLAN_OPTIONS,
      release: CAP1_OPTIONS,
      live: CAP1_LIVE_OPTIONS,
    },
  },
  {
    id: "CAP2",
    dimension: "capabilityFit",
    prompt: "Have the likely ways this could fail been identified and checked?",
    promptByStage: {
      plan: "Have you identified the likely ways this AI role could fail, and how will you check them?",
      release: "Were the likely ways this AI role could fail identified and checked before launch?",
      live: "Are likely failures being detected, corrected, and recorded during actual use?",
    },
    why: "Reliance depends on knowing where performance ends and what happens when it fails.",
    options: CAP2_OPTIONS,
  },
  {
    id: "BEH1",
    dimension: "behavioralFit",
    prompt: "What shows that the AI behaves the way you need it to in this relationship?",
    promptByStage: {
      plan: "How will you test whether the AI behaves the way you need it to in this relationship?",
      release: "What shows that the AI behaved the way you needed it to while making this work?",
      live: "What shows that the AI continues to behave the way you need it to in actual use?",
    },
    why: "An instruction to challenge, verify, or stop does not show that the behavior will occur when it matters.",
    options: BEH1_OPTIONS,
  },
  {
    id: "WF1",
    dimension: "workflowControl",
    prompt: "Are the system's access and authority limited to what this task requires?",
    promptByStage: {
      plan: "Will the AI's access and authority be limited to what this work requires?",
      release: "Were the AI's access and authority limited to what this work required?",
      live: "Are the AI's current access and authority still limited to what this work requires?",
    },
    why: "Authority should not exceed what the evidence, human capacity, and recovery controls can support.",
    options: WF1_OPTIONS,
  },
  {
    id: "WF2",
    dimension: "workflowControl",
    prompt: "What check happens before the result creates a consequence?",
    promptByStage: {
      plan: "What will be checked before an AI output or action creates a consequence?",
      release: "What was checked before this finished work was approved for launch?",
      live: "What is checked before each AI output or action creates a consequence?",
    },
    why: "A check changes the boundary only when it can detect a problem and stop or correct the work.",
    options: WF2_OPTIONS,
  },
  {
    id: "OUT1",
    dimension: "outcomeTestability",
    prompt: "What are you counting on this work to accomplish, and how will you recognize success or harm?",
    promptByStage: {
      plan: "What are you counting on this work to accomplish, and how will you recognize success or harm?",
      release: "Have you defined what success, failure, and warning signs will look like after launch?",
      live: "What actually happened? Did the expected result occur, and what problems appeared?",
    },
    why: "An output can look complete without producing the outcome you are betting on.",
    options: OUT_PLAN_OPTIONS,
    optionsByStage: {
      plan: OUT_PLAN_OPTIONS,
      release: OUT_RELEASE_OPTIONS,
      live: OUT_LIVE_OPTIONS,
    },
  },
  {
    id: "HUM2",
    dimension: "humanAssurance",
    prompt: "How were material claims verified?",
    promptByStage: {
      plan: "How will material claims be checked outside the AI system that produces or repeats them?",
      release: "How were material claims checked outside the AI system that produced or repeated them?",
      live: "How are material claims checked during actual use?",
    },
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
    promptByStage: {
      plan: "How will you test the AI with a flawed premise or a situation in which it should disagree or stop?",
      release: "Was the AI tested with a flawed premise or a situation in which it should disagree or stop?",
      live: "Does continued testing show that the AI disagrees or stops when it should?",
    },
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
    promptByStage: {
      plan: "Which technical checks will have to pass before launch?",
      release: "Which technical checks were completed and saved before launch?",
      live: "Which technical checks are repeated and saved while the work is in use?",
    },
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
    promptByStage: {
      plan: "Will you be able to see, stop, limit, and reverse the AI's activity while it is running?",
      release: "Were monitoring, stopping, limits, and recovery tested before launch?",
      live: "Can you see, stop, limit, and reverse the AI's activity during actual use?",
    },
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

const CORE_IDS = new Set(["HUM1", "HUM3", "CAP1", "CAP2", "BEH1", "WF1", "WF2", "OUT1"]);

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
    prompt: question.promptByStage?.[stage] || question.prompt,
    options: question.optionsByStage?.[stage] || question.options,
  }));
}

export function getActiveQuestionIds(assessment = {}) {
  return getActiveQuestionDefinitions(assessment).map(({ id }) => id);
}

export function getQuestionDefinition(id, assessment = {}) {
  return getActiveQuestionDefinitions(assessment).find((question) => question.id === id) || null;
}

