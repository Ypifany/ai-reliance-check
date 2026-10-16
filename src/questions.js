/**
 * evAIdence Load Test assessment definition.
 *
 * The definitions are data, rather than UI markup, so the assessment can be
 * rendered consistently in the browser, a printable form, or a future API.
 */

export const METHOD_VERSION = "0.5";

const UNCERTAINTY_TEXT = new Set([
  "unknown",
  "not known",
  "not sure",
  "unsure",
  "i do not know",
  "i don't know",
  "i dont know",
  "dont know",
  "cannot determine",
  "can't determine",
  "i cannot determine",
  "not available",
  "not applicable",
  "n/a",
  "na",
  "?",
]);

export function isUncertainText(value) {
  const raw = String(value ?? "").trim().toLowerCase().replaceAll("’", "'");
  if (!raw) return true;
  const normalized = raw.replace(/\s+/g, " ").replace(/[.!]+$/g, "");
  return UNCERTAINTY_TEXT.has(normalized) ||
    normalized.startsWith("unknown ") ||
    normalized.startsWith("i don't know ") ||
    normalized.startsWith("i do not know ");
}

export const DIMENSIONS = Object.freeze({
  humanAssurance: {
    label: "Human Review Capacity",
    description:
      "Checks whether the person or people reviewing the AI work can spot, fix, or stop a serious mistake. This includes what they know, can access, are allowed to change, and have time to review.",
  },
  capabilityFit: {
    label: "AI Role Fit",
    description:
      "Checks whether this AI product, model, and setup has shown that it can do the specific job you gave it.",
  },
  behavioralFit: {
    label: "Working Relationship",
    description:
      "Checks whether the AI responds the way this work needs. For example, will it question a bad idea, explain doubt, ask for missing details, or stop?",
  },
  workflowControl: {
    label: "Workflow and Controls",
    description:
      "Checks whether your access limits, reviews, approvals, records, stop controls, and recovery steps match the job you gave AI.",
  },
  outcomeTestability: {
    label: "Outcome and Stakes",
    description:
      "Checks whether you know what result you want, what could go wrong, and what signs will tell you to continue, change, or stop.",
  },
});

export const AUTHORITY_LEVELS = Object.freeze({
  A0: {
    label: "Give ideas or make a private draft",
    description: "AI explores ideas, gives advice, or makes a draft that no one else will use yet.",
  },
  A1: {
    label: "Make work for a person to approve",
    description: "AI makes the work, but a person approves it before anyone uses it or it causes a real result.",
  },
  A2: {
    label: "Take an approved action that can be undone",
    description: "AI takes a specific action only after a person approves it, and someone can undo the action.",
  },
  A3: {
    label: "Act without approval each time",
    description: "AI may publish, send, change, spend, or take other actions on its own within set limits.",
  },
});

export const EVIDENCE_BASES = Object.freeze({
  confirmed: {
    label: "Yes, I named a saved record",
    description: "You named a test result, work sample, screenshot, note, log, or link from this project. This tool does not open or inspect it.",
  },
  reported: {
    label: "No saved record",
    description: "You answered from memory, observation, a plan, or what someone told you, but you did not name a saved record from this project.",
  },
  unknown: {
    label: "I do not know yet",
    description: "You do not have enough information to answer this question.",
  },
});

const option = (value, label, description) => ({ value, label, description });

const UNKNOWN_OPTION = option(
  "unknown",
  "I do not know",
  "I do not have enough information to choose one of the other answers. The result will treat this part as unknown, not as a guess.",
);

const CAP1_OPTIONS = [
  option(0, "No one has tested this specific job", "The project is relying on the model name, its reputation, or an assumption."),
  option(25, "Someone tried one example", "One example looked okay, but no one decided what it had to do to pass."),
  option(50, "One typical test passed", "One test that represents the real work met the stated rules for passing."),
  option(75, "Several tests passed", "Several tests passed, including at least one difficult case."),
  option(100, "Normal, unusual, and failure tests passed more than once", "The same setup repeatedly passed normal, difficult, unusual, and failure tests."),
];

const CAP1_PLAN_OPTIONS = [
  option(0, "No one has tested this specific job", "The plan relies on the model name, its reputation, or an assumption."),
  option(25, "Someone tried one example", "One example looked okay, but no one decided what it had to do to pass."),
  option(50, "One typical test passed", "One test that represents the planned work met the stated rules for passing."),
  option(75, "Several tests passed", "Several tests using the planned setup passed, including at least one difficult case."),
  option(100, "The planned setup passed a full set of tests", "The same setup repeatedly passed normal, difficult, unusual, and failure tests for this job."),
];

const CAP1_LIVE_OPTIONS = [
  option(0, "No one has checked how it performs in real use", "There is no saved record showing how this setup performs while people use it."),
  option(25, "Someone looked at one result", "One result looked okay, but no one decided what it had to do to pass."),
  option(50, "One typical use passed", "At least one use that represents the real work met the stated rules for passing."),
  option(75, "Normal and difficult uses passed", "Several uses passed, including a difficult or unusual case."),
  option(100, "Real use has passed a full set of tests more than once", "The same setup repeatedly passed normal, unusual, and failure cases during real use."),
];

const CAP2_OPTIONS = [
  option(0, "No one has looked for likely problems", "No one has named or tested the problems this AI could cause in this project."),
  option(25, "The project only accounts for common AI problems", "People know about general AI problems, but have not identified the problems most likely in this project."),
  option(50, "The team named important problems and tested at least one", "The team named the problems that matter most and checked at least one of them."),
  option(75, "The team tested important problems and knows when to stop", "The team tested important problems and decided when to stop the work or require a correction."),
  option(100, "Repeated tests covered limits, stopping, and recovery", "Repeated tests showed that someone can spot a problem, stop the work, fix it, and recover."),
];

const BEH1_OPTIONS = [
  option(0, "The behavior was only assumed or requested", "Someone expects the AI to behave this way or only told it to do so."),
  option(25, "Someone defined the behavior and a test", "The expected behavior and test are written down, but no one has seen the AI pass the test yet."),
  option(50, "The AI passed one behavior test", "The AI passed one test of the behavior this project needs."),
  option(75, "The AI passed several useful tests", "It passed several tests, including one that tempted it to agree or keep going when it should not."),
  option(100, "The AI repeatedly responded the right way", "Repeated tests show that it agrees, disagrees, explains doubt, and stops when each response is appropriate."),
];

const HUM1_OPTIONS = [
  option(0, "The reviewer cannot catch or fix a serious mistake", "The reviewer lacks needed knowledge, access, decision power, or time."),
  option(25, "A major gap limits what the reviewer can do", "The reviewer can review some work, but an important gap remains in knowledge, access, decision power, or time."),
  option(50, "The reviewer can handle some important parts", "The reviewer can judge and fix part of the work, but not every part that could cause serious harm."),
  option(75, "The reviewer can handle every part that could cause serious harm", "The reviewer can examine each of those parts at the right time and require a correction or stop the work."),
  option(100, "Every high-impact part also gets a second strong check", "The reviewer covers every part that could cause serious harm, and a person with the needed knowledge or a different checking method also checks the highest-impact work."),
];

const HUM3_OPTIONS = [
  option(0, "The reviewer does not have enough time or attention", "The amount, speed, or difficulty of the work requires more time and attention than the reviewer has."),
  option(25, "The reviewer can keep up only for a short time", "The reviewer can do the needed review sometimes, but will probably fall behind during normal use."),
  option(50, "The reviewer can keep up if the work stays limited", "The reviewer can manage the review only if the work stays limited in size, speed, amount, or the job AI performs."),
  option(75, "The reviewer can keep up at the expected pace", "The reviewer has enough time, attention, and backup for the amount and pace you expect."),
  option(100, "The project measured the review work and kept up over time", "The review process has worked at the expected amount and pace, including during busy or difficult times."),
];

const WF1_OPTIONS = [
  option(0, "No one knows or controls what AI can access", "The AI's access or power is unknown, wider than needed, or not controlled."),
  option(25, "Someone stated limits but did not set them", "The team intends for AI to stay within limits, but no one has put those limits in place."),
  option(50, "Some limits exist, but gaps remain", "No one has confirmed all access or how every limit is enforced."),
  option(75, "AI has only needed access, and a person approves real actions", "Someone confirmed that AI has only the access it needs and that a person approves its work before it causes a real result."),
  option(100, "The team tested the controls", "The team tested access limits, approvals, records, stop controls, removing access, and undoing changes where they apply."),
];

const WF2_OPTIONS = [
  option(0, "Nothing outside the AI checks its work", "No one checks the work before use, or the AI only checks its own work."),
  option(25, "A person takes a quick final look", "A person briefly looks at the finished result."),
  option(50, "A person or separate tool follows a clear check", "A person or separate tool completes a defined check before anyone uses the work."),
  option(75, "A failed check stops the work", "The checks cover serious risks, and the work cannot move forward when a check fails."),
  option(100, "The team saves check results and has proven it can recover", "The team saves results, uses a separate way to check high-risk work, and has shown that someone can fix or undo a bad result."),
];

const WF2_PLAN_OPTIONS = [
  option(0, "No outside check is planned", "The plan does not include a person or different tool checking the AI work before anyone uses it."),
  option(25, "A quick final look is planned", "A person will briefly look at the finished result, but no clear checking steps are written down."),
  option(50, "A clear check is assigned", "A named person or different tool will follow written steps before anyone uses the work."),
  option(75, "A failed check will stop the work", "The planned checks cover serious risks, and the work cannot move forward when a check fails."),
  option(100, "The plan includes saved results and a recovery test", "The team will save results, use a different way to check high-risk work, and test whether a bad result can be fixed or undone."),
];

const OUT_PLAN_OPTIONS = [
  option(0, "The wanted result has not been clearly stated", "The result is too vague to check."),
  option(25, "The result is stated, but no one has decided how to check it", "The team can describe the result, but cannot yet measure or observe it."),
  option(50, "Success and possible harm are named", "The team stated what success would look like and what could go wrong."),
  option(75, "The team knows what to check, when, and who will check it", "The signs, limits, timing, source of information, and person responsible for checking the result are defined."),
  option(100, "The plan also includes a small trial, stop point, and later review", "The team knows the starting point, how to test on a small scale, when to stop, and when to review the decision again."),
];

const OUT_BUILD_OPTIONS = [
  option(0, "The wanted result has not been clearly stated", "The result is too vague to check during the work or after it is finished."),
  option(25, "The result is stated, but no one has decided how to check it", "The team can describe the result, but has not decided how to measure or observe it."),
  option(50, "Success and warning signs are named", "The team stated what success would look like and what signs would show a problem."),
  option(75, "The team knows what to check, when, and who will check it", "The signs, limits, timing, source of information, and person responsible for checking the result are defined."),
  option(100, "The team also set a small trial, stop point, and later review", "The team knows the starting point, how to test on a small scale, when to stop, and when to review the decision again."),
];

const OUT_LIVE_OPTIONS = [
  option(0, "No one has checked what happened after use", "There is no record of what happened after people used the work."),
  option(25, "The team only knows how much activity occurred", "The records only show numbers such as completions, visits, or how much output AI produced."),
  option(50, "The team checks either results or problems", "The team collects information about the wanted result or the problems that occurred, but not both."),
  option(75, "The team compares results and problems with its targets", "The team checks both the wanted result and signs of harm against stated targets."),
  option(100, "The team uses repeated results to change what it does", "Repeated observations have led the team to continue, fix, limit, or stop the work, and those decisions were saved."),
];

const OUT_RELEASE_OPTIONS = [
  option(0, "Success and warning signs were not defined", "The work may be finished, but no one has stated how to recognize success, failure, or harm."),
  option(25, "Only the finished work was checked", "Someone reviewed the finished work, but the team does not yet know how it will recognize success or harm after launch."),
  option(50, "Success and warning signs are defined", "The wanted result, the most likely failure, and important signs of a problem are named."),
  option(75, "The team is ready to check what happens after launch", "What to check, the limits, timing, source of information, and person responsible are defined."),
  option(100, "The team is ready for a small trial, stop point, and later review", "Before launch, the team set the starting point, a small trial, a point that will stop the work, and a date to review the decision again."),
];

const HUM2_OPTIONS = [
  option(0, "No one checked important facts", "No one checked the important facts, or the same AI checked its own claims."),
  option(25, "Links were saved but not reviewed", "The team has links, but no one read enough to confirm that they support the claims."),
  option(50, "Someone checked a sample of important facts", "Some important facts were checked against outside sources."),
  option(75, "Someone checked every important fact", "Each important fact was checked or clearly marked as unconfirmed."),
  option(100, "The highest-risk facts received a second strong check", "A person with the needed knowledge or a different source or tool checked the facts that could cause the most harm if they were wrong."),
];

const HUM2_PLAN_OPTIONS = [
  option(0, "There is no plan to check important facts", "No person or method outside the AI has been chosen to check important facts."),
  option(25, "Possible sources are listed", "The team listed possible sources, but has not decided what to check, who will check it, or when a failed check will stop the work."),
  option(50, "The important checks are assigned", "The types of facts to check, the sources they need, and the person who will check them are named."),
  option(75, "A full fact-checking plan is ready", "Before anyone uses the work, every important fact must have a good source or a clear note that it remains unconfirmed. A failed check stops the work."),
  option(100, "A second strong check is arranged for the highest-risk facts", "A person with the needed knowledge or a different source or tool will also check the facts that could cause the most harm if they were wrong."),
];

const BEH2_OPTIONS = [
  option(0, "No one tested this behavior", "The AI was told what to do, but no one tested whether it would do it."),
  option(25, "A test was written but not run", "Someone wrote down a bad assumption or a situation when the AI should stop, but has not tested it."),
  option(50, "Someone ran one test", "The AI received one bad assumption it should question or one situation when it should stop."),
  option(75, "Someone ran several agreement and disagreement tests", "Several tests required the AI to agree when the idea was sound and disagree when it was not."),
  option(100, "The AI repeatedly challenged ideas when needed", "Repeated tests show that the AI questions weak ideas without arguing when no challenge is needed."),
];

const BEH2_PLAN_OPTIONS = [
  option(0, "No challenge test is planned", "No one has written a bad assumption, disagreement case, unknown-answer case, or situation when the AI should stop."),
  option(25, "One challenge test is written", "Someone wrote one bad assumption the AI should question or one situation when it should stop."),
  option(50, "The test set and passing rules are ready", "The team has tests and clear passing rules for when the AI should agree, disagree, say it does not know, or stop."),
  option(75, "The planned setup passed several challenge tests", "The setup passed several tests that required it to agree when appropriate and disagree when appropriate."),
  option(100, "The planned setup repeatedly challenged ideas when needed", "Repeated tests show that the setup questions weak ideas without arguing when no challenge is needed."),
];

const WF3_OPTIONS = [
  option(0, "No technical checks were run", "No one completed a technical check that applies to this work."),
  option(25, "Someone only looked at it", "Someone checked how it looks, but did not test whether it works."),
  option(50, "The site or software works and a user can complete the main task", "Someone confirmed that the site or software can be created without code errors and that a user can complete its main task."),
  option(75, "The needed launch checks were completed and saved", "The applicable checks were completed and saved, such as code errors, links, phone display, accessibility, and whether the site can go live."),
  option(100, "Failure, security, and returning to a working version were also tested", "Someone tested what happens when something fails, ran the needed security checks, tested how to return to the last working version, and saved the results."),
];

const WF3_PLAN_OPTIONS = [
  option(0, "No one has decided which technical checks must pass", "The plan does not say which technical checks must be completed before launch."),
  option(25, "The plan is only to look at it", "The team plans to check how it looks, but not whether it works or what happens when it fails."),
  option(50, "The site or software and main-task checks are planned", "The plan names who will check for code errors, whether a user can complete the main task, and what counts as passing."),
  option(75, "A failed launch check will block release", "The needed checks are assigned, such as code errors, links, phone display, accessibility, going live, and security. A failed check stops launch."),
  option(100, "The failure and recovery plan is ready", "The plan also covers failure tests, a return to the last working version, saved results, and who can stop the release."),
];

const WF3_BUILD_OPTIONS = [
  option(0, "The technical checks have not started", "No one has completed a technical check that applies to the work so far."),
  option(25, "Someone only looked at the work so far", "Someone checked how the current version looks, but has not tested whether it works."),
  option(50, "The current site or software and main task were checked", "Someone checked for code errors and confirmed that a user can complete the main task built so far."),
  option(75, "The needed checks are being run and saved", "The team runs and saves the checks that apply while working, such as code errors, links, phone display, accessibility, and whether the site can go live."),
  option(100, "Failure, security, and undoing changes are also tested", "The team tests failures, security, and how to return to a working version while building, and saves the results."),
];

const WF4_OPTIONS = [
  option(0, "No one can control it while it runs", "No one can reliably watch, stop, limit, or undo the AI's activity, or that ability is unknown."),
  option(25, "Someone can review a record after it acts", "The AI records what it does, but no one has shown that they can step in while it runs."),
  option(50, "A person can watch and stop it", "A person can see the AI's activity and stop it by hand."),
  option(75, "Someone tested automatic stop points and undoing changes", "Someone tested limits that stop the AI and steps that undo its changes."),
  option(100, "The team tested all controls for live use", "The team tested limited access, monitoring, stopping, problem response, undoing changes, and approval before restart."),
];

const WF4_PLAN_OPTIONS = [
  option(0, "There is no plan to control it while it runs", "The plan does not explain how someone will watch, stop, limit, or undo the AI's activity."),
  option(25, "The plan only records its activity", "The AI will record what it does, but the team has not decided who can step in or how they will stop it."),
  option(50, "A named person will watch and stop it", "The plan names a person who can see the AI's activity and stop it by hand."),
  option(75, "Limits, stop points, and steps to undo changes are defined", "The plan names the limits, warning signs, who can stop the AI, and how to undo its changes."),
  option(100, "The team practiced all controls with this setup", "The team practiced limited access, monitoring, stopping, problem response, undoing changes, and approval before restart with the planned setup."),
];

/**
 * `trigger` is declarative so the UI can explain why an adaptive question was
 * added. `getActiveQuestionDefinitions` is the canonical trigger evaluator.
 */
export const QUESTION_DEFINITIONS = Object.freeze([
  {
    id: "HUM1",
    dimension: "humanAssurance",
    prompt: "Can {{checker}} catch a serious mistake in this AI’s work and make sure it gets fixed?",
    promptByStage: {
      plan: "Will {{checker}} be able to catch a serious mistake in this AI’s work and make sure it gets fixed?",
      build: "During the build, can {{checker}} catch a serious mistake in this AI’s work and make sure it gets fixed?",
      release: "Before launch, could {{checker}} catch a serious mistake in this AI’s work and make sure it got fixed?",
      live: "While people use this work, can {{checker}} catch a serious mistake in this AI’s work and make sure it gets fixed?",
    },
    why: "To do that, the reviewer needs enough knowledge, access, decision power, and time. Simply having a person involved is not enough.",
    evidenceGuidance: "Name the reviewer. Save examples of mistakes that person caught, related work they have done, and proof that they can access, change, or stop the work.",
    options: HUM1_OPTIONS,
  },
  {
    id: "HUM3",
    dimension: "humanAssurance",
    prompt: "Does {{checker}} have enough time and attention to review the amount of work this AI produces?",
    promptByStage: {
      plan: "Will {{checker}} have enough time and attention to review the amount of work this AI will produce?",
      build: "While this project is being made, does {{checker}} have enough time and attention to review the amount of work this AI produces?",
      release: "Before launch, did {{checker}} have enough time and attention to review the amount of work this AI produced?",
      live: "During use, does {{checker}} have enough time and attention to review the amount of work this AI produces?",
    },
    why: "AI may make work faster, but its output can create more work to check, fix, watch, and recover. The people responsible for those checks need enough time and attention.",
    evidenceGuidance: "Record who does the checks, how long reviews take, how much output you expect, how much work is waiting, any missed checks, and who provides backup.",
    options: HUM3_OPTIONS,
  },
  {
    id: "CAP1",
    dimension: "capabilityFit",
    prompt: "What tests or work samples show that this AI can do this specific job?",
    promptByStage: {
      plan: "What tests show that this AI can do the specific job it will do?",
      build: "What tests or work samples show that this AI can do its job so far?",
      release: "What tests or work samples show that this AI did its job?",
      live: "What results show that this AI keeps doing its job well?",
    },
    why: "A product or model name does not prove that your exact AI setup can do this specific job.",
    evidenceGuidance: "Save tests that use the same AI product, model, instructions, tools, and sources. State what counts as passing and test normal, difficult, unusual, and failure cases.",
    options: CAP1_OPTIONS,
    optionsByStage: {
      plan: CAP1_PLAN_OPTIONS,
      build: CAP1_OPTIONS,
      release: CAP1_OPTIONS,
      live: CAP1_LIVE_OPTIONS,
    },
  },
  {
    id: "CAP2",
    dimension: "capabilityFit",
    prompt: "How much testing has anyone done for the AI mistakes most likely in this project?",
    promptByStage: {
      plan: "Before work starts, how much testing has anyone done for the AI mistakes most likely in this project?",
      build: "While this project is being made, how much testing has anyone done for the AI mistakes most likely here?",
      release: "Before launch, how much testing did anyone do for the AI mistakes most likely in this project?",
      live: "During use, how well does the project team find, fix, and record the AI mistakes most likely here?",
    },
    why: "Knowing how the AI may fail shows what you need to catch, fix, stop, or recover from.",
    evidenceGuidance: "Save a list of likely problems, tests that caused those problems, what should make the work stop, and what happened when you tried to fix the problem.",
    options: CAP2_OPTIONS,
  },
  {
    id: "BEH1",
    dimension: "behavioralFit",
    prompt: "What have you seen that shows this AI responds the way you need?",
    promptByStage: {
      plan: "What tests show whether this AI will respond the way you need for this work?",
      build: "While you build, what have you seen that shows this AI responds the way you need?",
      release: "While making this work, what showed that the AI responded the way you needed?",
      live: "During real use, what shows that the AI continues to respond the way you need?",
    },
    why: "Telling AI to question, check, or stop does not prove that it will do so when it matters.",
    evidenceGuidance: "Save tests that show when the AI agreed, questioned an idea, said it was unsure, asked for missing details, or stopped while using this exact setup.",
    options: BEH1_OPTIONS,
  },
  {
    id: "WF1",
    dimension: "workflowControl",
    prompt: "What can the AI access or change, and what keeps it within those limits?",
    promptByStage: {
      plan: "What will the AI be able to access or change, and what will keep it within those limits?",
      build: "While the project is being made, what can the AI access or change, and what keeps it within those limits?",
      release: "While making this work, what could the AI access or change, and did the limits work?",
      live: "What can the AI access or change now, and do the limits still work?",
    },
    why: "When AI can reach more accounts, data, or tools before someone reviews its work, one mistake can cause more harm and require more work to fix.",
    evidenceGuidance: "Save current permission screens, records of what the AI accessed, approval limits, and tests showing that you can remove access or undo a change.",
    options: WF1_OPTIONS,
  },
  {
    id: "WF2",
    dimension: "workflowControl",
    prompt: "What check can catch and fix a bad AI result before anyone uses it?",
    promptByStage: {
      plan: "What check will catch and fix a bad AI result before anyone uses it?",
      build: "What does someone check before the AI's work is used or approved?",
      release: "What did someone check before this work was approved for launch?",
      live: "What check can catch and fix a bad AI result before each use or action?",
    },
    why: "A check only helps if it can find the kind of mistake that matters and prevent that mistake from reaching people or causing an action.",
    evidenceGuidance: "Save a checklist, approval record, comparison, or example showing that a person or separate tool found and fixed a serious mistake before use.",
    options: WF2_OPTIONS,
    optionsByStage: { plan: WF2_PLAN_OPTIONS },
  },
  {
    id: "OUT1",
    dimension: "outcomeTestability",
    prompt: "How will you know whether the finished work succeeded or caused a problem?",
    promptByStage: {
      plan: "How will you know whether the finished work succeeded or caused a problem?",
      build: "How will you know whether the finished work succeeded or caused a problem?",
      release: "After launch, what should happen? What warning signs would make you change or stop the work?",
      live: "What happened after people used the work? What worked, what went wrong, and what will you change?",
    },
    why: "Finished does not mean successful. You need clear signs that show whether the work helped, failed, or caused a problem.",
    evidenceGuidance: "Write down the result you want, warning signs, who will check, and when they will check. Save user feedback and records of what actually happened.",
    options: OUT_PLAN_OPTIONS,
    optionsByStage: {
      plan: OUT_PLAN_OPTIONS,
      build: OUT_BUILD_OPTIONS,
      release: OUT_RELEASE_OPTIONS,
      live: OUT_LIVE_OPTIONS,
    },
  },
  {
    id: "HUM2",
    dimension: "humanAssurance",
    prompt: "Who checks important facts, and how do they avoid relying on the same AI that gave those facts?",
    promptByStage: {
      plan: "Who will check important facts, and how will they avoid relying on the same AI that gives those facts?",
      build: "Who checks important facts as the work is built, and how do they avoid relying on the same AI that gives those facts?",
      release: "Who checked important facts, and how did they avoid relying on the same AI that gave those facts?",
      live: "Who checks important facts during use, and how do they avoid relying on the same AI that gives those facts?",
    },
    why: "Asking the same AI to check its own facts may repeat the same mistake. Important facts need a reliable source, a person with the needed knowledge, or a different way to check them.",
    evidenceGuidance: "Save notes showing which sources were read, how they were compared with trusted information, what a knowledgeable person reviewed, and which facts could not be confirmed.",
    options: HUM2_OPTIONS,
    optionsByStage: { plan: HUM2_PLAN_OPTIONS, build: HUM2_OPTIONS },
    evidenceGuidanceByStage: {
      plan: "Write a plan that says which facts need checking, which sources count, who will check, how you will mark unconfirmed facts, and whether another person or method must check high-risk facts.",
      build: "Save notes showing which sources were read, how they were compared with trusted information, what a knowledgeable person reviewed, and which facts could not be confirmed.",
    },
    trigger: {
      description: "Asked because this work includes facts or claims that could affect someone.",
      projectFlag: "materialClaims",
      workTypes: ["factual", "decision", "training"],
    },
  },
  {
    id: "BEH2",
    dimension: "behavioralFit",
    prompt: "Has anyone tested whether the AI will question a bad idea, admit when it does not know, or stop when it should?",
    promptByStage: {
      plan: "What tests are planned or complete to see whether the AI will question a bad idea, admit when it does not know, or stop?",
      build: "As the work is built, has anyone tested whether the AI will question a bad idea, admit when it does not know, or stop when it should?",
      release: "Before launch, did anyone test whether the AI would question a bad idea, admit when it did not know, or stop when it should?",
      live: "During use, do the tests show that the AI questions bad ideas, admits when it does not know, and stops when it should?",
    },
    why: "AI agreeing with you does not prove that it can catch a weak idea, point out a mistake, or stop when it lacks enough information.",
    evidenceGuidance: "Save tests where you gave the same AI setup a bad assumption, a reason to disagree, missing information, or a situation when it should stop.",
    options: BEH2_OPTIONS,
    optionsByStage: { plan: BEH2_PLAN_OPTIONS, build: BEH2_OPTIONS },
    evidenceGuidanceByStage: {
      plan: "Write test cases and clear passing rules. Save the results for any tests you already ran with the planned setup.",
      build: "Save tests where you gave the same AI setup a bad assumption, a reason to disagree, missing information, or a situation when it should stop.",
    },
    trigger: {
      description: "Asked because you need the AI to compare choices, question ideas, admit doubt, or stop.",
      requiredBehaviors: ["compare", "challenge", "uncertainty", "stop"],
    },
  },
  {
    id: "WF3",
    dimension: "workflowControl",
    prompt: "Which website or software checks did the project team run and save?",
    promptByStage: {
      plan: "Which website or software checks must pass before launch?",
      build: "Which website or software checks has the project team run and saved so far?",
      release: "Which website or software checks did the project team run and save before launch?",
      live: "Which website or software checks does the project team repeat and save while people use the work?",
    },
    why: "Looking at a website or software does not show whether its code, links, phone display, accessibility, security, or launch process works.",
    evidenceGuidance: "Save results from the checks that fit this work, such as code builds, automated tests, links, phone display, accessibility, security, launch, failure, and returning to a working version.",
    options: WF3_OPTIONS,
    optionsByStage: { plan: WF3_PLAN_OPTIONS, build: WF3_BUILD_OPTIONS },
    evidenceGuidanceByStage: {
      plan: "Write a launch checklist that says which checks must pass, what counts as passing, who runs each check, what stops launch, and the results of any practice run.",
      build: "Save results from checks you have completed so far and list the checks that still must pass before launch.",
    },
    trigger: {
      description: "Asked because this project includes software, a website, code, or technical settings.",
      projectFlag: "productionCodeOrConfiguration",
      workTypes: ["software", "website", "code", "configuration"],
    },
  },
  {
    id: "WF4",
    dimension: "workflowControl",
    prompt: "If AI works on its own or repeats actions, can someone watch it, limit it, stop it, and undo its changes?",
    promptByStage: {
      plan: "If AI will work on its own or repeat actions, who will watch, limit, and stop it, and who can undo its changes?",
      build: "While the work is built, can someone responsible watch, limit, and stop the AI and undo its changes?",
      release: "Before launch, did anyone test whether someone could watch, limit, and stop the AI and undo its changes?",
      live: "During real use, can someone watch, limit, and stop the AI and undo its changes?",
    },
    why: "When AI works on its own or repeats actions, you need controls that work while it runs. A review afterward may be too late.",
    evidenceGuidance: "Save records showing that you watched the AI and tested limits, stopping, removing access, undoing changes, fixing problems, and responding to an incident.",
    options: WF4_OPTIONS,
    optionsByStage: { plan: WF4_PLAN_OPTIONS, build: WF4_OPTIONS },
    evidenceGuidanceByStage: {
      plan: "Write a plan that says what the AI can access, how someone will watch and limit it, who can stop it, how to undo changes and recover, and the results of any practice run.",
      build: "Save records showing that you watched the AI and tested limits, stopping, removing access, undoing changes, fixing problems, and responding to an incident.",
    },
    trigger: {
      description: "Asked because the AI may repeat actions or work without someone watching each step.",
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

const BEHAVIOR_PHRASES = Object.freeze({
  follow: "follow the directions it receives",
  organize: "put information in a useful order",
  compare: "compare reasonable choices",
  challenge: "point out problems or weak ideas",
  verify: "check facts against reliable sources",
  separate: "say what it checked, assumed, or could not confirm",
  uncertainty: "say when it is unsure or does not know",
  test: "test whether the result works",
  stop: "stop and wait for a person",
});

function primarySystemFor(assessment) {
  const systems = Array.isArray(assessment?.project?.systems) ? assessment.project.systems : [];
  return systems.find((system) => system.id === assessment?.project?.primarySystemId) || systems[0] || {};
}

/**
 * Answers only apply to the AI job and human-review arrangement they describe.
 * This compact snapshot lets the UI invalidate old answers when that
 * arrangement changes instead of silently applying them to a different job.
 */
export function getAssessmentScopeKey(assessment = {}) {
  const project = assessment.project || {};
  const systems = Array.isArray(project.systems) ? project.systems : [];
  const normalizedSystems = systems.map((system) => ({
    id: String(system.id || ""),
    product: String(system.product || system.name || "").trim(),
    model: String(system.model || "").trim(),
    role: String(system.role || "").trim(),
    operator: String(system.operator || ""),
    operatorRole: String(system.operatorRole || "").trim(),
    checker: String(system.checker || ""),
    checkerRole: String(system.checkerRole || "").trim(),
    checkerScope: String(system.checkerScope || "").trim(),
    authority: String(system.proposedAuthority || ""),
    setup: String(system.setup || "").trim(),
  }));
  return JSON.stringify({
    stage: ["plan", "build", "release", "live"].includes(assessment.stage) ? assessment.stage : "plan",
    task: String(project.task || "").trim(),
    aiUseFocus: String(project.aiUseFocus || ""),
    intendedOutcome: String(project.intendedOutcome || "").trim(),
    humanActivities: normalizedTerms(project.humanActivities).sort(),
    otherHumanInvolved: String(project.otherHumanInvolved || ""),
    otherHumanRole: String(project.otherHumanRole || "").trim(),
    otherHumanActivities: normalizedTerms(project.otherHumanActivities).sort(),
    humanOther: String(project.humanOther || "").trim(),
    failureScenario: String(project.failureScenario || "").trim(),
    failureImpact: String(project.failureImpact || "").trim(),
    workTypes: normalizedTerms(project.workTypes).sort(),
    requiredBehaviors: normalizedTerms(project.requiredBehaviors).sort(),
    consequence: String(project.consequence || ""),
    primarySystemId: String(project.primarySystemId || normalizedSystems[0]?.id || ""),
    systems: normalizedSystems,
  });
}

function checkerPromptLabel(assessment) {
  const system = primarySystemFor(assessment);
  const asRole = (value, fallback) => {
    const role = String(value || "").trim();
    if (isUncertainText(role)) return fallback;
    return role.toLowerCase().startsWith("the ") ? role : `the ${role}`;
  };
  let label = "the person responsible for reviewing this AI’s work";
  if (system.checker === "me") label = "you";
  else if (system.checker === "operator") {
    if (system.operator === "me") label = "you";
    else if (system.operator === "both") label = `you and ${asRole(system.operatorRole, "the other person working directly with AI")}`;
    else label = asRole(system.operatorRole, "the person working directly with AI");
  } else if (system.checker === "other") label = asRole(system.checkerRole, "the other reviewer");
  else if (system.checker === "shared") label = asRole(system.checkerRole, "the people reviewing different parts");
  else if (system.checker === "unknown") label = "the reviewer, whose identity is not known";
  return label;
}

function formatPlainList(items) {
  if (items.length <= 1) return items[0] || "respond the way this work requires";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function behaviorPrompt(assessment, stage) {
  const behaviors = (assessment?.project?.requiredBehaviors || [])
    .map((id) => BEHAVIOR_PHRASES[id])
    .filter(Boolean);
  const expected = formatPlainList(behaviors);
  return ({
    plan: `What tests show whether this AI will ${expected}?`,
    build: `What tests or examples show so far that this AI can ${expected}?`,
    release: `What showed that this AI could ${expected}?`,
    live: `What shows that this AI continues to ${expected}?`,
  })[stage];
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
  const stage = ["plan", "build", "release", "live"].includes(assessment.stage)
    ? assessment.stage
    : "plan";

  return QUESTION_DEFINITIONS.filter((question) =>
    CORE_IDS.has(question.id) || isQuestionActive(question, assessment),
  ).map((question) => {
    const stageOptions = question.optionsByStage?.[stage] || question.options;
    const stagePrompt = question.promptByStage?.[stage] || question.prompt;
    const prompt = question.id === "BEH1"
      ? behaviorPrompt(assessment, stage)
      : stagePrompt.replaceAll("{{checker}}", checkerPromptLabel(assessment));
    return {
      ...question,
      prompt,
      options: [...stageOptions, UNKNOWN_OPTION],
      evidenceGuidance: question.evidenceGuidanceByStage?.[stage] || question.evidenceGuidance,
    };
  });
}

export function getActiveQuestionIds(assessment = {}) {
  return getActiveQuestionDefinitions(assessment).map(({ id }) => id);
}

export function getQuestionDefinition(id, assessment = {}) {
  return getActiveQuestionDefinitions(assessment).find((question) => question.id === id) || null;
}

