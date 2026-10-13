import './styles.css';
import {
  DIMENSIONS,
  getActiveQuestionDefinitions,
} from './questions.js';
import {
  AUTHORITY_LABELS,
  METHOD_VERSION,
  getBand,
  scoreAssessment,
} from './scoring.js';
import homeBakingPhoto from './home-baking.webp';

const STORAGE_KEY = 'ai-reliance-check:v0.2';
const LEGACY_STORAGE_KEY = 'ai-reliance-check:v0.1';
const RECORD_KEY = 'ai-reliance-check:work-record:v0.2';
const LEGACY_RECORD_KEY = 'ai-reliance-check:creation-record:v0.1';
const SCHEMA_VERSION = 2;

const WORK_TYPES = [
  ['factual', 'Factual content', 'Claims, research, or source-based material'],
  ['creative', 'Creative work', 'Ideas, language, design, or media'],
  ['software', 'Software or website', 'Code, configuration, or deployment'],
  ['decision', 'Decision support', 'Recommendations that influence a choice'],
  ['automation', 'Repeated or agent action', 'Work that continues or acts through tools'],
  ['training', 'Training or learning', 'Materials intended to build knowledge or skill'],
];

const BEHAVIORS = [
  ['follow', 'Follow directions'],
  ['organize', 'Organize material'],
  ['compare', 'Compare alternatives'],
  ['challenge', 'Challenge assumptions'],
  ['verify', 'Verify claims'],
  ['separate', 'Separate evidence and inference'],
  ['uncertainty', 'Identify uncertainty'],
  ['test', 'Test the result'],
  ['stop', 'Stop and request approval'],
];

const CONTRIBUTIONS = [
  ['idea', 'Originating idea'],
  ['sources', 'Sources and context'],
  ['structure', 'Structure and organization'],
  ['production', 'Draft or technical production'],
  ['review', 'Reviewed suggestions and decided what to keep, change, or leave out'],
  ['revision', 'Revision and final meaning'],
  ['verification', 'Verification and testing'],
  ['release', 'Final release decision'],
];

const CONTRIBUTION_OPTIONS = [
  ['Human-led', 'I led this'],
  ['Shared', 'I did this with AI'],
  ['AI-reviewed', 'AI did this, then I reviewed and changed it'],
  ['AI-accepted', 'AI did this, and I accepted it as given'],
  ['Other-person', 'Another person did this'],
  ['Unknown', 'Unknown'],
  ['Not applicable', 'Not applicable'],
];

const main = document.querySelector('#main-content');
const nav = document.querySelector('#site-nav');
const menuButton = document.querySelector('.menu-button');
const toast = document.querySelector('#toast');
const siteFooter = document.querySelector('.site-footer');

let assessment = loadAssessment();
let creationRecord = loadCreationRecord();
let checkView = assessment.completed ? 'result' : 'entry';
let currentQuestionIndex = resumeQuestionIndex(assessment);

function makeAssessment() {
  const firstSystem = makeSystem();
  return {
    schemaVersion: SCHEMA_VERSION,
    methodVersion: METHOD_VERSION,
    id: makeId('check'),
    stage: '',
    project: {
      name: '',
      task: '',
      system: '',
      systems: [firstSystem],
      primarySystemId: firstSystem.id,
      intendedOutcome: '',
      consequence: 'moderate',
      proposedAuthority: 'A1',
      workTypes: [],
      requiredBehaviors: [],
      connectedAccess: null,
      permissionsConfirmed: null,
      humanApprovalBeforeConsequence: null,
      sensitiveData: false,
      dataAuthorizationConfirmed: null,
      unresolvedMaterialFailure: false,
      actionsAreReversible: null,
      monitoringConfirmed: null,
      observedRuns: 0,
      representativeConditions: null,
      atLeastOneEdgeOrFailureCase: null,
      controlsActuallyOperated: null,
      observedInRealUseForFullOperatingCycle: null,
      outcomeDataCollected: null,
      materialFailuresResolved: null,
      reviewSustainable: null,
      independentReviewerName: '',
      independentReviewerRole: '',
      independentReviewScope: '',
      independentReviewDate: '',
      qualifiedIndependentReview: false,
    },
    answers: {},
    completed: false,
    currentQuestion: 0,
    currentQuestionId: '',
    needsReassessment: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeSystem(overrides = {}) {
  return {
    product: '',
    model: '',
    role: '',
    proposedAuthority: 'A1',
    setup: '',
    evidence: '',
    evidenceBasis: 'reported',
    connectedAccess: null,
    permissionsConfirmed: null,
    ...overrides,
    id: overrides.id || makeId('system'),
  };
}

function makeCreationRecord(projectId = '') {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: makeId('record'),
    projectId,
    aiUse: 'yes',
    title: '',
    description: '',
    ideaSource: '',
    humanActions: '',
    aiContributions: '',
    artifactUrl: '',
    system: '',
    systems: [makeSystem()],
    interactionEvidence: '',
    otherEvidence: '',
    reviewerName: '',
    reviewerRole: '',
    reviewerScope: '',
    reviewerDate: '',
    finalDecisionName: '',
    finalDecisionRole: '',
    finalDecisionDate: '',
    contributions: Object.fromEntries(CONTRIBUTIONS.map(([id]) => [id, 'Unknown'])),
    updatedAt: new Date().toISOString(),
  };
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? { ...fallback, ...JSON.parse(value) } : fallback;
  } catch {
    return fallback;
  }
}

function loadAssessment() {
  const fallback = makeAssessment();
  const current = loadJSON(STORAGE_KEY, null);
  const legacy = current ? null : loadJSON(LEGACY_STORAGE_KEY, null);
  const stored = current || legacy;
  if (!stored || typeof stored !== 'object') return fallback;
  const isLegacy = stored.schemaVersion !== SCHEMA_VERSION || stored.methodVersion !== METHOD_VERSION;
  const project = { ...fallback.project, ...(stored.project || {}) };
  project.systems = normalizeSystems(stored.project?.systems, project.system, project.proposedAuthority);
  project.primarySystemId = project.systems.some((item) => item.id === project.primarySystemId)
    ? project.primarySystemId
    : project.systems[0].id;
  project.workTypes = Array.isArray(project.workTypes) ? project.workTypes : [];
  project.requiredBehaviors = Array.isArray(project.requiredBehaviors) ? project.requiredBehaviors.slice(0, 3) : [];
  const normalized = {
    ...fallback,
    ...stored,
    schemaVersion: SCHEMA_VERSION,
    methodVersion: METHOD_VERSION,
    project,
    answers: stored.answers && typeof stored.answers === 'object' ? stored.answers : {},
  };
  if (isLegacy) {
    normalized.legacySnapshot = {
      methodVersion: stored.methodVersion || '0.1',
      completed: Boolean(stored.completed),
      answers: normalized.answers,
      completedAt: stored.completedAt || '',
    };
    normalized.answers = {};
    normalized.completed = false;
    normalized.currentQuestion = 0;
    normalized.currentQuestionId = '';
    normalized.needsReassessment = true;
  }
  return normalized;
}

function loadCreationRecord() {
  const fallback = makeCreationRecord(assessment.id);
  const current = loadJSON(RECORD_KEY, null);
  const stored = current || loadJSON(LEGACY_RECORD_KEY, null);
  if (!stored || typeof stored !== 'object') return fallback;
  const legacyContributions = { ...(stored.contributions || {}) };
  const migrateContribution = (value) => value === 'AI-led' ? 'Unknown' : value || 'Unknown';
  const migratedContributions = {
    idea: migrateContribution(legacyContributions.idea || legacyContributions['Originating idea'] || legacyContributions['Main idea and purpose'] || legacyContributions['Purpose and originating idea']),
    sources: migrateContribution(legacyContributions.sources || legacyContributions['Sources and context']),
    structure: migrateContribution(legacyContributions.structure || legacyContributions['Structure and organization']),
    production: migrateContribution(legacyContributions.production || legacyContributions['Draft or technical production']),
    review: migrateContribution(legacyContributions.review || legacyContributions['Reviewed suggestions and decided what to keep, change, or leave out'] || legacyContributions['Evaluation and rejection']),
    revision: migrateContribution(legacyContributions.revision || legacyContributions['Revision and final meaning']),
    verification: migrateContribution(legacyContributions.verification || legacyContributions['Verification and testing']),
    release: migrateContribution(legacyContributions.release || legacyContributions['Final release decision'] || legacyContributions['Final approval']),
  };
  const legacyNotes = [];
  if (legacyContributions['Concept development']) {
    legacyNotes.push(`Earlier record, Concept development: ${legacyContributions['Concept development']}`);
  }
  if (Object.values(legacyContributions).includes('AI-led')) {
    legacyNotes.push('Earlier records marked one or more contributions as “AI contributed this.” Review those rows because the earlier option did not distinguish AI work that was revised from AI work accepted as given.');
  }
  if (stored.accountability) {
    legacyNotes.push(`Earlier final approval entry: ${stored.accountability}`);
  }
  return {
    ...fallback,
    ...stored,
    schemaVersion: SCHEMA_VERSION,
    projectId: stored.projectId || assessment.id,
    systems: normalizeSystems(stored.systems, stored.system),
    interactionEvidence: stored.interactionEvidence || '',
    otherEvidence: stored.otherEvidence || stored.evidenceLinks || '',
    finalDecisionName: stored.finalDecisionName || stored.accountability || '',
    finalDecisionRole: stored.finalDecisionRole || '',
    legacyNotes: stored.legacyNotes || legacyNotes.join('\n'),
    contributions: { ...fallback.contributions, ...migratedContributions },
  };
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resumeQuestionIndex(value) {
  const questions = getActiveQuestionDefinitions(value || {});
  if (!questions.length) return 0;
  const firstUnanswered = questions.findIndex((question) => !isValidAnswer(question, value?.answers?.[question.id]));
  if (firstUnanswered >= 0) return firstUnanswered;
  if (value?.currentQuestionId) {
    const savedIndex = questions.findIndex((question) => question.id === value.currentQuestionId);
    if (savedIndex >= 0) return savedIndex;
  }
  return Math.min(Number(value?.currentQuestion || 0), questions.length - 1);
}

function isValidAnswer(question, answer) {
  if (!question || !answer || typeof answer !== 'object') return false;
  const validLevel = question.options.some((option) => Number(option.value) === Number(answer.level));
  const validBasis = ['confirmed', 'reported', 'unknown'].includes(answer.basis);
  if (!validLevel || !validBasis) return false;
  if (answer.basis === 'confirmed' && !String(answer.evidenceNote || '').trim() && !String(answer.evidenceUrl || '').trim()) {
    return false;
  }
  return true;
}

function normalizeSystems(systems, legacySystem = '', legacyAuthority = 'A1') {
  const normalized = Array.isArray(systems)
    ? systems.filter((item) => item && typeof item === 'object').map((item) => makeSystem(item))
    : [];
  if (normalized.length) return normalized;
  return [makeSystem({
    product: String(legacySystem || ''),
    setup: String(legacySystem || ''),
    proposedAuthority: Object.hasOwn(AUTHORITY_LABELS, legacyAuthority) ? legacyAuthority : 'A1',
  })];
}

function saveAssessment() {
  assessment.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assessment));
}

function saveCreationRecord() {
  creationRecord.updatedAt = new Date().toISOString();
  localStorage.setItem(RECORD_KEY, JSON.stringify(creationRecord));
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(date = new Date()) {
  const dateOnly = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const parsed = dateOnly
    ? new Date(...date.split('-').map((part, index) => Number(part) - (index === 1 ? 1 : 0)))
    : new Date(date);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(safeDate);
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function downloadJSON(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function route() {
  const path = (location.hash || '#/').slice(1).split('?')[0];
  setMenuOpen(false);
  setActiveNav(path);

  const routes = {
    '/': renderHome,
    '/check': renderCheck,
    '/sample': renderSample,
    '/creation-record': renderCreationRecord,
    '/method': renderMethod,
    '/examples': renderExamples,
    '/pricing': renderPricing,
    '/faq': renderFAQ,
  };

  const renderer = routes[path] || renderNotFound;
  renderer();
  focusCurrentStep();
}

function setActiveNav(path) {
  document.querySelectorAll('.site-nav a').forEach((link) => {
    const current = link.getAttribute('href') === `#${path}`;
    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function renderHome() {
  document.title = 'Home | Human + AI Work Check';
  main.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-kicker">When human work includes AI</p>
        <h1>Check whether the trust you are placing in the work is supported.</h1>
        <p class="hero-definition"><strong>Human + AI Work Check starts with your capacity.</strong> It then examines one consequential AI system and role, the task, the workflow, the evidence, and what you are betting will happen.</p>
        <p class="hero-promise">See the largest role supported now, what needs capable review, what is not supported yet, and what would strengthen the arrangement.</p>
        <p class="assurance-note"><strong>A person in the loop is not enough.</strong> You need the knowledge, access, authority, time, attention, and stamina to recognize a problem, correct it, or stop the work.</p>
        <div class="hero-actions">
          <a class="button" href="#/check">Check a project <span aria-hidden="true">→</span></a>
          <a class="button button-secondary" href="#/creation-record">Create a Work Record</a>
        </div>
        <p class="hero-limit"><strong>It is not an AI detector.</strong> It does not grade a model in general or guess who made a finished artifact. It examines one real human and AI arrangement doing one job.</p>
      </div>
      <figure class="kitchen-figure">
        <img src="${homeBakingPhoto}" alt="A woman in a kitchen smiles at a finished chocolate cake beside an open recipe notebook." />
        <figcaption><strong>The output is the cake. The working relationship is the kitchen.</strong> This tool checks how the person and AI made the work, not just the finished product.</figcaption>
      </figure>
    </section>

    <section class="section section-compact situations-section">
      <div class="section-heading">
        <div>
          <p class="kicker">Why this matters</p>
          <h2>The final product does not show how the work was done.</h2>
        </div>
        <p class="lede">These are different problems, but each one is missing the same thing: evidence of what the person did, what AI contributed, what was checked, and what AI was authorized to do.</p>
      </div>
      <ul class="situation-list" aria-label="Common situations involving AI">
        <li><span>Teacher</span><q>This sounds like AI wrote it.</q></li>
        <li><span>Publisher</span><q>The checker says you didn’t write this.</q></li>
        <li><span>Manager</span><q>Let the AI agent do it so we can save time. You are responsible for checking it.</q></li>
        <li><span>Business owner</span><q>If an expert checks everything, what are we saving?</q></li>
      </ul>
    </section>

    <section class="section">
      <div class="section-heading">
        <div><p class="kicker">Two connected tools</p><h2>Check the arrangement. Document the work.</h2></div>
        <p class="lede">The tools answer different questions. Use either one, or connect them when you need both a decision and a record.</p>
      </div>
      <div class="grid-2">
        <article class="card"><span class="card-number">01</span><h3>Work Check</h3><p><strong>Is the trust I am placing in this human and AI work arrangement supported?</strong></p><p>Use it to plan a project, check work before launch, or review an arrangement already in use.</p><a class="text-link" href="#/check">Check a project</a></article>
        <article class="card"><span class="card-number">02</span><h3>Work Record</h3><p><strong>How was this finished work actually made?</strong></p><p>Record the person’s actions, each AI system and role, supporting records, and the final release decision.</p><a class="text-link" href="#/creation-record">Create a Work Record</a></article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="kicker">Three decision points</p>
          <h2>Use the Work Check when the decision changes.</h2>
        </div>
        <p class="lede">The questions and result change depending on whether you are planning, ready to launch, or reviewing real use.</p>
      </div>
      <div class="grid-3">
        ${stageCard('01', 'Before you start', 'Plan Readiness', 'Choose a supported AI role, required human capacity, workflow checks, and stopping points.', 'plan', 'Plan the work')}
        ${stageCard('02', 'Ready to publish, send, or launch', 'Launch Support', 'Check what actually happened and whether the finished arrangement supports release.', 'release', 'Check before launch')}
        ${stageCard('03', 'Already in use', 'Current-Use Support', 'Use observed results, errors, and consequences to decide whether to continue, limit, or stop.', 'live', 'Review current use')}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="kicker">What the Work Check weighs</p>
          <h2>The arrangement has to carry the wager.</h2>
        </div>
        <p class="lede">A stronger model can still be a poor fit. A simpler model can work inside a narrow, tested workflow when the person can carry the review load. The parts have to work together.</p>
      </div>
      <div class="formula" aria-label="Your capacity plus the AI system and role plus the task plus the workflow plus the wager">
        <span>Your capacity</span><span class="formula-symbol">+</span>
        <span>AI system and role</span><span class="formula-symbol">+</span>
        <span>Task</span><span class="formula-symbol">+</span>
        <span>Workflow</span><span class="formula-symbol">+</span>
        <span>Wager</span>
      </div>
      <p class="helper-text"><strong>Evidence is reported separately.</strong> It determines how strongly the Work Check can state its conclusion. Missing evidence creates uncertainty. It does not automatically prove poor ability.</p>
      <details class="term-help"><summary>What do arrangement, AI role, authority, wager, and Evidence Strength mean?</summary><dl>
        <div><dt>Arrangement</dt><dd>The person, AI system, task, workflow, controls, and outcome considered together.</dd></div>
        <div><dt>AI role</dt><dd>The part of the work assigned to the AI system.</dd></div>
        <div><dt>Authority</dt><dd>What the AI system is permitted to do, including whether it must wait for explicit human approval before acting.</dd></div>
        <div><dt>Wager</dt><dd>The useful outcome you are counting on this work to produce.</dd></div>
        <div><dt>Evidence Strength</dt><dd>How well the answers are supported by current records or direct observation.</dd></div>
      </dl></details>
      <div class="grid-2">
        <article class="card"><h3>Not supported for proposed role</h3><p>Your current capacity, AI fit, controls, or workflow cannot support the role you want AI to have.</p></article>
        <article class="card"><h3>Supported only in a smaller role</h3><p>The work may continue if AI has less authority or performs a narrower function.</p></article>
        <article class="card"><h3>Supported with named conditions</h3><p>The arrangement supports the role only while specific review, evidence, or controls remain in place.</p></article>
        <article class="card"><h3>Strongly supported under current conditions</h3><p>Your current capacity, evidence, controls, and workflow provide strong support for this use.</p></article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div><p class="kicker">What you receive</p><h2>A decision you can use, not just a number.</h2></div>
        <p class="lede">The score starts the answer. The useful part is the supported role, the conditions and limits, and the shortest actions that could strengthen the arrangement.</p>
      </div>
      <div class="sample-result">
        <div class="sample-result-copy">
          <p class="kicker">Fictional example result</p>
          <h3>Preparation supported. AI-executed deployment not authorized yet.</h3>
          <p>The project owner keeps the release decision. The current arrangement supports AI preparing changes and test reports, but not carrying out the public deployment.</p>
          <p>This fictional example has no numeric score because it was not produced from a completed assessment record.</p>
          <p><a class="text-link" href="#/sample">Open the full sample result</a></p>
        </div>
        <aside class="sample-card" aria-label="Example task-specific Work Check result">
          <span class="stamp stamp-restriction">Deployment not authorized</span>
          <p class="sample-verdict"><strong>AI may prepare the release.</strong><span>A capable person must review the technical work before the project owner decides whether to launch.</span></p>
          <ul class="boundary-list">
            <li class="allow"><span><strong>Supported:</strong> Organize and draft under review</span></li>
            <li class="allow"><span><strong>Supported:</strong> Propose changes and report named tests</span></li>
            <li class="block"><span><strong>Not supported:</strong> Self-verify material claims</span></li>
            <li class="block"><span><strong>Not supported:</strong> Execute the public deployment yet</span></li>
          </ul>
        </aside>
      </div>
      <div class="grid-3">
        ${featureCard('01', 'Current score', 'A score for this human and AI arrangement, task, workflow, and wager. It is not a general rating of the model.')}
        ${featureCard('02', 'Supported role', 'What is supported in this workflow, what needs capable review, and what is not supported yet.')}
        ${featureCard('03', 'Evidence strength', 'How much the conclusion rests on documented evidence, reported experience, or unknowns.')}
        ${featureCard('04', 'Problems to fix first', 'Serious gaps that a high average cannot cancel, such as unknown access or no capable reviewer.')}
        ${featureCard('05', 'What to do next', 'Actions for now, 24 hours, days, and weeks, including what each completed action is expected to change.')}
        ${featureCard('06', 'A record you can save or share', 'A printable result and a separate Work Record that documents how finished work was made.')}
      </div>
      <p class="quote">Trust the relationship only as far as the whole arrangement can support.</p>
      <div class="button-row">
        <a class="button" href="#/check">Check a project</a>
        <a class="button button-secondary" href="#/method">See how it works</a>
      </div>
    </section>
  `;
  bindStageLinks();
}

function stageCard(number, eyebrow, title, copy, stage, label) {
  return `<article class="card stage-card">
    <span class="card-number">${number}</span>
    <p class="kicker">${eyebrow}</p>
    <h3>${title}</h3>
    <p>${copy}</p>
    <a class="button button-secondary" href="#/check" data-start-stage="${stage}">${label}</a>
  </article>`;
}

function featureCard(number, title, copy) {
  return `<article class="card"><span class="card-number">${number}</span><h3>${title}</h3><p>${copy}</p></article>`;
}

function bindStageLinks() {
  document.querySelectorAll('[data-start-stage]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (!startAssessment(link.dataset.startStage)) return;
      if (location.hash === '#/check') renderCheck();
      else location.hash = '#/check';
    });
  });
}

function startAssessment(stage) {
  if (assessment.project?.task && !window.confirm('Start a new check? Export the saved project first if you want to keep a separate copy.')) {
    return false;
  }
  assessment = makeAssessment();
  assessment.stage = stage;
  checkView = 'setup';
  currentQuestionIndex = 0;
  saveAssessment();
  return true;
}

function renderCheck() {
  document.title = 'Check a Project | Human + AI Work Check';
  if (checkView === 'setup') renderSetup();
  else if (checkView === 'questions') renderQuestion();
  else if (checkView === 'review') renderReview();
  else if (checkView === 'result' && assessment.completed) renderResult();
  else renderCheckEntry();
}

function renderCheckEntry() {
  const savedNotice = assessment.needsReassessment
    ? `<div class="callout callout-warning"><p><strong>Your saved project used an earlier method.</strong> The project setup was preserved, but its old answers will not be silently rescored under method ${escapeHTML(METHOD_VERSION)}.</p><button class="text-button" id="resume-check" type="button">Reassess this project</button></div>`
    : assessment.project?.task && !assessment.completed
    ? `<div class="callout"><p><strong>You have a saved check in this browser.</strong> ${escapeHTML(assessment.project.task)}</p><button class="text-button" id="resume-check" type="button">Resume where you left off</button></div>`
    : '';

  main.innerHTML = `<div class="page">
    <header class="page-header">
      <p class="eyebrow">Check a project</p>
      <h1>What decision are you making now?</h1>
      <p>The questions change depending on whether you are planning the work, ready to launch it, or reviewing what happened in real use.</p>
    </header>
    ${savedNotice}
    <section aria-labelledby="choose-check-heading">
      <h2 class="sr-only" id="choose-check-heading">Choose when you are checking the project</h2>
      <div class="grid-3">
        ${stageCard('01', 'I am planning work that may use AI', 'Plan Readiness', 'See what role the proposed arrangement can support before the work begins.', 'plan', 'Plan the work')}
        ${stageCard('02', 'I am ready to publish, send, or launch', 'Launch Support', 'Check what actually happened and whether the reliance is supported before release.', 'release', 'Check before launch')}
        ${stageCard('03', 'People are already using the work', 'Current-Use Support', 'Review results, errors, and consequences before continuing, expanding, limiting, or stopping.', 'live', 'Review current use')}
      </div>
    </section>
    <div class="button-row no-print">
      <button class="button button-secondary" type="button" id="import-trigger">Import a saved project</button>
      <input id="import-assessment" type="file" accept="application/json" hidden />
    </div>
    <p class="helper-text">Preview data stays in this browser unless you export it. Do not enter confidential, regulated, or sensitive information.</p>
  </div>`;

  bindStageLinks();
  document.querySelector('#resume-check')?.addEventListener('click', () => {
    assessment.needsReassessment = false;
    checkView = assessment.currentQuestionId || Object.keys(assessment.answers || {}).length ? 'questions' : 'setup';
    saveAssessment();
    renderCheck();
  });
  document.querySelector('#import-trigger').addEventListener('click', () => document.querySelector('#import-assessment').click());
  document.querySelector('#import-assessment').addEventListener('change', importAssessment);
  focusCurrentStep();
}

function renderSetup(error = [], focusId = '') {
  const p = assessment.project;
  const stage = stagePrompts(assessment.stage);
  const errors = normalizeFormErrors(error);
  document.title = `${errors.length ? 'Error: ' : ''}Check a Project | Human + AI Work Check`;
  main.innerHTML = `<div class="page">
    <div class="assessment-shell">
      <section class="assessment-main setup-card">
        <div class="progress-row"><span>PROJECT SETUP</span><span>Setup takes about 2 minutes; the full check depends on your project</span></div>
        <div class="progress-track" role="progressbar" aria-label="Project check progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="8" aria-valuetext="Project setup"><span style="width: 8%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${escapeHTML(stage.setupHeading)}</h1>
        <p class="question-why">${escapeHTML(stage.setupIntro)}</p>
        ${renderErrorSummary(errors)}
        <form id="setup-form" novalidate>
          <h2 class="form-section-heading">1. Describe the work and wager</h2>
          <div class="field-grid">
            <div class="field field-span-2">
              <label for="project-name">Project name <span class="helper-text">Optional</span></label>
              <input id="project-name" name="name" value="${escapeHTML(p.name)}" autocomplete="off" />
            </div>
            <div class="field field-span-2">
              <label for="task">${escapeHTML(stage.taskQuestion)} <span class="required">Required</span></label>
              <textarea id="task" name="task" required ${errorAttributes(errors, 'task')}>${escapeHTML(p.task)}</textarea>
              ${fieldError(errors, 'task')}
            </div>
            <div class="field field-span-2">
              <label for="outcome">${escapeHTML(stage.outcomeQuestion)} <span class="required">Required</span></label>
              <textarea id="outcome" name="intendedOutcome" required ${errorAttributes(errors, 'outcome', 'outcome-help')}>${escapeHTML(p.intendedOutcome)}</textarea>
              <small id="outcome-help">${escapeHTML(stage.outcomeHelp)}</small>
              ${fieldError(errors, 'outcome')}
            </div>
            <div class="field">
              <label for="consequence">Consequence if it fails</label>
              <select id="consequence" name="consequence">
                ${selectOptions([
                  ['low', 'Low, easy to notice and correct'],
                  ['moderate', 'Moderate, real cost, delay, or confusion'],
                  ['high', 'High, serious harm or difficult recovery'],
                  ['critical', 'Critical, safety, rights, major loss, or irreversible harm'],
                ], p.consequence)}
              </select>
            </div>
            <div class="field"><p class="field-note"><strong>Role assessed</strong><br />Choose the authority for each AI system below. The detailed questions focus on the system with the most consequential role.</p></div>
          </div>

          <fieldset class="fieldset systems-fieldset" id="systems-group" ${groupErrorAttributes(errors, 'systems-group')}>
            <legend>2. Which AI systems and models are part of this arrangement? <span class="required">Required</span></legend>
            <p class="helper-text">Record each system separately. Enter “Unknown” when you do not know the exact model or version. Mark the system with the most consequential role.</p>
            <div class="system-editor-list">
              ${p.systems.map((system, index) => systemEditor(system, index, p.systems.length, errors)).join('')}
            </div>
            <fieldset class="fieldset consequential-system-group">
              <legend>Which system has the most consequential role in this check?</legend>
              <div class="choice-grid">${p.systems.map((system, index) => `<label class="choice"><input type="radio" name="primarySystemId" value="${escapeHTML(system.id)}" ${system.id === p.primarySystemId ? 'checked' : ''} required /><span><strong>${escapeHTML(system.product || `System ${index + 1}`)}</strong><span>The detailed performance questions will focus on this system and role.</span></span></label>`).join('')}</div>
            </fieldset>
            ${fieldError(errors, 'systems-group')}
            <button class="button button-secondary" type="button" id="add-system">Add another system</button>
          </fieldset>

          <fieldset class="fieldset" id="work-types-group" ${groupErrorAttributes(errors, 'work-types-group')}>
            <legend>3. What kind of work is involved? <span class="required">Choose at least one</span></legend>
            <div class="choice-grid">
              ${WORK_TYPES.map(([value, label, description]) => checkboxChoice('workTypes', value, label, description, p.workTypes.includes(value))).join('')}
            </div>
            ${fieldError(errors, 'work-types-group')}
          </fieldset>

          <fieldset class="fieldset" id="behaviors-group" ${groupErrorAttributes(errors, 'behaviors-group')}>
            <legend>4. ${escapeHTML(stage.behaviorQuestion)} <span class="required">Choose one to three</span></legend>
            <div class="choice-grid choice-grid-compact">
              ${BEHAVIORS.map(([value, label]) => checkboxChoice('requiredBehaviors', value, label, '', p.requiredBehaviors.includes(value))).join('')}
            </div>
            <small id="behavior-count">${p.requiredBehaviors.length} of 3 selected</small>
            ${fieldError(errors, 'behaviors-group')}
          </fieldset>

          <div class="form-actions">
            <button class="button button-secondary" type="button" id="cancel-check">Cancel</button>
            <button class="button" type="submit">Continue <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
      ${arrangementSummary()}
    </div>
  </div>`;

  const form = document.querySelector('#setup-form');
  form.addEventListener('submit', submitSetup);
  form.querySelectorAll('input[name="requiredBehaviors"]').forEach((input) => {
    input.addEventListener('change', limitBehaviors);
  });
  document.querySelector('#cancel-check').addEventListener('click', () => {
    checkView = 'entry';
    renderCheck();
  });
  document.querySelector('#add-system').addEventListener('click', () => {
    captureSetupDraft(form);
    assessment.project.systems.push(makeSystem());
    saveAssessment();
    renderSetup([], `system-${assessment.project.systems.length - 1}-product`);
  });
  document.querySelectorAll('[data-remove-system]').forEach((button) => {
    button.addEventListener('click', () => {
      captureSetupDraft(form);
      assessment.project.systems = assessment.project.systems.filter((system) => system.id !== button.dataset.removeSystem);
      if (!assessment.project.systems.some((system) => system.id === assessment.project.primarySystemId)) {
        assessment.project.primarySystemId = assessment.project.systems[0].id;
      }
      saveAssessment();
      renderSetup([], 'add-system');
    });
  });
  bindErrorSummaryLinks();
  if (focusId) window.requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  else focusCurrentStep();
}

function systemEditor(system, index, count, errors = []) {
  const prefix = `system-${index}`;
  return `<article class="system-editor">
    <div class="system-editor-heading"><h2>System ${index + 1}</h2>${count > 1 ? `<button class="text-button" type="button" data-remove-system="${escapeHTML(system.id)}">Remove</button>` : ''}</div>
    <input type="hidden" name="systemId" value="${escapeHTML(system.id)}" />
    <div class="field-grid">
      <div class="field"><label for="${prefix}-product">AI product or tool <span class="required">Required</span></label><input id="${prefix}-product" name="systemProduct" value="${escapeHTML(system.product)}" placeholder="For example, ChatGPT" required ${errorAttributes(errors, `${prefix}-product`)} />${fieldError(errors, `${prefix}-product`)}</div>
      <div class="field"><label for="${prefix}-model">Exact model or version <span class="required">Required</span></label><input id="${prefix}-model" name="systemModel" value="${escapeHTML(system.model)}" placeholder="Enter Unknown if needed" required ${errorAttributes(errors, `${prefix}-model`)} />${fieldError(errors, `${prefix}-model`)}</div>
      <div class="field field-span-2"><label for="${prefix}-role">What role does this system have in the workflow? <span class="required">Required</span></label><textarea id="${prefix}-role" name="systemRole" placeholder="For example, organize source material, draft code, or execute an approved deployment" required ${errorAttributes(errors, `${prefix}-role`)}>${escapeHTML(system.role)}</textarea>${fieldError(errors, `${prefix}-role`)}</div>
      <div class="field"><label for="${prefix}-authority">What authority does this system have?</label><select id="${prefix}-authority" name="systemAuthority">${Object.entries(AUTHORITY_LABELS).map(([value, label]) => `<option value="${value}" ${system.proposedAuthority === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('')}</select></div>
      <div class="field"><label for="${prefix}-access">Can it connect to accounts, files, repositories, data, publishing, or other tools?</label><select id="${prefix}-access" name="systemAccess">${triStateOptions(system.connectedAccess, 'No', 'Yes', 'Unknown')}</select></div>
      <div class="field"><label for="${prefix}-permissions">If it connects, are its permissions known and limited?</label><select id="${prefix}-permissions" name="systemPermissions">${triStateOptions(system.permissionsConfirmed, 'No', 'Yes, confirmed', 'Unknown or not applicable')}</select></div>
      <div class="field field-span-2"><label for="${prefix}-setup">Instructions, memory, tools, data, access, or permissions</label><textarea id="${prefix}-setup" name="systemSetup" placeholder="Describe the setup that could affect how this system behaves">${escapeHTML(system.setup)}</textarea></div>
      <div class="field field-span-2"><label for="${prefix}-evidence">Evidence about this system in this role <span class="helper-text">Optional unless you select Documented below</span></label><textarea id="${prefix}-evidence" name="systemEvidence" placeholder="Model documentation, tests, work samples, or known limits" ${errorAttributes(errors, `${prefix}-evidence`)}>${escapeHTML(system.evidence)}</textarea>${fieldError(errors, `${prefix}-evidence`)}</div>
      <div class="field field-span-2"><label for="${prefix}-evidence-basis">How is this system description supported?</label><select id="${prefix}-evidence-basis" name="systemEvidenceBasis">${selectOptions([
        ['confirmed', 'Documented with a current record or result'],
        ['reported', 'Based on my experience or description'],
        ['unknown', 'Unknown or not yet determined'],
      ], system.evidenceBasis || 'reported')}</select></div>
    </div>
  </article>`;
}

function selectOptions(options, selected) {
  return options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('');
}

function normalizeFormErrors(error) {
  if (!error) return [];
  if (Array.isArray(error)) return error.filter((item) => item?.message);
  return [{ id: '', message: String(error) }];
}

function renderErrorSummary(errors) {
  if (!errors.length) return '';
  return `<div class="inline-error error-summary" role="alert" tabindex="-1"><h2>There is a problem</h2><ul>${errors.map(({ id, message }) => `<li>${id ? `<button class="error-link" type="button" data-error-target="${escapeHTML(id)}">${escapeHTML(message)}</button>` : escapeHTML(message)}</li>`).join('')}</ul></div>`;
}

function bindErrorSummaryLinks() {
  document.querySelectorAll('[data-error-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.errorTarget);
      if (!target) return;
      if (!target.hasAttribute('tabindex') && !target.matches('input, textarea, select, button, a')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
  });
}

function findFieldError(errors, id) {
  return errors.find((item) => item.id === id);
}

function errorAttributes(errors, id, describedBy = '') {
  const error = findFieldError(errors, id);
  const descriptions = [describedBy, error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return `${error ? 'aria-invalid="true"' : ''}${descriptions ? ` aria-describedby="${descriptions}"` : ''}`;
}

function groupErrorAttributes(errors, id) {
  const error = findFieldError(errors, id);
  return error ? `aria-invalid="true" aria-describedby="${id}-error" tabindex="-1"` : '';
}

function fieldError(errors, id) {
  const error = findFieldError(errors, id);
  return error ? `<p class="field-error" id="${id}-error">Error: ${escapeHTML(error.message)}</p>` : '';
}

function checkboxChoice(name, value, label, description, checked) {
  return `<label class="choice">
    <input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''} />
    <span><strong>${escapeHTML(label)}</strong>${description ? `<span>${escapeHTML(description)}</span>` : ''}</span>
  </label>`;
}

function limitBehaviors(event) {
  const selected = [...document.querySelectorAll('input[name="requiredBehaviors"]:checked')];
  if (selected.length > 3) {
    event.target.checked = false;
    showToast('Choose no more than three required behaviors.');
  }
  document.querySelector('#behavior-count').textContent = `${Math.min(selected.length, 3)} of 3 selected`;
}

function submitSetup(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const workTypes = form.getAll('workTypes');
  const requiredBehaviors = form.getAll('requiredBehaviors');
  const task = String(form.get('task') || '').trim();
  const intendedOutcome = String(form.get('intendedOutcome') || '').trim();
  captureSetupDraft(formElement);
  assessment.completed = false;
  saveAssessment();

  const errors = [];
  if (!task) errors.push({ id: 'task', message: 'Describe the work being checked.' });
  if (!intendedOutcome) errors.push({ id: 'outcome', message: 'Describe the outcome you are betting on.' });
  if (!workTypes.length) errors.push({ id: 'work-types-group', message: 'Choose at least one kind of work.' });
  if (!requiredBehaviors.length) errors.push({ id: 'behaviors-group', message: 'Choose at least one AI behavior you are counting on.' });
  assessment.project.systems.forEach((system, index) => {
    const prefix = `system-${index}`;
    if (!system.product) errors.push({ id: `${prefix}-product`, message: `Enter the product or tool for system ${index + 1}.` });
    if (!system.model) errors.push({ id: `${prefix}-model`, message: `Enter the model or version for system ${index + 1}, or enter Unknown.` });
    if (!system.role) errors.push({ id: `${prefix}-role`, message: `Describe the workflow role for system ${index + 1}.` });
    if (system.evidenceBasis === 'confirmed' && !system.evidence) {
      errors.push({ id: `${prefix}-evidence`, message: `Add the record supporting the Documented description for system ${index + 1}, or choose Based on my experience.` });
    }
  });
  if (errors.length) return renderSetup(errors);
  currentQuestionIndex = Math.min(currentQuestionIndex, activeQuestions().length - 1);
  checkView = 'questions';
  renderCheck();
}

function captureSetupDraft(formElement) {
  const form = new FormData(formElement);
  const ids = form.getAll('systemId');
  const products = form.getAll('systemProduct');
  const models = form.getAll('systemModel');
  const roles = form.getAll('systemRole');
  const authorities = form.getAll('systemAuthority');
  const setups = form.getAll('systemSetup');
  const evidence = form.getAll('systemEvidence');
  const evidenceBases = form.getAll('systemEvidenceBasis');
  const access = form.getAll('systemAccess');
  const permissions = form.getAll('systemPermissions');
  const systems = ids.map((id, index) => makeSystem({
    id: String(id),
    product: String(products[index] || '').trim(),
    model: String(models[index] || '').trim(),
    role: String(roles[index] || '').trim(),
    proposedAuthority: Object.hasOwn(AUTHORITY_LABELS, authorities[index]) ? authorities[index] : 'A1',
    setup: String(setups[index] || '').trim(),
    evidence: String(evidence[index] || '').trim(),
    evidenceBasis: ['confirmed', 'reported', 'unknown'].includes(evidenceBases[index])
      ? evidenceBases[index]
      : 'reported',
    connectedAccess: parseTriState(access[index]),
    permissionsConfirmed: parseTriState(permissions[index]),
  }));
  const primarySystemId = String(form.get('primarySystemId') || systems[0]?.id || '');
  const primarySystem = systems.find((system) => system.id === primarySystemId) || systems[0];
  const connectedSystems = systems.filter((system) => system.connectedAccess === true);
  assessment.project = {
    ...assessment.project,
    name: String(form.get('name') || '').trim(),
    task: String(form.get('task') || '').trim(),
    intendedOutcome: String(form.get('intendedOutcome') || '').trim(),
    consequence: form.get('consequence'),
    proposedAuthority: primarySystem?.proposedAuthority || form.get('proposedAuthority') || 'A1',
    workTypes: form.getAll('workTypes'),
    requiredBehaviors: form.getAll('requiredBehaviors'),
    systems,
    primarySystemId,
    system: systems.map(systemSummary).join('; '),
    connectedAccess: systems.some((system) => system.connectedAccess === true)
      ? true
      : systems.some((system) => system.connectedAccess === null) ? null : false,
    permissionsConfirmed: connectedSystems.length
      ? connectedSystems.every((system) => system.permissionsConfirmed === true)
      : systems.some((system) => system.connectedAccess === null) ? null : true,
  };
}

function parseTriState(value) {
  return value === 'true' ? true : value === 'false' ? false : null;
}

function systemSummary(system) {
  const model = system.model ? ` (${system.model})` : '';
  const role = system.role ? `: ${system.role}` : '';
  return `${system.product || 'Unnamed system'}${model}${role}`;
}

function activeQuestions() {
  return getActiveQuestionDefinitions(assessment);
}

function renderQuestion(error = [], draftAnswer = null) {
  const questions = activeQuestions();
  const question = questions[currentQuestionIndex];
  if (!question) {
    checkView = 'review';
    return renderReview();
  }
  assessment.currentQuestion = currentQuestionIndex;
  assessment.currentQuestionId = question.id;
  saveAssessment();
  const answer = draftAnswer || assessment.answers[question.id] || {};
  const progress = Math.round(((currentQuestionIndex + 1) / (questions.length + 1)) * 100);
  const errors = normalizeFormErrors(error);
  document.title = `${errors.length ? 'Error: ' : ''}Check a Project | Human + AI Work Check`;

  main.innerHTML = `<div class="page">
    <div class="assessment-shell">
      <section class="assessment-main question-card">
        <div class="progress-row"><span>${escapeHTML(DIMENSIONS[question.dimension]?.label || question.dimension || 'EVIDENCE')}</span><span>Question ${currentQuestionIndex + 1} of ${questions.length}</span></div>
        <div class="progress-track" role="progressbar" aria-label="Project check progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-valuetext="Question ${currentQuestionIndex + 1} of ${questions.length}"><span style="width: ${progress}%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${escapeHTML(question.prompt)}</h1>
        <p class="question-why">${escapeHTML(question.why || 'Choose the answer that best describes what is true now, not what you intend to do later.')}</p>
        ${renderErrorSummary(errors)}
        <form id="question-form">
          <fieldset class="fieldset" id="answer-choice-group" ${groupErrorAttributes(errors, 'answer-choice-group')}>
            <legend>Choose the description that is true now.</legend>
            <div class="option-stack">
            ${question.options.map((option) => `<label class="option-card">
              <input type="radio" name="level" value="${option.value}" ${Number(answer.level) === Number(option.value) ? 'checked' : ''} />
              <span><strong>${escapeHTML(option.label)}</strong><span>${escapeHTML(option.description || '')}</span></span>
            </label>`).join('')}
            </div>
            ${fieldError(errors, 'answer-choice-group')}
          </fieldset>
          <div class="evidence-box">
            <h2>What supports this answer?</h2>
            <p class="helper-text">An instruction or plan is not proof that the behavior occurred. “I don’t know” is a valid and useful answer. If you choose Documented, add at least one current note or link.</p>
            <fieldset class="fieldset" id="evidence-basis-group" ${groupErrorAttributes(errors, 'evidence-basis-group')}><legend class="sr-only">Evidence basis</legend><div class="choice-grid choice-grid-compact">
                ${evidenceChoice('confirmed', 'Documented', 'Directly observed and supported by a current result, record, note, or link', answer.basis)}
                ${evidenceChoice('reported', 'Based on my experience', 'Observed, recalled, or asserted without a current supporting record', answer.basis)}
                ${evidenceChoice('unknown', 'Unknown', 'I cannot determine this yet', answer.basis)}
              </div>${fieldError(errors, 'evidence-basis-group')}</fieldset>
            <div class="field-grid" style="margin-top: 1rem">
              <div class="field">
                <label for="evidence-note">Evidence note</label>
                <input id="evidence-note" name="evidenceNote" value="${escapeHTML(answer.evidenceNote || '')}" placeholder="Test result, observation, or gap" ${errorAttributes(errors, 'evidence-note')} />
                ${fieldError(errors, 'evidence-note')}
              </div>
              <div class="field">
                <label for="evidence-url">Evidence link</label>
                <input id="evidence-url" name="evidenceUrl" type="url" value="${escapeHTML(answer.evidenceUrl || '')}" placeholder="https://" />
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button class="button button-secondary" type="button" id="question-back">Back</button>
            <button class="button" type="submit">${currentQuestionIndex === questions.length - 1 ? 'Review answers' : 'Continue'} <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
      ${arrangementSummary()}
    </div>
  </div>`;

  document.querySelector('#question-form').addEventListener('submit', (event) => submitQuestion(event, question, questions.length));
  document.querySelector('#question-back').addEventListener('click', () => {
    if (currentQuestionIndex === 0) checkView = 'setup';
    else currentQuestionIndex -= 1;
    renderCheck();
  });
  bindErrorSummaryLinks();
  focusCurrentStep();
}

function evidenceChoice(value, label, description, selected) {
  return `<label class="choice">
    <input type="radio" name="basis" value="${value}" ${selected === value ? 'checked' : ''} />
    <span><strong>${label}</strong><span>${description}</span></span>
  </label>`;
}

function submitQuestion(event, question, count) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const answer = {
    level: form.get('level') === null ? undefined : Number(form.get('level')),
    basis: form.get('basis') || undefined,
    evidenceNote: String(form.get('evidenceNote') || '').trim(),
    evidenceUrl: String(form.get('evidenceUrl') || '').trim(),
  };
  const errors = [];
  if (answer.level === undefined) errors.push({ id: 'answer-choice-group', message: 'Choose the description that is true now.' });
  if (!answer.basis) errors.push({ id: 'evidence-basis-group', message: 'Choose whether the answer is Documented, Based on my experience, or Unknown.' });
  if (errors.length) return renderQuestion(errors, answer);
  if (!isValidAnswer(question, answer)) {
    return renderQuestion([{ id: 'evidence-note', message: 'Add a brief evidence note or link for a Documented answer, or choose Based on my experience.' }], answer);
  }
  assessment.answers[question.id] = answer;
  if (question.id === 'CAP1' && assessment.stage === 'plan') {
    const matchedEvidence = answer.basis === 'confirmed' && answer.level >= 50;
    assessment.project.priorMatchedEvidence = matchedEvidence;
    assessment.project.priorEvidenceFromSameConfiguration = matchedEvidence;
  }
  saveAssessment();
  if (currentQuestionIndex >= count - 1) checkView = 'review';
  else currentQuestionIndex += 1;
  assessment.currentQuestionId = activeQuestions()[currentQuestionIndex]?.id || '';
  saveAssessment();
  renderCheck();
}

function arrangementSummary() {
  const p = assessment.project;
  const open = !window.matchMedia('(max-width: 900px)').matches;
  const primarySystem = p.systems.find((system) => system.id === p.primarySystemId) || p.systems[0];
  const summaryLabel = `${p.name || 'Project'} · ${stageLabel(assessment.stage)} · ${primarySystem?.product || 'AI system'}`;
  return `<details class="assessment-summary" ${open ? 'open' : ''}>
    <summary>${escapeHTML(summaryLabel)}</summary>
    <h2 class="summary-heading">Project setup</h2>
    <dl class="summary-list">
      <div><dt>Stage</dt><dd>${escapeHTML(stageLabel(assessment.stage))}</dd></div>
      <div><dt>Person</dt><dd>You, plus any capable reviewer actually included in the workflow</dd></div>
      <div><dt>AI systems</dt><dd>${p.systems.length ? p.systems.map((system) => `${escapeHTML(systemSummary(system))}${system.id === primarySystem?.id ? ' <strong>(most consequential)</strong>' : ''}`).join('<br />') : 'Not defined yet'}</dd></div>
      <div><dt>Work</dt><dd>${escapeHTML(p.task || 'Not defined yet')}</dd></div>
      <div><dt>Role assessed</dt><dd>${escapeHTML(AUTHORITY_LABELS[primarySystem?.proposedAuthority || p.proposedAuthority] || 'Not defined yet')}</dd></div>
      <div><dt>Wager</dt><dd>${escapeHTML(p.intendedOutcome || 'Not defined yet')}</dd></div>
    </dl>
    <p class="helper-text">Saved on this device when you continue.</p>
  </details>`;
}

function stageLabel(stage) {
  return {
    plan: 'Plan Readiness',
    release: 'Launch Support',
    live: 'Current-Use Support',
  }[stage] || 'Project check';
}

function stagePrompts(stage) {
  return {
    plan: {
      setupHeading: 'Describe the work you are planning.',
      setupIntro: 'Record the arrangement you intend to use. The result will show what role it can support before the work begins.',
      taskQuestion: 'What work are you planning, and what are you considering delegating to AI?',
      outcomeQuestion: 'What are you betting will happen if this arrangement works?',
      outcomeHelp: 'Name the useful result, what could happen if it fails, and how you plan to recognize success.',
      authorityQuestion: 'What do you plan to authorize AI to do?',
      behaviorQuestion: 'What are you counting on the AI system to do?',
    },
    release: {
      setupHeading: 'Describe the work you are ready to launch.',
      setupIntro: 'Record what actually happened, not only what you planned. The result will show whether the finished arrangement supports publication, delivery, or launch.',
      taskQuestion: 'What did the work produce, recommend, decide, change, or do?',
      outcomeQuestion: 'What are you betting will happen when you publish, send, or launch it?',
      outcomeHelp: 'Name the result you expect and what could happen if the work is wrong, incomplete, biased, insecure, or unused.',
      authorityQuestion: 'What was the most consequential AI role in this work?',
      behaviorQuestion: 'What did you count on the AI system to do?',
    },
    live: {
      setupHeading: 'Describe the arrangement people are already using.',
      setupIntro: 'Record the current arrangement and observed use. The result will show whether current reliance should continue, expand, narrow, or stop.',
      taskQuestion: 'What work is the arrangement producing, recommending, deciding, changing, or doing now?',
      outcomeQuestion: 'What result are you continuing to bet on?',
      outcomeHelp: 'Name the intended result, the observed consequences, and what would make you limit or stop the arrangement.',
      authorityQuestion: 'What is the most consequential AI role now?',
      behaviorQuestion: 'What are you counting on the AI system to keep doing?',
    },
  }[stage] || {
    setupHeading: 'Describe the work.',
    setupIntro: 'Record the human and AI arrangement for this project.',
    taskQuestion: 'What work is being done?',
    outcomeQuestion: 'What are you betting will happen?',
    outcomeHelp: 'Describe the intended result and what could happen if it fails.',
    authorityQuestion: 'What authority does AI have?',
    behaviorQuestion: 'What are you counting on the AI system to do?',
  };
}

function renderReview(error = '') {
  const questions = activeQuestions();
  const p = assessment.project;
  const needsApproval = p.proposedAuthority !== 'A0';
  const needsReversibility = ['A2', 'A3'].includes(p.proposedAuthority) || p.workTypes.includes('automation') || p.workTypes.includes('software');
  const needsMonitoring = p.proposedAuthority === 'A3' || p.workTypes.includes('automation');
  main.innerHTML = `<div class="page">
    <div class="assessment-shell">
      <section class="assessment-main setup-card">
        <div class="progress-row"><span>FINAL CHECK</span><span>Review before your result</span></div>
        <div class="progress-track" role="progressbar" aria-label="Project check progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="94" aria-valuetext="Final review before result"><span style="width: 94%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${assessment.stage === 'plan' ? 'Confirm the planned boundaries.' : assessment.stage === 'release' ? 'Confirm the launch boundaries.' : 'Confirm the current operating boundaries.'}</h1>
        <p class="question-why">Some gaps limit the supported role even when other answers are strong. That includes unknown access, missing approval, or a serious problem that has not been fixed.</p>
        ${error ? `<p class="inline-error" role="alert" tabindex="-1">${escapeHTML(error)}</p>` : ''}
        <form id="review-form">
          <div class="field-grid">
            ${systemReviewFields(p.systems)}
            <div class="field" id="approval-field" ${needsApproval ? '' : 'hidden'}>
              <label for="humanApproval">Does a human approve the work before it creates an external consequence?</label>
              <select id="humanApproval" name="humanApprovalBeforeConsequence">${triStateOptions(p.humanApprovalBeforeConsequence, 'No', 'Yes, confirmed', 'Unknown')}</select>
            </div>
            <div class="field" id="reversible-field" ${needsReversibility ? '' : 'hidden'}>
              <label for="reversible">Can consequential actions be reversed or rolled back?</label>
              <select id="reversible" name="actionsAreReversible">${triStateOptions(p.actionsAreReversible, 'No', 'Yes, confirmed', 'Unknown')}</select>
            </div>
            <div class="field">
              <label for="sensitiveData">Will the system receive confidential, regulated, personal, or otherwise sensitive information?</label>
              <select id="sensitiveData" name="sensitiveData">${triStateOptions(p.sensitiveData, 'No', 'Yes', 'Unknown')}</select>
            </div>
            <div class="field" id="data-authorization-field" ${p.sensitiveData === false ? 'hidden' : ''}>
              <label for="dataAuthorization">If sensitive data is involved, is its use explicitly authorized?</label>
              <select id="dataAuthorization" name="dataAuthorizationConfirmed">${triStateOptions(p.dataAuthorizationConfirmed, 'No', 'Yes, confirmed', 'Unknown')}</select>
            </div>
            <div class="field" id="monitoring-field" ${needsMonitoring ? '' : 'hidden'}>
              <label for="monitoring">If the system acts repeatedly or independently, can the activity be seen and stopped?</label>
              <select id="monitoring" name="monitoringConfirmed">${triStateOptions(p.monitoringConfirmed, 'No', 'Yes, confirmed', 'Unknown')}</select>
            </div>
            <div class="field">
              <label for="failure">Is there a known material failure that remains unresolved?</label>
              <select id="failure" name="unresolvedMaterialFailure">${triStateOptions(p.unresolvedMaterialFailure, 'No', 'Yes', 'Unknown')}</select>
            </div>
          </div>

          ${assessment.stage === 'live' ? liveEvidenceFields(p) : ''}

          <details class="optional-review" ${p.independentReviewerName ? 'open' : ''}>
            <summary>Independent evidence review <span class="helper-text">Optional</span></summary>
            <p class="helper-text">Complete this only if another qualified person checked the important records within a stated scope.</p>
            <div class="field-grid">
              <div class="field"><label for="check-reviewer-name">Reviewer name</label><input id="check-reviewer-name" name="independentReviewerName" value="${escapeHTML(p.independentReviewerName)}" /></div>
              <div class="field"><label for="check-reviewer-role">Reviewer role</label><input id="check-reviewer-role" name="independentReviewerRole" value="${escapeHTML(p.independentReviewerRole)}" /></div>
              <div class="field field-span-2"><label for="check-reviewer-scope">Records examined, scope, and limits</label><textarea id="check-reviewer-scope" name="independentReviewScope">${escapeHTML(p.independentReviewScope)}</textarea></div>
              <div class="field"><label for="check-reviewer-date">Review date</label><input id="check-reviewer-date" name="independentReviewDate" type="date" value="${escapeHTML(p.independentReviewDate)}" /></div>
            </div>
          </details>

          <h2 style="margin-top: 2rem">Review your evidence answers</h2>
          <div class="review-list">
            ${questions.map((question, index) => {
              const answer = assessment.answers[question.id];
              const option = question.options.find((item) => Number(item.value) === Number(answer?.level));
              return `<div class="review-item">
                <div><strong>${escapeHTML(question.prompt)}</strong><p>${escapeHTML(option?.label || 'Unanswered')} · ${escapeHTML(answer?.basis || 'Unknown')}</p></div>
                <button class="text-button" type="button" data-edit-question="${index}">Edit</button>
              </div>`;
            }).join('')}
          </div>

          <div class="callout callout-warning" style="margin-top: 1.5rem">
            <p><strong>Before you calculate:</strong> this is a self-assessment. “Documented” means you identified direct support for an answer. It does not mean an independent reviewer certified it.</p>
          </div>
          <div class="form-actions">
            <button class="button button-secondary" type="button" id="review-back">Back</button>
            <button class="button" type="submit">See my result <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
      ${arrangementSummary()}
    </div>
  </div>`;

  document.querySelector('#review-form').addEventListener('submit', submitReview);
  const syncConditionalReviewFields = () => {
    toggleConditionalField('data-authorization-field', document.querySelector('#sensitiveData').value !== 'false');
  };
  document.querySelector('#sensitiveData').addEventListener('change', syncConditionalReviewFields);
  syncConditionalReviewFields();
  document.querySelector('#review-back').addEventListener('click', () => {
    currentQuestionIndex = Math.max(0, questions.length - 1);
    checkView = 'questions';
    renderCheck();
  });
  document.querySelectorAll('[data-edit-question]').forEach((button) => {
    button.addEventListener('click', () => {
      currentQuestionIndex = Number(button.dataset.editQuestion);
      checkView = 'questions';
      renderCheck();
    });
  });
  focusCurrentStep();
}

function systemReviewFields(systems) {
  return systems.map((system, index) => `<div class="field system-review-field">
    <input type="hidden" name="reviewSystemId" value="${escapeHTML(system.id)}" />
    <label for="review-system-access-${index}">${escapeHTML(system.product || `System ${index + 1}`)} ${system.model ? `(${escapeHTML(system.model)})` : ''}: can it connect to accounts, files, repositories, data, publishing, or other tools?</label>
    <select id="review-system-access-${index}" name="reviewSystemAccess">${triStateOptions(system.connectedAccess, 'No', 'Yes', 'Unknown')}</select>
    <label for="review-system-permissions-${index}">Are its permissions known and limited to this role?</label>
    <select id="review-system-permissions-${index}" name="reviewSystemPermissions">${triStateOptions(system.permissionsConfirmed, 'No', 'Yes, confirmed', 'Unknown or not applicable')}</select>
  </div>`).join('');
}

function toggleConditionalField(id, visible) {
  const field = document.querySelector(`#${id}`);
  if (!field) return;
  field.hidden = !visible;
  field.querySelectorAll('input, select, textarea').forEach((control) => {
    control.disabled = !visible;
  });
}

function triStateOptions(selected, noLabel, yesLabel, unknownLabel) {
  return selectOptions([
    ['false', noLabel],
    ['true', yesLabel],
    ['unknown', unknownLabel],
  ], selected === true ? 'true' : selected === false ? 'false' : 'unknown');
}

function liveEvidenceFields(p) {
  return `<fieldset class="fieldset" style="margin-top: 1.5rem">
    <legend>What has been observed?</legend>
    <div class="field-grid">
      <div class="field"><label for="observedRuns">Completed end-to-end runs</label><input id="observedRuns" name="observedRuns" type="number" min="0" max="999" value="${Number(p.observedRuns || 0)}" /></div>
      ${booleanSelect('representativeConditions', 'Observed under representative conditions?', p.representativeConditions)}
      ${booleanSelect('atLeastOneEdgeOrFailureCase', 'At least one edge or failure case observed?', p.atLeastOneEdgeOrFailureCase)}
      ${booleanSelect('controlsActuallyOperated', 'Did the stated controls actually operate?', p.controlsActuallyOperated)}
      ${booleanSelect('observedInRealUseForFullOperatingCycle', 'Observed for a full operating cycle?', p.observedInRealUseForFullOperatingCycle)}
      ${booleanSelect('outcomeDataCollected', 'Was outcome data collected?', p.outcomeDataCollected)}
      ${booleanSelect('materialFailuresResolved', 'Were material failures resolved?', p.materialFailuresResolved)}
    </div>
  </fieldset>`;
}

function booleanSelect(name, label, selected) {
  const value = selected === true ? 'true' : selected === false ? 'false' : 'unknown';
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}">${selectOptions([['unknown', 'Choose an answer'], ['false', 'No'], ['true', 'Yes']], value)}</select></div>`;
}

function submitReview(event) {
  event.preventDefault();
  const questions = activeQuestions();
  const invalidQuestionIndex = questions.findIndex((question) => !isValidAnswer(question, assessment.answers[question.id]));
  if (invalidQuestionIndex >= 0) {
    currentQuestionIndex = invalidQuestionIndex;
    checkView = 'questions';
    return renderQuestion('Complete this answer and its evidence basis before calculating the result.');
  }
  const form = new FormData(event.currentTarget);
  const keys = [
    'humanApprovalBeforeConsequence', 'actionsAreReversible', 'sensitiveData', 'dataAuthorizationConfirmed',
    'monitoringConfirmed', 'unresolvedMaterialFailure',
  ];
  keys.forEach((key) => {
    const value = form.get(key);
    assessment.project[key] = value === 'true' ? true : value === 'false' ? false : null;
  });

  const systemIds = form.getAll('reviewSystemId');
  const systemAccess = form.getAll('reviewSystemAccess');
  const systemPermissions = form.getAll('reviewSystemPermissions');
  assessment.project.systems = assessment.project.systems.map((system) => {
    const index = systemIds.indexOf(system.id);
    if (index < 0) return system;
    return {
      ...system,
      connectedAccess: parseTriState(systemAccess[index]),
      permissionsConfirmed: parseTriState(systemPermissions[index]),
    };
  });
  const connectedSystems = assessment.project.systems.filter((system) => system.connectedAccess === true);
  assessment.project.connectedAccess = assessment.project.systems.some((system) => system.connectedAccess === true)
    ? true
    : assessment.project.systems.some((system) => system.connectedAccess === null) ? null : false;
  assessment.project.permissionsConfirmed = connectedSystems.length
    ? connectedSystems.every((system) => system.permissionsConfirmed === true)
    : assessment.project.systems.some((system) => system.connectedAccess === null) ? null : true;
  ['independentReviewerName', 'independentReviewerRole', 'independentReviewScope', 'independentReviewDate'].forEach((key) => {
    assessment.project[key] = String(form.get(key) || '').trim();
  });
  assessment.project.qualifiedIndependentReview = Boolean(
    assessment.project.independentReviewerName &&
    assessment.project.independentReviewerRole &&
    assessment.project.independentReviewScope &&
    assessment.project.independentReviewDate
  );

  if (assessment.stage === 'live') {
    assessment.project.observedRuns = Number(form.get('observedRuns') || 0);
    ['representativeConditions', 'atLeastOneEdgeOrFailureCase', 'controlsActuallyOperated', 'observedInRealUseForFullOperatingCycle', 'outcomeDataCollected', 'materialFailuresResolved'].forEach((key) => {
      const value = form.get(key);
      assessment.project[key] = value === 'true' ? true : value === 'false' ? false : null;
    });
  }
  assessment.completed = true;
  assessment.completedAt = new Date().toISOString();
  saveAssessment();
  checkView = 'result';
  renderCheck();
}

function renderResult() {
  const result = scoreAssessment(assessment);
  const p = assessment.project;
  document.title = `${p.name || stageLabel(assessment.stage)} Result | Human + AI Work Check`;
  const primarySystem = p.systems.find((system) => system.id === p.primarySystemId) || p.systems[0];
  const dimensionLabels = Object.fromEntries(Object.entries(DIMENSIONS).map(([key, value]) => [key, value.label]));
  const authorization = result.authorization || {};
  const gates = result.gates || [];
  const recommendations = result.recommendations || [];
  const date = assessment.completedAt || assessment.updatedAt;
  const evidenceStrength = result.evidenceStrength || { label: result.evidenceConfidence || 'Unknown', description: '' };
  const reviewLoad = humanReviewLoad(result);
  const consequenceLabel = {
    low: 'Low, easy to notice and correct',
    moderate: 'Moderate, real cost, delay, or confusion',
    high: 'High, serious harm or difficult recovery',
    critical: 'Critical, safety, rights, major loss, or irreversible harm',
  }[p.consequence] || 'Not recorded';

  main.innerHTML = `<div class="page results-page print-all">
    <header class="page-header result-page-intro">
      <p class="eyebrow">${stageLabel(assessment.stage)} result</p>
      <h1>${escapeHTML(p.name || 'Your project result')}</h1>
      <p>This result asks whether the arrangement described below supports giving ${escapeHTML(primarySystem?.product || 'the AI system')} the requested role and authority.</p>
    </header>

    <section class="project-context card" aria-labelledby="result-context-heading">
      <div class="section-heading-compact"><p class="kicker">Your recorded arrangement</p><h2 id="result-context-heading">What was checked?</h2></div>
      <dl class="context-list">
        ${contextItem('Work', p.task || 'Not recorded')}
        ${contextItem('Person assessed', 'You, plus any capable reviewer actually included in the recorded workflow')}
        ${contextItem('AI system and model', primarySystem ? systemSummary(primarySystem) : 'Not recorded')}
        ${contextItem('AI job in the workflow', primarySystem?.role || 'Not recorded')}
        ${contextItem('Requested AI authority', AUTHORITY_LABELS[primarySystem?.proposedAuthority || p.proposedAuthority] || 'Not recorded')}
        ${contextItem('Outcome wager', p.intendedOutcome || 'Not recorded')}
        ${contextItem('Consequence if it fails', consequenceLabel)}
        ${contextItem('Check completed', `${formatDate(date)} using method ${METHOD_VERSION}`)}
      </dl>
    </section>

    <section class="result-summary" aria-labelledby="result-decision-heading">
      <div class="result-header">
        <div>
          <p class="eyebrow">Result</p>
          <h2 id="result-decision-heading">${escapeHTML(result.decisionStatus?.label || resultDecision(result))}</h2>
          <p class="lede">${escapeHTML(result.decisionStatus?.description || '')}</p>
        </div>
        <div class="score-lockup" aria-label="Work arrangement support score ${result.publicScore} out of 100, ${escapeHTML(result.scoreBand || getBand(result.publicScore))}">
          <strong>${result.publicScore}</strong>
          <span>/ 100 work arrangement support</span>
        </div>
      </div>
      <dl class="result-facts" aria-label="Key result facts">
        ${resultFact('Evidence Strength', evidenceStrength.label)}
        ${resultFact('Highest AI authority supported', AUTHORITY_LABELS[result.conclusionAuthority || result.maxAuthority] || result.conclusionAuthority || result.maxAuthority)}
        ${resultFact('Human Review Load', reviewLoad.label)}
      </dl>
      <div class="callout"><p><strong>What ${result.publicScore} means:</strong> This score describes support inside this specific human and AI arrangement. It is not a model rating, an accuracy probability, or a human versus AI percentage. A serious gap or unsupported authority can make the decision more restrictive than the number alone.</p></div>
    </section>

    <section class="decision-grid" aria-label="Current work boundary">
      ${decisionColumn('Supported in this workflow', 'supported', authorization.delegate || defaultDelegate(result), 'Functions the current arrangement can support within the stated boundary.')}
      ${decisionColumn('Needs capable review', 'verify', authorization.verify || defaultVerify(), 'Checks that require you or a named person with the needed knowledge, access, authority, and time.')}
      ${decisionColumn('Not supported yet', 'blocked', authorization.doNotAuthorize || gates.map(gateText), 'Functions the current capacity, evidence, controls, or workflow cannot support yet.')}
    </section>

    <details class="result-disclosure">
      <summary>See the score breakdown and evidence limits</summary>
      <div class="score-explanation">
        <p>The operational score needed for the stakes and role selected is ${result.requiredScore}/100. Evidence Strength is reported separately and may limit how strong a conclusion the check can support.</p>
        <div class="score-band" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
          <i class="score-marker" style="left: ${Math.min(100, Math.max(0, result.publicScore))}%"></i>
        </div>
        <div class="band-labels band-labels-four" aria-hidden="true"><span>Not supported</span><span>Smaller role</span><span>Named conditions</span><span>Strong support</span></div>
      </div>
      <div class="grid-2 result-detail-grid">
      <section class="result-panel card">
        <p class="kicker">Operational support</p>
        <h2>How the arrangement scored</h2>
        <div class="dimension-list">
          ${Object.entries(dimensionLabels).map(([key, label]) => dimensionRow(label, result.dimensions?.[key] ?? 0)).join('')}
        </div>
        ${result.capacityCeiling < 100 ? `<div class="callout callout-warning"><p><strong>Your capacity sets a current ceiling of ${result.capacityCeiling}/100.</strong> ${escapeHTML(result.capacityLimitReasons.join(' '))}</p></div>` : ''}
      </section>
      <section class="result-panel card">
        <p class="kicker">Evidence and supported authority</p>
        <h2>${escapeHTML(evidenceStrength.label)}</h2>
        <p>${escapeHTML(evidenceStrength.description || 'Evidence is reported separately from operational performance.')}</p>
        <p><strong>Highest operational AI authority:</strong><br />${escapeHTML(AUTHORITY_LABELS[result.operationalMaxAuthority] || result.operationalMaxAuthority)}</p>
        <p><strong>Highest AI authority supported by current evidence:</strong><br />${escapeHTML(AUTHORITY_LABELS[result.conclusionAuthority] || result.conclusionAuthority)}</p>
        <p><strong>You may rely on:</strong></p>
        ${listHTML(authorization.relyOn || ['Only outputs reviewed under the conditions recorded in this check.'])}
        <p class="helper-text">A lower result does not always mean do not launch. It may mean giving AI a smaller role, adding capable human help, or holding back one unsupported function.</p>
      </section>
      </div>
    </details>

    <section class="result-panel card review-load-card">
      <p class="kicker">Human Review Load</p>
      <h2>${escapeHTML(reviewLoad.label)}</h2>
      <p>${escapeHTML(reviewLoad.description)}</p>
    </section>

    <details class="result-disclosure">
      <summary>See the AI systems and roles recorded</summary>
      <div class="result-disclosure-body"><p>The model matters in the role it was given.</p><div class="grid-2">${p.systems.map((system) => `<article class="card"><h3>${escapeHTML(system.product || 'Unnamed system')} ${system.model ? `<span class="helper-text">${escapeHTML(system.model)}</span>` : ''}</h3><p>${escapeHTML(system.role || 'Role not described')}</p><p><strong>Assessment scope:</strong> ${system.id === p.primarySystemId ? 'Detailed performance questions answered for this role' : 'Recorded for workflow context only; run a separate Work Check to assess this role'}</p><p><strong>Requested authority:</strong> ${escapeHTML(AUTHORITY_LABELS[system.proposedAuthority] || system.proposedAuthority)}</p><p><strong>Access and permissions:</strong> ${system.connectedAccess === false ? 'No connected access reported' : system.permissionsConfirmed === true ? 'Connected access reported, permissions confirmed as limited' : 'Connected access or permission limits are not fully confirmed'}</p>${result.limitingSystemIds?.includes(system.id) ? '<span class="stamp stamp-warning">Limits this result</span>' : ''}</article>`).join('')}</div>
      ${p.systems.length > 1 ? '<p class="helper-text">This check asks the detailed performance questions about the system marked most consequential. Run a separate Work Check for another consequential role when needed.</p>' : ''}</div>
    </details>

    ${gates.length ? `<section style="margin-top: 3rem"><p class="kicker">Problems to fix first</p><h2>These limits override the average score.</h2><ul class="gate-list">${gates.map((gate) => `<li><strong>${escapeHTML(gate.title || gate.id?.replaceAll('_', ' ') || 'Use limit')}</strong><br />${escapeHTML(gateText(gate))}</li>`).join('')}</ul></section>` : `<div class="callout" style="margin-top: 2rem"><p><strong>Your answers did not trigger a stop condition.</strong> The score and named limits still apply.</p></div>`}

    <section style="margin-top: 4rem">
      <p class="kicker">Make this setup stronger</p>
      <h2>What can change the result?</h2>
      <p class="lede">Each action shows its estimated effect. Planned actions add zero points. The score or Evidence Strength changes only after the action is completed, the result is recorded, and the check is run again.</p>
      <div class="action-timeline">
        ${timeBlock('Now', recommendations.filter((item) => item.timing === 'now'))}
        ${timeBlock('Within 24 hours', recommendations.filter((item) => item.timing === 'within24h'))}
        ${timeBlock('Within days', recommendations.filter((item) => item.timing === 'days'))}
        ${timeBlock('Within weeks', recommendations.filter((item) => item.timing === 'weeks'))}
      </div>
    </section>

    <section class="reliance-card" id="reliance-card">
      <h1 class="print-only">Human + AI Work Check result</h1>
      <div class="reliance-card-header">
        <div><p class="kicker">Human + AI Work Check | Self-assessed</p><h2>${escapeHTML(p.name || 'Untitled project')}</h2><p>${escapeHTML(p.task)}</p></div>
        <div class="reliance-card-score">${result.publicScore}/100 | ${escapeHTML(result.decisionStatus?.label || result.band)}</div>
      </div>
      <div class="grid-2" style="margin-top: 1.3rem">
        <div><p class="meta-label">Arrangement</p><p><strong>AI systems and roles:</strong> ${p.systems.map((system) => escapeHTML(systemSummary(system))).join('<br />')}</p><p><strong>Outcome wager:</strong> ${escapeHTML(p.intendedOutcome)}</p></div>
        <div><p class="meta-label">Current boundary</p><p><strong>Highest AI authority supported by evidence:</strong> ${escapeHTML(AUTHORITY_LABELS[result.conclusionAuthority] || result.conclusionAuthority)}</p><p><strong>Evidence Strength:</strong> ${escapeHTML(evidenceStrength.label)}<br /><strong>Real-use testing:</strong> ${escapeHTML(result.validationStatus)}</p></div>
      </div>
      <p class="helper-text">Dated ${formatDate(date)} | Method ${escapeHTML(METHOD_VERSION)} | This result applies only to the person, systems, roles, workflow, evidence, and stakes recorded here. It is not a certification or guarantee.</p>
    </section>

    <div class="result-actions no-print">
      <button class="button" type="button" id="print-result">Print Work Check</button>
      <button class="button button-secondary" type="button" id="export-result">Export Work Check</button>
      <a class="button button-secondary" href="#/creation-record" id="start-record-from-result">Create a Work Record</a>
      <button class="button button-danger" type="button" id="new-check">Start a new check</button>
    </div>
  </div>`;

  document.querySelector('#print-result').addEventListener('click', () => printMode('printing-result'));
  document.querySelector('#export-result').addEventListener('click', () => {
    downloadJSON(`${slug(p.name || 'human-ai-work-check')}.json`, {
      kind: 'human-ai-work-check-assessment',
      schemaVersion: SCHEMA_VERSION,
      methodVersion: METHOD_VERSION,
      exportedAt: new Date().toISOString(),
      assessment,
      result,
    });
  });
  document.querySelector('#start-record-from-result').addEventListener('click', (event) => {
    if (!prepareWorkRecordFromAssessment()) event.preventDefault();
  });
  document.querySelector('#new-check').addEventListener('click', () => {
    if (window.confirm('Start a new check? Export this project first if you want to keep a separate copy.')) {
      assessment = makeAssessment();
      saveAssessment();
      checkView = 'entry';
      currentQuestionIndex = 0;
      renderCheck();
    }
  });
  focusCurrentStep();
}

function resultDecision(result) {
  const proposed = authorityRank(assessment.project.proposedAuthority);
  const supported = authorityRank(result.maxAuthority);
  if (result.proposedAuthoritySupported && supported >= proposed && !(result.gates || []).length) {
    return 'This project setup supports the AI role you selected within the limits below.';
  }
  if (result.publicScore < 40) return 'Keep the system in a private, advisory role for now.';
  return 'Proceed only within a narrower, supervised boundary.';
}

function humanReviewLoad(result) {
  const level = Number(result.itemScores?.HUM3?.level || 0);
  if (level < 25) return {
    label: 'Not sustainable',
    description: 'The arrangement requires more review than you can maintain at the expected pace or volume. Reduce the role, pace, or volume, or add capable human coverage.',
  };
  if (level < 50) return {
    label: 'High',
    description: 'The required review will probably break down during normal use. The current arrangement needs a smaller AI role or additional capable review.',
  };
  if (level < 75) return {
    label: 'Manageable only with limits',
    description: 'The review load is supportable only while scope, pace, volume, or AI authority stays within the recorded limits.',
  };
  return {
    label: level >= 100 ? 'Demonstrated as sustainable' : 'Sustainable under the stated conditions',
    description: 'The available time, attention, authority, and coverage support the expected review load under the conditions recorded here.',
  };
}

function prepareWorkRecordFromAssessment() {
  const belongsToAnotherProject = creationRecord.title && creationRecord.projectId && creationRecord.projectId !== assessment.id;
  if (belongsToAnotherProject && !window.confirm('Start a new Work Record for this project? Export the current Work Record first if you want to keep a separate copy.')) {
    return false;
  }
  if (belongsToAnotherProject || !creationRecord.title) {
    creationRecord = makeCreationRecord(assessment.id);
    creationRecord.title = assessment.project.name || '';
    creationRecord.description = assessment.project.task || '';
    creationRecord.systems = assessment.project.systems.map((system) => makeSystem({
      product: system.product,
      model: system.model,
      role: system.role,
      setup: system.setup,
      evidence: system.evidence,
    }));
    creationRecord.system = creationRecord.systems.map(systemSummary).join('; ');
    saveCreationRecord();
  } else {
    creationRecord.projectId = assessment.id;
    saveCreationRecord();
  }
  return true;
}

function authorityRank(value) {
  return { A0: 0, A1: 1, A2: 2, A3: 3 }[value] ?? 0;
}

function decisionColumn(title, className, items, description) {
  const safeItems = Array.isArray(items) && items.length ? items : ['No use is supported in this category from the current evidence.'];
  return `<article class="decision-column ${className}"><h2>${title}</h2><p class="helper-text">${description}</p>${listHTML(safeItems)}</article>`;
}

function listHTML(items) {
  return `<ul>${items.map((item) => `<li>${escapeHTML(typeof item === 'string' ? item : gateText(item))}</li>`).join('')}</ul>`;
}

function gateText(gate) {
  return gate?.effect || gate?.message || gate?.description || String(gate || '');
}

function defaultDelegate(result) {
  if (authorityRank(result.maxAuthority) === 0) return ['Private exploration, drafting, or proposing options for human review.'];
  if (authorityRank(result.maxAuthority) === 1) return ['Produce work that a capable human reviews and approves before use.'];
  if (authorityRank(result.maxAuthority) === 2) return ['Perform bounded, reversible actions after explicit human approval.'];
  return ['Perform the defined operation within the tested permissions, monitoring, and stopping controls.'];
}

function defaultVerify() {
  return ['Material claims, high-impact choices, and any part outside the reviewer’s demonstrated capacity.'];
}

function dimensionRow(label, value) {
  const rounded = Math.round(Number(value) || 0);
  return `<div class="dimension-row"><span id="dimension-${slug(label)}">${escapeHTML(label)}</span><div class="dimension-track" role="progressbar" aria-labelledby="dimension-${slug(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rounded}"><span style="width:${rounded}%"></span></div><output aria-label="${escapeHTML(label)} score">${rounded}</output></div>`;
}

function timeBlock(label, items = []) {
  const normalized = Array.isArray(items) ? items : items ? [items] : [];
  return `<article class="time-block"><h3>${label}</h3>${normalized.length ? `<div class="recommendation-list">${normalized.slice(0, 4).map((item) => recommendationCard(item)).join('')}</div>` : '<p class="helper-text">No additional action generated for this period.</p>'}</article>`;
}

function recommendationCard(item) {
  if (typeof item === 'string') return `<p class="recommendation-action">${escapeHTML(item)}</p>`;
  const projectedChange = Number(item.scoreEffect?.projectedChange || 0);
  const scoreEffect = item.modelChangeTest
    ? 'Changing models adds 0 points now. Any projected change depends on passing the same comparison tests.'
    : projectedChange > 0
      ? `Adds 0 points now. Illustrative potential: up to ${item.scoreEffect.projectedScore} (+${projectedChange}) if this action closes the named gap and the check is recalculated.`
      : item.scoreEffect?.condition || 'Adds 0 points until completed and evidenced.';
  return `<div class="recommendation-card">
    ${item.modelChangeTest ? '<span class="stamp stamp-warning">Model comparison</span>' : ''}
    <p class="recommendation-action">${escapeHTML(item.action)}</p>
    <p><strong>Projected effect:</strong> ${escapeHTML(scoreEffect)}</p>
    <details><summary>Why this helps and what to record</summary>
      <p><strong>Evidence effect:</strong> ${escapeHTML(item.evidenceEffect || 'No evidence change stated.')}</p>
      <p><strong>Role effect:</strong> ${escapeHTML(item.roleEffect || 'No role change stated.')}</p>
      ${item.blocker?.statement ? `<p><strong>Blocker:</strong> ${escapeHTML(item.blocker.statement)}</p>` : ''}
      ${item.evidenceRequired ? `<p><strong>What to record:</strong> ${escapeHTML(item.evidenceRequired)}</p>` : ''}
    </details>
  </div>`;
}

function importAssessment(event) {
  const [file] = event.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = parsed.assessment || parsed;
      assessment = normalizeImportedAssessment(imported);
      currentQuestionIndex = resumeQuestionIndex(assessment);
      saveAssessment();
      checkView = assessment.completed ? 'result' : 'setup';
      showToast('Project imported.');
      renderCheck();
    } catch {
      showToast('That file is not a valid Human + AI Work Check project.');
    }
  };
  reader.readAsText(file);
}

function normalizeImportedAssessment(imported) {
  if (!imported || typeof imported !== 'object' || !imported.project || typeof imported.answers !== 'object') {
    throw new Error('Missing assessment fields');
  }
  if (!['plan', 'release', 'live'].includes(imported.stage)) {
    throw new Error('Invalid stage');
  }

  const fallback = makeAssessment();
  const project = { ...fallback.project, ...imported.project };
  project.systems = normalizeSystems(
    imported.project.systems,
    imported.project.system,
    imported.project.proposedAuthority,
  );
  project.primarySystemId = project.systems.some((system) => system.id === imported.project.primarySystemId)
    ? imported.project.primarySystemId
    : project.systems[0].id;
  project.workTypes = Array.isArray(imported.project.workTypes)
    ? imported.project.workTypes.filter((value) => WORK_TYPES.some(([id]) => id === value))
    : [];
  project.requiredBehaviors = Array.isArray(imported.project.requiredBehaviors)
    ? imported.project.requiredBehaviors.filter((value) => BEHAVIORS.some(([id]) => id === value)).slice(0, 3)
    : [];
  project.consequence = ['low', 'moderate', 'high', 'critical'].includes(project.consequence)
    ? project.consequence
    : 'moderate';
  project.proposedAuthority = Object.hasOwn(AUTHORITY_LABELS, project.proposedAuthority)
    ? project.proposedAuthority
    : 'A1';

  const answers = Object.fromEntries(Object.entries(imported.answers).filter(([id, answer]) => {
    return typeof id === 'string' && answer && typeof answer === 'object';
  }));

  const isLegacy = imported.schemaVersion !== SCHEMA_VERSION || imported.methodVersion !== METHOD_VERSION;
  return {
    ...fallback,
    ...imported,
    schemaVersion: SCHEMA_VERSION,
    methodVersion: METHOD_VERSION,
    stage: imported.stage,
    project,
    answers: isLegacy ? {} : answers,
    completed: isLegacy ? false : Boolean(imported.completed),
    currentQuestion: isLegacy ? 0 : Number(imported.currentQuestion || 0),
    currentQuestionId: isLegacy ? '' : String(imported.currentQuestionId || ''),
    needsReassessment: isLegacy,
    legacySnapshot: isLegacy ? {
      methodVersion: imported.methodVersion || '0.1',
      completed: Boolean(imported.completed),
      answers,
      completedAt: imported.completedAt || '',
    } : imported.legacySnapshot,
  };
}

function renderSample() {
  document.title = 'Sample Result | Human + AI Work Check';
  main.innerHTML = `<div class="page sample-result-page">
    <header class="page-header sample-result-intro">
      <p class="eyebrow">Fictional sample result</p>
      <h1>Sample result: CyberReady Practice Lab launch check</h1>
      <p>This made-up example shows what a completed result looks like for a project that is almost ready to publish.</p>
      <p class="stage-label"><strong>Launch Support:</strong> checked before public release</p>
    </header>

    <section class="project-context card" aria-labelledby="sample-context-heading">
      <div class="section-heading-compact">
        <p class="kicker">Sample project</p>
        <h2 id="sample-context-heading">What was checked?</h2>
      </div>
      <dl class="context-list">
        ${contextItem('Project', 'A public website with cybersecurity certification lessons and command-line practice.')}
        ${contextItem('Person doing the work', 'A solo cybersecurity professional who created the concept and directs the project.')}
        ${contextItem('AI system and model', 'ChatGPT, Example Model X4. The model name is fictional and used only for this demonstration.')}
        ${contextItem('What AI did', 'Organized sources, created first drafts, suggested code, and ran named tests.')}
        ${contextItem('What the person can review', 'Cybersecurity content, source use, and whether the website reflects its intended purpose.')}
        ${contextItem('Current capacity gap', 'The person cannot fully inspect the code, accessibility, or deployment settings without capable help.')}
        ${contextItem('Role proposed for AI', 'Prepare changes, run named tests, and execute a specific deployment after the project owner approves that release.')}
        ${contextItem('Release decision authority', 'The project owner decides whether the website is ready to launch.')}
        ${contextItem('AI action requested', 'Carry out the approved deployment. AI may not choose what or when to publish.')}
        ${contextItem('Outcome at stake', 'Learners receive accurate instruction and a usable, working practice experience.')}
        ${contextItem('Consequence if it fails', 'Learners may study inaccurate material, lose time, or be unable to complete the practice tasks.')}
      </dl>
      <p class="decision-question"><strong>Decision tested:</strong> Does this arrangement support allowing ChatGPT to carry out a specific public deployment after the project owner approves that release?</p>
    </section>

    <section class="result-summary" aria-labelledby="sample-decision-heading">
      <div class="result-header result-header-single">
        <div>
          <p class="eyebrow">Result</p>
          <h2 id="sample-decision-heading">Do not authorize AI to deploy the website yet</h2>
          <p class="lede">AI may prepare changes and run named tests. It should not execute the public release until a capable reviewer has checked the code, accessibility, permissions, and deployment settings, the project owner has explicitly approved that exact release, and rollback has been confirmed.</p>
        </div>
      </div>
      <dl class="result-facts" aria-label="Key result facts">
        ${resultFact('Proposed AI action', 'Execute a specific, reversible deployment after explicit human approval')}
        ${resultFact('Release decision authority', 'Retained by the project owner')}
        ${resultFact('Current supported AI role', 'Prepare changes and test reports for capable human review')}
        ${resultFact('Launch status', 'Blocked pending capable technical review and confirmed release controls')}
        ${resultFact('Evidence Strength', 'Partly documented')}
        ${resultFact('Human Review Load', 'High')}
      </dl>
      <div class="callout"><p><strong>The distinction:</strong> The project owner keeps the authority to decide whether to release. The requested AI role adds permission to execute that decision. The first does not automatically support the second.</p></div>
    </section>

    <section class="visible-result-section" aria-labelledby="sample-conditions-heading">
      <p class="kicker">Required boundary</p>
      <h2 id="sample-conditions-heading">What must be true before this project launches?</h2>
      <ol class="condition-list">
        <li>AI remains limited to preparing changes and reporting named tests while deployment is blocked.</li>
        <li>A capable person reviews the code, accessibility, permissions, and deployment settings.</li>
        <li>Material cybersecurity claims are checked against the named sources.</li>
        <li>The project owner explicitly approves the exact release after the reviews are complete.</li>
        <li>The AI system's permissions are limited and a tested rollback path is available.</li>
      </ol>
      <div class="callout callout-warning"><p><strong>Important:</strong> These controls reduce risk. They do not give the project owner technical expertise they do not have. Run a new Work Check before granting deployment permission.</p></div>
    </section>

    <section class="visible-result-section" aria-labelledby="sample-reasons-heading">
      <p class="kicker">Why deployment is blocked</p>
      <h2 id="sample-reasons-heading">Three facts drive the decision.</h2>
      <div class="reason-grid">
        <article class="card"><h3>Human strength</h3><p>The project owner can judge the main cybersecurity content and whether it fits the website’s purpose.</p></article>
        <article class="card"><h3>Capacity gap</h3><p>The project owner cannot fully catch and correct serious code, accessibility, or deployment problems alone.</p></article>
        <article class="card"><h3>Evidence gap</h3><p>Some work is documented, but technical review and observation of intended users are still missing.</p></article>
      </div>
    </section>

    <section class="visible-result-section" aria-labelledby="sample-actions-heading">
      <p class="kicker">Next actions</p>
      <h2 id="sample-actions-heading">What would strengthen the result?</h2>
      <p class="lede">A plan does not change the result. Complete and record each action, then run the Work Check again before changing AI's role.</p>
      <div class="action-timeline">
        ${timeBlock('Now', [sampleRecommendation('Keep AI deployment permission disabled and confirm the project owner holds the release decision.', 'Prevents the unresolved technical gaps from reaching the public site.', 'Save the current permission settings and release approval rule.', 'Keeps AI in the supported preparation role.')])}
        ${timeBlock('Within 24 hours', [sampleRecommendation('Run and save build, link, phone, keyboard, and automated accessibility checks. Confirm the deployment can be reversed.', 'Adds current test and recovery records, but does not replace capable review.', 'Save the test results, unresolved failures, and rollback result.', 'May remove workflow blockers after the findings are resolved.')])}
        ${timeBlock('Within days', [sampleRecommendation('Have a capable reviewer examine the code, accessibility, permissions, and deployment areas the project owner cannot fully judge.', 'Adds the missing technical review needed before the release decision.', 'Save the reviewer’s name, capacity, scope, findings, required changes, and date.', 'May support approved deployment after the findings are resolved and the check is run again.')])}
        ${timeBlock('Within weeks', [sampleRecommendation('Watch representative users complete the main tasks in a private preview and record where they succeed, stop, or misunderstand.', 'Adds direct evidence about usability and task completion.', 'Save observations, failures, changes, and results from a later check.', 'May support a later Current-Use Support decision.')])}
      </div>
    </section>

    <section class="result-explanations" aria-labelledby="sample-details-heading">
      <p class="kicker">Supporting detail</p>
      <h2 id="sample-details-heading">Open only what you need.</h2>
      <details>
        <summary>See what each participant may do</summary>
        <div class="decision-grid">
          ${decisionColumn('Supported in this workflow', 'supported', ['AI organizes supplied material', 'AI drafts content and code', 'AI proposes site changes', 'AI runs named tests and reports the results'], 'Functions supported within the current boundary.')}
          ${decisionColumn('Needs capable review', 'verify', ['Cybersecurity claims and source use', 'Code, permissions, and deployment settings', 'Keyboard, phone, link, and accessibility behavior', 'The exact release the project owner is being asked to approve'], 'Checks that require a person with the needed capacity.')}
          ${decisionColumn('Not supported yet', 'blocked', ['AI independently verifies its own work', 'AI carries out the public deployment', 'The project claims learner success before observing learners', 'AI receives broader permissions without confirming their scope'], 'Functions the arrangement cannot support yet.')}
        </div>
      </details>
      <details>
        <summary>See why the evidence is only partly documented</summary>
        <p>The project includes some source records, selected content review, and reported checks. It does not yet include complete saved test results, capable technical review, or evidence from intended users.</p>
        <ul><li>Documented evidence supports stronger conclusions.</li><li>Personal experience can inform the result, but it is easier to misunderstand or dispute.</li><li>Unknown information lowers confidence. It does not automatically prove poor performance.</li></ul>
      </details>
      <details>
        <summary>Why does this fictional sample have no score?</summary>
        <p>A score should be reproducible from a completed set of assessment answers. This fictional example was written to demonstrate the result format, not generated from a saved assessment record, so displaying an exact number would suggest evidence that does not exist.</p>
        <p>A real Work Check displays a score after the questions are answered. It also shows the separate Evidence Strength and the serious gaps that can limit the supported role.</p>
        <p><a href="#/method">Read the full scoring method</a></p>
      </details>
      <details>
        <summary>Could changing the model help?</summary>
        <p>Possibly, but changing models adds no points by itself. Compare both models on the same representative tasks and record the results. Change the score only if that comparison shows a meaningful improvement in this role.</p>
      </details>
      <details>
        <summary>Limits of this fictional result</summary>
        <ul><li>This is an example, not a certification or guarantee.</li><li>The project and model are fictional. ChatGPT is named only to make the example concrete.</li><li>The result would change if the person, system, model, role, permissions, workflow, evidence, or stakes changed.</li><li>The website has not been observed in real use.</li></ul>
      </details>
    </section>

    <div class="button-row"><a class="button" href="#/check">Check a project</a><a class="button button-secondary" href="#/method">See how the method works</a></div>
    <p class="helper-text sample-closing-note">A new check is needed when the person, system, model, role, workflow, evidence, or stakes materially change.</p>
  </div>`;
}

function contextItem(term, description) {
  return `<div><dt>${escapeHTML(term)}</dt><dd>${escapeHTML(description)}</dd></div>`;
}

function resultFact(term, description) {
  return `<div><dt>${escapeHTML(term)}</dt><dd>${escapeHTML(description)}</dd></div>`;
}

function sampleRecommendation(action, condition, evidenceEffect, roleEffect) {
  return {
    action,
    scoreEffect: { projectedChange: 0, condition },
    evidenceEffect,
    roleEffect,
    evidenceRequired: evidenceEffect,
    modelChangeTest: false,
  };
}

function renderCreationRecord(focusId = '') {
  document.title = 'Work Record | Human + AI Work Check';
  const r = creationRecord;
  main.innerHTML = `<div class="page">
    <header class="page-header">
      <p class="eyebrow">Work Record</p>
      <h1>Show how this work was made.</h1>
      <p>Record what you did, what each AI system contributed, what was checked, the supporting records available, and who made the final release decision.</p>
    </header>
    <div class="callout"><p><strong>This is not a human versus AI percentage or a certificate.</strong> It is an evidence-based alternative to judging AI involvement from the finished work alone.</p></div>
    ${r.legacyNotes ? `<div class="callout callout-warning"><p><strong>Review information carried forward from an earlier version.</strong><br />${escapeHTML(r.legacyNotes).replaceAll('\n', '<br />')}</p></div>` : ''}
    <div class="record-grid" style="margin-top: 2rem">
      <form class="record-panel" id="creation-form">
        <p class="save-status"><strong>Saved in this browser as you type.</strong> Export the record to keep a separate file.</p>
        <h2 class="form-section-heading">1. Describe the work</h2>
        <div class="field"><label for="record-ai-use">Was AI used in the documented workflow?</label><select id="record-ai-use" name="aiUse">${selectOptions([
          ['yes', 'Yes, AI was used'],
          ['no-ai-reported', 'No AI use reported in the documented workflow'],
          ['uncertain', 'Uncertain or not fully documented'],
        ], r.aiUse)}</select></div>
        <div class="field"><label for="record-title">Work or project title <span class="required">Required to print or copy</span></label><input id="record-title" name="title" value="${escapeHTML(r.title)}" /></div>
        <div class="field"><label for="record-description">What is the work and what was its purpose?</label><textarea id="record-description" name="description">${escapeHTML(r.description)}</textarea></div>
        <div class="field"><label for="record-idea-source">What is the first documented source of the main idea?</label><textarea id="record-idea-source" name="ideaSource" placeholder="For example: my notes dated..., a client request, an AI suggestion in the linked conversation, or unknown">${escapeHTML(r.ideaSource)}</textarea><small>This records the earliest source you can document. It does not prove what first occurred in someone’s mind.</small></div>
        <h2 class="form-section-heading">2. Record what each participant did</h2>
        <div class="field"><label for="record-human-actions">What did you do?</label><textarea id="record-human-actions" name="humanActions" placeholder="For example: supplied sources, made decisions, challenged suggestions, rewrote sections, checked claims, or tested the result">${escapeHTML(r.humanActions)}</textarea></div>
        ${r.aiUse !== 'no-ai-reported' ? `<div class="field"><label for="record-ai-contributions">What did AI contribute?</label><textarea id="record-ai-contributions" name="aiContributions" placeholder="For example: organized notes, proposed options, drafted language, found possible sources, wrote code, or ran named checks">${escapeHTML(r.aiContributions)}</textarea></div>
        <fieldset class="fieldset"><legend>AI systems and roles</legend><div class="record-system-list">${r.systems.map((system, index) => recordSystemEditor(system, index, r.systems.length)).join('')}</div><button class="button button-secondary" type="button" id="add-record-system">Add another system</button></fieldset>` : ''}
        <h2 class="form-section-heading">3. Add supporting records</h2>
        <div class="field"><label for="record-url">Link to the finished work <span class="helper-text">Optional</span></label><input id="record-url" name="artifactUrl" type="url" value="${escapeHTML(r.artifactUrl)}" placeholder="https://" /></div>
        ${r.aiUse !== 'no-ai-reported' ? `<div class="field"><label for="interaction-evidence">AI conversation or work records <span class="helper-text">One link or note per line</span></label><textarea id="interaction-evidence" name="interactionEvidence" placeholder="Public link, redacted export, screenshot, preserved transcript, or private reviewer access">${escapeHTML(r.interactionEvidence)}</textarea><small>A public chat is not required and does not prove the record is complete.</small></div>` : ''}
        <div class="field"><label for="other-evidence">Other supporting records <span class="helper-text">One link or note per line</span></label><textarea id="other-evidence" name="otherEvidence" placeholder="Notes, drafts, source records, version history, commits, tests, or editor comments">${escapeHTML(r.otherEvidence)}</textarea></div>

        <h2 class="form-section-heading">4. Record the final decision</h2>
        <fieldset class="fieldset"><legend>Who decided this work was ready to release?</legend><div class="field-grid">
          <div class="field"><label for="final-name">Name <span class="required">Required to print or copy</span></label><input id="final-name" name="finalDecisionName" value="${escapeHTML(r.finalDecisionName)}" /></div>
          <div class="field"><label for="final-role">Role <span class="required">Required to print or copy</span></label><input id="final-role" name="finalDecisionRole" value="${escapeHTML(r.finalDecisionRole)}" /></div>
          <div class="field"><label for="final-date">Date <span class="required">Required to print or copy</span></label><input id="final-date" name="finalDecisionDate" type="date" value="${escapeHTML(r.finalDecisionDate)}" /></div>
        </div></fieldset>

        <details class="optional-review" ${r.reviewerName || r.reviewerRole || r.reviewerScope || r.reviewerDate ? 'open' : ''}><summary>Independent review <span class="helper-text">Optional</span></summary><fieldset class="fieldset"><legend class="sr-only">Independent review</legend><p class="helper-text">Complete this only if another person examined the supporting records.</p><div class="field-grid">
          <div class="field"><label for="reviewer-name">Reviewer name</label><input id="reviewer-name" name="reviewerName" value="${escapeHTML(r.reviewerName)}" /></div>
          <div class="field"><label for="reviewer-role">Reviewer role</label><input id="reviewer-role" name="reviewerRole" value="${escapeHTML(r.reviewerRole)}" /></div>
          <div class="field field-span-2"><label for="reviewer-scope">Records examined, scope, and limits</label><textarea id="reviewer-scope" name="reviewerScope">${escapeHTML(r.reviewerScope)}</textarea></div>
          <div class="field"><label for="reviewer-date">Review date</label><input id="reviewer-date" name="reviewerDate" type="date" value="${escapeHTML(r.reviewerDate)}" /></div>
        </div></fieldset></details>

        <h2 class="form-section-heading">5. Map how each part was handled</h2>
        <p class="helper-text"><strong>Contribution map:</strong> record how each part was handled. “AI did this, and I accepted it as given” is different from reviewing and changing it.</p>
        <table class="contribution-table">
          <thead><tr><th id="contribution-part-heading" scope="col">Part of the work</th><th id="contribution-handling-heading" scope="col">How was it handled?</th></tr></thead>
          <tbody>${CONTRIBUTIONS.map(([key, label]) => {
            const id = `contribution-${key}`;
            return `<tr><th scope="row" id="${id}" data-label="Part of the work">${escapeHTML(label)}</th><td data-label="How was it handled?"><select name="contribution:${key}" aria-labelledby="${id} contribution-handling-heading">${contributionOptionsFor(r.aiUse).map(([value, optionLabel]) => `<option value="${value}" ${r.contributions[key] === value ? 'selected' : ''}>${optionLabel}</option>`).join('')}</select></td></tr>`;
          }).join('')}</tbody>
        </table>
        <div class="form-actions no-print">
          <button class="button" type="submit">Save record</button>
          <button class="button button-secondary" type="button" id="export-record">Export Work Record</button>
        </div>
      </form>
      <aside class="record-preview" id="record-preview" aria-label="How the Work Was Made preview">
        ${creationRecordPreview(r)}
      </aside>
    </div>
    <div class="result-actions no-print">
      <button class="button" type="button" id="print-record" ${recordIsComplete(r) ? '' : 'disabled'}>${recordIsComplete(r) ? 'Print Work Record' : 'Complete the final decision to print'}</button>
      <button class="button button-secondary" type="button" id="copy-disclosure" ${recordIsComplete(r) ? '' : 'disabled'}>${recordIsComplete(r) ? 'Copy short disclosure' : 'Complete the final decision to copy disclosure'}</button>
    </div>
    <div class="callout callout-warning" style="margin-top: 2rem"><p><strong>Important limit:</strong> This record documents the disclosed workflow and available evidence. It cannot prove that undisclosed AI use never occurred, establish absolute idea ownership, guarantee every claim is correct, or require another organization to accept the record.</p></div>
  </div>`;

  const form = document.querySelector('#creation-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    updateCreationRecord(new FormData(form));
    showToast('Work Record saved in this browser.');
    renderCreationRecord('record-title');
  });
  form.addEventListener('input', () => {
    updateCreationRecord(new FormData(form));
    document.querySelector('#record-preview').innerHTML = creationRecordPreview(creationRecord);
    updateCreationActions();
  });
  document.querySelector('#record-ai-use').addEventListener('change', () => {
    updateCreationRecord(new FormData(form));
    if (creationRecord.aiUse === 'no-ai-reported') {
      Object.entries(creationRecord.contributions).forEach(([key, value]) => {
        if (['Shared', 'AI-reviewed', 'AI-accepted'].includes(value)) creationRecord.contributions[key] = 'Unknown';
      });
    }
    if (creationRecord.aiUse !== 'no-ai-reported' && !creationRecord.systems.length) {
      creationRecord.systems = [makeSystem()];
    }
    saveCreationRecord();
    renderCreationRecord('record-ai-use');
  });
  document.querySelector('#add-record-system')?.addEventListener('click', () => {
    updateCreationRecord(new FormData(form));
    creationRecord.systems.push(makeSystem());
    saveCreationRecord();
    renderCreationRecord(`record-system-product-${creationRecord.systems.length - 1}`);
  });
  document.querySelectorAll('[data-remove-record-system]').forEach((button) => {
    button.addEventListener('click', () => {
      updateCreationRecord(new FormData(form));
      creationRecord.systems = creationRecord.systems.filter((system) => system.id !== button.dataset.removeRecordSystem);
      if (!creationRecord.systems.length) creationRecord.systems = [makeSystem()];
      saveCreationRecord();
      renderCreationRecord('add-record-system');
    });
  });
  document.querySelector('#export-record').addEventListener('click', () => downloadJSON(`${slug(r.title || 'work-record')}.json`, {
    kind: 'human-ai-work-record',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    record: creationRecord,
  }));
  document.querySelector('#print-record')?.addEventListener('click', () => {
    if (recordIsComplete(creationRecord)) printMode('printing-record');
  });
  document.querySelector('#copy-disclosure')?.addEventListener('click', async () => {
    if (!recordIsComplete(creationRecord)) return;
    const text = recordDisclosure(creationRecord);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Short disclosure copied.');
    } catch {
      showToast('Copy was unavailable. Select the disclosure from the printed record instead.');
    }
  });
  updateCreationActions();
  if (focusId) {
    window.requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  }
}

function recordSystemEditor(system, index, count) {
  return `<article class="system-editor">
    <div class="system-editor-heading"><h2>System ${index + 1}</h2>${count > 1 ? `<button class="text-button" type="button" data-remove-record-system="${escapeHTML(system.id)}">Remove</button>` : ''}</div>
    <input type="hidden" name="recordSystemId" value="${escapeHTML(system.id)}" />
    <div class="field-grid">
      <div class="field"><label for="record-system-product-${index}">AI product or tool</label><input id="record-system-product-${index}" name="recordSystemProduct" value="${escapeHTML(system.product)}" /></div>
      <div class="field"><label for="record-system-model-${index}">Exact model or version</label><input id="record-system-model-${index}" name="recordSystemModel" value="${escapeHTML(system.model)}" placeholder="Unknown if not shown" /></div>
      <div class="field field-span-2"><label for="record-system-role-${index}">Role in making the work</label><textarea id="record-system-role-${index}" name="recordSystemRole">${escapeHTML(system.role)}</textarea></div>
      <div class="field field-span-2"><label for="record-system-evidence-${index}">System-specific record <span class="helper-text">Optional</span></label><textarea id="record-system-evidence-${index}" name="recordSystemEvidence" placeholder="Conversation, export, screenshot, version history, or private review note">${escapeHTML(system.evidence)}</textarea></div>
    </div>
  </article>`;
}

function updateCreationActions() {
  const complete = recordIsComplete(creationRecord);
  const copy = document.querySelector('#copy-disclosure');
  const print = document.querySelector('#print-record');
  if (copy) {
    copy.disabled = !complete;
    copy.textContent = complete ? 'Copy short disclosure' : 'Complete the final decision to copy disclosure';
  }
  if (print) {
    print.disabled = !complete;
    print.textContent = complete ? 'Print Work Record' : 'Complete the final decision to print';
  }
}

function updateCreationRecord(form) {
  ['aiUse', 'title', 'description', 'ideaSource', 'humanActions', 'aiContributions', 'artifactUrl', 'interactionEvidence', 'otherEvidence', 'reviewerName', 'reviewerRole', 'reviewerScope', 'reviewerDate', 'finalDecisionName', 'finalDecisionRole', 'finalDecisionDate'].forEach((key) => {
    creationRecord[key] = String(form.get(key) || '').trim();
  });
  if (creationRecord.aiUse !== 'no-ai-reported') {
    const ids = form.getAll('recordSystemId');
    const products = form.getAll('recordSystemProduct');
    const models = form.getAll('recordSystemModel');
    const roles = form.getAll('recordSystemRole');
    const evidence = form.getAll('recordSystemEvidence');
    creationRecord.systems = ids.map((id, index) => makeSystem({
      id: String(id),
      product: String(products[index] || '').trim(),
      model: String(models[index] || '').trim(),
      role: String(roles[index] || '').trim(),
      evidence: String(evidence[index] || '').trim(),
    }));
  } else {
    creationRecord.aiContributions = '';
    creationRecord.systems = [];
  }
  creationRecord.system = creationRecord.systems.map(systemSummary).join('; ');
  CONTRIBUTIONS.forEach(([key]) => {
    creationRecord.contributions[key] = form.get(`contribution:${key}`) || 'Unknown';
  });
  saveCreationRecord();
}

function creationRecordPreview(record) {
  const strength = recordEvidenceStrength(record);
  const finalDecision = [record.finalDecisionName, record.finalDecisionRole, record.finalDecisionDate].filter(Boolean).join(' | ');
  return `<h1 class="print-only">Human + AI Work Record</h1><p class="kicker">Work Record | Evidence Strength: ${escapeHTML(strength)}</p>
    <h2>${escapeHTML(record.title || 'Untitled work')}</h2>
    <p>${escapeHTML(record.description || 'Describe the work to give this record context.')}</p>
    <p class="record-summary">${escapeHTML(recordHeadline(record))}</p>
    <div class="record-action-summary">
      <p><strong>First documented source of the main idea</strong><br />${escapeHTML(record.ideaSource || 'Not yet described')}</p>
      <p><strong>What the person did</strong><br />${escapeHTML(record.humanActions || 'Not yet described')}</p>
      ${record.aiUse !== 'no-ai-reported' ? `<p><strong>What AI contributed</strong><br />${escapeHTML(record.aiContributions || 'Not yet described')}</p>` : ''}
    </div>
    <ul class="mini-record-list">
      ${CONTRIBUTIONS.map(([key, label]) => `<li><span>${escapeHTML(label)}</span><strong>${escapeHTML(contributionLabel(record.contributions[key]))}</strong></li>`).join('')}
    </ul>
    <p style="margin-top: 1rem"><strong>Final release decision:</strong><br />${escapeHTML(finalDecision || 'Not yet complete')}</p>
    ${record.aiUse !== 'no-ai-reported' ? `<p><strong>AI systems and roles:</strong><br />${record.systems.length ? record.systems.map((system) => escapeHTML(systemSummary(system))).join('<br />') : 'Not yet named'}</p>` : ''}
    ${safeLink(record.artifactUrl) ? `<p><strong>Finished work:</strong><br /><a href="${escapeHTML(safeLink(record.artifactUrl))}" target="_blank" rel="noreferrer">Open the documented work <span class="new-tab-note">(opens in a new tab)</span></a></p>` : ''}
    ${renderEvidenceLinks(record.interactionEvidence, 'AI conversation or work records')}
    ${renderEvidenceLinks(record.otherEvidence, 'Other supporting records')}
    ${recordEvidenceReview(record)}
    <p class="helper-text">Updated ${formatDate(record.updatedAt)}. Evidence Strength is calculated from this record; it is not selected by the person completing it.</p>`;
}

function recordHeadline(record) {
  if (!recordIsComplete(record)) return 'Record incomplete. Final release decision not established.';
  if (record.aiUse === 'no-ai-reported') return 'No AI use was reported in the documented workflow.';
  if (record.aiUse === 'uncertain') return 'AI use is uncertain or not fully documented.';
  return 'AI use and contributions are documented by role.';
}

function contributionLabel(value) {
  return CONTRIBUTION_OPTIONS.find(([storedValue]) => storedValue === value)?.[1] || value || 'Unknown';
}

function contributionOptionsFor(aiUse) {
  if (aiUse !== 'no-ai-reported') return CONTRIBUTION_OPTIONS;
  return CONTRIBUTION_OPTIONS.filter(([value]) => !['Shared', 'AI-reviewed', 'AI-accepted'].includes(value));
}

function recordIsComplete(record) {
  return Boolean(record.title?.trim() && record.finalDecisionName?.trim() && record.finalDecisionRole?.trim() && record.finalDecisionDate);
}

function recordEvidenceStrength(record) {
  const interaction = evidenceEntries(record.interactionEvidence);
  const other = evidenceEntries(record.otherEvidence);
  const systemEvidence = (record.systems || []).filter((system) => system.evidence?.trim()).length;
  const hasArtifact = Boolean(safeLink(record.artifactUrl));
  const mapped = Object.values(record.contributions || {}).filter((value) => !['Unknown', 'Not applicable'].includes(value)).length;
  const reviewerComplete = Boolean(record.reviewerName && record.reviewerRole && record.reviewerScope && record.reviewerDate);
  const hasSupport = interaction.length + other.length + systemEvidence + Number(hasArtifact) > 0;
  const keyEvidence = record.aiUse === 'no-ai-reported'
    ? other.length > 0 && hasArtifact
    : interaction.length > 0 && (other.length > 0 || systemEvidence > 0) && hasArtifact;
  if (recordIsComplete(record) && reviewerComplete && keyEvidence && mapped >= 5) return 'Independently checked';
  if (recordIsComplete(record) && keyEvidence && mapped >= 5) return 'Key steps documented';
  if (hasSupport || record.ideaSource || mapped >= 3) return 'Partly documented';
  if (record.title || record.description || record.humanActions) return 'Self-described';
  return 'Not enough information';
}

function recordEvidenceReview(record) {
  if (!(record.reviewerName || record.reviewerRole || record.reviewerScope || record.reviewerDate)) return '';
  return `<p><strong>Independent review:</strong><br />${escapeHTML([record.reviewerName, record.reviewerRole, record.reviewerDate].filter(Boolean).join(' | ') || 'Incomplete')}<br />${escapeHTML(record.reviewerScope || 'Scope and limits not yet described')}</p>`;
}

function recordDisclosure(record) {
  const decider = `${record.finalDecisionName} (${record.finalDecisionRole})`;
  if (record.aiUse === 'no-ai-reported') {
    return `Process note: No AI use was reported in the documented workflow for this work. ${decider} made the final release decision on ${record.finalDecisionDate} and remains accountable for that decision.`;
  }
  if (record.aiUse === 'uncertain') {
    return `AI disclosure: AI use in this workflow is uncertain or not fully documented. ${decider} made the final release decision on ${record.finalDecisionDate} and remains accountable for that decision.`;
  }
  const systems = record.systems.map((system) => `${system.product || 'AI'}${system.model ? ` ${system.model}` : ''}`).join(', ') || 'AI';
  return `AI disclosure: I used ${systems} to assist with this work. The attached Work Record describes what I did, what AI contributed, and the review performed. ${decider} made the final release decision on ${record.finalDecisionDate} and remains accountable for that decision.`;
}

function safeLink(value) {
  try {
    const parsed = new URL(String(value || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function evidenceEntries(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function renderEvidenceLinks(value, heading = 'Supporting evidence') {
  const entries = evidenceEntries(value);
  if (!entries.length) return '';
  return `<div><strong>${escapeHTML(heading)}:</strong><ul>${entries.map((item) => {
    const link = safeLink(item);
    return link
      ? `<li><a href="${escapeHTML(link)}" target="_blank" rel="noreferrer">${escapeHTML(item)} <span class="new-tab-note">(opens in a new tab)</span></a></li>`
      : `<li>${escapeHTML(item)}</li>`;
  }).join('')}</ul></div>`;
}

function printMode(className) {
  document.body.classList.add(className);
  window.print();
}

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-result', 'printing-record');
});

function focusCurrentStep() {
  window.requestAnimationFrame(() => {
    const target = main.querySelector('[role="alert"]') || main.querySelector('h1') || main;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
}

function renderMethod() {
  document.title = 'How It Works | Human + AI Work Check';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">AI Reliance Check method ${escapeHTML(METHOD_VERSION)}</p><h1>How the Work Check reaches a result.</h1><p>The model is only one part of the arrangement. The method starts with your capacity, then weighs the exact AI setup and role, workflow controls, and the outcome you are betting on.</p></header>
    <div class="prose">
      <h2>Central question</h2>
      <blockquote class="callout"><p><strong>Is the trust I am placing in this human and AI work arrangement supported?</strong></p></blockquote>
      <h2>The five questions being scored</h2>
      <div class="table-scroll" role="region" aria-label="Five questions scored by the method" tabindex="0"><table><thead><tr><th scope="col">Question</th><th scope="col">Method term</th></tr></thead><tbody>
        <tr><td><strong>Can I catch and correct a serious problem?</strong><br />Do I have the knowledge, access, authority, time, attention, and stamina this review requires?</td><td>Your Capacity</td></tr>
        <tr><td><strong>Can this exact AI setup perform its assigned role?</strong><br />Has it been tested on normal work and important failure cases?</td><td>AI Role Fit</td></tr>
        <tr><td><strong>Does the system behave as this relationship requires?</strong><br />Can it challenge, qualify, identify uncertainty, test, and stop when needed?</td><td>Working Relationship</td></tr>
        <tr><td><strong>Does the workflow keep control in the right places?</strong><br />Are access, permissions, records, checks, approvals, stopping, and recovery matched to the consequences?</td><td>Workflow and Controls</td></tr>
        <tr><td><strong>Can I tell whether the outcome I am betting on was achieved?</strong><br />The evidence needed changes from a plan, to launch, to real use.</td><td>Outcome and Stakes</td></tr>
      </tbody></table></div>
      <h2>How the score works</h2>
      <ol>
        <li>Each answer has a transparent rubric value.</li>
        <li>The operational score describes support within the current arrangement. It is not the probability that AI is correct.</li>
        <li>Evidence Strength is reported separately. Thin evidence creates uncertainty, but it does not automatically turn reported ability into poor ability.</li>
        <li>The stakes and the authority assigned to AI determine how much support the arrangement needs.</li>
        <li>Serious gaps can limit the supported role even when the average score is high.</li>
        <li>Planned improvements do not change the current result. They count only after they are completed and evidenced.</li>
        <li>A different model may be suggested for comparison when model behavior is the weak point. A newer or larger model receives no automatic credit.</li>
      </ol>
      <p>If several systems are involved, record each one and identify the most consequential role. The detailed questions focus on that role. Run a separate Work Check when another consequential system needs its own evaluation.</p>
      <h2>Four working score ranges</h2>
      <p>The scope statement applies to every range: <strong>your current capacity, AI role fit, working relationship, workflow controls, and outcome for this project and proposed AI role.</strong> Evidence Strength is reported separately.</p>
      <div class="table-scroll" role="region" aria-label="Four working score ranges" tabindex="0"><table><thead><tr><th scope="col">Score</th><th scope="col">Result</th><th scope="col">Meaning</th></tr></thead><tbody>
        <tr><td>0 to 39</td><td>Not supported for proposed role</td><td>The current arrangement does not support relying on AI in the role proposed.</td></tr>
        <tr><td>40 to 59</td><td>Supported only in a smaller role</td><td>A narrower function or lower authority may be supported.</td></tr>
        <tr><td>60 to 79</td><td>Supported with named conditions</td><td>The role depends on stated reviews, limits, tests, or approvals.</td></tr>
        <tr><td>80 to 100</td><td>Strongly supported under current conditions</td><td>The current arrangement provides strong support for the proposed role under the documented conditions.</td></tr>
      </tbody></table></div>
      <p>A gate, unsupported authority, or weak evidence can produce a more restrictive decision than the numeric range suggests.</p>
      <h2>What 0 and 100 mean</h2>
      <p>A score of <strong>0</strong> means the current answers provide no operational support for relying on AI in the proposed role. It does not prove that the person or system has no ability.</p>
      <p>A score of <strong>100</strong> means the recorded capacity, system behavior, workflow controls, and outcome checks strongly support the proposed role under the stated conditions. It is not a guarantee of accuracy, safety, success, or future performance.</p>
      <h2>Evidence Strength and real-use testing</h2>
      <p><strong>Evidence Strength</strong> describes how well the answers are supported by records or direct observations. <strong>Real-use testing</strong> describes whether the arrangement is planned, checked for launch, piloted, repeated, or sustained in actual use.</p>
      <p>A project can have a strong operational arrangement and weak documentation. It can also be thoroughly documented and perform poorly. The result shows both.</p>
      <h2>Problems that can override the average</h2>
      <ul>
        <li>Unknown permissions block sensitive, external, or autonomous action.</li>
        <li>Unverified material claims cannot be presented as verified.</li>
        <li>AI cannot carry out a production deployment without the relevant technical checks, even when a person approved the release.</li>
        <li>High-consequence decisions without capable human review cannot be delegated solely to AI.</li>
        <li>A review process that cannot be sustained limits the supported role.</li>
        <li>A project without outcome evidence may be piloted but cannot claim demonstrated effectiveness.</li>
      </ul>
      <h2>What recommendations mean</h2>
      <p>Recommendations are grouped by what can be done now, within 24 hours, within days, or within weeks. Each one explains whether it could raise operational support, strengthen evidence, remove a blocker, add human capacity, or support a smaller AI role. A numeric projection is an illustrative maximum based on closing the named gap, not a guaranteed increase. Nothing changes until the action is completed, recorded, and the check is recalculated.</p>
      <h2>Accountability</h2>
      <p>AI can produce recommendations, influence decisions, and initiate actions when connected to tools. It cannot absorb the accountability that follows human agency. The person who can authorize, reject, limit, stop, or correct an action remains accountable for how that agency is used.</p>
      <h2>When to refresh</h2>
      <p>Repeat the check when the model, instructions, memory, tools, data, permissions, human reviewer, task, audience, stakes, acceptance criteria, workflow, or observed outcomes materially change.</p>
      <div class="callout callout-warning"><p><strong>Current status:</strong> Method ${escapeHTML(METHOD_VERSION)} is a transparent, practice-based working method. It has not been independently validated as a scientific instrument. Its ranges and recommendations are working guidance that should improve through testing and real use.</p></div>
    </div>
  </div>`;
}

function renderExamples() {
  document.title = 'Examples | Human + AI Work Check';
  const examples = [
    ['Create an article or report', 'AI may organize, challenge, research, draft, or edit. The Work Check identifies the supported role and required verification. The Work Record documents the creator’s actions and each AI contribution.', 'Work Check + Work Record'],
    ['Build a website', 'AI may propose structure, write code, create content, run tests, or publish. The check separates visible review from security, accessibility, code, permissions, and deployment areas the creator cannot inspect.', 'Launch boundary + test plan'],
    ['Use an agent to take actions', 'An agent may send messages, change files, operate accounts, or use its own output to trigger a next step. Permissions, reversibility, monitoring, and approval gates matter more than fluent responses.', 'Authority boundary + blockers'],
    ['Develop training content', 'Content accuracy does not prove that people can learn from or use it. The check separates subject review, instructional flow, learner testing, and observed outcomes.', 'Pilot plan + Evidence Strength'],
    ['Review a project already in use', 'A polished result may still have weak evidence about what worked. Current-Use Support compares the intended wager with observed use, errors, and consequences.', 'Updated boundary + next review'],
  ];
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">Examples</p><h1>Different projects require different reliance.</h1><p>The same system can deserve very different authority in two tasks. Start with the situation where a consequential choice is being made.</p></header><section aria-labelledby="example-types-heading"><h2 class="sr-only" id="example-types-heading">Project examples</h2><div class="grid-2">${examples.map(([title, copy, output], index) => `<article class="card"><span class="card-number">0${index + 1}</span><h3>${title}</h3><p>${copy}</p><p class="kicker">Useful output</p><p><strong>${output}</strong></p></article>`).join('')}</div></section><div class="button-row"><a class="button" href="#/check">Check a project</a><a class="button button-secondary" href="#/sample">View the fictional website result</a></div></div>`;
}

function renderPricing() {
  document.title = 'Pricing | Human + AI Work Check';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">Pricing</p><h1>Start free. Pay later for continuity, collaboration, or human review. Never for a better result.</h1><p>This GitHub-hosted preview is free. No payment is collected on this version.</p></header>
    <div class="grid-2">
      <article class="card pricing-card featured"><span class="stamp">Available in preview</span><h2>Free Preview</h2><p class="price">$0</p><ul><li>Plan Readiness, Launch Support, and Current-Use Support</li><li>Project-specific score and decision</li><li>Evidence Strength</li><li>Supported role, review needs, and current limits</li><li>Actions for now, 24 hours, days, and weeks</li><li>Printable Work Check result</li><li>Work Record</li><li>Local browser save and JSON export</li></ul><a class="button" href="#/check">Check a project for free</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned</span><h2>Project Record</h2><p class="price">Coming later</p><ul><li>Secure project storage</li><li>Dated updates</li><li>Plan-to-launch comparisons</li><li>Evidence management</li><li>Public, unlisted, or private records</li></ul><a class="button button-secondary" href="#/method">Review the method</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned</span><h2>Individual and Team</h2><p class="price">Coming later</p><ul><li>Multiple projects</li><li>Score and decision history</li><li>Reviewer assignments</li><li>Approval records</li><li>Reusable workflows</li><li>Shareable project cards</li></ul><a class="button button-secondary" href="#/examples">See use cases</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned human service</span><h2>Guided Review</h2><p class="price">Coming later</p><p>A facilitated review for projects that need outside examination or additional human capacity.</p><ul><li>Capacity and authority review</li><li>Evidence-gap review</li><li>Independent challenge</li><li>Documented findings</li></ul><p class="availability-note">Contact option coming later</p></article>
    </div>
    <div class="callout" style="margin-top:2rem"><p><strong>Pricing principle:</strong> Payment may add storage, teamwork, integrations, or qualified human review. It never purchases a higher score or a more favorable decision.</p></div>
  </div>`;
}

function renderFAQ() {
  document.title = 'FAQ | Human + AI Work Check';
  const faqs = [
    ['What does this tool check?', 'It checks one real human and AI work arrangement: your capacity, one consequential AI system and role, the work, the workflow, and the outcome you are betting on. Other systems can be recorded for context, but each consequential role needs its own Work Check. It does not rate a model by itself.'],
    ['How does this tool define trust?', 'Trust is the decision to rely on a system for a defined role. The Work Check asks whether your current capacity, evidence, controls, and workflow support that reliance.'],
    ['Is having a human in the loop enough?', 'No. The person needs the knowledge, access, authority, time, attention, and stamina to recognize a serious problem, correct it, or stop the work. A named reviewer counts only if that person is actually in the workflow and has what the role requires.'],
    ['Is this an AI detector?', 'No. Detectors guess from the finished product. This tool examines the documented working relationship and process.'],
    ['Can the Work Record prove authorship?', 'No. It can preserve dated evidence of what the person did, what AI contributed, and how decisions were made. It is an evidence-based alternative to judging AI involvement from the finished work alone, not proof or a certificate.'],
    ['Does the score show how much of the work is human?', 'No. A single percentage cannot honestly represent originating an idea, supplying context, drafting, revising, checking, deciding, and approving. The Work Record shows those actions separately.'],
    ['Is the score the probability that AI is correct?', 'No. It shows how strongly the current arrangement supports relying on AI in the proposed role.'],
    ['What is Evidence Strength?', 'Evidence Strength shows how well the answers are documented. It is separate from the operational relationship score. Missing evidence creates uncertainty, not automatic proof of poor ability.'],
    ['Does a newer or more powerful model automatically improve the result?', 'No. Another model may perform better in a specific role, but it needs to be compared on the same representative tasks. A model change does not improve human capacity, permissions, workflow controls, or outcome evidence.'],
    ['What if several AI systems were used?', 'Record each tool, model or version, setup, and role. Identify the most consequential role for this Work Check. Run another check if a second consequential role needs separate evaluation.'],
    ['Do I have to make my AI conversations public?', 'No. Evidence may be public, private, redacted, exported, or reviewed by another person. If key records are unavailable, the Work Record will show lower Evidence Strength.'],
    ['What if I did not use AI?', 'The Work Record can state: “No AI use reported in the documented workflow.” That is a bounded statement, not proof that no AI was used anywhere.'],
    ['Does a lower score mean I cannot publish or launch?', 'Not always. It may mean giving AI a smaller role, adding capable human review, or keeping an untested function inactive. A hard gate can still block the proposed authority.'],
    ['Who remains accountable?', 'Accountability follows agency. You remain accountable for choices you had the authority and capacity to make, including how much authority you gave the system.'],
    ['When should I repeat the check?', 'Repeat it when the model, instructions, memory, tools, permissions, task, reviewer, audience, stakes, workflow, or observed results materially change.'],
    ['Where is my information stored?', 'In this preview, information stays in the current browser unless you export it. Do not enter confidential, regulated, or sensitive information.'],
    ['Is this scientifically validated?', 'No. It is a transparent, practice-based working method. Its ranges and recommendations are working guidance that should improve through testing and real use.'],
  ];
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">FAQ</p><h1>Plain answers about what this tool can and cannot say.</h1></header><div class="faq-list">${faqs.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div><div class="button-row"><a class="button" href="#/check">Check a project</a><a class="button button-secondary" href="#/method">See the full method</a></div></div>`;
}

function renderNotFound() {
  document.title = 'Page not found | Human + AI Work Check';
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">404</p><h1>This page is outside the current boundary.</h1><p>The link may be outdated or incomplete.</p></header><a class="button" href="#/">Return home</a></div>`;
}

function slug(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'record';
}

function setMenuOpen(open) {
  nav.classList.toggle('open', open);
  document.body.classList.toggle('nav-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.querySelector('.sr-only').textContent = open ? ', close navigation' : ', open navigation';
  main.inert = open;
  siteFooter.inert = open;
  if (open) nav.querySelector('a')?.focus();
}

menuButton.addEventListener('click', () => {
  const open = !nav.classList.contains('open');
  setMenuOpen(open);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && nav.classList.contains('open')) {
    const focusable = [menuButton, ...nav.querySelectorAll('a[href]')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeIndex = focusable.indexOf(document.activeElement);
    if (event.shiftKey && (document.activeElement === first || activeIndex < 0)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || activeIndex < 0)) {
      event.preventDefault();
      first.focus();
    }
  }
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    setMenuOpen(false);
    menuButton.focus();
  }
});

document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  main.focus();
});

window.addEventListener('hashchange', route);

const arrangementMedia = window.matchMedia('(max-width: 900px)');
arrangementMedia.addEventListener('change', (event) => {
  document.querySelectorAll('details.assessment-summary').forEach((details) => {
    details.open = !event.matches;
  });
});

const navigationMedia = window.matchMedia('(max-width: 840px)');
navigationMedia.addEventListener('change', (event) => {
  if (!event.matches) setMenuOpen(false);
});

route();
