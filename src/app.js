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
import {
  AI_USE_OPTIONS,
  CLAIM_CATEGORY_OPTIONS,
  CONTRIBUTIONS,
  CONTRIBUTION_OPTIONS,
  EVIDENCE_INTEGRITY_OPTIONS,
  EVIDENCE_RELATIONSHIP_OPTIONS,
  EVIDENCE_VISIBILITY_OPTIONS,
  WORK_RECORD_SCHEMA_VERSION,
  WORK_RECORD_STATUS_OPTIONS,
  buildCredits,
  buildDisclosure,
  createWorkRecord,
  getClaimSupport,
  getEvidenceIntegrity,
  getReviewStatus,
  getWorkRecordCompleteness,
  normalizeWorkRecord,
  safeHttpUrl,
  toPublicWorkRecord,
} from './work-record.js';
import homeBakingPhoto from './home-baking.webp';

const STORAGE_KEY = 'ai-reliance-check:v0.2';
const LEGACY_STORAGE_KEY = 'ai-reliance-check:v0.1';
const RECORD_KEY = 'ai-reliance-check:work-record:v0.3';
const LEGACY_RECORD_KEYS = ['ai-reliance-check:work-record:v0.2', 'ai-reliance-check:creation-record:v0.1'];
const ASSESSMENT_SCHEMA_VERSION = 2;
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSef4UnjJR67d2zV0Osuu85TVtd5lqXrHCVWwdcOzPwCxNOrSw/viewform';

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

const RECORD_STEPS = [
  ['work', 'Work'],
  ['claims', 'Claims'],
  ['credits', 'Credits'],
  ['evidence', 'Evidence'],
  ['handling', 'Handling'],
  ['review', 'Review'],
];

const CLAIM_PRESETS = [
  ['claim-originated', 'origination', 'I originated the main idea or purpose.'],
  ['claim-developed', 'development', 'I developed the core method, argument, design, or approach.'],
  ['claim-language', 'authorship', 'I wrote or materially rewrote the final language.'],
  ['claim-directed', 'direction', 'I directed and evaluated the AI-assisted work.'],
  ['claim-defend', 'evaluation', 'I can explain and defend the final work.'],
  ['claim-perform', 'evaluation', 'I can personally perform the underlying task shown here.'],
  ['claim-release', 'direction', 'I made the final decision to share this version.'],
];

const EVIDENCE_TYPES = [
  ['AI conversation or export', 'AI conversation or export'],
  ['Original notes or source material', 'Original notes or source material'],
  ['Draft or revision history', 'Draft or revision history'],
  ['Git commit or pull request', 'Git commit or pull request'],
  ['Test result', 'Test result'],
  ['Approval or decision record', 'Approval or decision record'],
  ['Independent review', 'Independent review'],
  ['Finished artifact', 'Finished artifact'],
  ['Other supporting record', 'Other supporting record'],
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
let recordStep = loadRecordStep();
if (recordStep > RECORD_STEPS.length && !getWorkRecordCompleteness(creationRecord).complete) recordStep = 1;

function makeAssessment() {
  const firstSystem = makeSystem();
  return {
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
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
      failureScenario: '',
      failureImpact: '',
      consequence: '',
      proposedAuthority: '',
      workTypes: [],
      requiredBehaviors: [],
      connectedAccess: '',
      permissionsConfirmed: '',
      humanApprovalBeforeConsequence: '',
      sensitiveData: '',
      dataAuthorizationConfirmed: '',
      unresolvedMaterialFailure: '',
      actionsAreReversible: '',
      monitoringConfirmed: '',
      observedRuns: '',
      representativeConditions: '',
      atLeastOneEdgeOrFailureCase: '',
      controlsActuallyOperated: '',
      observedInRealUseForFullOperatingCycle: '',
      outcomeDataCollected: '',
      materialFailuresResolved: '',
      reviewSustainable: '',
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
    proposedAuthority: '',
    setup: '',
    evidence: '',
    evidenceBasis: 'unknown',
    connectedAccess: '',
    permissionsConfirmed: '',
    ...overrides,
    id: overrides.id || makeId('system'),
  };
}

function makeCreationRecord(projectId = '') {
  return createWorkRecord({ projectId, idFactory: (prefix) => makeId(prefix) });
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? { ...fallback, ...JSON.parse(value) } : fallback;
  } catch {
    return fallback;
  }
}

function loadRecordStep() {
  try {
    return Number(sessionStorage.getItem('human-ai-work-record:step') || 1);
  } catch {
    return 1;
  }
}

function saveRecordStep() {
  try {
    sessionStorage.setItem('human-ai-work-record:step', String(recordStep));
  } catch {
    // The record still works when browser session storage is unavailable.
  }
}

function loadAssessment() {
  const fallback = makeAssessment();
  const current = loadJSON(STORAGE_KEY, null);
  const legacy = current ? null : loadJSON(LEGACY_STORAGE_KEY, null);
  const stored = current || legacy;
  if (!stored || typeof stored !== 'object') return fallback;
  const isLegacy = stored.schemaVersion !== ASSESSMENT_SCHEMA_VERSION || stored.methodVersion !== METHOD_VERSION;
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
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
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
  const current = loadJSON(RECORD_KEY, null);
  const legacy = current ? null : LEGACY_RECORD_KEYS.map((key) => loadJSON(key, null)).find(Boolean);
  const stored = current || legacy;
  if (!stored || typeof stored !== 'object') return makeCreationRecord();
  return normalizeWorkRecord(stored, { idFactory: (prefix) => makeId(prefix) });
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

function normalizeSystems(systems, legacySystem = '', legacyAuthority = '') {
  const normalized = Array.isArray(systems)
    ? systems.filter((item) => item && typeof item === 'object').map((item) => makeSystem(item))
    : [];
  if (normalized.length) return normalized;
  return [makeSystem({
    product: String(legacySystem || ''),
    setup: String(legacySystem || ''),
    proposedAuthority: Object.hasOwn(AUTHORITY_LABELS, legacyAuthority) ? legacyAuthority : '',
  })];
}

function saveAssessment() {
  assessment.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assessment));
    return true;
  } catch {
    showToast('Unable to save this Load Test in your browser. Export it before leaving this page.');
    return false;
  }
}

function saveCreationRecord() {
  creationRecord.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(creationRecord));
    const status = document.querySelector('#record-save-status');
    if (status && status.textContent !== 'Changes are saved in this browser.') status.textContent = 'Changes are saved in this browser.';
    return true;
  } catch {
    const status = document.querySelector('#record-save-status');
    if (status) status.textContent = 'Unable to save in this browser. Export a private backup before leaving this page.';
    return false;
  }
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
  if (Number.isNaN(parsed.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
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
    '/load-test': renderCheck,
    '/sample': renderSample,
    '/creation-record': renderCreationRecord,
    '/method': renderMethod,
    '/research': renderResearch,
    '/examples': renderExamples,
    '/pricing': renderPricing,
    '/copyright': renderCopyright,
    '/faq': renderFAQ,
  };

  const renderer = routes[path] || renderNotFound;
  renderer();
  focusCurrentStep();
}

function setActiveNav(path) {
  const activePath = path === '/check' ? '/load-test' : path;
  document.querySelectorAll('.site-nav a').forEach((link) => {
    const current = link.getAttribute('href') === `#${activePath}`;
    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function homepageCreditsSequence(duplicate = false) {
  return `<div class="credits-sequence"${duplicate ? ' aria-hidden="true"' : ''}>
    <p class="credits-overline">A Work Record for</p>
    <h2${duplicate ? '' : ' id="credits-screen-title"'}>Human + AI Work</h2>
    <div class="credits-entry"><p>Originating idea and purpose</p><strong>Human</strong><span>Identified the problem and decided what the product should accomplish.</span></div>
    <div class="credits-entry"><p>Source material and core method</p><strong>Human</strong><span>Supplied the experience, examples, principles, and method behind the product.</span></div>
    <div class="credits-entry"><p>Product direction and requirements</p><strong>Human</strong><span>Defined the audience, boundaries, features, and changes to keep or reject.</span></div>
    <div class="credits-entry"><p>Research and source checking</p><strong>Human + AI tool</strong><span>The AI tool located and compared sources. The human judged what belonged in the method.</span></div>
    <div class="credits-entry"><p>Writing, editing, and user flow</p><strong>Human + AI tool</strong><span>The AI tool organized and drafted. The human questioned, revised, and decided the final meaning.</span></div>
    <div class="credits-entry"><p>Implementation and production</p><strong>AI tool</strong><span>Wrote and revised code and executed approved publication changes.</span></div>
    <div class="credits-entry"><p>Verification and testing</p><strong>Human + AI tool</strong><span>The AI tool ran automated checks. The human reviewed visible behavior. Independent technical review is not claimed.</span></div>
    <div class="credits-entry"><p>Final release decision</p><strong>Human</strong><span>Approved the documented version and decided it was ready to publish.</span></div>
    <div class="credits-entry credits-evidence"><p>Evidence connected</p><strong>Conversation history · Source material · GitHub history · Live version</strong></div>
    <p class="credits-end">End of example credits</p>
  </div>`;
}

function renderHome() {
  document.title = 'Home | Human + AI Work';
  main.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-kicker">The problem</p>
        <h1>Your credibility is being questioned.</h1>
        <ul class="hero-problem-list">
          <li>An AI checker says the work is not yours.</li>
          <li>“AI helped” becomes “AI did everything.”</li>
          <li>Your contribution disappears.</li>
        </ul>
        <div class="hero-solution">
          <p class="hero-solution-label">The solution</p>
          <h2>Show how the work was made.</h2>
          <p>Create a Work Record showing what the human did, what the AI tool did, and the evidence behind both.</p>
        </div>
        <div class="hero-actions">
          <a class="button" href="#/creation-record">Create my Work Record <span aria-hidden="true">→</span></a>
          <a class="button button-secondary" href="#/sample">See an example</a>
        </div>
        <p class="hero-limit"><strong>Not an AI detector.</strong> It does not scan writing style, assign a human-versus-AI percentage, or rewrite work to bypass detection. It documents the process and links claims to evidence.</p>
        <p class="hero-limit"><strong>Founding Preview:</strong> Use the complete prototype free while the method and product are being tested.</p>
      </div>
      <aside class="credits-screen" aria-labelledby="credits-screen-title">
        <div class="credits-screen-toolbar">
          <span>Example credits for this website</span>
          <button class="credits-motion-toggle" id="credits-motion-toggle" type="button" aria-controls="credits-track">Pause credits</button>
        </div>
        <div class="credits-viewport">
          <div class="credits-track" id="credits-track">
            ${homepageCreditsSequence()}
            ${homepageCreditsSequence(true)}
          </div>
        </div>
        <p class="credits-screen-caption">The Work Record connects each credit to evidence instead of asking the finished page to prove how it was made. <a href="#/sample">View this site’s full Work Record.</a></p>
      </aside>
    </section>

    <section class="section section-compact situations-section">
      <div class="section-heading">
        <div>
          <p class="kicker">The missing middle</p>
          <h2>AI detectors guess from the finished work.</h2>
        </div>
        <p class="lede">A Work Record documents the work behind it, using records of the process instead of a guess about how the final product sounds.</p>
      </div>
      <div class="missing-middle-grid">
        <figure class="kitchen-figure">
          <img src="${homeBakingPhoto}" alt="A woman in a kitchen smiles at a finished chocolate cake beside an open recipe notebook." />
          <figcaption><strong>The finished cake cannot show who developed the recipe, made the choices, corrected mistakes, or decided it was ready.</strong> Finished work cannot either.</figcaption>
        </figure>
        <ul class="situation-list" aria-label="Common situations involving AI">
          <li><span>Question</span><q>This sounds like AI wrote it.</q></li>
          <li><span>Question</span><q>Tell me what AI actually did.</q></li>
          <li><span>Question</span><q>Does this polished work show what the person can really do?</q></li>
          <li><span>Question</span><q>Who checked the AI before this was published?</q></li>
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div><p class="kicker">Two connected tools</p><h2>Document the work. Test the arrangement.</h2></div>
        <p class="lede">The Work Record shows how the work was made. The Load Test checks whether the arrangement can carry it. Use either tool by itself, or connect them.</p>
      </div>
      <div class="grid-2">
        <article class="card"><span class="card-number">01</span><h3>Work Record</h3><p><strong>Who did what?</strong></p><p>Create a dated receipt and set of credits for one finished product. Record what the human did, what each AI system did, who made the final decisions, and what evidence supports the account.</p><a class="button" href="#/creation-record">Create a Work Record</a></article>
        <article class="card"><span class="card-number">02</span><h3>Load Test</h3><p><strong>Can this arrangement carry the work?</strong></p><p>Check whether your current capacity, the role assigned to AI, the workflow and controls, and what is at stake support relying on this arrangement.</p><a class="button button-secondary" href="#/load-test">Run a Load Test</a></article>
      </div>
    </section>

    <section class="section section-compact" aria-labelledby="fluency-capacity-heading">
      <div class="callout">
        <p class="kicker">A different question</p>
        <h2 id="fluency-capacity-heading">Fluency is not the same as capacity.</h2>
        <p><strong>AI fluency helps you work with AI.</strong> A Load Test asks whether this exact arrangement can carry this particular work. It considers what you can currently judge, inspect, change, stop, and sustain.</p>
        <p><a href="#/method">See the difference in the method.</a></p>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div><p class="kicker">What you receive</p><h2>A record people can examine.</h2></div>
        <p class="lede">The record does not collapse a working relationship into one percentage. It preserves the parts that matter.</p>
      </div>
      <div class="grid-3">
        ${featureCard('01', 'Credits', 'Who did what, including the human creator, other people, and each AI system.')}
        ${featureCard('02', 'Claim support', 'What the evidence documents, contradicts, or does not establish.')}
        ${featureCard('03', 'Evidence profile', 'How evidence is connected to the work, preserved, and reviewed.')}
        ${featureCard('04', 'Selected evidence', 'Public, redacted, or privately reviewed records without forcing every conversation into public view.')}
        ${featureCard('05', 'Detailed credits', 'Who handled the originating idea, source material and method, product direction, research, writing, implementation, testing, and release.')}
        ${featureCard('06', 'Short disclosure', 'Clear language that can travel with the finished work.')}
      </div>
      <div class="button-row">
        <a class="button" href="#/creation-record">Create my Work Record</a>
        <a class="button button-secondary" href="#/method">See how it works</a>
      </div>
    </section>

    <section class="section section-compact" aria-labelledby="feedback-heading">
      <div class="callout">
        <p class="kicker">Founding feedback</p>
        <h2 id="feedback-heading">Help improve Human + AI Work.</h2>
        <p>Try the Work Record or Load Test first. Then tell me what helped, what was confusing, or what should change. The form has four short questions.</p>
        <a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Share feedback <span class="new-tab-note">(opens in a new tab)</span></a>
      </div>
    </section>
  `;

  const creditsScreen = document.querySelector('.credits-screen');
  const creditsToggle = document.querySelector('#credits-motion-toggle');
  creditsToggle?.addEventListener('click', () => {
    const paused = creditsScreen.classList.toggle('credits-paused');
    creditsToggle.textContent = paused ? 'Resume credits' : 'Pause credits';
  });
}

function stageCard(number, eyebrow, title, copy, stage, label) {
  return `<article class="card stage-card">
    <span class="card-number">${number}</span>
    <p class="kicker">${eyebrow}</p>
    <h3>${title}</h3>
    <p>${copy}</p>
    <a class="button button-secondary" href="#/load-test" data-start-stage="${stage}">${label}</a>
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
      if (location.hash === '#/load-test' || location.hash === '#/check') renderCheck();
      else location.hash = '#/load-test';
    });
  });
}

function startAssessment(stage) {
  if (assessment.project?.task && !window.confirm('Start a new Load Test? Export the saved project first if you want to keep a separate copy.')) {
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
  document.title = 'Load Test | Human + AI Work';
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
    ? `<div class="callout"><p><strong>You have a saved Load Test in this browser.</strong> ${escapeHTML(assessment.project.task)}</p><button class="text-button" id="resume-check" type="button">Resume where you left off</button></div>`
    : '';

  main.innerHTML = `<div class="page">
    <header class="page-header">
      <p class="eyebrow">Load Test</p>
      <h1>When are you checking the arrangement?</h1>
      <p>Choose before the work starts, before release, or after people begin using it. The questions change with the stage.</p>
    </header>
    ${savedNotice}
    <section aria-labelledby="choose-check-heading">
      <h2 class="sr-only" id="choose-check-heading">Choose when to run the Load Test</h2>
      <div class="grid-3">
        ${stageCard('01', 'Before the work starts', 'Plan Readiness', 'Test whether the proposed arrangement can support the AI role.', 'plan', 'Plan the work')}
        ${stageCard('02', 'Before I publish, send, or launch', 'Launch Support', 'Test what actually happened before you rely on the result.', 'release', 'Test before launch')}
        ${stageCard('03', 'People are already using it', 'Current-Use Support', 'Compare the arrangement with actual results, errors, and consequences.', 'live', 'Review current use')}
      </div>
      <p class="helper-text">A Load Test does not rate you or the model in general. It tests one arrangement for one job.</p>
    </section>
    <section class="section section-compact" aria-labelledby="check-output-heading">
      <div class="section-heading">
        <div><p class="kicker">Your result</p><h2 id="check-output-heading">You will not get only a score.</h2></div>
        <p class="lede">The result shows what role is supported now and what could make the arrangement stronger.</p>
      </div>
      <div class="grid-3">
        ${featureCard('01', 'Supported AI role', 'The highest role and authority the current arrangement supports.')}
        ${featureCard('02', 'Capacity and workflow gaps', 'What you cannot yet judge, inspect, control, stop, or sustain.')}
        ${featureCard('03', 'How to raise support', 'Actions you can take now, within 24 hours, within days, or within weeks, with the possible score effect shown.')}
      </div>
      <p class="helper-text">Some actions raise operational support. Others strengthen the evidence or reduce the AI role so less reliance is required. Planned actions count only after they are completed, recorded, and checked again.</p>
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
  document.title = `${errors.length ? 'Error: ' : ''}Load Test | Human + AI Work`;
  main.innerHTML = `<div class="page">
    <div class="assessment-shell">
      <section class="assessment-main setup-card">
        <div class="progress-row"><span>PROJECT SETUP</span><span>Setup takes about 2 minutes; the full Load Test depends on your project</span></div>
        <div class="progress-track" role="progressbar" aria-label="Load Test progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="8" aria-valuetext="Project setup"><span style="width: 8%"></span></div>
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
            <div class="field field-span-2">
              <label for="failure-scenario">How could this human and AI arrangement fail? <span class="required">Required</span></label>
              <textarea id="failure-scenario" name="failureScenario" required ${errorAttributes(errors, 'failure-scenario')}>${escapeHTML(p.failureScenario || '')}</textarea>
              <small>Name the serious failure, not only that “AI could be wrong.”</small>
              ${fieldError(errors, 'failure-scenario')}
            </div>
            <div class="field field-span-2">
              <label for="failure-impact">If that failure reached another person or system, what could happen? <span class="required">Required</span></label>
              <textarea id="failure-impact" name="failureImpact" required ${errorAttributes(errors, 'failure-impact')}>${escapeHTML(p.failureImpact || '')}</textarea>
              ${fieldError(errors, 'failure-impact')}
            </div>
            <div class="field">
              <label for="consequence">How serious would that impact be? <span class="required">Required</span></label>
              <select id="consequence" name="consequence" required ${errorAttributes(errors, 'consequence')}>
                <option value="">Choose a level</option>
                ${selectOptions([
                  ['low', 'Low, easy to notice and correct'],
                  ['moderate', 'Moderate, real cost, delay, or confusion'],
                  ['high', 'High, serious harm or difficult recovery'],
                  ['critical', 'Critical, safety, rights, major loss, or irreversible harm'],
                ], p.consequence)}
              </select>
              ${fieldError(errors, 'consequence')}
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
              <legend>Which system has the most consequential role in this Load Test?</legend>
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
      <div class="field"><label for="${prefix}-authority">What authority does this system have? <span class="required">Required</span></label><select id="${prefix}-authority" name="systemAuthority" required ${errorAttributes(errors, `${prefix}-authority`)}><option value="">Choose authority</option>${Object.entries(AUTHORITY_LABELS).map(([value, label]) => `<option value="${value}" ${system.proposedAuthority === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('')}</select>${fieldError(errors, `${prefix}-authority`)}</div>
      <div class="field"><label for="${prefix}-access">Can it connect to accounts, files, repositories, data, publishing, or other tools?</label><select id="${prefix}-access" name="systemAccess">${triStateOptions(system.connectedAccess, 'No', 'Yes', 'Unknown')}</select></div>
      <div class="field"><label for="${prefix}-permissions">If it connects, are its permissions known and limited?</label><select id="${prefix}-permissions" name="systemPermissions">${triStateOptions(system.permissionsConfirmed, 'No', 'Yes, confirmed', 'Unknown or not applicable')}</select></div>
      <div class="field field-span-2"><label for="${prefix}-setup">Instructions, memory, tools, data, access, or permissions</label><textarea id="${prefix}-setup" name="systemSetup" placeholder="Describe the setup that could affect how this system behaves">${escapeHTML(system.setup)}</textarea></div>
      <div class="field field-span-2"><label for="${prefix}-evidence">Evidence about this system in this role <span class="helper-text">Optional unless you select Documented below</span></label><textarea id="${prefix}-evidence" name="systemEvidence" placeholder="Model documentation, tests, work samples, or known limits" ${errorAttributes(errors, `${prefix}-evidence`)}>${escapeHTML(system.evidence)}</textarea>${fieldError(errors, `${prefix}-evidence`)}</div>
      <div class="field field-span-2"><label for="${prefix}-evidence-basis">How is this system description supported?</label><select id="${prefix}-evidence-basis" name="systemEvidenceBasis">${selectOptions([
        ['confirmed', 'Documented with a current record or result'],
        ['reported', 'Based on my experience or description'],
        ['unknown', 'Unknown or not yet determined'],
      ], system.evidenceBasis || 'unknown')}</select></div>
    </div>
  </article>`;
}

function selectOptions(options, selected) {
  return options.map(([value, label]) => `<option value="${escapeHTML(value)}" ${selected === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('');
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
    <input type="checkbox" name="${escapeHTML(name)}" value="${escapeHTML(value)}" ${checked ? 'checked' : ''} />
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
  const failureScenario = String(form.get('failureScenario') || '').trim();
  const failureImpact = String(form.get('failureImpact') || '').trim();
  captureSetupDraft(formElement);
  assessment.completed = false;
  saveAssessment();

  const errors = [];
  if (!task) errors.push({ id: 'task', message: 'Describe the work being checked.' });
  if (!intendedOutcome) errors.push({ id: 'outcome', message: 'Describe the outcome you are betting on.' });
  if (!failureScenario) errors.push({ id: 'failure-scenario', message: 'Describe how this human and AI arrangement could seriously fail.' });
  if (!failureImpact) errors.push({ id: 'failure-impact', message: 'Describe what could happen if that failure reached others.' });
  if (!['low', 'moderate', 'high', 'critical'].includes(String(form.get('consequence') || ''))) {
    errors.push({ id: 'consequence', message: 'Choose how serious the impact could be.' });
  }
  if (!workTypes.length) errors.push({ id: 'work-types-group', message: 'Choose at least one kind of work.' });
  if (!requiredBehaviors.length) errors.push({ id: 'behaviors-group', message: 'Choose at least one AI behavior you are counting on.' });
  assessment.project.systems.forEach((system, index) => {
    const prefix = `system-${index}`;
    if (!system.product) errors.push({ id: `${prefix}-product`, message: `Enter the product or tool for system ${index + 1}.` });
    if (!system.model) errors.push({ id: `${prefix}-model`, message: `Enter the model or version for system ${index + 1}, or enter Unknown.` });
    if (!system.role) errors.push({ id: `${prefix}-role`, message: `Describe the workflow role for system ${index + 1}.` });
    if (!Object.hasOwn(AUTHORITY_LABELS, system.proposedAuthority)) errors.push({ id: `${prefix}-authority`, message: `Choose the authority for system ${index + 1}.` });
    if (system.evidenceBasis === 'confirmed' && !system.evidence) {
      errors.push({ id: `${prefix}-evidence`, message: `Add the record supporting the Documented description for system ${index + 1}, or choose Based on my experience.` });
    }
  });
  if (errors.length) return renderSetup(errors);
  const activeIds = new Set(activeQuestions().map(({ id }) => id));
  assessment.answers = Object.fromEntries(Object.entries(assessment.answers).filter(([id]) => activeIds.has(id)));
  saveAssessment();
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
    proposedAuthority: Object.hasOwn(AUTHORITY_LABELS, authorities[index]) ? authorities[index] : '',
    setup: String(setups[index] || '').trim(),
    evidence: String(evidence[index] || '').trim(),
    evidenceBasis: ['confirmed', 'reported', 'unknown'].includes(evidenceBases[index])
      ? evidenceBases[index]
      : 'unknown',
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
    failureScenario: String(form.get('failureScenario') || '').trim(),
    failureImpact: String(form.get('failureImpact') || '').trim(),
    consequence: form.get('consequence'),
    proposedAuthority: primarySystem?.proposedAuthority || form.get('proposedAuthority') || '',
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
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'unknown') return null;
  return '';
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
  document.title = `${errors.length ? 'Error: ' : ''}Load Test | Human + AI Work`;

  main.innerHTML = `<div class="page">
    <div class="assessment-shell">
      <section class="assessment-main question-card">
        <div class="progress-row"><span>${escapeHTML(DIMENSIONS[question.dimension]?.label || question.dimension || 'EVIDENCE')}</span><span>Question ${currentQuestionIndex + 1} of ${questions.length}</span></div>
        <div class="progress-track" role="progressbar" aria-label="Load Test progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-valuetext="Question ${currentQuestionIndex + 1} of ${questions.length}"><span style="width: ${progress}%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${escapeHTML(question.prompt)}</h1>
        <p class="question-why">${escapeHTML(question.why || 'Choose the answer that best describes what is true now, not what you intend to do later.')}</p>
        ${question.trigger?.description ? `<p class="adaptive-question-note"><strong>Why you are seeing this question:</strong> ${escapeHTML(question.trigger.description)}</p>` : ''}
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
    const form = new FormData(document.querySelector('#question-form'));
    const draft = {
      level: form.get('level') === null ? undefined : Number(form.get('level')),
      basis: form.get('basis') || undefined,
      evidenceNote: String(form.get('evidenceNote') || '').trim(),
      evidenceUrl: String(form.get('evidenceUrl') || '').trim(),
    };
    if (draft.level !== undefined || draft.basis || draft.evidenceNote || draft.evidenceUrl) {
      assessment.answers[question.id] = draft;
      saveAssessment();
    }
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
      <div><dt>Serious failure</dt><dd>${escapeHTML(p.failureScenario || 'Not defined yet')}</dd></div>
    </dl>
    <p class="helper-text">Saved on this device when you continue.</p>
  </details>`;
}

function stageLabel(stage) {
  return {
    plan: 'Plan Readiness',
    release: 'Launch Support',
    live: 'Current-Use Support',
  }[stage] || 'Load Test';
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
        <div class="progress-row"><span>LOAD TEST REVIEW</span><span>Review before your result</span></div>
        <div class="progress-track" role="progressbar" aria-label="Load Test progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="94" aria-valuetext="Final review before result"><span style="width: 94%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${assessment.stage === 'plan' ? 'Confirm the planned boundaries.' : assessment.stage === 'release' ? 'Confirm the launch boundaries.' : 'Confirm the current operating boundaries.'}</h1>
        <p class="question-why">Some gaps limit the supported role even when other answers are strong. That includes unknown access, missing approval, or a serious problem that has not been fixed.</p>
        ${error ? `<p class="inline-error" role="alert" tabindex="-1">${escapeHTML(error)}</p>` : ''}
        <form id="review-form">
          <div class="field-grid">
            ${systemReviewFields(p.systems)}
            <div class="field" id="approval-field" ${needsApproval ? '' : 'hidden'}>
              <label for="humanApproval">Does a human approve the work before it creates an external consequence?</label>
              <select id="humanApproval" name="humanApprovalBeforeConsequence" required>${triStateOptions(p.humanApprovalBeforeConsequence, 'No', 'Yes, confirmed', 'I cannot determine')}</select>
            </div>
            <div class="field" id="reversible-field" ${needsReversibility ? '' : 'hidden'}>
              <label for="reversible">Can consequential actions be reversed or rolled back?</label>
              <select id="reversible" name="actionsAreReversible" required>${triStateOptions(p.actionsAreReversible, 'No', 'Yes, confirmed', 'I cannot determine')}</select>
            </div>
            <div class="field">
              <label for="sensitiveData">Will the system receive confidential, regulated, personal, or otherwise sensitive information?</label>
              <select id="sensitiveData" name="sensitiveData" required>${triStateOptions(p.sensitiveData, 'No', 'Yes', 'I cannot determine')}</select>
            </div>
            <div class="field" id="data-authorization-field" ${p.sensitiveData === false ? 'hidden' : ''}>
              <label for="dataAuthorization">If sensitive data is involved, is its use explicitly authorized?</label>
              <select id="dataAuthorization" name="dataAuthorizationConfirmed" required>${triStateOptions(p.dataAuthorizationConfirmed, 'No', 'Yes, confirmed', 'I cannot determine')}</select>
            </div>
            <div class="field" id="monitoring-field" ${needsMonitoring ? '' : 'hidden'}>
              <label for="monitoring">If the system acts repeatedly or independently, can the activity be seen and stopped?</label>
              <select id="monitoring" name="monitoringConfirmed" required>${triStateOptions(p.monitoringConfirmed, 'No', 'Yes, confirmed', 'I cannot determine')}</select>
            </div>
            <div class="field">
              <label for="failure">Is there a known material failure that remains unresolved?</label>
              <select id="failure" name="unresolvedMaterialFailure" required>${triStateOptions(p.unresolvedMaterialFailure, 'No', 'Yes', 'I cannot determine')}</select>
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
    <select id="review-system-access-${index}" name="reviewSystemAccess" required>${triStateOptions(system.connectedAccess, 'No', 'Yes', 'I cannot determine')}</select>
    <label for="review-system-permissions-${index}">Are its permissions known and limited to this role?</label>
    <select id="review-system-permissions-${index}" name="reviewSystemPermissions" required>${triStateOptions(system.permissionsConfirmed, 'No', 'Yes, confirmed', 'I cannot determine or not applicable')}</select>
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
    ['', 'Choose an answer'],
    ['false', noLabel],
    ['true', yesLabel],
    ['unknown', unknownLabel],
  ], selected === true ? 'true' : selected === false ? 'false' : selected === null ? 'unknown' : '');
}

function liveEvidenceFields(p) {
  return `<fieldset class="fieldset" style="margin-top: 1.5rem">
    <legend>What has been observed?</legend>
    <div class="field-grid">
      <div class="field"><label for="observedRuns">Completed end-to-end runs</label><input id="observedRuns" name="observedRuns" type="number" min="0" max="999" value="${p.observedRuns === '' || p.observedRuns === undefined ? '' : Number(p.observedRuns)}" required /></div>
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
  const value = selected === true ? 'true' : selected === false ? 'false' : selected === null ? 'unknown' : '';
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}" required>${selectOptions([['', 'Choose an answer'], ['unknown', 'I cannot determine'], ['false', 'No'], ['true', 'Yes']], value)}</select></div>`;
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
  document.title = `${p.name || stageLabel(assessment.stage)} Load Test Result | Human + AI Work`;
  const primarySystem = p.systems.find((system) => system.id === p.primarySystemId) || p.systems[0];
  const dimensionLabels = Object.fromEntries(Object.entries(DIMENSIONS).map(([key, value]) => [key, value.label]));
  const authorization = result.authorization || {};
  const gates = result.gates || [];
  const recommendations = result.recommendations || [];
  const scoreRaiser = [...recommendations]
    .filter((item) => Number(item.scoreEffect?.projectedChange || 0) > 0)
    .sort((a, b) => Number(b.scoreEffect?.projectedChange || 0) - Number(a.scoreEffect?.projectedChange || 0))[0];
  const roleBoundary = recommendations.find((item) => item.category === 'role_adjustment');
  const evidenceRaiser = recommendations.find((item) => item.category === 'evidence');
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
      <p>This result asks whether this exact arrangement supports the role you are giving ${escapeHTML(primarySystem?.product || 'the AI system')}, in relation to your current capacity.</p>
    </header>

    <section class="project-context card" aria-labelledby="result-context-heading">
      <div class="section-heading-compact"><p class="kicker">Your recorded arrangement</p><h2 id="result-context-heading">What did this Load Test cover?</h2></div>
      <dl class="context-list">
        ${contextItem('Work', p.task || 'Not recorded')}
        ${contextItem('Person assessed', 'You, plus any capable reviewer actually included in the recorded workflow')}
        ${contextItem('AI system and model', primarySystem ? systemSummary(primarySystem) : 'Not recorded')}
        ${contextItem('AI job in the workflow', primarySystem?.role || 'Not recorded')}
        ${contextItem('Requested AI authority', AUTHORITY_LABELS[primarySystem?.proposedAuthority || p.proposedAuthority] || 'Not recorded')}
        ${contextItem('Outcome wager', p.intendedOutcome || 'Not recorded')}
        ${contextItem('Serious failure', p.failureScenario || 'Not recorded')}
        ${contextItem('Possible impact', p.failureImpact || 'Not recorded')}
        ${contextItem('Impact level', consequenceLabel)}
        ${contextItem('Load Test completed', `${formatDate(date)} using method ${METHOD_VERSION}`)}
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
      <div class="quick-result-actions" aria-labelledby="quick-actions-heading">
        <h3 id="quick-actions-heading">Three ways the result can change</h3>
        <div class="grid-3">
          <article class="card"><p class="kicker">Raise operational support</p><p>${scoreRaiser ? escapeHTML(scoreRaiser.action) : 'No additional score-raising action was generated from the current answers.'}</p>${scoreRaiser ? `<p><strong>If completed and confirmed:</strong> up to ${scoreRaiser.scoreEffect.projectedScore} (+${scoreRaiser.scoreEffect.projectedChange}).</p>` : ''}</article>
          <article class="card"><p class="kicker">Reduce the reliance required</p><p>${escapeHTML(roleBoundary?.action || 'Keep the AI inside the highest role currently supported and do not expand its authority without another Load Test.')}</p><p class="helper-text">This changes the boundary, not the score.</p></article>
          <article class="card"><p class="kicker">Strengthen the evidence</p><p>${escapeHTML(evidenceRaiser?.action || 'Preserve the tests, decisions, approvals, and outcome records that support this arrangement.')}</p><p class="helper-text">This can strengthen Evidence Strength without changing operational performance.</p></article>
        </div>
      </div>
      <p class="result-next-link"><a href="#raise-score">See what could raise this score or reduce the reliance required <span aria-hidden="true">↓</span></a></p>
    </section>

    <section class="decision-grid" aria-label="Current work boundary">
      ${decisionColumn('Supported in this workflow', 'supported', authorization.delegate || defaultDelegate(result), 'Functions the current arrangement can support within the stated boundary.')}
      ${decisionColumn('Needs capable review', 'verify', authorization.verify || defaultVerify(), 'Checks that require you or a named person with the needed knowledge, access, authority, and time.')}
      ${decisionColumn('Not supported yet', 'blocked', authorization.doNotAuthorize || gates.map(gateText), 'Functions the current capacity, evidence, controls, or workflow cannot support yet.')}
    </section>

    <details class="result-disclosure">
      <summary>See the score breakdown and evidence limits</summary>
      <div class="score-explanation">
        <p>The operational score needed for the stakes and role selected is ${result.requiredScore}/100. Evidence Strength is reported separately and may limit how strong a conclusion the Load Test can support.</p>
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
        ${listHTML(authorization.relyOn || ['Only outputs reviewed under the conditions recorded in this Load Test.'])}
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
      <div class="result-disclosure-body"><p>The model matters in the role it was given.</p><div class="grid-2">${p.systems.map((system) => `<article class="card"><h3>${escapeHTML(system.product || 'Unnamed system')} ${system.model ? `<span class="helper-text">${escapeHTML(system.model)}</span>` : ''}</h3><p>${escapeHTML(system.role || 'Role not described')}</p><p><strong>Assessment scope:</strong> ${system.id === p.primarySystemId ? 'Detailed performance questions answered for this role' : 'Recorded for workflow context only; run a separate Load Test to assess this role'}</p><p><strong>Requested authority:</strong> ${escapeHTML(AUTHORITY_LABELS[system.proposedAuthority] || system.proposedAuthority)}</p><p><strong>Access and permissions:</strong> ${system.connectedAccess === false ? 'No connected access reported' : system.permissionsConfirmed === true ? 'Connected access reported, permissions confirmed as limited' : 'Connected access or permission limits are not fully confirmed'}</p>${result.limitingSystemIds?.includes(system.id) ? '<span class="stamp stamp-warning">Limits this result</span>' : ''}</article>`).join('')}</div>
      ${p.systems.length > 1 ? '<p class="helper-text">This Load Test asks the detailed performance questions about the system marked most consequential. Run a separate Load Test for another consequential role when needed.</p>' : ''}</div>
    </details>

    ${gates.length ? `<section style="margin-top: 3rem"><p class="kicker">Problems to fix first</p><h2>These limits override the average score.</h2><ul class="gate-list">${gates.map((gate) => `<li><strong>${escapeHTML(gate.title || gate.id?.replaceAll('_', ' ') || 'Use limit')}</strong><br />${escapeHTML(gateText(gate))}</li>`).join('')}</ul></section>` : `<div class="callout" style="margin-top: 2rem"><p><strong>Your answers did not trigger a stop condition.</strong> The score and named limits still apply.</p></div>`}

    <section id="raise-score" style="margin-top: 4rem" tabindex="-1">
      <p class="kicker">Make this setup stronger</p>
      <h2>What could raise this score?</h2>
      <p class="lede">Each action shows its possible effect. Some actions can raise operational support. Others strengthen the evidence, remove a blocker, add capable human help, or reduce the AI role so less reliance is required.</p>
      <p>Planning an action changes nothing. Complete it, record what happened, and run the Load Test again before the score or Evidence Strength changes.</p>
      <div class="action-timeline">
        ${timeBlock('Now', recommendations.filter((item) => item.timing === 'now'))}
        ${timeBlock('Within 24 hours', recommendations.filter((item) => item.timing === 'within24h'))}
        ${timeBlock('Within days', recommendations.filter((item) => item.timing === 'days'))}
        ${timeBlock('Within weeks', recommendations.filter((item) => item.timing === 'weeks'))}
      </div>
    </section>

    <section class="reliance-card" id="reliance-card">
      <h1 class="print-only">Human + AI Load Test result</h1>
      <div class="reliance-card-header">
        <div><p class="kicker">Load Test | Self-assessed</p><h2>${escapeHTML(p.name || 'Untitled project')}</h2><p>${escapeHTML(p.task)}</p></div>
        <div class="reliance-card-score">${result.publicScore}/100 | ${escapeHTML(result.decisionStatus?.label || result.band)}</div>
      </div>
      <div class="grid-2" style="margin-top: 1.3rem">
        <div><p class="meta-label">Arrangement</p><p><strong>AI systems and roles:</strong> ${p.systems.map((system) => escapeHTML(systemSummary(system))).join('<br />')}</p><p><strong>Outcome wager:</strong> ${escapeHTML(p.intendedOutcome)}</p></div>
        <div><p class="meta-label">Current boundary</p><p><strong>Highest AI authority supported by evidence:</strong> ${escapeHTML(AUTHORITY_LABELS[result.conclusionAuthority] || result.conclusionAuthority)}</p><p><strong>Evidence Strength:</strong> ${escapeHTML(evidenceStrength.label)}<br /><strong>Real-use testing:</strong> ${escapeHTML(result.validationStatus)}</p></div>
      </div>
      <p class="helper-text">Dated ${formatDate(date)} | Method ${escapeHTML(METHOD_VERSION)} | This result applies only to the person, systems, roles, workflow, evidence, and stakes recorded here. It is not a certification or guarantee.</p>
    </section>

    <div class="result-actions no-print">
      <button class="button" type="button" id="print-result">Print Load Test</button>
      <button class="button button-secondary" type="button" id="export-result">Export Load Test</button>
      <a class="button button-secondary" href="#/creation-record" id="start-record-from-result">Create a Work Record</a>
      <a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Share feedback <span class="new-tab-note">(opens in a new tab)</span></a>
      <button class="button button-danger" type="button" id="new-check">Start a new Load Test</button>
    </div>
  </div>`;

  document.querySelector('#print-result').addEventListener('click', () => printMode('printing-result'));
  document.querySelector('#export-result').addEventListener('click', () => {
    downloadJSON(`${slug(p.name || 'human-ai-load-test')}.json`, {
      kind: 'human-ai-work-check-assessment',
      schemaVersion: ASSESSMENT_SCHEMA_VERSION,
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
    if (window.confirm('Start a new Load Test? Export this project first if you want to keep a separate copy.')) {
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
    creationRecord.systems = assessment.project.systems.map((system) => ({
      id: makeId('system'),
      product: system.product,
      model: system.model,
      role: system.role,
      setup: system.setup,
      evidence: system.evidence,
      evidenceBasis: system.evidenceBasis || 'reported',
      modelHistory: 'unknown',
    }));
    creationRecord.outcome = {
      intended: assessment.project.intendedOutcome || '',
      failureScenario: assessment.project.failureScenario || '',
      failureImpact: assessment.project.failureImpact || '',
      severity: assessment.project.consequence || '',
    };
    creationRecord.readiness = {
      workCheckId: assessment.id,
      stage: assessment.stage,
      decision: assessment.completed ? scoreAssessment(assessment).decisionStatus?.label || '' : '',
      checkedAt: assessment.completedAt || '',
    };
    saveCreationRecord();
  } else {
    creationRecord.projectId = assessment.id;
    creationRecord.readiness = {
      ...(creationRecord.readiness || {}),
      workCheckId: assessment.id,
      stage: assessment.stage,
      decision: assessment.completed ? scoreAssessment(assessment).decisionStatus?.label || '' : creationRecord.readiness?.decision || '',
      checkedAt: assessment.completedAt || creationRecord.readiness?.checkedAt || '',
    };
    saveCreationRecord();
  }
  recordStep = 1;
  saveRecordStep();
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
    ? 'A model change earns no increase by itself. Any improvement depends on the new model passing the same comparison tests.'
    : projectedChange > 0
      ? `If completed and confirmed: up to ${item.scoreEffect.projectedScore} (+${projectedChange}). This is an illustrative maximum, not a promised increase.`
      : item.scoreEffect?.condition || 'No increase until this is completed and supported by evidence.';
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
      showToast('That file is not a valid Load Test project.');
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
    : '';
  project.proposedAuthority = Object.hasOwn(AUTHORITY_LABELS, project.proposedAuthority)
    ? project.proposedAuthority
    : '';

  const answers = Object.fromEntries(Object.entries(imported.answers).filter(([id, answer]) => {
    return typeof id === 'string' && answer && typeof answer === 'object';
  }));

  const isLegacy = imported.schemaVersion !== ASSESSMENT_SCHEMA_VERSION || imported.methodVersion !== METHOD_VERSION;
  return {
    ...fallback,
    ...imported,
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
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
  document.title = 'Real Work Record | Human + AI Work';
  main.innerHTML = `<div class="page sample-record-page">
    <header class="page-header">
      <p class="eyebrow">Real Work Record</p>
      <h1>How this website was made.</h1>
      <p>This record shows where Cheryl Abram led the work, where ChatGPT contributed, what evidence exists, and what has not been established.</p>
      <p class="stage-label"><strong>Status:</strong> Public prototype, unfinished</p>
    </header>
    <article class="record-preview public-record">
      <header class="public-record-header"><p class="kicker">Human + AI Work Record · Public prototype v0.3</p><h2>Human + AI Work website and methods</h2><p class="record-summary">Here are the credits and evidence for this version.</p><p>A public website that documents human and AI contributions and optionally checks whether a consequential AI role is supported by the person’s capacity, workflow, evidence, and stakes.</p></header>
      <section class="record-output-section"><h3>Artifact documented</h3><dl class="record-facts"><div><dt>Status</dt><dd>Public prototype, unfinished</dd></div><div><dt>Version</dt><dd>v0.3 provenance-first revision</dd></div><div><dt>Creator</dt><dd>Cheryl Abram</dd></div><div><dt>Other human contributors</dt><dd>None reported</dd></div></dl><p><a href="https://ypifany.github.io/ai-reliance-check/" target="_blank" rel="noreferrer">Open the public website <span class="new-tab-note">(opens in a new tab)</span></a></p></section>
      <section class="record-output-section"><h3>Credits</h3>
        <h4>People and systems involved</h4>
        <div class="credit-row"><strong>Cheryl Abram</strong><span> (creator and final authority)</span><p>Originated the product, supplied the method and experience behind it, directed the work, evaluated alternatives, rewrote public language, reviewed the live site, and made the final release decisions.</p></div>
        <div class="credit-row"><strong>ChatGPT</strong><p>Organized and challenged the method, compared alternatives, checked outside information, drafted and revised wording, proposed user flow, wrote and modified code, ran automated tests, identified problems, and executed approved publication changes.</p></div>
        <p class="helper-text"><strong>Known model:</strong> ChatGPT 5.6 Sol Ultra. The complete model history has not been verified.</p>
        <h4>Detailed credits</h4>
        <ul class="mini-record-list credit-role-list">
          <li><span><strong>Originating idea and purpose</strong><small>Identified the problem and decided what the product should accomplish.</small></span><strong>Cheryl Abram</strong></li>
          <li><span><strong>Source material and core method</strong><small>Supplied experience, examples, principles, and the developing method.</small></span><strong>Cheryl Abram</strong></li>
          <li><span><strong>Product direction and requirements</strong><small>Defined the audience, boundaries, features, and final decisions.</small></span><strong>Cheryl Abram</strong></li>
          <li><span><strong>Research and source checking</strong><small>Located and compared outside material; the human judged what belonged in the method.</small></span><strong>Cheryl Abram + ChatGPT</strong></li>
          <li><span><strong>Evaluation, challenge, and selection</strong><small>ChatGPT challenged selected ideas. Cheryl accepted, rejected, or redirected the work.</small></span><strong>Cheryl Abram + ChatGPT</strong></li>
          <li><span><strong>Writing, editing, and final meaning</strong><small>ChatGPT organized and drafted. Cheryl revised and decided the final public meaning.</small></span><strong>Cheryl Abram + ChatGPT</strong></li>
          <li><span><strong>Implementation and production</strong><small>Wrote and revised the website code and carried out approved publication changes.</small></span><strong>ChatGPT</strong></li>
          <li><span><strong>Verification and testing</strong><small>ChatGPT ran automated checks. Cheryl reviewed visible behavior. No independent technical review is claimed.</small></span><strong>Cheryl Abram + ChatGPT</strong></li>
          <li><span><strong>Final release decision</strong><small>Approved the documented version for publication.</small></span><strong>Cheryl Abram</strong></li>
        </ul>
      </section>
      <section class="record-output-section"><h3>What the record supports</h3><ul class="claim-support-list"><li><span>Cheryl Abram originated and developed the method.</span><strong class="status-pill">Documented</strong></li><li><span>Cheryl Abram can direct and evaluate AI-assisted work.</span><strong class="status-pill">Documented</strong></li><li><span>Cheryl Abram made the final decisions about the public product.</span><strong class="status-pill">Documented</strong></li></ul></section>
      <section class="record-output-section"><h3>What is not established</h3><ul><li>Cheryl personally wrote the website source code.</li><li>Cheryl independently evaluated the technical architecture.</li><li>The method has been scientifically validated.</li><li>The site is production-grade or independently confirmed as accessibility-conformant.</li></ul></section>
      <section class="record-output-section"><h3>Selected evidence</h3><ul><li>ChatGPT conversation history from the original idea through development. Detailed excerpts remain private.</li><li><a href="https://github.com/Ypifany/ai-reliance-check" target="_blank" rel="noreferrer">GitHub repository, commits, and pull requests <span class="new-tab-note">(opens in a new tab)</span></a></li><li>Source documents, examples, screenshots, review notes, and approval decisions preserved in the working history.</li><li>The live site and its version history.</li></ul></section>
      <section class="record-output-section"><h3>Evidence profile</h3><dl class="record-facts"><div><dt>Claim support</dt><dd>Key claims documented</dd></div><div><dt>Evidence integrity</dt><dd>Partly version-linked</dd></div><div><dt>Review status</dt><dd>Self-reviewed</dd></div><div><dt>Independent code review</dt><dd>Not completed</dd></div></dl></section>
      <section class="record-output-section"><h3>Final release decision</h3><p>Cheryl Abram evaluated, revised, and approved publication. ChatGPT executed approved publication changes.</p></section>
      <section class="record-output-section disclosure-box"><h3>Short disclosure</h3><p><strong>Human + AI disclosure:</strong> Cheryl Abram originated and directed this work. ChatGPT assisted with research, organization, challenge, public wording, user flow, code, testing, and publishing approved changes. Cheryl reviewed the documented version and made the final release decision.</p></section>
      <footer class="public-record-footer"><p>The Work Record creates a dated account of human origination, contribution, judgment, decisions, and AI involvement, and it can connect evidence to a specific artifact version. It supports an authorship claim and makes that claim examinable.</p><p>This record is self-reported and remains open to correction as additional evidence is classified.</p></footer>
    </article>
    <div class="button-row"><a class="button" href="#/creation-record">Create your Work Record</a><a class="button button-secondary" href="#/load-test">Run a Load Test</a></div>
  </div>`;
}

function contextItem(term, description) {
  return `<div><dt>${escapeHTML(term)}</dt><dd>${escapeHTML(description)}</dd></div>`;
}

function resultFact(term, description) {
  return `<div><dt>${escapeHTML(term)}</dt><dd>${escapeHTML(description)}</dd></div>`;
}

function creditHandlingLabel(value) {
  return ({
    'Human-led': 'Human-led',
    Shared: 'Human + AI',
    'AI-reviewed': 'AI produced, human materially revised',
    'AI-accepted': 'AI produced, human accepted',
    'Other-person': 'Other human contributor',
    Unknown: 'Not established',
    'Not applicable': 'Not applicable',
  })[value] || 'Not established';
}

function renderCreationRecord(focusId = '', errors = []) {
  if (recordStep > RECORD_STEPS.length) return renderWorkRecordResult();
  recordStep = Math.min(Math.max(Number(recordStep) || 1, 1), RECORD_STEPS.length);
  saveRecordStep();
  document.title = 'Create a Work Record | Human + AI Work';
  const normalizedErrors = normalizeFormErrors(errors);
  const [stepId, stepLabel] = RECORD_STEPS[recordStep - 1];
  main.innerHTML = `<div class="page work-record-page">
    <header class="page-header record-page-header">
      <p class="eyebrow">Create a Work Record</p>
      <h1>Show how this work was made.</h1>
      <p>Document one finished or near-finished artifact. Name the people and AI systems involved, connect important claims to evidence, and create credits that can travel with the work.</p>
    </header>
    <div class="callout"><p><strong>This record does not estimate a human-versus-AI percentage.</strong> It shows roles, actions, decisions, and evidence.</p></div>
    ${creationRecord.legacyNotes ? `<div class="callout callout-warning"><p><strong>Review information carried forward from an earlier record.</strong><br />${escapeHTML(creationRecord.legacyNotes).replaceAll('\n', '<br />')}</p></div>` : ''}
    ${recordStepper(recordStep)}
    <section class="record-step-card" aria-labelledby="record-step-heading">
      <div class="progress-row"><span>STEP ${recordStep} OF ${RECORD_STEPS.length}</span><span>${escapeHTML(stepLabel)}</span></div>
      <div class="progress-track" role="progressbar" aria-label="Work Record progress" aria-valuemin="1" aria-valuemax="${RECORD_STEPS.length}" aria-valuenow="${recordStep}" aria-valuetext="Step ${recordStep} of ${RECORD_STEPS.length}: ${escapeHTML(stepLabel)}"><span style="width:${Math.round((recordStep / RECORD_STEPS.length) * 100)}%"></span></div>
      <p id="record-save-status" class="save-status" role="status" aria-live="polite">Changes are saved in this browser.</p>
      ${renderErrorSummary(normalizedErrors)}
      <form id="work-record-form" data-record-step="${stepId}" novalidate>
        ${renderWorkRecordStep(stepId, creationRecord, normalizedErrors)}
        <div class="form-actions no-print">
          ${recordStep > 1 ? '<button class="button button-secondary" type="button" id="record-back">Back</button>' : '<a class="button button-secondary" href="#/">Cancel</a>'}
          <button class="button" type="submit">${recordStep === RECORD_STEPS.length ? 'Generate Work Record' : 'Continue'} <span aria-hidden="true">→</span></button>
        </div>
      </form>
    </section>
    ${recordStep === 1 ? `<div class="record-utility-row no-print"><button class="text-button" type="button" id="import-record-trigger">Import a saved Work Record</button><input id="import-work-record" type="file" accept="application/json" hidden /><button class="text-button" type="button" id="new-work-record">Start a new record</button></div>` : ''}
  </div>`;

  const form = document.querySelector('#work-record-form');
  form.addEventListener('input', () => {
    captureWorkRecordStep(new FormData(form), stepId);
    saveCreationRecord();
    if (stepId === 'review') {
      const preview = document.querySelector('.record-review-preview');
      if (preview) preview.innerHTML = `<h3 id="review-preview-heading">Public preview</h3>${workRecordPreview(toPublicWorkRecord(creationRecord))}`;
    }
  });
  form.addEventListener('change', (event) => {
    captureWorkRecordStep(new FormData(form), stepId);
    saveCreationRecord();
    if (['aiUse', 'contributorStatus', 'reviewStatus'].includes(event.target?.name)) {
      renderCreationRecord(event.target?.id || '');
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    captureWorkRecordStep(new FormData(form), stepId);
    saveCreationRecord();
    const stepErrors = validateWorkRecordStep(stepId, creationRecord);
    if (stepErrors.length) return renderCreationRecord('', stepErrors);
    if (recordStep === RECORD_STEPS.length) {
      const firstInvalidStep = RECORD_STEPS
        .map(([id], index) => ({ index, errors: validateWorkRecordStep(id, creationRecord) }))
        .find(({ errors: validationErrors }) => validationErrors.length);
      if (firstInvalidStep) {
        recordStep = firstInvalidStep.index + 1;
        saveRecordStep();
        return renderCreationRecord('', firstInvalidStep.errors);
      }
      const completeness = getWorkRecordCompleteness(creationRecord);
      if (!completeness.complete) {
        recordStep = 1;
        saveRecordStep();
        return renderCreationRecord('', completeness.missing.map((item) => ({ id: 'record-step-heading', message: item })));
      }
      recordStep = RECORD_STEPS.length + 1;
      saveRecordStep();
      return renderWorkRecordResult();
    }
    recordStep += 1;
    renderCreationRecord();
  });
  document.querySelector('#record-back')?.addEventListener('click', () => {
    captureWorkRecordStep(new FormData(form), stepId);
    saveCreationRecord();
    recordStep = Math.max(1, recordStep - 1);
    renderCreationRecord();
  });
  bindWorkRecordDynamicActions(form, stepId);
  bindErrorSummaryLinks();
  document.querySelector('#import-record-trigger')?.addEventListener('click', () => document.querySelector('#import-work-record').click());
  document.querySelector('#import-work-record')?.addEventListener('change', importWorkRecord);
  document.querySelector('#new-work-record')?.addEventListener('click', () => {
    if (!hasWorkRecordContent(creationRecord) || window.confirm('Start a new Work Record? Export a private backup first if you want to keep this one.')) {
      creationRecord = makeCreationRecord();
      recordStep = 1;
      saveCreationRecord();
      renderCreationRecord('record-title');
    }
  });
  if (focusId) window.requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  else focusCurrentStep();
}

function recordStepper(activeStep) {
  return `<nav class="record-stepper" aria-label="Work Record steps"><ol>${RECORD_STEPS.map(([, label], index) => {
    const step = index + 1;
    const current = step === activeStep ? ' aria-current="step"' : '';
    return `<li${current}><button type="button" data-record-step-jump="${step}" ${step > activeStep ? 'disabled' : ''}><span>${step}</span>${escapeHTML(label)}</button></li>`;
  }).join('')}</ol></nav>`;
}

function renderWorkRecordStep(stepId, record, errors) {
  return {
    work: renderRecordWorkStep,
    claims: renderRecordClaimsStep,
    credits: renderRecordCreditsStep,
    evidence: renderRecordEvidenceStep,
    handling: renderRecordHandlingStep,
    review: renderRecordReviewStep,
  }[stepId](record, errors);
}

function renderRecordWorkStep(record, errors) {
  const publicStatus = !['in-progress', 'private'].includes(record.status);
  return `<div class="record-step-intro"><p class="eyebrow">Step 1</p><h2 id="record-step-heading">Identify the work and its exact version.</h2><p>One Work Record should describe one artifact version. If the work changes materially, update the version or create a new record.</p></div>
    <div class="field-grid">
      <div class="field field-span-2"><label for="record-title">Work or project title <span class="required">Required</span></label><input id="record-title" name="title" value="${escapeHTML(record.title)}" required ${errorAttributes(errors, 'record-title')} />${fieldError(errors, 'record-title')}</div>
      <div class="field field-span-2"><label for="record-description">What is the work, and what is it meant to do?</label><textarea id="record-description" name="description">${escapeHTML(record.description)}</textarea></div>
      <div class="field"><label for="record-status">Current status</label><select id="record-status" name="status">${selectOptions(WORK_RECORD_STATUS_OPTIONS, record.status)}</select></div>
      <div class="field"><label for="artifact-date">Artifact or release date <span class="helper-text">Optional</span></label><input id="artifact-date" name="artifactDate" type="date" value="${escapeHTML(record.artifact?.date || '')}" /></div>
      <div class="field field-span-2"><label for="artifact-url">Link to the exact work being documented${publicStatus ? ' <span class="required">Required for this status</span>' : ''}</label><input id="artifact-url" name="artifactUrl" type="url" value="${escapeHTML(record.artifact?.url || '')}" placeholder="https://" ${publicStatus ? 'required' : ''} ${errorAttributes(errors, 'artifact-url')} /><small>A version-specific link is stronger than a homepage that changes over time.</small>${fieldError(errors, 'artifact-url')}</div>
      <div class="field field-span-2"><label for="artifact-version">Exact version being documented${publicStatus && !record.artifact?.date ? ' <span class="required">Required unless a release date is provided</span>' : ''}</label><input id="artifact-version" name="artifactVersion" value="${escapeHTML(record.artifact?.version || '')}" placeholder="Release date, file name, version number, Git commit, or other identifier" ${errorAttributes(errors, 'artifact-version')} />${fieldError(errors, 'artifact-version')}</div>
    </div>
    <fieldset class="fieldset"><legend>Does the final work need to sound recognizably like you?</legend><div class="choice-grid">
      ${radioChoice('voiceRequired', 'yes', 'Yes', 'My voice is part of what this work should demonstrate.', record.voiceRequired)}
      ${radioChoice('voiceRequired', 'partly', 'Partly', 'Some parts should sound like me; other parts only need to be clear or functional.', record.voiceRequired)}
      ${radioChoice('voiceRequired', 'no', 'No', 'Clarity or function matters more than my recognizable voice.', record.voiceRequired)}
      ${radioChoice('voiceRequired', 'not-applicable', 'Not applicable', 'This artifact is not meant to have a personal voice.', record.voiceRequired)}
      ${radioChoice('voiceRequired', 'unknown', 'Not sure yet', 'Leave this visible as unanswered in the record.', record.voiceRequired)}
    </div></fieldset>
    <fieldset class="fieldset"><legend>Is this work being used to show what you know or can do?</legend><div class="choice-grid choice-grid-compact">
      ${radioChoice('capabilityDemonstration', 'yes', 'Yes', 'The artifact is intended to demonstrate my capability.', record.capabilityDemonstration)}
      ${radioChoice('capabilityDemonstration', 'partly', 'Partly', 'It demonstrates some, but not all, of my capability.', record.capabilityDemonstration)}
      ${radioChoice('capabilityDemonstration', 'no', 'No', 'The artifact only needs to achieve its purpose.', record.capabilityDemonstration)}
      ${radioChoice('capabilityDemonstration', 'unknown', 'Not sure yet', 'Leave this visible as unanswered in the record.', record.capabilityDemonstration)}
    </div></fieldset>`;
}

function renderRecordClaimsStep(record, errors = []) {
  const selectedIds = new Set(record.claims.map(({ id }) => id));
  const customClaim = record.claims.find(({ id }) => id === 'claim-other');
  return `<div class="record-step-intro"><p class="eyebrow">Step 2</p><h2 id="record-step-heading">What should this record support?</h2><p>Select only the claims you want the evidence to demonstrate. Each claim will be rated separately.</p></div>
    <fieldset class="fieldset" id="claim-selection-group" ${groupErrorAttributes(errors, 'claim-selection-group')}><legend>Claims about your work <span class="required">Choose at least one</span></legend><div class="choice-grid">
      ${CLAIM_PRESETS.map(([id, , statement]) => checkboxChoice('recordClaim', id, statement, '', selectedIds.has(id))).join('')}
    </div>${fieldError(errors, 'claim-selection-group')}</fieldset>
    <div class="field"><label for="custom-claim">Another claim <span class="helper-text">Optional</span></label><textarea id="custom-claim" name="customClaim" placeholder="Write one specific claim that evidence could support or fail to establish.">${escapeHTML(customClaim?.statement || '')}</textarea></div>
    <div class="callout callout-warning"><p><strong>Be precise.</strong> “I directed and evaluated the AI-assisted work” is different from “I personally wrote every line of code.” The record should support only what the evidence can show.</p></div>`;
}

function renderRecordCreditsStep(record, errors = []) {
  const showContributors = record.contributorStatus === 'listed';
  const showAI = ['yes', 'uncertain'].includes(record.aiUse);
  const systems = record.systems.length ? record.systems : [{
    id: makeId('system'), product: '', model: '', role: '', setup: '', evidenceBasis: 'unknown', modelHistory: 'unknown',
  }];
  return `<div class="record-step-intro"><p class="eyebrow">Step 3</p><h2 id="record-step-heading">Give the credits.</h2><p>Name what you did, what other people did, and what each AI system did. Credit actions, not percentages.</p></div>
    <div class="field-grid">
      <div class="field"><label for="creator-name">Your name <span class="required">Required</span></label><input id="creator-name" name="creatorName" value="${escapeHTML(record.creator?.name || '')}" required ${errorAttributes(errors, 'creator-name')} />${fieldError(errors, 'creator-name')}</div>
      <div class="field"><label for="creator-role">Your role</label><input id="creator-role" name="creatorRole" value="${escapeHTML(record.creator?.role || '')}" placeholder="Creator, author, project owner, designer..." /></div>
      <div class="field field-span-2"><label for="idea-source">First documented source of the main idea</label><textarea id="idea-source" name="ideaSource" placeholder="Notes, client request, dated conversation, earlier draft, AI suggestion, or unknown">${escapeHTML(record.ideaSource)}</textarea></div>
      <div class="field field-span-2"><label for="human-actions">What did you materially do? <span class="required">Required</span></label><textarea id="human-actions" name="humanActions" placeholder="Describe the ideas, context, direction, evaluation, rejection, revision, checking, and decisions you contributed." required ${errorAttributes(errors, 'human-actions')}>${escapeHTML(record.humanActions)}</textarea>${fieldError(errors, 'human-actions')}</div>
      <div class="field"><label for="contributor-status">Did any other person materially contribute? <span class="required">Required</span></label><select id="contributor-status" name="contributorStatus" required ${errorAttributes(errors, 'contributor-status')}>${selectOptions([
        ['unknown', 'I have not answered yet'], ['none', 'No other human materially contributed'], ['listed', 'Yes, list the contributors below'],
      ], record.contributorStatus)}</select>${fieldError(errors, 'contributor-status')}</div>
    </div>
    ${showContributors ? `<fieldset class="fieldset record-repeat-group" id="record-contributors-group" ${groupErrorAttributes(errors, 'record-contributors-group')}><legend>Other human contributors <span class="required">Required</span></legend><div class="record-contributor-list">${record.contributors.map((item, index) => recordContributorEditor(item, index, errors)).join('')}</div>${fieldError(errors, 'record-contributors-group')}<button class="button button-secondary" type="button" id="add-record-contributor">Add another person</button></fieldset>` : ''}
    <fieldset class="fieldset systems-fieldset" id="ai-use-group" ${groupErrorAttributes(errors, 'ai-use-group')}><legend>Was AI used in the documented workflow? <span class="required">Required</span></legend><div class="choice-grid choice-grid-compact">${AI_USE_OPTIONS.map(([value, label]) => radioChoice('aiUse', value, label, '', record.aiUse)).join('')}</div>${fieldError(errors, 'ai-use-group')}</fieldset>
    ${showAI ? `<div class="field"><label for="ai-contributions">What did AI materially contribute? <span class="required">Required</span></label><textarea id="ai-contributions" name="aiContributions" placeholder="Organized notes, compared alternatives, drafted language, wrote code, tested behavior, published approved changes..." required ${errorAttributes(errors, 'ai-contributions')}>${escapeHTML(record.aiContributions)}</textarea>${fieldError(errors, 'ai-contributions')}</div>
      <div class="field"><label for="model-history">Do you know the complete model history for this work?</label><select id="model-history" name="modelHistoryCompleteness">${selectOptions([
        ['complete', 'Yes, all material models are identified'], ['incomplete', 'No, at least one model is missing or uncertain'], ['unknown', 'I do not know whether the history is complete'],
      ], record.modelHistoryCompleteness)}</select></div>
      <fieldset class="fieldset record-repeat-group" id="record-systems-group" ${groupErrorAttributes(errors, 'record-systems-group')}><legend>AI systems and roles <span class="required">Required</span></legend><div class="record-system-list">${systems.map((system, index) => recordSystemEditorV03(system, index, systems.length, errors)).join('')}</div>${fieldError(errors, 'record-systems-group')}<button class="button button-secondary" type="button" id="add-record-system-v03">Add another AI system</button></fieldset>` : ''}`;
}

function renderRecordEvidenceStep(record, errors = []) {
  const evidenceRequired = !['in-progress', 'private'].includes(record.status);
  return `<div class="record-step-intro"><p class="eyebrow">Step 4</p><h2 id="record-step-heading">Connect claims to evidence.</h2><p>Evidence may stay private. Positive public findings use evidence you mark public. Redacted evidence is shown as withheld without exposing its details.</p></div>
    <div class="field"><label for="public-evidence-level">How much supporting evidence should appear in the public Work Record?</label><select id="public-evidence-level" name="publicEvidenceLevel">${selectOptions([
      ['selected', 'Detailed summary with selected evidence links'], ['full', 'Full public evidence'], ['summary', 'Summary only, no evidence items'], ['private', 'Evidence remains private or reviewer-only'],
    ], record.publicEvidenceLevel)}</select></div>
    <div class="callout"><p><strong>Privacy first:</strong> New evidence starts as private. A public export never includes private URLs or notes. Redacted evidence appears only as a placeholder.</p></div>
    <div class="record-evidence-list" id="record-evidence-list" role="group" aria-label="${evidenceRequired ? 'Evidence items, required for this status' : 'Evidence items'}" ${groupErrorAttributes(errors, 'record-evidence-list')}>${record.evidence.map((item, index) => recordEvidenceEditor(item, index, record.claims)).join('')}</div>
    ${fieldError(errors, 'record-evidence-list')}
    <button class="button button-secondary" type="button" id="add-record-evidence">Add evidence</button>`;
}

function renderRecordHandlingStep(record, errors = []) {
  return `<div class="record-step-intro"><p class="eyebrow">Step 5</p><h2 id="record-step-heading">Create the detailed credits.</h2><p>For each part of the work, record who led it and how AI output was handled. “AI produced it, then I reviewed and changed it” is different from accepting AI output without material change.</p></div>
    <div class="contribution-card-list" id="contribution-map" role="group" aria-label="Contribution handling, choose at least one" ${groupErrorAttributes(errors, 'contribution-map')}>${CONTRIBUTIONS.map(([key, label]) => `<div class="contribution-card"><label for="contribution-${key}">${escapeHTML(label)}</label><select id="contribution-${key}" name="contribution:${key}" aria-label="How was ${escapeHTML(label)} handled?">${selectOptions(CONTRIBUTION_OPTIONS, record.contributions[key])}</select></div>`).join('')}</div>${fieldError(errors, 'contribution-map')}`;
}

function renderRecordReviewStep(record, errors = []) {
  const publicRecord = toPublicWorkRecord(record);
  const independent = record.review?.status === 'independently-checked';
  const releaseDecisionRequired = !['in-progress', 'private'].includes(record.status);
  return `<div class="record-step-intro"><p class="eyebrow">Step 6</p><h2 id="record-step-heading">Review the record and name the release decision.</h2><p>The person below decided that this exact version could be published, submitted, sent, or launched. This is not asking who clicked the publish button.</p></div>
    <fieldset class="fieldset"><legend>Who made the final decision to share this version?</legend><div class="field-grid">
      <div class="field"><label for="final-name">Name${releaseDecisionRequired ? ' <span class="required">Required</span>' : ''}</label><input id="final-name" name="finalDecisionName" value="${escapeHTML(record.finalDecision?.name || '')}" ${releaseDecisionRequired ? 'required' : ''} ${errorAttributes(errors, 'final-name')} />${fieldError(errors, 'final-name')}</div>
      <div class="field"><label for="final-role">Role${releaseDecisionRequired ? ' <span class="required">Required</span>' : ''}</label><input id="final-role" name="finalDecisionRole" value="${escapeHTML(record.finalDecision?.role || '')}" ${releaseDecisionRequired ? 'required' : ''} ${errorAttributes(errors, 'final-role')} />${fieldError(errors, 'final-role')}</div>
      <div class="field"><label for="final-date">Decision date${releaseDecisionRequired ? ' <span class="required">Required</span>' : ''}</label><input id="final-date" name="finalDecisionDate" type="date" value="${escapeHTML(record.finalDecision?.date || '')}" ${releaseDecisionRequired ? 'required' : ''} ${errorAttributes(errors, 'final-date')} />${fieldError(errors, 'final-date')}</div>
    </div></fieldset>
    <details class="optional-review" ${independent ? 'open' : ''}><summary>Independent evidence review <span class="helper-text">Optional</span></summary>
      <div class="field"><label for="review-status">Review status</label><select id="review-status" name="reviewStatus">${selectOptions([['self-reviewed', 'Self-reviewed'], ['independently-checked', 'Independently checked']], record.review?.status || 'self-reviewed')}</select></div>
      ${independent ? `<div class="field-grid">
        <div class="field"><label for="reviewer-name-v03">Reviewer name <span class="required">Required</span></label><input id="reviewer-name-v03" name="reviewerName" value="${escapeHTML(record.review?.reviewerName || '')}" required ${errorAttributes(errors, 'reviewer-name-v03')} />${fieldError(errors, 'reviewer-name-v03')}</div>
        <div class="field"><label for="reviewer-role-v03">Reviewer role <span class="required">Required</span></label><input id="reviewer-role-v03" name="reviewerRole" value="${escapeHTML(record.review?.reviewerRole || '')}" required ${errorAttributes(errors, 'reviewer-role-v03')} />${fieldError(errors, 'reviewer-role-v03')}</div>
        <div class="field field-span-2"><label for="reviewer-scope-v03">Records examined, scope, findings, and limits <span class="required">Required</span></label><textarea id="reviewer-scope-v03" name="reviewerScope" required ${errorAttributes(errors, 'reviewer-scope-v03')}>${escapeHTML(record.review?.scope || '')}</textarea>${fieldError(errors, 'reviewer-scope-v03')}</div>
        <div class="field"><label for="reviewer-date-v03">Review date <span class="required">Required</span></label><input id="reviewer-date-v03" name="reviewerDate" type="date" value="${escapeHTML(record.review?.date || '')}" required ${errorAttributes(errors, 'reviewer-date-v03')} />${fieldError(errors, 'reviewer-date-v03')}</div>
        <div class="field"><label for="review-visibility">Reviewer details in public record</label><select id="review-visibility" name="reviewVisibility">${selectOptions(EVIDENCE_VISIBILITY_OPTIONS, record.review?.visibility || 'private')}</select></div>
      </div>
      <fieldset class="fieldset" id="review-claims-group" ${groupErrorAttributes(errors, 'review-claims-group')}><legend>Which claims did the reviewer examine? <span class="required">Required</span></legend><label class="choice"><input type="checkbox" name="reviewAllClaims" value="true" ${record.review?.allClaims ? 'checked' : ''} /><span><strong>All selected claims</strong></span></label><div class="choice-grid">${record.claims.map((claim) => checkboxChoice('reviewClaimId', claim.id, claim.statement, '', record.review?.claimIds?.includes(claim.id))).join('')}</div>${fieldError(errors, 'review-claims-group')}</fieldset>` : ''}
    </details>
    <section class="record-review-preview" aria-labelledby="review-preview-heading"><h3 id="review-preview-heading">Public preview</h3>${workRecordPreview(publicRecord, { draft: !getWorkRecordCompleteness(record).publicReady })}</section>`;
}

function radioChoice(name, value, label, description, selected) {
  const id = `${slug(name)}-${slug(value)}`;
  return `<label class="choice" for="${escapeHTML(id)}"><input id="${escapeHTML(id)}" type="radio" name="${escapeHTML(name)}" value="${escapeHTML(value)}" ${selected === value ? 'checked' : ''} /><span><strong>${escapeHTML(label)}</strong>${description ? `<span>${escapeHTML(description)}</span>` : ''}</span></label>`;
}

function recordContributorEditor(item, index, errors = []) {
  return `<article class="system-editor">
    <div class="system-editor-heading"><h3>Person ${index + 1}</h3><button class="text-button" type="button" data-remove-record-contributor="${escapeHTML(item.id)}">Remove</button></div>
    <input type="hidden" name="contributorId" value="${escapeHTML(item.id)}" />
    <div class="field-grid">
      <div class="field"><label for="contributor-name-${index}">Name <span class="required">Required</span></label><input id="contributor-name-${index}" name="contributorName" value="${escapeHTML(item.name)}" required ${errorAttributes(errors, `contributor-name-${index}`)} />${fieldError(errors, `contributor-name-${index}`)}</div>
      <div class="field"><label for="contributor-role-${index}">Role</label><input id="contributor-role-${index}" name="contributorRole" value="${escapeHTML(item.role)}" /></div>
      <div class="field field-span-2"><label for="contributor-credit-${index}">What did this person materially contribute? <span class="required">Required</span></label><textarea id="contributor-credit-${index}" name="contributorContribution" required ${errorAttributes(errors, `contributor-credit-${index}`)}>${escapeHTML(item.contribution)}</textarea>${fieldError(errors, `contributor-credit-${index}`)}</div>
      <div class="field"><label for="contributor-visibility-${index}">Public visibility</label><select id="contributor-visibility-${index}" name="contributorVisibility">${selectOptions(EVIDENCE_VISIBILITY_OPTIONS, item.visibility || 'private')}</select></div>
    </div>
  </article>`;
}

function recordSystemEditorV03(system, index, count, errors = []) {
  return `<article class="system-editor">
    <div class="system-editor-heading"><h3>AI system ${index + 1}</h3>${count > 1 ? `<button class="text-button" type="button" data-remove-record-system-v03="${escapeHTML(system.id)}">Remove</button>` : ''}</div>
    <input type="hidden" name="recordSystemId" value="${escapeHTML(system.id)}" />
    <div class="field-grid">
      <div class="field"><label for="record-system-product-v03-${index}">AI product or tool <span class="required">Required</span></label><input id="record-system-product-v03-${index}" name="recordSystemProduct" value="${escapeHTML(system.product)}" placeholder="For example, ChatGPT" required ${errorAttributes(errors, `record-system-product-v03-${index}`)} />${fieldError(errors, `record-system-product-v03-${index}`)}</div>
      <div class="field"><label for="record-system-model-v03-${index}">Exact model or version <span class="required">Required</span></label><input id="record-system-model-v03-${index}" name="recordSystemModel" value="${escapeHTML(system.model)}" placeholder="Enter Unknown if it was not shown" required ${errorAttributes(errors, `record-system-model-v03-${index}`)} />${fieldError(errors, `record-system-model-v03-${index}`)}</div>
      <div class="field field-span-2"><label for="record-system-setup-v03-${index}">How was it configured or guided?</label><textarea id="record-system-setup-v03-${index}" name="recordSystemSetup" placeholder="Prompts, custom instructions, memory, tools, source files, or permissions">${escapeHTML(system.setup || '')}</textarea></div>
      <div class="field field-span-2"><label for="record-system-role-v03-${index}">What did this system materially do? <span class="required">Required</span></label><textarea id="record-system-role-v03-${index}" name="recordSystemRole" required ${errorAttributes(errors, `record-system-role-v03-${index}`)}>${escapeHTML(system.role)}</textarea>${fieldError(errors, `record-system-role-v03-${index}`)}</div>
      <div class="field"><label for="record-system-basis-v03-${index}">Basis for this description</label><select id="record-system-basis-v03-${index}" name="recordSystemEvidenceBasis">${selectOptions([['unknown', 'Choose an answer'], ['confirmed', 'Documented'], ['reported', 'Reported from experience']], system.evidenceBasis || 'unknown')}</select></div>
    </div>
  </article>`;
}

function recordEvidenceEditor(item, index, claims) {
  return `<article class="evidence-editor">
    <div class="system-editor-heading"><h3>Evidence ${index + 1}</h3><button class="text-button" type="button" data-remove-record-evidence="${escapeHTML(item.id)}">Remove</button></div>
    <input type="hidden" name="evidenceId" value="${escapeHTML(item.id)}" />
    <div class="field-grid">
      <div class="field"><label for="evidence-label-${index}">Type of record</label><select id="evidence-label-${index}" name="evidenceLabel">${selectOptions(EVIDENCE_TYPES, item.label)}</select></div>
      <div class="field"><label for="evidence-date-${index}">Date</label><input id="evidence-date-${index}" name="evidenceDate" type="date" value="${escapeHTML(item.date || '')}" /></div>
      <div class="field field-span-2"><label for="evidence-description-${index}">Description or private reference</label><textarea id="evidence-description-${index}" name="evidenceDescription" placeholder="What is this record, and what does it show?">${escapeHTML(item.description || '')}</textarea></div>
      <div class="field field-span-2"><label for="evidence-url-${index}">Link <span class="helper-text">Optional</span></label><input id="evidence-url-${index}" name="evidenceUrl" type="url" value="${escapeHTML(item.url || '')}" placeholder="https://" /></div>
      <div class="field"><label for="evidence-version-${index}">Version, commit, release, or identifier</label><input id="evidence-version-${index}" name="evidenceVersion" value="${escapeHTML(item.version || '')}" /></div>
      <div class="field"><label for="evidence-visibility-${index}">Visibility</label><select id="evidence-visibility-${index}" name="evidenceVisibility">${selectOptions(EVIDENCE_VISIBILITY_OPTIONS, item.visibility || 'private')}</select></div>
      <div class="field"><label for="evidence-integrity-${index}">Connection to the documented version</label><select id="evidence-integrity-${index}" name="evidenceIntegrity">${selectOptions(EVIDENCE_INTEGRITY_OPTIONS, item.integrity || 'unlinked')}</select><small>Use “tamper-evident” only when a signature, credential, verified digest, or comparable mechanism protects the record.</small></div>
      <div class="field"><label for="evidence-relationship-${index}">Relationship to the claim</label><select id="evidence-relationship-${index}" name="evidenceRelationship">${selectOptions(EVIDENCE_RELATIONSHIP_OPTIONS, item.relationship || 'unknown')}</select></div>
    </div>
    <fieldset class="fieldset"><legend>Which claim does this evidence address?</legend><div class="choice-grid">${claims.length ? claims.map((claim) => checkboxChoice(`evidenceClaim:${item.id}`, claim.id, claim.statement, '', item.claimIds?.includes(claim.id))).join('') : '<p class="helper-text">Return to Step 2 and select at least one claim.</p>'}</div></fieldset>
  </article>`;
}

function captureWorkRecordStep(form, stepId) {
  if (stepId === 'work') {
    creationRecord.title = String(form.get('title') || '').trim();
    creationRecord.description = String(form.get('description') || '').trim();
    creationRecord.status = String(form.get('status') || 'in-progress');
    creationRecord.artifact = {
      url: safeHttpUrl(form.get('artifactUrl')),
      version: String(form.get('artifactVersion') || '').trim(),
      date: String(form.get('artifactDate') || '').trim(),
    };
    creationRecord.voiceRequired = String(form.get('voiceRequired') || 'unknown');
    creationRecord.capabilityDemonstration = String(form.get('capabilityDemonstration') || 'unknown');
  }
  if (stepId === 'claims') {
    const prior = new Map(creationRecord.claims.map((claim) => [claim.id, claim]));
    const selected = new Set(form.getAll('recordClaim').map(String));
    const claims = CLAIM_PRESETS.filter(([id]) => selected.has(id)).map(([id, category, statement]) => ({
      id, category, statement, evidenceIds: prior.get(id)?.evidenceIds || [], support: prior.get(id)?.support || 'auto',
    }));
    const custom = String(form.get('customClaim') || '').trim();
    if (custom) claims.push({ id: 'claim-other', category: 'other', statement: custom, evidenceIds: prior.get('claim-other')?.evidenceIds || [], support: prior.get('claim-other')?.support || 'auto' });
    creationRecord.claims = claims;
    const claimIds = new Set(claims.map(({ id }) => id));
    creationRecord.evidence = creationRecord.evidence.map((item) => ({ ...item, claimIds: (item.claimIds || []).filter((id) => claimIds.has(id)) }));
  }
  if (stepId === 'credits') {
    creationRecord.creator = {
      name: String(form.get('creatorName') || '').trim(),
      role: String(form.get('creatorRole') || '').trim(),
    };
    creationRecord.ideaSource = String(form.get('ideaSource') || '').trim();
    creationRecord.humanActions = String(form.get('humanActions') || '').trim();
    creationRecord.contributorStatus = String(form.get('contributorStatus') || 'unknown');
    const contributorIds = form.getAll('contributorId');
    const contributorNames = form.getAll('contributorName');
    const contributorRoles = form.getAll('contributorRole');
    const contributorContributions = form.getAll('contributorContribution');
    const contributorVisibility = form.getAll('contributorVisibility');
    creationRecord.contributors = creationRecord.contributorStatus === 'listed' ? contributorIds.map((id, index) => ({
      id: String(id),
      name: String(contributorNames[index] || '').trim(),
      role: String(contributorRoles[index] || '').trim(),
      contribution: String(contributorContributions[index] || '').trim(),
      visibility: String(contributorVisibility[index] || 'private'),
    })).filter(({ name, role, contribution }) => name || role || contribution) : [];
    creationRecord.aiUse = String(form.get('aiUse') || 'unknown');
    creationRecord.aiContributions = creationRecord.aiUse === 'no-ai-reported' ? '' : String(form.get('aiContributions') || '').trim();
    creationRecord.modelHistoryCompleteness = creationRecord.aiUse === 'no-ai-reported' ? 'complete' : String(form.get('modelHistoryCompleteness') || 'unknown');
    if (creationRecord.aiUse === 'no-ai-reported') creationRecord.systems = [];
    else {
      const ids = form.getAll('recordSystemId');
      const products = form.getAll('recordSystemProduct');
      const models = form.getAll('recordSystemModel');
      const setups = form.getAll('recordSystemSetup');
      const roles = form.getAll('recordSystemRole');
      const bases = form.getAll('recordSystemEvidenceBasis');
      creationRecord.systems = ids.map((id, index) => ({
        id: String(id), product: String(products[index] || '').trim(), model: String(models[index] || '').trim(),
        setup: String(setups[index] || '').trim(), role: String(roles[index] || '').trim(),
        evidenceBasis: String(bases[index] || 'unknown'), modelHistory: 'unknown',
      })).filter(({ product, model, role, setup }) => product || model || role || setup);
    }
  }
  if (stepId === 'evidence') {
    creationRecord.publicEvidenceLevel = String(form.get('publicEvidenceLevel') || 'selected');
    const ids = form.getAll('evidenceId');
    const labels = form.getAll('evidenceLabel');
    const descriptions = form.getAll('evidenceDescription');
    const urls = form.getAll('evidenceUrl');
    const versions = form.getAll('evidenceVersion');
    const dates = form.getAll('evidenceDate');
    const visibility = form.getAll('evidenceVisibility');
    const integrity = form.getAll('evidenceIntegrity');
    const relationships = form.getAll('evidenceRelationship');
    creationRecord.evidence = ids.map((id, index) => ({
      id: String(id), label: String(labels[index] || 'Other supporting record'), description: String(descriptions[index] || '').trim(),
      url: safeHttpUrl(urls[index]), version: String(versions[index] || '').trim(), date: String(dates[index] || '').trim(),
      visibility: String(visibility[index] || 'private'), integrity: String(integrity[index] || 'unlinked'),
      relationship: String(relationships[index] || 'unknown'), claimIds: form.getAll(`evidenceClaim:${id}`).map(String),
    }));
    creationRecord.claims = creationRecord.claims.map((claim) => ({
      ...claim,
      evidenceIds: creationRecord.evidence.filter((item) => item.claimIds.includes(claim.id)).map(({ id }) => id),
    }));
  }
  if (stepId === 'handling') {
    CONTRIBUTIONS.forEach(([key]) => { creationRecord.contributions[key] = String(form.get(`contribution:${key}`) || 'Unknown'); });
  }
  if (stepId === 'review') {
    creationRecord.finalDecision = {
      name: String(form.get('finalDecisionName') || '').trim(),
      role: String(form.get('finalDecisionRole') || '').trim(),
      date: String(form.get('finalDecisionDate') || '').trim(),
    };
    const reviewStatus = String(form.get('reviewStatus') || 'self-reviewed');
    creationRecord.review = {
      ...(creationRecord.review || {}),
      status: reviewStatus,
      reviewerName: reviewStatus === 'independently-checked' ? String(form.get('reviewerName') || '').trim() : '',
      reviewerRole: reviewStatus === 'independently-checked' ? String(form.get('reviewerRole') || '').trim() : '',
      scope: reviewStatus === 'independently-checked' ? String(form.get('reviewerScope') || '').trim() : '',
      date: reviewStatus === 'independently-checked' ? String(form.get('reviewerDate') || '').trim() : '',
      visibility: String(form.get('reviewVisibility') || 'private'),
      allClaims: form.get('reviewAllClaims') === 'true',
      claimIds: form.getAll('reviewClaimId').map(String),
    };
  }
}

function validateWorkRecordStep(stepId, record) {
  const errors = [];
  if (stepId === 'work') {
    if (!record.title) errors.push({ id: 'record-title', message: 'Enter a title for the work.' });
    if (!['in-progress', 'private'].includes(record.status)) {
      if (!record.artifact?.url) errors.push({ id: 'artifact-url', message: 'Add a link to the exact work for this public or ready-to-share status.' });
      if (!record.artifact?.version && !record.artifact?.date) errors.push({ id: 'artifact-version', message: 'Identify the artifact version, commit, release, file, or release date.' });
    }
  }
  if (stepId === 'claims' && !record.claims.length) errors.push({ id: 'claim-selection-group', message: 'Choose or write at least one claim for this record.' });
  if (stepId === 'credits') {
    if (!record.creator?.name) errors.push({ id: 'creator-name', message: 'Enter your name for the credits.' });
    if (!record.humanActions) errors.push({ id: 'human-actions', message: 'Describe what you materially did.' });
    if (record.contributorStatus === 'unknown') errors.push({ id: 'contributor-status', message: 'Say whether another person materially contributed.' });
    if (record.contributorStatus === 'listed') {
      if (!record.contributors.length) errors.push({ id: 'record-contributors-group', message: 'Add at least one other person and describe the contribution.' });
      record.contributors.forEach((contributor, index) => {
        if (!contributor.name) errors.push({ id: `contributor-name-${index}`, message: `Enter a name for person ${index + 1}.` });
        if (!contributor.contribution) errors.push({ id: `contributor-credit-${index}`, message: `Describe what person ${index + 1} materially contributed.` });
      });
    }
    if (record.aiUse === 'unknown') errors.push({ id: 'ai-use-group', message: 'Say whether AI was used in the documented workflow.' });
    if (['yes', 'uncertain'].includes(record.aiUse)) {
      if (!record.aiContributions) errors.push({ id: 'ai-contributions', message: 'Describe what AI materially contributed.' });
      if (!record.systems.length) errors.push({ id: 'record-systems-group', message: 'Add at least one AI system and describe what it did.' });
      record.systems.forEach((system, index) => {
        if (!system.product) errors.push({ id: `record-system-product-v03-${index}`, message: `Enter the AI product or tool for system ${index + 1}.` });
        if (!system.model) errors.push({ id: `record-system-model-v03-${index}`, message: `Enter the model or “Unknown” for system ${index + 1}.` });
        if (!system.role) errors.push({ id: `record-system-role-v03-${index}`, message: `Describe what AI system ${index + 1} materially did.` });
      });
    }
  }
  if (stepId === 'evidence' && !['in-progress', 'private'].includes(record.status)) {
    const substantive = record.evidence.find((item) => (item.url || item.description || item.version) && item.claimIds?.length && item.relationship !== 'unknown');
    if (!substantive) errors.push({ id: 'record-evidence-list', message: 'Add a description, link, or version; identify its relationship; and connect it to a claim.' });
  }
  if (stepId === 'handling' && !Object.values(record.contributions).some((value) => !['Unknown', 'Not applicable'].includes(value))) errors.push({ id: 'contribution-map', message: 'Record how at least one part of the work was handled.' });
  if (stepId === 'review' && record.review?.status === 'independently-checked') {
    if (!record.review.reviewerName) errors.push({ id: 'reviewer-name-v03', message: 'Enter the independent reviewer’s name.' });
    if (!record.review.reviewerRole) errors.push({ id: 'reviewer-role-v03', message: 'Enter the independent reviewer’s role.' });
    if (!record.review.scope) errors.push({ id: 'reviewer-scope-v03', message: 'Describe the records examined, scope, findings, and limits.' });
    if (!record.review.date) errors.push({ id: 'reviewer-date-v03', message: 'Enter the independent review date.' });
    if (!(record.review.allClaims || record.review.claimIds?.length)) errors.push({ id: 'review-claims-group', message: 'Identify which claims the independent reviewer examined.' });
  }
  if (stepId === 'review' && !['in-progress', 'private'].includes(record.status)) {
    if (!record.finalDecision?.name) errors.push({ id: 'final-name', message: 'Enter who made the final decision to share this version.' });
    if (!record.finalDecision?.role) errors.push({ id: 'final-role', message: 'Enter that person’s role.' });
    if (!record.finalDecision?.date) errors.push({ id: 'final-date', message: 'Enter the decision date.' });
  }
  return errors;
}

function bindWorkRecordDynamicActions(form, stepId) {
  document.querySelectorAll('[data-record-step-jump]').forEach((button) => {
    button.addEventListener('click', () => {
      captureWorkRecordStep(new FormData(form), stepId);
      saveCreationRecord();
      recordStep = Number(button.dataset.recordStepJump);
      renderCreationRecord();
    });
  });
  document.querySelector('#add-record-contributor')?.addEventListener('click', () => {
    captureWorkRecordStep(new FormData(form), stepId);
    creationRecord.contributors.push({ id: makeId('contributor'), name: '', role: '', contribution: '', visibility: 'private' });
    saveCreationRecord();
    renderCreationRecord(`contributor-name-${creationRecord.contributors.length - 1}`);
  });
  document.querySelectorAll('[data-remove-record-contributor]').forEach((button) => {
    button.addEventListener('click', () => {
      captureWorkRecordStep(new FormData(form), stepId);
      const item = creationRecord.contributors.find(({ id }) => id === button.dataset.removeRecordContributor);
      if (item && (item.name || item.role || item.contribution) && !window.confirm('Remove this contributor from the record?')) return;
      creationRecord.contributors = creationRecord.contributors.filter(({ id }) => id !== button.dataset.removeRecordContributor);
      saveCreationRecord();
      renderCreationRecord('add-record-contributor');
    });
  });
  document.querySelector('#add-record-system-v03')?.addEventListener('click', () => {
    captureWorkRecordStep(new FormData(form), stepId);
    creationRecord.systems.push({ id: makeId('system'), product: '', model: '', role: '', setup: '', evidenceBasis: 'unknown', modelHistory: 'unknown' });
    saveCreationRecord();
    renderCreationRecord(`record-system-product-v03-${creationRecord.systems.length - 1}`);
  });
  document.querySelectorAll('[data-remove-record-system-v03]').forEach((button) => {
    button.addEventListener('click', () => {
      captureWorkRecordStep(new FormData(form), stepId);
      const item = creationRecord.systems.find(({ id }) => id === button.dataset.removeRecordSystemV03);
      if (item && (item.product || item.model || item.role || item.setup || item.evidence) && !window.confirm('Remove this AI system and its role from the record?')) return;
      creationRecord.systems = creationRecord.systems.filter(({ id }) => id !== button.dataset.removeRecordSystemV03);
      saveCreationRecord();
      renderCreationRecord('add-record-system-v03');
    });
  });
  document.querySelector('#add-record-evidence')?.addEventListener('click', () => {
    captureWorkRecordStep(new FormData(form), stepId);
    creationRecord.evidence.push({
      id: makeId('evidence'), label: 'AI conversation or export', description: '', url: '', version: '', date: '',
      visibility: 'private', integrity: 'unlinked', relationship: 'unknown', claimIds: [],
    });
    saveCreationRecord();
    renderCreationRecord(`evidence-label-${creationRecord.evidence.length - 1}`);
  });
  document.querySelectorAll('[data-remove-record-evidence]').forEach((button) => {
    button.addEventListener('click', () => {
      captureWorkRecordStep(new FormData(form), stepId);
      const item = creationRecord.evidence.find(({ id }) => id === button.dataset.removeRecordEvidence);
      if (item && (item.description || item.url || item.version || item.date || item.claimIds?.length || item.relationship !== 'unknown') && !window.confirm('Remove this evidence item and its claim links?')) return;
      creationRecord.evidence = creationRecord.evidence.filter(({ id }) => id !== button.dataset.removeRecordEvidence);
      creationRecord.claims = creationRecord.claims.map((claim) => ({ ...claim, evidenceIds: claim.evidenceIds.filter((id) => id !== button.dataset.removeRecordEvidence) }));
      saveCreationRecord();
      renderCreationRecord('add-record-evidence');
    });
  });
}

function renderWorkRecordResult() {
  document.title = `${creationRecord.title || 'Work Record'} | Human + AI Work`;
  const publicRecord = toPublicWorkRecord(creationRecord);
  const completeness = getWorkRecordCompleteness(creationRecord);
  main.innerHTML = `<div class="page work-record-result-page">
    <header class="page-header">
      <p class="eyebrow">Work Record created</p>
      <h1>Your credits and evidence are ready to review.</h1>
      <p>This public view includes only information marked public or redacted. Keep the private backup if you may need the complete record later.</p>
    </header>
    ${completeness.publicReady ? '' : `<div class="callout callout-warning"><p><strong>This is a complete private draft, not a public-ready record.</strong> To make it public-ready, add: ${escapeHTML((completeness.publicMissing || completeness.missing).join(' · '))}.</p></div>`}
    <article class="record-preview public-record" id="public-work-record">${workRecordPreview(publicRecord, { draft: !completeness.publicReady })}</article>
    <div class="result-actions no-print">
      <button class="button" type="button" id="print-record-v03">${completeness.publicReady ? 'Print or save as PDF' : 'Print draft'}</button>
      <button class="button button-secondary" type="button" id="download-public-record">${completeness.publicReady ? 'Download public record' : 'Download draft record'}</button>
      <button class="button button-secondary" type="button" id="export-private-record">Export private backup</button>
      <button class="button button-secondary" type="button" id="copy-disclosure-v03">Copy short disclosure</button>
      <a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Share feedback <span class="new-tab-note">(opens in a new tab)</span></a>
      <button class="text-button" type="button" id="edit-work-record">Edit record</button>
    </div>
    <section class="optional-next-step card">
      <p class="eyebrow">Optional next step</p>
      <h2>Did this work depend on AI being right or acting correctly?</h2>
      <p>Run a Load Test if AI influenced a consequential decision, handled work you could not fully judge, used tools or permissions, published or deployed anything, or could affect another person if wrong.</p>
      <a class="button button-secondary" id="work-check-from-record" href="#/load-test">Run a Load Test for this project</a>
    </section>
  </div>`;
  document.querySelector('#print-record-v03').addEventListener('click', () => printMode('printing-record-v03'));
  document.querySelector('#download-public-record').addEventListener('click', () => downloadPublicWorkRecord(publicRecord, !completeness.publicReady));
  document.querySelector('#export-private-record').addEventListener('click', () => {
    if (!window.confirm('This private backup may contain private evidence, conversation links, and notes. Save it only where you intend to keep that information.')) return;
    downloadJSON(`${slug(creationRecord.title || 'work-record')}-private-backup.json`, {
      kind: 'human-ai-work-record-private-backup', schemaVersion: WORK_RECORD_SCHEMA_VERSION, exportedAt: new Date().toISOString(), record: creationRecord,
    });
  });
  document.querySelector('#copy-disclosure-v03').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(buildDisclosure(creationRecord));
      showToast('Short disclosure copied.');
    } catch {
      showToast('Copy was unavailable. Select the disclosure in the record instead.');
    }
  });
  document.querySelector('#edit-work-record').addEventListener('click', () => {
    recordStep = RECORD_STEPS.length;
    renderCreationRecord();
  });
  document.querySelector('#work-check-from-record').addEventListener('click', (event) => {
    if (!prefillWorkCheckFromRecord()) event.preventDefault();
  });
  focusCurrentStep();
}

function workRecordPreview(recordInput, options = {}) {
  const evidenceSummary = recordInput?.evidenceSummary || { private: 0 };
  const record = normalizeWorkRecord(recordInput);
  const credits = buildCredits(record, { publicOnly: true });
  const integrity = getEvidenceIntegrity(record, { publicOnly: true });
  const review = getReviewStatus(record);
  const statusLabel = WORK_RECORD_STATUS_OPTIONS.find(([value]) => value === record.status)?.[1] || record.status;
  const voiceLabel = ({ yes: 'Yes', partly: 'Partly', no: 'No, clarity or function matters more', 'not-applicable': 'Not applicable', unknown: 'Not answered' })[record.voiceRequired] || 'Not answered';
  const capabilityLabel = ({ yes: 'Yes', partly: 'Partly', no: 'No', mixed: 'Mixed', unknown: 'Not answered' })[record.capabilityDemonstration] || 'Not answered';
  const claimRows = record.claims.map((claim) => ({ claim, support: getClaimSupport(record, claim.id, { publicOnly: true }) }));
  const limitations = workRecordLimitations(record, claimRows, integrity, review);
  const finalDecision = [record.finalDecision?.name, record.finalDecision?.role, record.finalDecision?.date].filter(Boolean).join(' | ');
  const title = escapeHTML(record.title || 'Untitled work');
  const titleMarkup = options.standalone ? `<h1>${title}</h1>` : `<h1 class="print-only">${title}</h1><h2 class="no-print">${title}</h2>`;
  return `<header class="public-record-header">
      <p class="kicker">Human + AI Work Record · Public prototype v0.3</p>
      ${options.draft ? '<p class="draft-stamp">Draft Work Record · Public-ready requirements are incomplete</p>' : ''}
      ${titleMarkup}
      <p class="record-summary">${escapeHTML(credits.headline)}</p>
      <p>${escapeHTML(record.description || 'No description provided.')}</p>
    </header>
    <section class="record-output-section"><h3>Artifact documented</h3><dl class="record-facts">
      <div><dt>Status</dt><dd>${escapeHTML(statusLabel)}</dd></div>
      <div><dt>Exact version</dt><dd>${escapeHTML(record.artifact?.version || record.artifact?.date || 'Not identified')}</dd></div>
      <div><dt>Record ID</dt><dd>${escapeHTML(record.id)}</dd></div>
      <div><dt>Updated</dt><dd>${escapeHTML(formatDate(record.updatedAt))}</dd></div>
      <div><dt>Recognizable voice needed</dt><dd>${escapeHTML(voiceLabel)}</dd></div>
      <div><dt>Used to demonstrate capability</dt><dd>${escapeHTML(capabilityLabel)}</dd></div>
    </dl>${record.artifact?.url ? `<p><a href="${escapeHTML(record.artifact.url)}" target="_blank" rel="noreferrer">Open the documented artifact <span class="new-tab-note">(opens in a new tab)</span></a></p>` : ''}</section>
    ${record.readiness?.workCheckId || record.outcome?.intended ? `<section class="record-output-section"><h3>Linked Load Test context</h3><dl class="record-facts">
      <div><dt>Outcome wager</dt><dd>${escapeHTML(record.outcome?.intended || 'Not recorded')}</dd></div>
      <div><dt>Serious failure</dt><dd>${escapeHTML(record.outcome?.failureScenario || 'Not recorded')}</dd></div>
      <div><dt>Possible impact</dt><dd>${escapeHTML(record.outcome?.failureImpact || 'Not recorded')}</dd></div>
      <div><dt>Readiness decision</dt><dd>${escapeHTML(record.readiness?.decision || 'Load Test not completed')}</dd></div>
    </dl></section>` : ''}
    <section class="record-output-section"><h3>Credits</h3><h4>People and systems involved</h4>
      ${credits.human.map((item) => `<div class="credit-row"><strong>${escapeHTML(item.name)}</strong>${item.role ? ` <span>(${escapeHTML(item.role)})</span>` : ''}<p>${escapeHTML(item.credit)}</p></div>`).join('') || '<p>No human creator named.</p>'}
      ${record.aiUse === 'unknown'
        ? '<p>Whether AI was used has not been answered or established.</p>'
        : record.aiUse === 'no-ai-reported'
          ? '<p>No AI use was reported in the documented workflow.</p>'
          : `<h4>AI systems</h4>${credits.ai.map((item) => `<div class="credit-row"><strong>${escapeHTML(item.name)}</strong><p>${escapeHTML(item.role)}</p></div>`).join('')}<p class="helper-text">${escapeHTML(credits.modelHistoryNote)}</p>`}
      <h4>Detailed credits</h4><ul class="mini-record-list credit-role-list">${credits.roles.map((item) => `<li><span><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.credit)}</small></span><strong>${escapeHTML(creditHandlingLabel(item.handling))}</strong></li>`).join('')}</ul>
    </section>
    <section class="record-output-section"><h3>What this record supports</h3><ul class="claim-support-list">${claimRows.map(({ claim, support }) => `<li><span>${escapeHTML(claim.statement)}</span><strong class="status-pill">${escapeHTML(support.label)}</strong></li>`).join('') || '<li>No claims selected.</li>'}</ul></section>
    <section class="record-output-section"><h3>Evidence profile</h3><dl class="record-facts">
      <div><dt>Reported evidence connection</dt><dd>${escapeHTML(integrity.label)}</dd></div>
      <div><dt>Review status</dt><dd>${escapeHTML(review.label)}</dd></div>
      <div><dt>Evidence recorded</dt><dd>${evidenceSummary.total ?? record.evidence?.length ?? 0}</dd></div>
      <div><dt>Items displayed</dt><dd>${record.evidence?.length || 0}</dd></div>
      <div><dt>Private items withheld</dt><dd>${evidenceSummary.private || 0}</dd></div>
    </dl><p class="helper-text">Claim support and review status are calculated from the structured record. The evidence connection summarizes how each item was described; it is not independently verified unless the record says so.</p>
      ${record.evidence?.length ? `<h4>Selected evidence</h4><ul>${record.evidence.map((item) => item.visibility === 'redacted' ? '<li>Redacted supporting evidence. Details are withheld from the public record.</li>' : `<li><strong>${escapeHTML(item.label)}</strong>${item.date ? ` · ${escapeHTML(item.date)}` : ''}${item.version ? ` · ${escapeHTML(item.version)}` : ''}${item.url ? `<br /><a href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">Open evidence <span class="new-tab-note">(opens in a new tab)</span></a>` : ''}${item.description ? `<br />${escapeHTML(item.description)}` : ''}</li>`).join('')}</ul>` : '<p>No evidence item is displayed publicly.</p>'}
    </section>
    <section class="record-output-section"><h3>Final release decision</h3><p>${escapeHTML(finalDecision || 'No final release decision is recorded for this draft.')}</p></section>
    <section class="record-output-section"><h3>Known limits</h3><ul>${limitations.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul></section>
    <section class="record-output-section disclosure-box"><h3>Short disclosure</h3><p>${escapeHTML(buildDisclosure(record))}</p></section>
    <footer class="public-record-footer"><p>The Work Record creates a dated account of human origination, contribution, judgment, decisions, and AI involvement, and it can connect evidence to a specific artifact version. It supports an authorship claim and makes that claim examinable.</p><p>Record schema ${WORK_RECORD_SCHEMA_VERSION}. This is a practice-based public prototype. Records are self-reported unless independent review is documented.</p></footer>`;
}

function workRecordLimitations(record, claimRows, integrity, review) {
  const limits = [];
  if (record.aiUse === 'unknown') limits.push('Whether AI was used has not been answered or established.');
  else if (record.modelHistoryCompleteness !== 'complete' && record.aiUse !== 'no-ai-reported') limits.push('The complete AI model history has not been verified.');
  if (review.level !== 'independently-checked') limits.push('The supporting account has not been independently checked.');
  if (integrity.level === 'unlinked') limits.push('The public evidence is not fully tied to an exact artifact version.');
  if (claimRows.some(({ support }) => support.level === 'self-described')) limits.push('At least one claim is self-described without public supporting evidence.');
  if (claimRows.some(({ support }) => support.level === 'contradicted')) limits.push('At least one selected claim has contradicting evidence.');
  limits.push('Dates in this browser-generated record are not an independent trusted timestamp.');
  limits.push('The method and its findings have not been independently validated as a scientific instrument or legal determination.');
  return limits;
}

function downloadText(filename, textValue, type = 'text/plain') {
  const blob = new Blob([textValue], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadPublicWorkRecord(publicRecord, draft = false) {
  const title = escapeHTML(publicRecord.title || 'Human + AI Work Record');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
    body{max-width:850px;margin:0 auto;padding:40px 24px;color:#18211d;font:16px/1.55 system-ui,sans-serif}h1,h2,h3,h4{font-family:Georgia,serif;line-height:1.15}h1{font-size:2.4rem}.draft-stamp{padding:.7rem;border:2px solid #963e38;color:#963e38;font-weight:800;text-transform:uppercase}.kicker,dt{font:700 .75rem ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#0e5b50}.record-summary{padding:1rem 0;border-block:2px solid #18211d;font:600 1.4rem Georgia,serif}.record-output-section{padding:1.25rem 0;border-bottom:1px solid #cbd3cd}.record-facts{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.record-facts div{padding:.75rem;background:#f6f2e9}.record-facts dd{margin:.25rem 0 0}.claim-support-list,.mini-record-list{padding:0;list-style:none}.claim-support-list li,.mini-record-list li{display:flex;justify-content:space-between;gap:1rem;padding:.65rem 0;border-bottom:1px solid #cbd3cd}.credit-role-list small{display:block;margin-top:.2rem;color:#59645e}.status-pill{white-space:nowrap}.credit-row{padding:.75rem 0;border-bottom:1px solid #cbd3cd}.credit-row p{margin:.25rem 0}.helper-text,.public-record-footer{color:#59645e;font-size:.88rem}.disclosure-box{background:#dce8df;padding:1rem}.new-tab-note{font-size:.8em}@media(max-width:600px){.record-facts{grid-template-columns:1fr}.claim-support-list li,.mini-record-list li{display:block}.status-pill{display:block;margin-top:.3rem}}@media print{body{padding:0}.record-output-section{break-inside:auto}.credit-row,.record-facts div,.claim-support-list li,.mini-record-list li{break-inside:avoid}}
  </style></head><body><main>${workRecordPreview(publicRecord, { standalone: true, draft })}</main></body></html>`;
  downloadText(`${slug(publicRecord.title || 'work-record')}-${draft ? 'draft-record' : 'public-record'}.html`, html, 'text/html');
}

function hasWorkRecordContent(record) {
  return Boolean(
    record.title || record.description || record.ideaSource || record.humanActions || record.aiContributions ||
    record.creator?.name || record.artifact?.url || record.artifact?.version || record.artifact?.date ||
    record.claims?.length || record.evidence?.length || record.contributors?.length ||
    record.systems?.some(({ product, model, role }) => product || model || role) ||
    record.finalDecision?.name ||
    Object.values(record.contributions || {}).some((value) => !['Unknown', 'Not applicable'].includes(value))
  );
}

function isRecognizableWorkRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Number(value.schemaVersion) > WORK_RECORD_SCHEMA_VERSION) return false;
  if (value.project && value.answers && !value.title && !value.creator && !value.humanActions) return false;
  return [
    'title', 'creator', 'creatorName', 'humanActions', 'claims', 'evidence',
    'contributions', 'systems', 'artifact', 'artifactUrl', 'finalDecision',
  ].some((key) => Object.hasOwn(value, key));
}

function importWorkRecord(event) {
  const [file] = event.target.files;
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = '';
    showToast('That file is too large. Import a Work Record JSON file smaller than 5 MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const source = parsed?.record || parsed;
      if (!isRecognizableWorkRecord(source)) throw new Error('Not a supported Work Record');
      const candidate = normalizeWorkRecord(source, { idFactory: (prefix) => makeId(prefix) });
      if (hasWorkRecordContent(creationRecord) && !window.confirm('Replace the current Work Record with the imported record? Export a private backup first if you want to keep the current one.')) {
        event.target.value = '';
        return;
      }
      creationRecord = candidate;
      recordStep = 1;
      saveCreationRecord();
      showToast('Work Record imported. Review every step before publishing it.');
      renderCreationRecord('record-title');
    } catch {
      showToast('That file is not a valid Human + AI Work Record.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function prefillWorkCheckFromRecord() {
  if (assessment.project?.task && assessment.id !== creationRecord.projectId && !window.confirm('Replace the current Load Test setup with this Work Record? Export the current Load Test first if you want to keep it.')) return false;
  assessment = makeAssessment();
  assessment.stage = ['released', 'public-prototype', 'ready'].includes(creationRecord.status) ? 'release' : 'plan';
  assessment.project.name = creationRecord.title;
  assessment.project.task = creationRecord.description;
  assessment.project.intendedOutcome = creationRecord.outcome?.intended || '';
  assessment.project.failureScenario = creationRecord.outcome?.failureScenario || '';
  assessment.project.failureImpact = creationRecord.outcome?.failureImpact || '';
  assessment.project.consequence = creationRecord.outcome?.severity || '';
  assessment.project.systems = creationRecord.systems.length ? creationRecord.systems.map((system) => makeSystem({
    product: system.product, model: system.model, role: system.role, setup: system.setup, evidenceBasis: system.evidenceBasis,
  })) : [makeSystem()];
  assessment.project.primarySystemId = assessment.project.systems[0].id;
  assessment.project.system = assessment.project.systems.map(systemSummary).join('; ');
  creationRecord.projectId = assessment.id;
  saveCreationRecord();
  saveAssessment();
  checkView = 'setup';
  return true;
}

function printMode(className) {
  document.body.classList.add(className);
  window.print();
}

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-result', 'printing-record', 'printing-record-v03');
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
  document.title = 'How It Works | Human + AI Work';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">Site and Work Record v0.3 · Load Test method ${escapeHTML(METHOD_VERSION)}</p><h1>Follow the work, not the writing style.</h1><p>The methods answer two different questions: how the work was made, and whether the human + AI arrangement can carry the work.</p></header>
    <div class="prose">
      <h2>Two connected methods</h2>
      <h3>1. Work Record: How was this work made?</h3>
      <p>The Work Record follows the process instead of guessing from the finished product. It identifies one artifact and version, records human and AI actions, maps each part of the work, and connects claims to evidence. It reports claim support, evidence integrity, and review status separately.</p>
      <p>Claim support can be self-described, documented, corroborated, independently reviewed, not established, or contradicted. A positive label is calculated from linked evidence and review. The person filling out the record does not simply select it.</p>
      <h3>Why this is not an AI detector</h3>
      <p>An AI detector examines a finished product and guesses from patterns. A Work Record does not detect, classify, or help someone bypass detection. It documents the work behind the product.</p>
      <h3>2. Load Test: Can this arrangement carry the work?</h3>
      <p>The model is only one part of the arrangement. The Load Test checks whether your current capacity, the assigned AI role, the workflow and controls, and the stakes support relying on that arrangement.</p>
      <h2>AI fluency and this tool answer different questions</h2>
      <p><a href="https://aifluencyframework.org/" target="_blank" rel="noreferrer">The AI Fluency Framework <span class="new-tab-note">(opens in a new tab)</span></a> develops broad human competencies for deciding how to use AI, describing what is needed, evaluating what comes back, and using AI responsibly.</p>
      <p>Fluency matters, but it does not establish that you can catch a serious error in this task, inspect the important work, control the system’s access, stop a harmful action, or sustain the required review. The Load Test examines those conditions in one real arrangement.</p>
      <h2>Load Test central question</h2>
      <blockquote class="callout"><p><strong>Does this exact arrangement support the role you are giving AI, in relation to your current capacity?</strong></p></blockquote>
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
      <p>If several systems are involved, record each one and identify the most consequential role. The detailed questions focus on that role. Run a separate Load Test when another consequential system needs its own evaluation.</p>
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
      <p>Recommendations are grouped by what can be done now, within 24 hours, within days, or within weeks. Each one explains whether it could raise operational support, strengthen evidence, remove a blocker, add human capacity, or support a smaller AI role. A numeric projection is an illustrative maximum based on closing the named gap, not a guaranteed increase. Nothing changes until the action is completed, recorded, and the Load Test is recalculated.</p>
      <h2>Accountability</h2>
      <p>AI can produce recommendations, influence decisions, and initiate actions when connected to tools. It cannot absorb the accountability that follows human agency. The person who can authorize, reject, limit, stop, or correct an action remains accountable for how that agency is used.</p>
      <h2>When to refresh</h2>
      <p>Repeat the Load Test when the model, instructions, memory, tools, data, permissions, human reviewer, task, audience, stakes, acceptance criteria, workflow, or observed outcomes materially change.</p>
      <h2>Research and standards basis</h2>
      <p>This practice-based method is informed by established work on digital provenance, contributor roles, appropriate reliance, levels of automation, model documentation, and human oversight. Those sources informed the method. They have not tested or validated this tool or its scoring.</p>
      <p><a class="button button-secondary" href="#/research">Read the research basis</a></p>
      <div class="callout callout-warning"><p><strong>Current status:</strong> The Work Record is schema v${WORK_RECORD_SCHEMA_VERSION}; the Load Test scoring method is ${escapeHTML(METHOD_VERSION)}. Both are transparent, practice-based working methods. They have not been independently validated as scientific instruments. Their findings and recommendations should improve through testing and real use.</p></div>
    </div>
  </div>`;
}

function renderResearch() {
  document.title = 'Research Basis | Human + AI Work';
  const sources = [
    ['AI Fluency Framework', 'https://aifluencyframework.org/', 'AI fluency includes human competencies for deciding how to use AI, describing the work, judging AI outputs and behavior, and using AI responsibly.', 'This tool asks a narrower project question: whether one exact arrangement supports the assigned AI role in relation to the person’s current capacity. The framework has not validated this tool or its score.'],
    ['NIST AI Risk Management Framework', 'https://www.nist.gov/itl/ai-risk-management-framework', 'AI risk depends on the system, its use, the people involved, the operating context, and possible consequences.', 'The Load Test examines the person, AI system, assigned role, workflow, controls, and outcome together.'],
    ['Levels of automation', 'https://doi.org/10.1109/3468.844354', 'Automation can support information gathering, analysis, decision selection, and action. The right level can differ at each stage.', 'The tool does not treat AI authority as one all-or-nothing choice.'],
    ['Appropriate reliance in human-AI decision-making', 'https://doi.org/10.1145/3544548.3581058', 'Appropriate reliance depends on more than the chance that AI is right. The person’s ability also matters.', 'The Load Test considers the person’s capacity alongside the AI setup.'],
    ['Model Cards for Model Reporting', 'https://research.google/pubs/model-cards-for-model-reporting/', 'Models should be documented with intended uses, tested conditions, performance, and limits.', 'The record asks which system and model were used and what is known about their role and limits.'],
    ['AI Usage Cards', 'https://doi.org/10.1109/JCDL57899.2023.00060', 'AI use can be disclosed through a structured record covering transparency, integrity, and accountability.', 'The Work Record applies a related disclosure idea beyond scholarly work.'],
    ['W3C PROV', 'https://www.w3.org/TR/prov-overview/', 'Provenance can record people, software, activities, sources, and changes involved in producing something.', 'The Work Record connects contributors, actions, sources, evidence, and artifact versions.'],
    ['CRediT Contributor Role Taxonomy', 'https://credit.niso.org/contributor-roles-defined/', 'Contributions can be described by role. CRediT describes contributions but does not determine authorship.', 'The credits describe what each human and AI system did instead of reducing the relationship to a percentage.'],
    ['C2PA Content Credentials', 'https://c2pa.org/', 'Signed credentials can create a tamper-evident history tied to a digital asset. Integrity does not prove every statement is true.', 'The evidence profile distinguishes unlinked, version-linked, and tamper-evident records.'],
    ['U.S. Copyright Office: Copyright and Artificial Intelligence, Part 2', 'https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf', 'Using AI does not automatically erase human-created expression. Human selection, arrangement, and creative modification can matter, and each work depends on its facts.', 'The Work Record captures human origination, direction, selection, revision, and final decisions.'],
  ];
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">Research basis</p><h1>Practice-based, then compared with established work.</h1><p>The method began with observed problems in real AI-assisted work. It was then compared with research, standards, and public guidance on reliance, provenance, contributor roles, and AI-assisted authorship.</p></header>
    <div class="callout callout-warning"><p><strong>Important:</strong> These sources inform the method. They have not tested or validated this tool, its questions, or its results.</p></div>
    <div class="table-scroll research-table" role="region" aria-label="Research and standards informing the method" tabindex="0"><table><thead><tr><th scope="col">Source</th><th scope="col">Plain-language point</th><th scope="col">How it informs this tool</th></tr></thead><tbody>${sources.map(([name, url, point, use]) => `<tr><th scope="row"><a href="${url}" target="_blank" rel="noreferrer">${escapeHTML(name)} <span class="new-tab-note">(opens in a new tab)</span></a></th><td>${escapeHTML(point)}</td><td>${escapeHTML(use)}</td></tr>`).join('')}</tbody></table></div>
    <section class="prose"><h2>What the sources point toward</h2><blockquote class="callout"><p><strong>AI use cannot be evaluated by examining the model or finished artifact alone. The person’s capacity, the AI’s assigned role, the task, the workflow, the evidence, and the consequences must be examined together.</strong></p></blockquote><p>The Work Record then preserves who originated and directed the work, what each participant contributed, what was accepted or changed, what evidence supports the account, and which exact version the record describes.</p><p>The result is not an AI detector or a human-versus-AI percentage. It is a structured, examinable account of the collaboration.</p></section>
    <div class="button-row"><a class="button" href="#/creation-record">Create a Work Record</a><a class="button button-secondary" href="#/method">Read the full method</a></div>
  </div>`;
}

function renderExamples() {
  document.title = 'Examples | Human + AI Work';
  const examples = [
    ['Create an article or report', 'AI may organize, challenge, research, draft, or edit. The Load Test identifies the supported role and required verification. The Work Record documents the creator’s actions and each AI contribution.', 'Load Test + Work Record'],
    ['Build a website', 'AI may propose structure, write code, create content, run tests, or publish. The Load Test separates visible review from security, accessibility, code, permissions, and deployment areas the creator cannot inspect.', 'Launch boundary + test plan'],
    ['Use an agent to take actions', 'An agent may send messages, change files, operate accounts, or use its own output to trigger a next step. Permissions, reversibility, monitoring, and approval gates matter more than fluent responses.', 'Authority boundary + blockers'],
    ['Develop training content', 'Content accuracy does not prove that people can learn from or use it. The Load Test separates subject review, instructional flow, learner testing, and observed outcomes.', 'Pilot plan + Evidence Strength'],
    ['Review a project already in use', 'A polished result may still have weak evidence about what worked. Current-Use Support compares the intended wager with observed use, errors, and consequences.', 'Updated boundary + next review'],
  ];
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">Examples</p><h1>Different work needs different records and boundaries.</h1><p>Use a Work Record to document contributions. Add a Load Test when relying on AI in a consequential role needs its own decision.</p></header><section aria-labelledby="example-types-heading"><h2 class="sr-only" id="example-types-heading">Project examples</h2><div class="grid-2">${examples.map(([title, copy, output], index) => `<article class="card"><span class="card-number">0${index + 1}</span><h3>${title}</h3><p>${copy}</p><p class="kicker">Useful output</p><p><strong>${output}</strong></p></article>`).join('')}</div></section><div class="button-row"><a class="button" href="#/creation-record">Create a Work Record</a><a class="button button-secondary" href="#/sample">See this site’s real record</a></div></div>`;
}

function renderPricing() {
  document.title = 'Pricing | Human + AI Work';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">Pricing</p><h1>Full access is open during the Founding Preview.</h1><p>Use every current tool free while the product is being tested. The permanent free option will help people find their credibility gap. Paid options will create, preserve, and maintain complete Work Records.</p></header>
    <div class="grid-2">
      <article class="card pricing-card featured"><span class="stamp">Available now</span><h2>Founding Preview</h2><p class="price">$0 during testing</p><p>Complete prototype access for early users who help test the method.</p><ul><li>Full Work Record</li><li>Multiple people and AI systems</li><li>Detailed role-based credits, claims, and evidence</li><li>Public record and short disclosure</li><li>Print, public HTML, and private backup</li><li>Complete Load Test</li></ul><a class="button" href="#/creation-record">Use the Founding Preview</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned one-time purchase</span><h2>Project Record</h2><p class="price">Price to be announced</p><p>Build a complete record for one work product you plan to publish, submit, deliver, or defend.</p><ul><li>Complete evidence-linked Work Record</li><li>Exact artifact and version</li><li>Full Load Test and recommendations</li><li>Downloadable and shareable record</li><li>One later record update</li></ul><a class="button button-secondary" href="#/sample">See a complete record</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned subscription</span><h2>Creator</h2><p class="price">Monthly pricing to be announced</p><p>Maintain evidence as your work develops instead of rebuilding the record after someone questions it.</p><ul><li>Multiple active projects</li><li>Version and decision history</li><li>Reusable creator and AI profiles</li><li>Evidence library</li><li>Public, unlisted, or private records</li><li>Recheck and update reminders</li></ul><a class="button button-secondary" href="#/examples">See when to use it</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned subscription</span><h2>Team</h2><p class="price">Pricing to be announced</p><p>Document who contributed, who was capable of checking the work, and who approved its release.</p><ul><li>Contributor confirmations</li><li>Reviewer assignments</li><li>Approval records</li><li>Reusable team workflows</li><li>Organization history and audit export</li></ul><a class="button button-secondary" href="#/method">Review the method</a></article>
    </div>
    <div class="callout" style="margin-top:2rem"><p><strong>Pricing principle:</strong> Free access will reveal the gap. Paid options will create, preserve, share, and maintain the complete evidence record. Payment will never buy a stronger finding, higher score, or more favorable result.</p></div>
  </div>`;
}

function renderCopyright() {
  document.title = 'Copyright and use | Human + AI Work';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">Copyright and use</p><h1>Copyright protects the expression, not the method.</h1><p><strong>© 2026 Cheryl Abram. All rights reserved.</strong></p></header>
    <section class="prose">
      <h2>What this notice covers</h2>
      <p>This notice applies to the original human-authored writing, examples, explanations, interface content, code, and creative selection and arrangement of material on this site, to the extent copyright law protects them.</p>
      <h2>What it does not claim</h2>
      <p>It does not claim copyright in ideas, facts, systems, methods of operation, scoring rules, algorithms, third-party material, user-supplied content, or material that is not eligible for copyright protection.</p>
      <h2>AI-assisted material</h2>
      <p>The copyright claim is limited to protectable human-authored expression and human selection, arrangement, and modification. AI tools are not identified as authors.</p>
      <h2>Permission and reuse</h2>
      <p>This repository is public for inspection, but no open-source license has been granted. Public access does not grant permission to copy, redistribute, modify, or sell protected material. Uses allowed by law remain allowed.</p>
      <h2>Official guidance</h2>
      <p>See the U.S. Copyright Office guidance on <a href="https://www.copyright.gov/circs/circ01.pdf" target="_blank" rel="noreferrer">copyright basics <span class="new-tab-note">(opens in a new tab)</span></a>, <a href="https://www.copyright.gov/circs/circ66.pdf" target="_blank" rel="noreferrer">websites and website content <span class="new-tab-note">(opens in a new tab)</span></a>, and <a href="https://www.copyright.gov/ai/" target="_blank" rel="noreferrer">copyright and artificial intelligence <span class="new-tab-note">(opens in a new tab)</span></a>.</p>
    </section>
  </div>`;
}

function renderFAQ() {
  document.title = 'FAQ | Human + AI Work';
  const faqs = [
    ['What does this tool do?', 'The Work Record documents how one artifact was made, who and what contributed, what the evidence supports, and who made the final decision. The Load Test checks whether one human + AI arrangement can carry the work assigned to it.'],
    ['How does this tool define trust?', 'Trust is the decision to rely on a system for a defined role. The Load Test asks whether your current capacity, the AI role, the workflow, the controls, and the stakes support that reliance.'],
    ['Is having a human in the loop enough?', 'No. The person needs the knowledge, access, authority, time, attention, and stamina to recognize a serious problem, correct it, or stop the work. A named reviewer counts only if that person is actually in the workflow and has what the role requires.'],
    ['Is this an AI detector?', 'No. AI detectors guess from patterns in a finished product. The Work Record documents the process, contributions, decisions, and available evidence. It does not scan writing style or help people bypass detection.'],
    ['Can the Work Record support an authorship claim?', 'The Work Record creates a dated account of human origination, contribution, judgment, decisions, and AI involvement, and it can connect evidence to a specific artifact version. It supports an authorship claim and makes that claim examinable. The finding becomes stronger when important claims are connected to records, the record identifies an exact artifact version, and another person reviews the evidence.'],
    ['Does the score show how much of the work is human?', 'No. A single percentage cannot honestly represent originating an idea, supplying context, drafting, revising, checking, deciding, and approving. The Work Record shows those actions separately.'],
    ['Is the score the probability that AI is correct?', 'No. It shows how strongly the current arrangement supports relying on AI in the proposed role.'],
    ['What is Evidence Strength?', 'Evidence Strength shows how well the answers are documented. It is separate from the operational relationship score. Missing evidence creates uncertainty, not automatic proof of poor ability.'],
    ['Does a newer or more powerful model automatically improve the result?', 'No. Another model may perform better in a specific role, but it needs to be compared on the same representative tasks. A model change does not improve human capacity, permissions, workflow controls, or outcome evidence.'],
    ['What if several AI systems were used?', 'Record each tool, model or version, setup, and role. Identify the most consequential role for this Load Test. Run another Load Test if a second consequential role needs separate evaluation.'],
    ['Do I have to make my AI conversations public?', 'No. Evidence may be public, private, redacted, exported, or reviewed by another person. If key records are unavailable, the Work Record will show lower Evidence Strength.'],
    ['What if I did not use AI?', 'The Work Record can state: “No AI use reported in the documented workflow.” That is a bounded statement, not proof that no AI was used anywhere.'],
    ['Does a lower score mean I cannot publish or launch?', 'Not always. It may mean giving AI a smaller role, adding capable human review, or keeping an untested function inactive. A hard gate can still block the proposed authority.'],
    ['Who remains accountable?', 'Accountability follows agency. You remain accountable for choices you had the authority and capacity to make, including how much authority you gave the system.'],
    ['When should I repeat the Load Test?', 'Repeat it when the model, instructions, memory, tools, permissions, task, reviewer, audience, stakes, workflow, or observed results materially change.'],
    ['Where is my information stored?', 'In this preview, information stays in the current browser unless you export it. Do not enter confidential, regulated, or sensitive information.'],
    ['Is this scientifically validated?', 'No. It is a transparent, practice-based working method. Its ranges and recommendations are working guidance that should improve through testing and real use.'],
  ];
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">FAQ</p><h1>Plain answers about what this tool can and cannot say.</h1></header><div class="faq-list">${faqs.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div><div class="button-row"><a class="button" href="#/creation-record">Create a Work Record</a><a class="button button-secondary" href="#/method">See the full method</a></div></div>`;
}

function renderNotFound() {
  document.title = 'Page not found | Human + AI Work';
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
