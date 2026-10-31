import './styles.css';
import cherylPortraitUrl from './cheryl-abram.png';
import { canonicalProjectId } from './project-identity.js';
import {
  DIMENSIONS,
  getAssessmentScopeKey,
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
  createWorkRecord,
  getClaimSupport,
  getEvidenceIntegrity,
  getReviewStatus,
  getWorkRecordCompleteness,
  normalizeWorkRecord,
  safeHttpUrl,
  toPublicWorkRecord,
} from './work-record.js';
import { renderChangesPage, renderSnapshotPage } from './snapshot-ui.js';
import { mergeSnapshotIntoWorkRecord, workRecordFromSnapshot } from './snapshot-work-record.js';

const STORAGE_KEY = 'ai-reliance-check:v0.2';
const LEGACY_STORAGE_KEY = 'ai-reliance-check:v0.1';
const RECORD_KEY = 'ai-reliance-check:work-record:v0.3';
const LEGACY_RECORD_KEYS = ['ai-reliance-check:work-record:v0.2', 'ai-reliance-check:creation-record:v0.1'];
const ASSESSMENT_SCHEMA_VERSION = 4;
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSef4UnjJR67d2zV0Osuu85TVtd5lqXrHCVWwdcOzPwCxNOrSw/viewform';

const WORK_TYPES = [
  ['factual', 'Writing or research', 'Articles, reports, claims, or source-based material'],
  ['creative', 'Images, video, audio, or design', 'Creative work or media'],
  ['software', 'Website, app, code, or configuration', 'Technical work or deployment'],
  ['decision', 'Analysis, recommendation, or decision', 'Work that may influence a choice'],
  ['automation', 'Repeated or automated task', 'Work that continues or acts through tools'],
  ['training', 'Training or learning material', 'Work intended to build knowledge or skill'],
];

const BEHAVIORS = [
  ['follow', 'Follow your instructions'],
  ['organize', 'Put information in a useful order'],
  ['compare', 'Compare choices'],
  ['challenge', 'Point out problems or weak ideas'],
  ['verify', 'Check facts against reliable sources'],
  ['separate', 'Say what it checked, what it assumed, and what it could not confirm'],
  ['uncertainty', 'Say when it is unsure or does not know'],
  ['test', 'Test whether the result works'],
  ['stop', 'Stop and wait for a person'],
];

const HUMAN_ACTIVITIES = [
  ['purpose', 'Decide what the project should do and what it needs'],
  ['sources', 'Provide original ideas, examples, or source material'],
  ['direct', 'Tell AI what to make or change'],
  ['compare', 'Compare choices'],
  ['review', 'Review what AI produces'],
  ['facts', 'Check facts or sources'],
  ['technical', 'Test code, links, or features'],
  ['edit', 'Edit or correct the work'],
  ['select', 'Decide what stays in the final version'],
  ['approve', 'Approve the work before it is used or published'],
  ['stop', 'Stop or fix the work when something goes wrong'],
];

const RECORD_STEPS = [
  ['work', 'Work'],
  ['claims', 'Statements'],
  ['credits', 'Credits'],
  ['evidence', 'Evidence'],
  ['handling', 'Who did what'],
  ['review', 'Review'],
];

const CLAIM_PRESETS = [
  ['claim-originated', 'origination', 'I originated the main idea or purpose.'],
  ['claim-developed', 'development', 'I developed the core method, argument, design, or approach.'],
  ['claim-language', 'authorship', 'I wrote or substantially rewrote the final language.'],
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
  ['Finished artifact', 'Finished work'],
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
    projectId: makeId('project'),
    stage: '',
    project: {
      name: '',
      task: '',
      aiUseFocus: '',
      system: '',
      systems: [firstSystem],
      primarySystemId: firstSystem.id,
      intendedOutcome: '',
      humanLoad: '',
      humanActivities: [],
      otherHumanInvolved: '',
      otherHumanRole: '',
      otherHumanActivities: [],
      humanOther: '',
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
      reviewEvidenceBasis: 'unknown',
      reviewEvidenceNote: '',
      reviewEvidenceUrl: '',
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
      independentReviewEvidence: '',
      qualifiedIndependentReview: false,
    },
    answers: {},
    scopeKey: '',
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
    operator: '',
    operatorRole: '',
    checker: '',
    checkerRole: '',
    checkerScope: '',
    proposedAuthority: '',
    setup: '',
    evidence: '',
    evidenceBasis: 'unknown',
    connectedAccess: '',
    permissionsConfirmed: '',
    ...overrides,
    material: true,
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
  project.humanActivities = Array.isArray(project.humanActivities)
    ? project.humanActivities.filter((value) => HUMAN_ACTIVITIES.some(([id]) => id === value))
    : [];
  project.otherHumanActivities = Array.isArray(project.otherHumanActivities)
    ? project.otherHumanActivities.filter((value) => HUMAN_ACTIVITIES.some(([id]) => id === value))
    : [];
  if (!project.humanActivities.length && !project.otherHumanActivities.length && !project.humanOther && project.humanLoad) {
    project.humanOther = String(project.humanLoad);
  }
  project.aiUseFocus = ['making', 'operating'].includes(project.aiUseFocus) ? project.aiUseFocus : '';
  project.otherHumanInvolved = ['yes', 'no', 'unknown'].includes(project.otherHumanInvolved)
    ? project.otherHumanInvolved
    : '';
  const normalized = {
    ...fallback,
    ...stored,
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    methodVersion: METHOD_VERSION,
    projectId: canonicalProjectId(stored.projectId || stored.id || fallback.projectId),
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
  } else if (normalized.scopeKey !== getAssessmentScopeKey(normalized)) {
    normalized.legacySnapshot = {
      methodVersion: stored.methodVersion || METHOD_VERSION,
      completed: Boolean(stored.completed),
      answers: normalized.answers,
      completedAt: stored.completedAt || '',
    };
    normalized.answers = {};
    normalized.completed = false;
    normalized.currentQuestion = 0;
    normalized.currentQuestionId = '';
    normalized.scopeKey = getAssessmentScopeKey(normalized);
    normalized.needsReassessment = true;
  } else if (normalized.completed && !assessmentCanShowResult(normalized)) {
    normalized.completed = false;
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
  const firstUnanswered = questions.findIndex((question) => !isValidAnswer(question, value?.answers?.[question.id], value));
  if (firstUnanswered >= 0) return firstUnanswered;
  if (value?.currentQuestionId) {
    const savedIndex = questions.findIndex((question) => question.id === value.currentQuestionId);
    if (savedIndex >= 0) return savedIndex;
  }
  return Math.min(Number(value?.currentQuestion || 0), questions.length - 1);
}

function isValidAnswer(question, answer, value = assessment) {
  if (!question || !answer || typeof answer !== 'object') return false;
  const currentScopeKey = getAssessmentScopeKey(value || {});
  if (Number(value?.schemaVersion || 0) >= ASSESSMENT_SCHEMA_VERSION && value?.scopeKey !== currentScopeKey) return false;
  if (value?.scopeKey && answer.scopeKey !== currentScopeKey) return false;
  if (answer.status === 'unknown' || answer.level === 'unknown') {
    return answer.basis === 'unknown' && answer.level === null;
  }
  const validLevel = question.options.some((option) => typeof option.value === 'number' && option.value === Number(answer.level));
  const validBasis = ['confirmed', 'reported'].includes(answer.basis);
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
    if (status && status.textContent !== 'Saved only in this browser. Export a private backup when you finish.') status.textContent = 'Saved only in this browser. Export a private backup when you finish.';
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

function snapshotWorkType(value = '') {
  const normalized = String(value).toLocaleLowerCase();
  if (/writ|research|publish|article|report|factual/.test(normalized)) return 'writing';
  if (/software|website|application|\bapp\b|code|configuration/.test(normalized)) return 'software';
  if (/training|learning|course/.test(normalized)) return 'training';
  if (/image|audio|video|design|creative/.test(normalized)) return 'creative';
  if (/analysis|recommendation|decision/.test(normalized)) return 'decision';
  return 'other';
}

function knownProjectsForSnapshots() {
  const projects = new Map();
  const add = (project) => {
    if (!project.projectId || !project.projectName) return;
    const existing = projects.get(project.projectId);
    if (!existing || String(project.createdAt || '') >= String(existing.createdAt || '')) projects.set(project.projectId, project);
  };
  if (creationRecord.title) add({
    projectId: creationRecord.projectId,
    projectName: creationRecord.title,
    workType: snapshotWorkType(creationRecord.workType || creationRecord.description),
    stage: creationRecord.readiness?.stage || ({ ready: 'release', 'public-prototype': 'release', released: 'live', retired: 'live' }[creationRecord.status] || 'build'),
    createdAt: creationRecord.updatedAt,
  });
  if (assessment.project?.name) add({
    projectId: assessment.projectId,
    projectName: assessment.project.name,
    workType: ({ factual: 'writing', software: 'software', training: 'training', creative: 'creative', decision: 'decision', automation: 'other' })[assessment.project.workTypes?.[0]] || snapshotWorkType(assessment.project.task),
    stage: assessment.stage || 'build',
    createdAt: assessment.updatedAt,
  });
  return [...projects.values()];
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
    '/snapshot': () => renderSnapshotPage(main, { showToast, onCreateWorkRecord: prepareWorkRecordFromSnapshot, knownProjects: knownProjectsForSnapshots() }),
    '/changes': () => renderChangesPage(main, { showToast }),
    '/creation-record': () => renderSnapshotPage(main, { showToast, onCreateWorkRecord: prepareWorkRecordFromSnapshot, knownProjects: knownProjectsForSnapshots() }),
    '/detailed-record': renderCreationRecord,
    '/method': renderMethod,
    '/research': renderResearch,
    '/examples': renderExamples,
    '/pricing': renderPricing,
    '/copyright': renderCopyright,
    '/faq': renderFAQ,
  };

  const renderer = routes[path] || renderNotFound;
  renderer();
  if (path !== '/detailed-record') focusCurrentStep();
}

function setActiveNav(path) {
  const activePath = path === '/check'
    ? '/load-test'
    : path === '/creation-record'
      ? '/snapshot'
      : path;
  document.querySelectorAll('.site-nav a').forEach((link) => {
    const current = link.getAttribute('href') === `#${activePath}`;
    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function homepageCreditsSequence(duplicate = false) {
  return `<div class="credits-sequence"${duplicate ? ' aria-hidden="true"' : ''}>
    <p class="credits-overline">evAIdence Work Receipt</p>
    <h2${duplicate ? '' : ' id="credits-screen-title"'}>evAIdence</h2>
    <div class="credits-entry"><p>Created by</p><strong>Cheryl Abram</strong><span>Originated the problem, developed the method, directed the product, and made the final decisions.</span></div>
    <div class="credits-entry"><p>Originating idea and purpose</p><strong>Human</strong><span>Identified the problem and decided what the product should accomplish.</span></div>
    <div class="credits-entry"><p>Source material and core method</p><strong>Human</strong><span>Supplied the experience, examples, principles, and method behind the product.</span></div>
    <div class="credits-entry"><p>Product direction and requirements</p><strong>Human</strong><span>Defined the audience, boundaries, features, and changes to keep or reject.</span></div>
    <div class="credits-entry"><p>Brand name and logo direction</p><strong>Human + AI tool</strong><span>The human chose the name and supplied the logo. The AI tool prepared the transparent asset and added the approved branding.</span></div>
    <div class="credits-entry"><p>Research and source checking</p><strong>Human + AI tool</strong><span>The AI tool located and compared sources. The human judged what belonged in the method.</span></div>
    <div class="credits-entry"><p>Writing, editing, and user flow</p><strong>Human + AI tool</strong><span>The AI tool organized and drafted. The human questioned, revised, and decided the final meaning.</span></div>
    <div class="credits-entry"><p>Implementation and production</p><strong>AI tool</strong><span>Wrote and revised code and executed approved publication changes.</span></div>
    <div class="credits-entry"><p>Verification and testing</p><strong>Human + AI tool</strong><span>The AI tool ran automated checks. The human reviewed visible behavior. Independent technical review is not claimed.</span></div>
    <div class="credits-entry"><p>Final release decision</p><strong>Human</strong><span>Approved the documented version and decided it was ready to publish.</span></div>
    <div class="credits-entry credits-evidence"><p>Records provided</p><strong>Conversation history · Source material · GitHub history · Live version</strong></div>
    <p class="credits-end">End of Work Receipt</p>
  </div>`;
}

function renderHome() {
  document.title = 'evAIdence | Protect your credibility when AI helps';
  main.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-kicker">A receipt for work made with AI</p>
        <h1 class="credibility-headline">AI can help with the work. It should not cost you your credibility.</h1>
        <p class="hero-definition">evAIdence creates a dated receipt showing what you originated, directed, checked, and approved, what AI contributed, and which records support that account.</p>
        <p class="assurance-note">You do not have to hide AI or let its involvement erase your contribution.</p>
        <div class="hero-actions">
          <a class="button" href="#/snapshot">Create a Work Receipt <span aria-hidden="true">→</span></a>
          <a class="button button-secondary" href="#/sample">See a fictional receipt</a>
        </div>
        <p class="brand-explainer"><strong>evAIdence is pronounced “evidence.”</strong> AI is inside the evidence, just as it is inside the work. It is part of the process, not the whole work.</p>
        <p class="hero-limit"><strong>Not an AI detector.</strong> It does not guess from finished work or assign a human-versus-AI percentage. It records the process you provide.</p>
      </div>
      <aside class="credits-screen" aria-labelledby="credits-screen-title">
        <div class="credits-screen-toolbar">
          <span>One collaboration, brought into focus</span>
          <button class="credits-motion-toggle" id="credits-motion-toggle" type="button" aria-controls="credits-track">Pause credits</button>
        </div>
        <div class="credits-viewport">
          <div class="credits-track credits-track-blur" id="credits-track">
            ${homepageCreditsSequence()}
            ${homepageCreditsSequence(true)}
          </div>
          <div class="credits-focus-layer" aria-hidden="true">
            <div class="credits-track credits-track-clear">
              ${homepageCreditsSequence(true)}
              ${homepageCreditsSequence(true)}
            </div>
          </div>
          <div class="focus-window" aria-hidden="true"><span>In focus</span></div>
        </div>
        <p class="credits-screen-caption"><strong>Make your hand on the wheel visible.</strong> A Work Receipt connects the credits to records from the work. Save another later and evAIdence shows what changed. <a href="#/sample">See the fictional receipt.</a></p>
      </aside>
    </section>

    <section class="section">
      <div class="section-heading">
        <div><p class="kicker">How it works</p><h2>Add the records. Check the credits. Save the receipt.</h2></div>
        <p class="lede">Start with the records you already have. evAIdence keeps your account of the work separate from the records you provide.</p>
      </div>
      <div class="grid-3 snapshot-steps">
        <article class="card"><span class="card-number">01</span><h3>Add the project and records</h3><p>Name the work. Add any conversations, sources, current work, and repository history you have.</p></article>
        <article class="card"><span class="card-number">02</span><h3>Confirm the working arrangement</h3><p>Record what AI started with, what you added, what AI could do, and when it needed approval.</p></article>
        <article class="card"><span class="card-number">03</span><h3>Save and compare</h3><p>Save the Work Receipt. Later receipts show how the relationship changed.</p></article>
      </div>
      <div class="button-row"><a class="button" href="#/snapshot">Create a Work Receipt</a><a class="button button-secondary" href="#/method">See how it works</a></div>
    </section>

    <section class="section section-compact founder-section" aria-labelledby="founder-heading">
      <div class="founder-card">
        <div class="founder-portrait-frame">
          <img class="founder-portrait" src="${cherylPortraitUrl}" alt="Cheryl Abram, creator of evAIdence" width="1080" height="1080" loading="lazy" decoding="async" />
        </div>
        <div class="founder-copy">
          <p class="kicker">Meet the creator</p>
          <h2 id="founder-heading">Created by Cheryl Abram.</h2>
          <p>Cheryl is an author, curriculum designer, cybersecurity strategist, and learning systems architect. She created evAIdence to make human judgment, work, and accountability visible when AI is part of the process.</p>
          <a class="button button-secondary" href="https://www.ypifany.org/about" target="_blank" rel="noreferrer">Meet Cheryl and see her work <span class="new-tab-note">(opens in a new tab)</span></a>
        </div>
      </div>
    </section>

    <section class="section section-compact change-section" aria-labelledby="change-example-heading">
      <div class="section-heading">
        <div>
          <p class="kicker">The useful signal</p>
          <h2 id="change-example-heading">Something changed.</h2>
        </div>
        <p class="lede">evAIdence does not tell you that more AI is automatically bad. It shows what moved so you can decide whether the change was intentional and still fits the work.</p>
      </div>
      <div class="change-demo" role="group" aria-label="Example of changes between two Work Receipts">
        <div class="change-demo-heading"><span>January receipt</span><span>October receipt</span></div>
        <div class="change-row"><strong>Starting point</strong><span>You outlined first</span><span>AI proposes the first direction</span></div>
        <div class="change-row"><strong>AI’s role</strong><span>Challenge and edit</span><span>Generate ideas and first drafts</span></div>
        <div class="change-row"><strong>Your source check</strong><span>Checked each important source</span><span>Checked a sample</span></div>
        <div class="change-row"><strong>Final approval</strong><span>You</span><span>You</span></div>
      </div>
      <p class="change-question"><strong>Was this change intentional?</strong> Does the new arrangement still fit what matters in this work and what you can personally judge?</p>
    </section>

    <section class="section">
      <div class="section-heading">
        <div><p class="kicker">One record, several uses</p><h2>A private history and a Work Receipt you can share.</h2></div>
        <p class="lede">Keep your longer relationship history private. Export one project receipt or its work credits when you want to explain how that work was made.</p>
      </div>
      <div class="grid-2">
        ${featureCard('01', 'Your private change view', 'See how AI’s starting context, entry point, work, permissions, and your checking changed across comparable Work Receipts.')}
        ${featureCard('02', 'A shareable Work Receipt', 'Export clear credits, findings, and a concise account for one project without publishing your complete history or private conversations.')}
      </div>
      <div class="callout optional-check-callout">
        <p class="kicker">When a change needs a closer look</p>
        <h3>Use the optional Load Test.</h3>
        <p>If AI enters earlier, receives more access, or takes on work you cannot fully judge, the Load Test examines whether the current human capacity and workflow can carry that arrangement.</p>
        <p><a href="#/load-test">Run a Load Test</a></p>
      </div>
    </section>

    <section class="section section-compact" aria-labelledby="ship-heading">
      <div class="callout ship-preview">
        <p class="kicker">A focused companion is coming</p>
        <h2 id="ship-heading">Building real software with AI?</h2>
        <p><strong>Before You Ship</strong> will use the same evAIdence record to show what a nondeveloper can explain, what was tested, what remains unknown, and what changed before a release. It will have its own focused experience instead of making this one harder to use.</p>
      </div>
    </section>

    <section class="section section-compact" aria-labelledby="feedback-heading">
      <div class="callout">
        <p class="kicker">Review the founding preview</p>
        <h2 id="feedback-heading">Was evAIdence useful?</h2>
        <p>Use this short Google Form to tell me what was clear, confusing, or missing. Your feedback will help make evAIdence more meaningful before public release.</p>
        <a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Review this preview <span class="new-tab-note">(opens a Google Form in a new tab)</span></a>
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

function stageCard(number, title, copy, stage, label) {
  return `<article class="card stage-card">
    <span class="card-number">${number}</span>
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
  if (assessment.project?.task && !window.confirm('Start a new Load Test? This will replace the project currently saved in this browser.')) {
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
  document.title = 'Load Test | evAIdence';
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
      <h1>How far along is the work?</h1>
      <p>Choose where the work is now. The Load Test will adjust its questions to match this stage.</p>
    </header>
    ${savedNotice}
    <section aria-labelledby="choose-check-heading">
      <h2 class="sr-only" id="choose-check-heading">Choose when to run the Load Test</h2>
      <div class="grid-2">
        ${stageCard('01', 'I haven’t started the work yet', 'Test the plan before you begin.', 'plan', 'Check my plan')}
        ${stageCard('02', 'I’m working on it now', 'Check the work while you can still change how people and AI are working together.', 'build', 'Check work in progress')}
        ${stageCard('03', 'I’m ready to publish, send, or launch', 'Test the finished work and actual workflow before others rely on it.', 'release', 'Check before launch')}
        ${stageCard('04', 'The work is already in use', 'Compare the workflow with actual results, mistakes, and consequences.', 'live', 'Check current use')}
      </div>
      <p class="helper-text">Each Load Test covers one project, your current ability to check the work, and one main AI role. It does not rate you or the AI model in general.</p>
    </section>
    <section class="section section-compact" aria-labelledby="check-output-heading">
      <div class="section-heading">
        <div><p class="kicker">Your result</p><h2 id="check-output-heading">You get more than a score.</h2></div>
        <p class="lede">Your result shows what the role you gave AI requires from you and anyone else doing or checking the work, whether those people and the workflow can carry that load, and what could happen if you continue as-is.</p>
      </div>
      <div class="grid-3">
        ${featureCard('01', 'The load you are taking on', 'What this AI role still requires you or another capable person to judge, check, approve, monitor, correct, or recover.')}
        ${featureCard('02', 'Can the current setup carry it?', 'Where the recorded human reviewer, AI behavior, and workflow meet or fall short of that load.')}
        ${featureCard('03', 'The wager if you proceed', 'What you are counting on, what could go wrong, who or what could be affected, and what could reduce the exposure.')}
      </div>
      <p><strong>The Load Test does not decide whether you proceed.</strong> It makes the wager visible so you can decide with your eyes open.</p>
      <p class="helper-text">Some actions strengthen the workflow. Others add capable human help, strengthen the evidence, or reduce the AI role so there is less load to carry. A planned action changes the operational result only after it is completed and the Load Test is run again. Evidence Strength changes only when you identify a current supporting record.</p>
    </section>
    <div class="button-row no-print">
      <button class="button button-secondary" type="button" id="import-trigger">Import a saved project</button>
      <input id="import-assessment" type="file" accept="application/json" hidden />
    </div>
    <p class="helper-text">Your information stays in this browser unless you export it. Do not enter confidential, regulated, or sensitive information.</p>
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
  const aiUse = aiUsePrompts(assessment.stage);
  const errors = normalizeFormErrors(error);
  document.title = `${errors.length ? 'Error: ' : ''}Load Test | evAIdence`;
  main.innerHTML = `<div class="page">
    <div class="assessment-shell assessment-shell-single">
      <section class="assessment-main setup-card">
        <div class="progress-row"><span>PROJECT SETUP</span><span>Six sections, then 8–12 questions and a final review</span></div>
        <div class="progress-track" role="progressbar" aria-label="Load Test progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="8" aria-valuetext="Project setup"><span style="width: 8%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${escapeHTML(stage.setupHeading)}</h1>
        <p class="question-why">${escapeHTML(stage.setupIntro)}</p>
        ${renderErrorSummary(errors)}
        ${errors.length ? '<p class="helper-text"><strong>Your answers are saved.</strong> Fix the item below to continue.</p>' : ''}
        <form id="setup-form" novalidate>
          <div class="callout"><p><strong>Stay inside this project:</strong> ${escapeHTML(stage.scopeHelp)}</p><p class="helper-text">Your answers are saved only in this browser as you work.</p></div>
          <h2 class="form-section-heading">1. About this project</h2>
          <div class="field-grid">
            <div class="field field-span-2">
              <label for="project-name">Project name <span class="helper-text">Optional</span></label>
              <input id="project-name" name="name" value="${escapeHTML(p.name)}" autocomplete="off" />
            </div>
            <div class="field field-span-2">
              <label for="task">${escapeHTML(stage.taskQuestion)} <span class="required">Required</span></label>
              <textarea id="task" name="task" required ${errorAttributes(errors, 'task')}>${escapeHTML(p.task)}</textarea>
              <small>${escapeHTML(stage.taskHelp)}</small>
              ${fieldError(errors, 'task')}
            </div>
            <div class="field field-span-2">
              <label for="outcome">${escapeHTML(stage.outcomeQuestion)} <span class="required">Required</span></label>
              <textarea id="outcome" name="intendedOutcome" required ${errorAttributes(errors, 'outcome', 'outcome-help')}>${escapeHTML(p.intendedOutcome)}</textarea>
              <small id="outcome-help">${escapeHTML(stage.outcomeHelp)}</small>
              ${fieldError(errors, 'outcome')}
            </div>
          </div>

          <fieldset class="fieldset" id="ai-use-focus-group" ${groupErrorAttributes(errors, 'ai-use-focus-group')}>
            <legend>Which part of this project are you checking? <span class="required">Choose one</span></legend>
            <p class="helper-text">If AI is helping make the project and will also keep working inside it after launch, run a separate Load Test for each use. The jobs, risks, and people who need to check them may be different.</p>
            <div class="choice-grid">
              ${radioChoice('aiUseFocus', 'making', aiUse.makingLabel, aiUse.makingDescription, p.aiUseFocus)}
              ${radioChoice('aiUseFocus', 'operating', aiUse.operatingLabel, aiUse.operatingDescription, p.aiUseFocus)}
            </div>
            ${fieldError(errors, 'ai-use-focus-group')}
          </fieldset>

          <fieldset class="fieldset systems-fieldset" id="systems-group" ${groupErrorAttributes(errors, 'systems-group')}>
            <legend>2. ${escapeHTML(stage.systemsQuestion)} <span class="required">Required</span></legend>
            <p class="helper-text">Add each AI tool separately. Enter “Unknown” when you do not know the exact model or version.</p>
            <div class="callout"><p><strong>Think of the AI tool like another worker in the project:</strong> What job does it do? Who works with it? Who can tell whether its work is right and make sure mistakes are fixed?</p></div>
            <div class="system-editor-list">
              ${p.systems.map((system, index) => systemEditor(system, index, p.systems.length, errors, stage)).join('')}
            </div>
            <fieldset class="fieldset consequential-system-group">
              <legend>${escapeHTML(stage.primarySystemQuestion)}</legend>
              <p class="helper-text">Choose the tool doing the job that matters most or could cause the most trouble if it fails. You can run another Load Test for another tool.</p>
              <div class="choice-grid">${p.systems.map((system, index) => `<label class="choice"><input type="radio" name="primarySystemId" value="${escapeHTML(system.id)}" ${system.id === p.primarySystemId ? 'checked' : ''} required /><span><strong>${escapeHTML(system.product || `AI tool ${index + 1}`)}</strong><span>The remaining questions will focus on this tool and job.</span></span></label>`).join('')}</div>
            </fieldset>
            ${fieldError(errors, 'systems-group')}
            <button class="button button-secondary" type="button" id="add-system">Add another AI tool</button>
          </fieldset>

          <fieldset class="fieldset" id="human-activities-group" aria-required="true" ${groupErrorAttributes(errors, 'human-activities-group')}>
            <legend>3. ${escapeHTML(stage.humanActivityQuestion)} <span class="required">Required</span></legend>
            <p class="helper-text">${escapeHTML(stage.humanActivityHelp)} Choose an activity even if AI also helped with it. Human and AI work can overlap.</p>
            <div class="callout"><p><strong>Choose only the work you personally do below.</strong> If a developer uses AI, do not count the developer’s work here. You will list that person’s work next. Do not list jobs that begin after launch unless this Load Test is about AI working inside the finished project.</p></div>
            <div class="choice-grid">
              ${HUMAN_ACTIVITIES.map(([value, label]) => checkboxChoice('humanActivities', value, label, '', (p.humanActivities || []).includes(value))).join('')}
            </div>
            ${fieldError(errors, 'human-activities-group')}
            <div class="field-grid human-helper-fields">
              <div class="field">
                <label for="other-human-involved">${escapeHTML(stage.otherHumanQuestion)} <span class="required">Required</span></label>
                <select id="other-human-involved" name="otherHumanInvolved" required ${errorAttributes(errors, 'other-human-involved')}>${selectOptions([
                  ['', 'Choose an answer'],
                  ['no', 'No'],
                  ['yes', 'Yes'],
                  ['unknown', 'I do not know'],
                ], p.otherHumanInvolved || '')}</select>
                ${fieldError(errors, 'other-human-involved')}
              </div>
              <div class="field" id="other-human-role-field" ${p.otherHumanInvolved === 'yes' ? '' : 'hidden'}>
                <label for="other-human-role">${escapeHTML(stage.otherHumanRoleQuestion)} <span class="required">Required</span></label>
                <input id="other-human-role" name="otherHumanRole" value="${escapeHTML(p.otherHumanRole || '')}" placeholder="For example: developer, editor, designer, or reviewer" required ${errorAttributes(errors, 'other-human-role')} />
                <small>Roles named under an AI tool are copied here when possible. Edit this field if needed.</small>
                ${fieldError(errors, 'other-human-role')}
              </div>
            </div>
            <fieldset class="fieldset" id="other-human-activities-field" aria-required="true" ${groupErrorAttributes(errors, 'other-human-activities-field')} ${p.otherHumanInvolved === 'yes' ? '' : 'hidden'}>
              <legend>${escapeHTML(stage.otherHumanActivityQuestion)} <span class="required">Required</span></legend>
              <div class="choice-grid">
                ${HUMAN_ACTIVITIES.map(([value, label]) => checkboxChoice('otherHumanActivities', value, label, '', (p.otherHumanActivities || []).includes(value))).join('')}
              </div>
              ${fieldError(errors, 'other-human-activities-field')}
            </fieldset>
            <div class="field" style="margin-top:1rem">
              <label for="human-other">${escapeHTML(stage.humanOtherQuestion)} <span class="helper-text">Optional</span></label>
              <textarea id="human-other" name="humanOther" placeholder="Add a human contribution that is not listed above">${escapeHTML(p.humanOther || '')}</textarea>
            </div>
          </fieldset>

          <fieldset class="fieldset" id="work-types-group" ${groupErrorAttributes(errors, 'work-types-group')}>
            <legend>4. What kind of work is this? <span class="required">Choose at least one</span></legend>
            <div class="choice-grid">
              ${WORK_TYPES.map(([value, label, description]) => checkboxChoice('workTypes', value, label, description, p.workTypes.includes(value))).join('')}
            </div>
            ${fieldError(errors, 'work-types-group')}
          </fieldset>

          <fieldset class="fieldset" id="behaviors-group" ${groupErrorAttributes(errors, 'behaviors-group')}>
            <legend>5. ${escapeHTML(stage.behaviorQuestion)} <span class="required">Choose one to three</span></legend>
            <div class="choice-grid">
              ${BEHAVIORS.map(([value, label]) => checkboxChoice('requiredBehaviors', value, label, '', p.requiredBehaviors.includes(value))).join('')}
            </div>
            <small id="behavior-count">${p.requiredBehaviors.length} of 3 selected</small>
            ${fieldError(errors, 'behaviors-group')}
          </fieldset>

          <h2 class="form-section-heading">6. What could go wrong?</h2>
          <div class="field-grid">
            <div class="field field-span-2">
              <label for="failure-scenario">What is the worst thing that could happen if AI makes a mistake or a person does not catch it? <span class="required">Required</span></label>
              <textarea id="failure-scenario" name="failureScenario" required ${errorAttributes(errors, 'failure-scenario')}>${escapeHTML(p.failureScenario || '')}</textarea>
              <small>Think about an AI mistake, a missed human check, or something being used, published, or changed too soon.</small>
              ${fieldError(errors, 'failure-scenario')}
            </div>
            <div class="field field-span-2">
              <label for="failure-impact">If that happens, who or what could be harmed, and how? <span class="required">Required</span></label>
              <textarea id="failure-impact" name="failureImpact" required ${errorAttributes(errors, 'failure-impact')}>${escapeHTML(p.failureImpact || '')}</textarea>
              ${fieldError(errors, 'failure-impact')}
            </div>
            <div class="field">
              <label for="consequence">How serious could the harm be? <span class="required">Required</span></label>
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
          </div>

          <div class="form-actions">
            <button class="button button-secondary" type="button" id="cancel-check">Cancel</button>
            <button class="button" type="submit">Continue <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
    </div>
  </div>`;

  const form = document.querySelector('#setup-form');
  form.addEventListener('submit', submitSetup);
  form.addEventListener('input', () => {
    captureSetupDraft(form);
    saveAssessment();
  });
  form.addEventListener('change', () => {
    captureSetupDraft(form);
    saveAssessment();
  });
  const syncSetupConditionalFields = () => {
    let anotherPersonIsInvolved = false;
    const namedRoles = [];
    form.querySelectorAll('input[name="systemId"]').forEach((input, index) => {
      const prefix = `system-${index}`;
      const operator = form.querySelector(`#${prefix}-operator`)?.value;
      const checker = form.querySelector(`#${prefix}-checker`)?.value;
      const access = form.querySelector(`#${prefix}-access`)?.value;
      const evidenceBasis = form.querySelector(`#${prefix}-evidence-basis`)?.value;
      if (['other', 'both'].includes(operator) || ['other', 'shared'].includes(checker)) anotherPersonIsInvolved = true;
      if (['other', 'both'].includes(operator)) {
        const role = form.querySelector(`#${prefix}-operator-role`)?.value.trim();
        if (role) namedRoles.push(role);
      }
      if (['other', 'shared'].includes(checker)) {
        const role = form.querySelector(`#${prefix}-checker-role`)?.value.trim();
        if (role) namedRoles.push(role);
      }
      toggleConditionalField(`${prefix}-operator-role-field`, ['other', 'both'].includes(operator));
      toggleConditionalField(`${prefix}-checker-role-field`, ['other', 'shared'].includes(checker));
      toggleConditionalField(`${prefix}-checker-scope-field`, Boolean(checker) && checker !== 'unknown');
      toggleConditionalField(`${prefix}-permissions-field`, access === 'true');
      toggleConditionalField(`${prefix}-evidence-field`, evidenceBasis === 'confirmed');
    });
    if (anotherPersonIsInvolved && form.elements.otherHumanInvolved?.value !== 'yes') {
      form.elements.otherHumanInvolved.value = 'yes';
      assessment.project.otherHumanInvolved = 'yes';
      saveAssessment();
    }
    if (anotherPersonIsInvolved && !form.elements.otherHumanRole?.value.trim() && namedRoles.length) {
      const roles = [...new Set(namedRoles)].join('; ');
      form.elements.otherHumanRole.value = roles;
      assessment.project.otherHumanRole = roles;
      saveAssessment();
    }
    toggleConditionalField('other-human-role-field', form.elements.otherHumanInvolved?.value === 'yes');
    toggleConditionalField('other-human-activities-field', form.elements.otherHumanInvolved?.value === 'yes');
  };
  form.addEventListener('change', syncSetupConditionalFields);
  syncSetupConditionalFields();
  form.querySelectorAll('input[name="requiredBehaviors"]').forEach((input) => {
    input.addEventListener('change', limitBehaviors);
  });
  document.querySelector('#cancel-check').addEventListener('click', () => {
    captureSetupDraft(form);
    saveAssessment();
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
  if (focusId) window.requestAnimationFrame(() => {
    const target = document.getElementById(focusId);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'center', behavior: 'auto' });
  });
  else focusCurrentStep();
}

function systemEditor(system, index, count, errors = [], stage = stagePrompts(assessment.stage)) {
  const prefix = `system-${index}`;
  return `<article class="system-editor">
    <div class="system-editor-heading"><h2>AI tool ${index + 1}</h2>${count > 1 ? `<button class="text-button" type="button" data-remove-system="${escapeHTML(system.id)}" aria-label="Remove AI tool ${index + 1}${system.product ? `, ${escapeHTML(system.product)}` : ''}">Remove</button>` : ''}</div>
    <input type="hidden" name="systemId" value="${escapeHTML(system.id)}" />
    <div class="field-grid">
      <div class="field"><label for="${prefix}-product">AI product or tool <span class="required">Required</span></label><input id="${prefix}-product" name="systemProduct" value="${escapeHTML(system.product)}" placeholder="For example: ChatGPT, Claude, Gemini, or Copilot" required ${errorAttributes(errors, `${prefix}-product`)} /><small>If you do not know, enter “I do not know.” The Load Test will show what information is missing instead of guessing.</small>${fieldError(errors, `${prefix}-product`)}</div>
      <div class="field"><label for="${prefix}-model">Exact model or version <span class="required">Required</span></label><input id="${prefix}-model" name="systemModel" value="${escapeHTML(system.model)}" placeholder="Enter Unknown if needed" required ${errorAttributes(errors, `${prefix}-model`)} />${fieldError(errors, `${prefix}-model`)}</div>
      <div class="field field-span-2"><label for="${prefix}-role">${escapeHTML(stage.systemRoleQuestion)} <span class="required">Required</span></label><textarea id="${prefix}-role" name="systemRole" placeholder="For example: write website code, draft an article, create images, or compare options" required ${errorAttributes(errors, `${prefix}-role`)}>${escapeHTML(system.role)}</textarea>${fieldError(errors, `${prefix}-role`)}</div>
      <div class="field"><label for="${prefix}-operator">Who works directly with this AI tool? <span class="required">Required</span></label><select id="${prefix}-operator" name="systemOperator" required ${errorAttributes(errors, `${prefix}-operator`)}>${selectOptions([
        ['', 'Choose an answer'],
        ['me', 'I do'],
        ['other', 'Another person does'],
        ['both', 'Another person and I both do'],
        ['unknown', 'I do not know'],
      ], system.operator || '')}</select>${fieldError(errors, `${prefix}-operator`)}</div>
      <div class="field" id="${prefix}-operator-role-field" ${['other', 'both'].includes(system.operator) ? '' : 'hidden'}><label for="${prefix}-operator-role">What is that person’s role? <span class="required">Required</span></label><input id="${prefix}-operator-role" name="systemOperatorRole" value="${escapeHTML(system.operatorRole || '')}" placeholder="For example: developer, editor, or contractor" required ${errorAttributes(errors, `${prefix}-operator-role`)} /><small>Ask that person for the model, setup, access, and test records. Choose “I do not know” when you cannot verify a detail.</small>${fieldError(errors, `${prefix}-operator-role`)}</div>
      <div class="field"><label for="${prefix}-checker">Who is responsible for reviewing this AI’s work and making sure problems get fixed? <span class="required">Required</span></label><select id="${prefix}-checker" name="systemChecker" required ${errorAttributes(errors, `${prefix}-checker`)}>${selectOptions([
        ['', 'Choose an answer'],
        ['me', 'I review it'],
        ['operator', 'The person working directly with AI reviews it'],
        ['other', 'Another person reviews it'],
        ['shared', 'More than one person reviews different parts'],
        ['unknown', 'I do not know'],
      ], system.checker || '')}</select><small>The human reviewer is whoever can tell whether this AI’s work is right, require changes, and make sure mistakes are fixed. That may be you, the person using AI, someone else, or several people.</small>${fieldError(errors, `${prefix}-checker`)}</div>
      <div class="field" id="${prefix}-checker-role-field" ${['other', 'shared'].includes(system.checker) ? '' : 'hidden'}><label for="${prefix}-checker-role">What is the human reviewer’s role? <span class="required">Required</span></label><input id="${prefix}-checker-role" name="systemCheckerRole" value="${escapeHTML(system.checkerRole || '')}" placeholder="For example: technical lead, editor, or subject expert" required ${errorAttributes(errors, `${prefix}-checker-role`)} />${fieldError(errors, `${prefix}-checker-role`)}</div>
      <div class="field field-span-2" id="${prefix}-checker-scope-field" ${system.checker && system.checker !== 'unknown' ? '' : 'hidden'}><label for="${prefix}-checker-scope">What parts of the AI’s work can this person or group check and fix? <span class="required">Required</span></label><textarea id="${prefix}-checker-scope" name="systemCheckerScope" placeholder="For example: the developer can inspect, test, and correct all AI-assisted website code" required ${errorAttributes(errors, `${prefix}-checker-scope`)}>${escapeHTML(system.checkerScope || '')}</textarea><small>If different people review different parts, name each part and role. Say what no one can check. Run separate Load Tests if the jobs cannot be described clearly together.</small>${fieldError(errors, `${prefix}-checker-scope`)}</div>
      <div class="field field-span-2"><label for="${prefix}-authority">${escapeHTML(stage.systemAuthorityQuestion)} <span class="required">Required</span></label><select id="${prefix}-authority" name="systemAuthority" required ${errorAttributes(errors, `${prefix}-authority`)}><option value="">Choose one</option>${Object.entries(AUTHORITY_LABELS).map(([value, label]) => `<option value="${value}" ${system.proposedAuthority === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('')}</select><small>Choose what the AI is both allowed and technically able to do. For example, if it writes code but cannot publish the code, choose “Make work for a person to approve.”</small>${fieldError(errors, `${prefix}-authority`)}</div>
      <div class="field"><label for="${prefix}-access">Can this AI open or change accounts, files, code, data, or publishing tools?</label><select id="${prefix}-access" name="systemAccess">${triStateOptions(system.connectedAccess, 'No', 'Yes', 'I do not know')}</select></div>
      <div class="field" id="${prefix}-permissions-field" ${system.connectedAccess === true ? '' : 'hidden'}><label for="${prefix}-permissions">Is its access limited to only what this job needs?</label><select id="${prefix}-permissions" name="systemPermissions">${triStateOptions(system.permissionsConfirmed, 'No', 'Yes', 'I do not know')}</select></div>
      <div class="field field-span-2"><label for="${prefix}-setup">${escapeHTML(stage.systemSetupQuestion)} <span class="required">Required</span></label><textarea id="${prefix}-setup" name="systemSetup" placeholder="For example: typed instructions, uploaded files, saved memory, connected apps, data, tools, or account access" required ${errorAttributes(errors, `${prefix}-setup`)}>${escapeHTML(system.setup)}</textarea><small>If it gets only what someone types, say that. If you do not know, enter “I do not know.”</small>${fieldError(errors, `${prefix}-setup`)}</div>
      <div class="field field-span-2"><label for="${prefix}-evidence-basis">${escapeHTML(stage.systemRecordQuestion)}</label><select id="${prefix}-evidence-basis" name="systemEvidenceBasis">${selectOptions([
        ['confirmed', 'Yes, there is a saved record I can name or link'],
        ['reported', 'No, I do not have a saved record'],
        ['unknown', 'I do not know'],
      ], system.evidenceBasis || 'unknown')}</select><small>Your answer may come from memory, observation, a plan, or what someone told you. Choose “Yes” only when you can name or link a saved record.</small></div>
      <div class="field field-span-2" id="${prefix}-evidence-field" ${system.evidenceBasis === 'confirmed' ? '' : 'hidden'}><label for="${prefix}-evidence">Name or link the saved record <span class="required">Required</span></label><textarea id="${prefix}-evidence" name="systemEvidence" placeholder="For example: AI chat or prompt history, files given to AI, outputs, model or settings screen, permissions, GitHub history, or review notes" required ${errorAttributes(errors, `${prefix}-evidence`)}>${escapeHTML(system.evidence)}</textarea><small>You do not have to make these records public. Later questions ask whether the records show that this AI did its job well.</small>${fieldError(errors, `${prefix}-evidence`)}</div>
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
  const humanActivities = form.getAll('humanActivities');
  const otherHumanActivities = form.getAll('otherHumanActivities');
  const humanLoad = humanLoadFromForm(form);
  const failureScenario = String(form.get('failureScenario') || '').trim();
  const failureImpact = String(form.get('failureImpact') || '').trim();
  captureSetupDraft(formElement);
  assessment.completed = false;
  saveAssessment();

  const errors = [];
  if (!task) errors.push({ id: 'task', message: 'Tell us what you are making or doing.' });
  if (!intendedOutcome) errors.push({ id: 'outcome', message: 'Tell us what you want the finished work to accomplish.' });
  if (!['making', 'operating'].includes(String(form.get('aiUseFocus') || ''))) {
    errors.push({ id: 'ai-use-focus-group', message: 'Choose which use of AI this Load Test will check.' });
  }
  if (!humanActivities.length && !otherHumanActivities.length && !String(form.get('humanOther') || '').trim()) {
    errors.push({ id: 'human-activities-group', message: 'Choose at least one thing a person does in this project, or describe it in the box.' });
  }
  if (!['yes', 'no', 'unknown'].includes(String(form.get('otherHumanInvolved') || ''))) {
    errors.push({ id: 'other-human-involved', message: 'Tell us whether another person helps make, check, or approve this project.' });
  }
  if (form.get('otherHumanInvolved') === 'yes' && !String(form.get('otherHumanRole') || '').trim()) {
    errors.push({ id: 'other-human-role', message: 'Name the other person’s role.' });
  }
  if (form.get('otherHumanInvolved') === 'yes' && !otherHumanActivities.length && !String(form.get('humanOther') || '').trim()) {
    errors.push({ id: 'other-human-activities-field', message: 'Choose what the other person does, or describe it in the box.' });
  }
  if (!humanLoad) errors.push({ id: 'human-activities-group', message: 'Show what a person does in this project.' });
  if (!failureScenario) errors.push({ id: 'failure-scenario', message: 'Tell us the worst thing that could happen if AI makes a mistake or a person does not catch it.' });
  if (!failureImpact) errors.push({ id: 'failure-impact', message: 'Tell us who or what could be harmed and how.' });
  if (!['low', 'moderate', 'high', 'critical'].includes(String(form.get('consequence') || ''))) {
    errors.push({ id: 'consequence', message: 'Choose how serious the impact could be.' });
  }
  if (!workTypes.length) errors.push({ id: 'work-types-group', message: 'Choose at least one kind of work.' });
  if (!requiredBehaviors.length) errors.push({ id: 'behaviors-group', message: 'Choose at least one AI behavior you are counting on.' });
  assessment.project.systems.forEach((system, index) => {
    const prefix = `system-${index}`;
    if (!system.product) errors.push({ id: `${prefix}-product`, message: `Enter the name of AI tool ${index + 1}.` });
    if (!system.model) errors.push({ id: `${prefix}-model`, message: `Enter the model or version for AI tool ${index + 1}, or enter Unknown.` });
    if (!system.role) errors.push({ id: `${prefix}-role`, message: `Tell us what AI tool ${index + 1} does in this project.` });
    if (!['me', 'other', 'both', 'unknown'].includes(system.operator)) errors.push({ id: `${prefix}-operator`, message: `Choose who works directly with AI tool ${index + 1}.` });
    if (['other', 'both'].includes(system.operator) && !system.operatorRole) errors.push({ id: `${prefix}-operator-role`, message: `Name the role of the other person who works with AI tool ${index + 1}.` });
    if (!['me', 'operator', 'other', 'shared', 'unknown'].includes(system.checker)) errors.push({ id: `${prefix}-checker`, message: `Choose who is responsible for reviewing AI tool ${index + 1} and making sure problems get fixed.` });
    if (['other', 'shared'].includes(system.checker) && !system.checkerRole) errors.push({ id: `${prefix}-checker-role`, message: `Name the role of the person or people who review AI tool ${index + 1}.` });
    if (system.checker === 'operator' && system.operator === 'unknown') errors.push({ id: `${prefix}-checker`, message: `Choose “I do not know” for the reviewer, or identify who works directly with AI tool ${index + 1}.` });
    if (system.checker && system.checker !== 'unknown' && !system.checkerScope) errors.push({ id: `${prefix}-checker-scope`, message: `Describe what the reviewer can check and fix for AI tool ${index + 1}.` });
    if (!Object.hasOwn(AUTHORITY_LABELS, system.proposedAuthority)) errors.push({ id: `${prefix}-authority`, message: `Choose what AI tool ${index + 1} can do before a person checks or approves it.` });
    if (!system.setup) errors.push({ id: `${prefix}-setup`, message: `Tell us what AI tool ${index + 1} has to work with, or enter “I do not know.”` });
    if (system.evidenceBasis === 'confirmed' && !system.evidence) {
      errors.push({ id: `${prefix}-evidence`, message: `Name or link what you saved for AI tool ${index + 1}, or choose “No” or “I do not know.”` });
    }
  });
  if (errors.length) return renderSetup(errors, errors[0]?.id || '');
  const nextScopeKey = getAssessmentScopeKey(assessment);
  if (assessment.scopeKey && assessment.scopeKey !== nextScopeKey && Object.keys(assessment.answers || {}).length) {
    assessment.answers = {};
    assessment.currentQuestion = 0;
    assessment.currentQuestionId = '';
    currentQuestionIndex = 0;
    showToast('The AI job or human reviewer changed, so the earlier answers were cleared.');
  }
  assessment.scopeKey = nextScopeKey;
  const activeIds = new Set(activeQuestions().map(({ id }) => id));
  assessment.answers = Object.fromEntries(Object.entries(assessment.answers).filter(([id]) => activeIds.has(id)));
  saveAssessment();
  currentQuestionIndex = Math.min(currentQuestionIndex, activeQuestions().length - 1);
  checkView = 'questions';
  renderCheck();
}

function humanLoadFromForm(form) {
  const activityLabel = (id) => HUMAN_ACTIVITIES.find(([value]) => value === id)?.[1] || id;
  const personal = form.getAll('humanActivities').map(activityLabel);
  const other = form.getAll('otherHumanActivities').map(activityLabel);
  const directOperatorRole = form.getAll('systemOperatorRole').map((value) => String(value).trim()).find(Boolean);
  const otherRole = String(form.get('otherHumanRole') || '').trim() || directOperatorRole || 'Another person';
  const extra = String(form.get('humanOther') || '').trim();
  const parts = [];
  if (personal.length) parts.push(`You: ${personal.join('; ')}`);
  if (other.length) parts.push(`${otherRole}: ${other.join('; ')}`);
  if (extra) parts.push(`Other human work: ${extra}`);
  return parts.join('. ');
}

function captureSetupDraft(formElement) {
  const previousScopeKey = assessment.scopeKey;
  const form = new FormData(formElement);
  const systems = [...formElement.querySelectorAll('.system-editor')].map((editor) => {
    const fieldValue = (name) => editor.querySelector(`[name="${name}"]`)?.value || '';
    const operator = fieldValue('systemOperator');
    const checker = fieldValue('systemChecker');
    const authority = fieldValue('systemAuthority');
    const evidenceBasis = fieldValue('systemEvidenceBasis');
    return makeSystem({
      id: String(fieldValue('systemId')),
      product: String(fieldValue('systemProduct')).trim(),
      model: String(fieldValue('systemModel')).trim(),
      role: String(fieldValue('systemRole')).trim(),
      operator: ['me', 'other', 'both', 'unknown'].includes(operator)
        ? operator
        : '',
      operatorRole: String(fieldValue('systemOperatorRole')).trim(),
      checker: ['me', 'operator', 'other', 'shared', 'unknown'].includes(checker)
        ? checker
        : '',
      checkerRole: String(fieldValue('systemCheckerRole')).trim(),
      checkerScope: String(fieldValue('systemCheckerScope')).trim(),
      proposedAuthority: Object.hasOwn(AUTHORITY_LABELS, authority) ? authority : '',
      setup: String(fieldValue('systemSetup')).trim(),
      evidence: String(fieldValue('systemEvidence')).trim(),
      evidenceBasis: ['confirmed', 'reported', 'unknown'].includes(evidenceBasis)
        ? evidenceBasis
        : 'unknown',
      connectedAccess: parseTriState(fieldValue('systemAccess')),
      permissionsConfirmed: parseTriState(fieldValue('systemPermissions')),
    });
  });
  const primarySystemId = String(form.get('primarySystemId') || systems[0]?.id || '');
  const primarySystem = systems.find((system) => system.id === primarySystemId) || systems[0];
  const connectedSystems = systems.filter((system) => system.connectedAccess === true);
  assessment.project = {
    ...assessment.project,
    name: String(form.get('name') || '').trim(),
    task: String(form.get('task') || '').trim(),
    aiUseFocus: ['making', 'operating'].includes(form.get('aiUseFocus')) ? form.get('aiUseFocus') : '',
    intendedOutcome: String(form.get('intendedOutcome') || '').trim(),
    humanLoad: humanLoadFromForm(form),
    humanActivities: form.getAll('humanActivities').filter((value) => HUMAN_ACTIVITIES.some(([id]) => id === value)),
    otherHumanInvolved: ['yes', 'no', 'unknown'].includes(form.get('otherHumanInvolved')) ? form.get('otherHumanInvolved') : '',
    otherHumanRole: String(form.get('otherHumanRole') || '').trim(),
    otherHumanActivities: form.getAll('otherHumanActivities').filter((value) => HUMAN_ACTIVITIES.some(([id]) => id === value)),
    humanOther: String(form.get('humanOther') || '').trim(),
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
  const nextScopeKey = getAssessmentScopeKey(assessment);
  if (previousScopeKey && previousScopeKey !== nextScopeKey && Object.keys(assessment.answers || {}).length) {
    assessment.answers = {};
    assessment.completed = false;
    assessment.currentQuestion = 0;
    assessment.currentQuestionId = '';
    currentQuestionIndex = 0;
    showToast('The project, AI job, or human reviewer changed, so the earlier answers were cleared.');
  }
  assessment.scopeKey = nextScopeKey;
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
  return `${system.product || 'Unnamed AI tool'}${model}${role}`;
}

function systemCheckerLabel(system) {
  if (!system) return 'Not recorded';
  if (system.checker === 'me') return 'You';
  if (system.checker === 'operator') {
    if (system.operator === 'me') return 'You, as the person working directly with AI';
    if (system.operator === 'both') return `You and ${system.operatorRole || 'the other person working directly with AI'}`;
    return system.operatorRole || 'The person working directly with AI';
  }
  if (system.checker === 'other') return system.checkerRole || 'Another person';
  if (system.checker === 'shared') return system.checkerRole || 'More than one person';
  return 'Unknown';
}

function systemOperatorLabel(system) {
  if (!system) return 'Not recorded';
  if (system.operator === 'me') return 'You';
  if (system.operator === 'other') return system.operatorRole || 'Another person';
  if (system.operator === 'both') return `You and ${system.operatorRole || 'another person'}`;
  return 'Unknown';
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
  const selectedLevel = answer.status === 'unknown' ? 'unknown' : answer.level;
  const primarySystem = assessment.project.systems.find((system) => system.id === assessment.project.primarySystemId) || assessment.project.systems[0];
  const progress = Math.round(((currentQuestionIndex + 1) / (questions.length + 1)) * 100);
  const errors = normalizeFormErrors(error);
  document.title = `${errors.length ? 'Error: ' : ''}Load Test | evAIdence`;

  main.innerHTML = `<div class="page">
    <div class="assessment-shell">
      <section class="assessment-main question-card">
        <div class="progress-row"><span>${escapeHTML(DIMENSIONS[question.dimension]?.label || question.dimension || 'EVIDENCE')}</span><span>Question ${currentQuestionIndex + 1} of ${questions.length}</span></div>
        <div class="progress-track" role="progressbar" aria-label="Load Test progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}" aria-valuetext="Question ${currentQuestionIndex + 1} of ${questions.length}"><span style="width: ${progress}%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${escapeHTML(question.prompt)}</h1>
        <p class="question-why">${escapeHTML(question.why || 'Choose the answer that best describes what is true now, not what you intend to do later.')}</p>
        ${question.dimension === 'humanAssurance' ? `<p class="adaptive-question-note"><strong>Answer about:</strong> ${escapeHTML(systemCheckerLabel(primarySystem))}, for this part of the AI job: ${escapeHTML(primarySystem?.checkerScope || 'not yet described')}.</p>` : ''}
        ${question.trigger?.description ? `<p class="adaptive-question-note"><strong>Why you are seeing this question:</strong> ${escapeHTML(question.trigger.description)}</p>` : ''}
        ${renderErrorSummary(errors)}
        <form id="question-form">
          <fieldset class="fieldset" id="answer-choice-group" ${groupErrorAttributes(errors, 'answer-choice-group')}>
            <legend>Choose the description that is true now.</legend>
            <div class="option-stack">
            ${question.options.map((option) => `<label class="option-card">
              <input type="radio" name="level" value="${option.value}" ${String(selectedLevel) === String(option.value) ? 'checked' : ''} />
              <span><strong>${escapeHTML(option.label)}</strong><span>${escapeHTML(option.description || '')}</span></span>
            </label>`).join('')}
            </div>
            ${fieldError(errors, 'answer-choice-group')}
          </fieldset>
          <div class="evidence-box" id="question-evidence-box" ${selectedLevel === 'unknown' ? 'hidden' : ''}>
            <h2>Can you name something saved from this project that shows this answer is true?</h2>
            <p class="helper-text">This could be a test result, work sample, screenshot, note, log, or link. The Load Test records what you name but does not open or inspect it. A written plan can show what you prepared, but it cannot show that the plan worked.</p>
            ${question.evidenceGuidance ? `<p class="evidence-guidance"><strong>A useful record could be:</strong> ${escapeHTML(question.evidenceGuidance)}</p>` : ''}
            <fieldset class="fieldset" id="evidence-basis-group" ${groupErrorAttributes(errors, 'evidence-basis-group')}><legend class="sr-only">Evidence basis</legend><div class="choice-grid choice-grid-compact">
                ${evidenceChoice('confirmed', 'Yes, I can name or link it', 'I have something saved from this project that shows why I chose this answer', answer.basis)}
                ${evidenceChoice('reported', 'No saved record', 'This answer is based on memory, observation, a plan, or what someone told me', answer.basis)}
              </div>${fieldError(errors, 'evidence-basis-group')}</fieldset>
            <div class="field-grid" style="margin-top: 1rem">
              <div class="field">
                <label for="evidence-note">Name the saved record, or explain what is missing</label>
                <input id="evidence-note" name="evidenceNote" value="${escapeHTML(answer.evidenceNote || '')}" placeholder="For example: October 15 test results, GitHub test report, or no permission record available" ${errorAttributes(errors, 'evidence-note')} />
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

  const questionForm = document.querySelector('#question-form');
  const saveQuestionDraft = () => {
    const draft = answerFromQuestionForm(questionForm);
    if (draft.level !== undefined || draft.basis || draft.evidenceNote || draft.evidenceUrl) {
      assessment.answers[question.id] = draft;
      saveAssessment();
    }
  };
  const syncQuestionEvidence = () => {
    const selected = questionForm.querySelector('input[name="level"]:checked')?.value;
    toggleConditionalField('question-evidence-box', selected !== 'unknown');
  };
  questionForm.addEventListener('submit', (event) => submitQuestion(event, question, questions.length));
  questionForm.addEventListener('input', saveQuestionDraft);
  questionForm.addEventListener('change', () => {
    syncQuestionEvidence();
    saveQuestionDraft();
  });
  syncQuestionEvidence();
  document.querySelector('#question-back').addEventListener('click', () => {
    saveQuestionDraft();
    if (currentQuestionIndex === 0) checkView = 'setup';
    else currentQuestionIndex -= 1;
    renderCheck();
  });
  bindErrorSummaryLinks();
  focusCurrentStep();
}

function answerFromQuestionForm(formElement) {
  const form = new FormData(formElement);
  const rawLevel = form.get('level');
  const scopeKey = assessment.scopeKey || getAssessmentScopeKey(assessment);
  if (rawLevel === 'unknown') {
    return {
      status: 'unknown',
      level: null,
      basis: 'unknown',
      evidenceNote: '',
      evidenceUrl: '',
      scopeKey,
    };
  }
  return {
    status: rawLevel === null ? undefined : 'known',
    level: rawLevel === null ? undefined : Number(rawLevel),
    basis: form.get('basis') || undefined,
    evidenceNote: String(form.get('evidenceNote') || '').trim(),
    evidenceUrl: String(form.get('evidenceUrl') || '').trim(),
    scopeKey,
  };
}

function evidenceChoice(value, label, description, selected) {
  return `<label class="choice">
    <input type="radio" name="basis" value="${value}" ${selected === value ? 'checked' : ''} />
    <span><strong>${label}</strong><span>${description}</span></span>
  </label>`;
}

function evidenceBasisDisplay(value) {
  return ({
    confirmed: 'Yes, something saved was named',
    reported: 'No saved record; answered from memory, observation, a plan, or what someone reported',
    unknown: 'I do not know',
  })[value] || 'Unanswered';
}

function submitQuestion(event, question, count) {
  event.preventDefault();
  const answer = answerFromQuestionForm(event.currentTarget);
  const errors = [];
  if (answer.level === undefined) errors.push({ id: 'answer-choice-group', message: 'Choose the description that is true now.' });
  if (answer.status !== 'unknown' && !answer.basis) errors.push({ id: 'evidence-basis-group', message: 'Choose whether you can name something saved that shows why you selected this answer.' });
  if (errors.length) return renderQuestion(errors, answer);
  if (!isValidAnswer(question, answer)) {
    return renderQuestion([{ id: 'evidence-note', message: 'Name or link what you saved, or choose the memory, observation, or plan option.' }], answer);
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
  const primarySystem = p.systems.find((system) => system.id === p.primarySystemId) || p.systems[0];
  const summaryLabel = `${p.name || 'Project'} · ${stageLabel(assessment.stage)} · ${primarySystem?.product || 'AI tool'}`;
  const summaryOpen = arrangementMedia.matches ? '' : ' open';
  return `<details class="assessment-summary"${summaryOpen}>
    <summary>Project reminder: ${escapeHTML(summaryLabel)}</summary>
    <h2 class="summary-heading">The project you are answering about</h2>
    <p class="helper-text">Use this reminder to keep every answer about the same project, people, and AI job. It does not change your score.</p>
    <dl class="summary-list">
      <div><dt>Stage</dt><dd>${escapeHTML(stageLabel(assessment.stage))}</dd></div>
      <div><dt>AI tools</dt><dd>${p.systems.length ? p.systems.map((system) => `${escapeHTML(systemSummary(system))}${system.id === primarySystem?.id ? ' <strong>(tool being tested)</strong>' : ''}`).join('<br />') : 'Not defined yet'}</dd></div>
      <div><dt>What you are making</dt><dd>${escapeHTML(p.task || 'Not defined yet')}</dd></div>
      <div><dt>What AI can do without approval at each step</dt><dd>${escapeHTML(AUTHORITY_LABELS[primarySystem?.proposedAuthority || p.proposedAuthority] || 'Not defined yet')}</dd></div>
      <div><dt>Who reviews this AI job</dt><dd>${escapeHTML(systemCheckerLabel(primarySystem))}</dd></div>
      <div><dt>What that reviewer covers</dt><dd>${escapeHTML(primarySystem?.checkerScope || 'Not recorded yet')}</dd></div>
      <div><dt>What the finished work should do</dt><dd>${escapeHTML(p.intendedOutcome || 'Not defined yet')}</dd></div>
      <div><dt>What people do</dt><dd>${escapeHTML(p.humanLoad || 'Not defined yet')}</dd></div>
      <div><dt>Most serious problem</dt><dd>${escapeHTML(p.failureScenario || 'Not defined yet')}</dd></div>
    </dl>
    <p class="helper-text">Saved only in this browser as you work.</p>
  </details>`;
}

function stageLabel(stage) {
  return {
    plan: 'Before work begins',
    build: 'Work in progress',
    release: 'Before launch',
    live: 'Already in use',
  }[stage] || 'Load Test';
}

function validationStatusDisplay(status) {
  return ({
    'Pilot observed': 'Pilot record identified',
    Repeated: 'Repeated-use record identified',
    Sustained: 'Sustained-use record identified',
  })[status] || status;
}

function stagePrompts(stage) {
  return {
    plan: {
      setupHeading: 'Tell us about the project you are planning.',
      setupIntro: 'Start with the project, then show what each AI tool and each person will do.',
      scopeHelp: 'Answer only about planning, making, checking, approving, and launching this version. Do not include work that starts after launch unless AI will keep working inside the finished project.',
      taskQuestion: 'What are you making?',
      taskHelp: 'For example: a website, course, book, article, image, video, report, decision, or automated task.',
      outcomeQuestion: 'What should the finished work do for people?',
      outcomeHelp: 'For example: help people learn a skill, explain an idea, support a decision, or complete a task.',
      humanActivityQuestion: 'What work will you personally do to make or check this project?',
      humanActivityHelp: 'Count the work you will do to make, check, or approve this version.',
      otherHumanQuestion: 'Will another person also help make, check, or approve this project?',
      otherHumanRoleQuestion: 'If this is a different person, what will their role be?',
      otherHumanActivityQuestion: 'What work will that person do to make or check this project?',
      humanOtherQuestion: 'Will you or another person do anything else?',
      systemsQuestion: 'Which AI tools and models will you use?',
      primarySystemQuestion: 'Which AI job do you want this Load Test to focus on?',
      systemRoleQuestion: 'What job will this AI tool do in this project?',
      systemSetupQuestion: 'What will this AI have to work with?',
      systemAuthorityQuestion: 'What will this AI be allowed to do without a person approving each step?',
      systemRecordQuestion: 'Do you have a saved record showing what this AI will use and what job it will do?',
      behaviorQuestion: 'What will this AI need to do well?',
    },
    build: {
      setupHeading: 'Tell us about the project you are working on.',
      setupIntro: 'Show what you are making, who works directly with AI, and what each person and AI tool is doing now.',
      scopeHelp: 'Answer only about making and checking this version before it is ready. Do not include work that starts after launch unless AI will keep working inside the finished project.',
      taskQuestion: 'What are you making?',
      taskHelp: 'For example: a website, course, book, article, image, video, report, decision, or automated task.',
      outcomeQuestion: 'What should the finished work do for people?',
      outcomeHelp: 'For example: help people learn a skill, explain an idea, support a decision, or complete a task.',
      humanActivityQuestion: 'What work are you personally doing to make or check this project?',
      humanActivityHelp: 'Count only the work you are doing to make, check, or approve this version.',
      otherHumanQuestion: 'Is another person also helping make, check, or approve this project?',
      otherHumanRoleQuestion: 'If this is a different person, what is their role?',
      otherHumanActivityQuestion: 'What work is that person doing to make or check this project?',
      humanOtherQuestion: 'Are you or another person doing anything else?',
      systemsQuestion: 'Which AI tools and models are you using?',
      primarySystemQuestion: 'Which AI job do you want this Load Test to focus on?',
      systemRoleQuestion: 'What job does this AI tool do in this project?',
      systemSetupQuestion: 'What does this AI have to work with?',
      systemAuthorityQuestion: 'What can this AI do without a person approving each step?',
      systemRecordQuestion: 'Do you have a saved record showing what this AI uses, what job it does, or what it produces?',
      behaviorQuestion: 'What does this AI need to do well?',
    },
    release: {
      setupHeading: 'Tell us about the project you are ready to launch.',
      setupIntro: 'Show what you made, who worked directly with AI, and what each person and AI tool did before launch.',
      scopeHelp: 'Answer only about making, checking, approving, and launching this version. Do not include teaching, marketing, customer support, or other work that starts after launch unless AI will also do that work.',
      taskQuestion: 'What did you make?',
      taskHelp: 'For example: a website, course, book, article, image, video, report, decision, or automated task.',
      outcomeQuestion: 'What should the finished work do for people?',
      outcomeHelp: 'For example: help people learn a skill, explain an idea, support a decision, or complete a task.',
      humanActivityQuestion: 'What work did you personally do to make or check this project?',
      humanActivityHelp: 'Count only the work you did to make, check, or approve this version.',
      otherHumanQuestion: 'Did another person also help make, check, or approve this project?',
      otherHumanRoleQuestion: 'If this was a different person, what was their role?',
      otherHumanActivityQuestion: 'What work did that person do to make or check this project?',
      humanOtherQuestion: 'Did you or another person do anything else?',
      systemsQuestion: 'Which AI tools and models did you use?',
      primarySystemQuestion: 'Which AI job do you want this Load Test to focus on?',
      systemRoleQuestion: 'What job did this AI tool do in this project?',
      systemSetupQuestion: 'What did this AI have to work with?',
      systemAuthorityQuestion: 'What was this AI allowed to do without a person approving each step?',
      systemRecordQuestion: 'Do you have a saved record showing what this AI used, what job it did, or what it produced?',
      behaviorQuestion: 'What did this AI need to do well?',
    },
    live: {
      setupHeading: 'Tell us about the project people are already using.',
      setupIntro: 'Show what the project does now, who works directly with AI, and what each person and AI tool does during use.',
      scopeHelp: 'Answer about the work people and AI do now. Include work after launch only when it is part of how this project operates.',
      taskQuestion: 'What are people using now?',
      taskHelp: 'For example: a website, course, book, article, image, video, report, decision, or automated task.',
      outcomeQuestion: 'What should this work keep doing for people?',
      outcomeHelp: 'Describe the useful result people should continue to receive.',
      humanActivityQuestion: 'What work do you personally do to run or check this project?',
      humanActivityHelp: 'Count the work you do now to check, approve, monitor, or correct this project.',
      otherHumanQuestion: 'Does another person also help check, approve, monitor, or correct this project?',
      otherHumanRoleQuestion: 'If this is a different person, what is their role?',
      otherHumanActivityQuestion: 'What work does that person do to run or check this project?',
      humanOtherQuestion: 'Do you or another person do anything else?',
      systemsQuestion: 'Which AI tools and models are you using?',
      primarySystemQuestion: 'Which AI job do you want this Load Test to focus on?',
      systemRoleQuestion: 'What job does this AI tool do in this project?',
      systemSetupQuestion: 'What does this AI have to work with?',
      systemAuthorityQuestion: 'What can this AI do without a person approving each step?',
      systemRecordQuestion: 'Do you have a saved record showing what this AI uses, what job it does, or what it produces?',
      behaviorQuestion: 'What does this AI need to keep doing well?',
    },
  }[stage] || {
    setupHeading: 'Tell us about the project.',
    setupIntro: 'Show what you are making and what each person and AI tool does.',
    scopeHelp: 'Answer only about this project and this version.',
    taskQuestion: 'What are you making or doing?',
    taskHelp: 'For example: a website, course, book, article, image, video, report, decision, or automated task.',
    outcomeQuestion: 'What should the finished work do for people?',
    outcomeHelp: 'Describe the useful result you want.',
    humanActivityQuestion: 'What work do you personally do to make or check this project?',
    humanActivityHelp: 'Count the work you do to make, check, or approve this version.',
    otherHumanQuestion: 'Does another person also help make, check, or approve this project?',
    otherHumanRoleQuestion: 'If this is a different person, what is their role?',
    otherHumanActivityQuestion: 'What work does that person do to make or check this project?',
    humanOtherQuestion: 'Do you or another person do anything else?',
    systemsQuestion: 'Which AI tools and models are you using?',
    primarySystemQuestion: 'Which AI job do you want this Load Test to focus on?',
    systemRoleQuestion: 'What job does this AI tool do in this project?',
    systemSetupQuestion: 'What does this AI have to work with?',
    systemAuthorityQuestion: 'What can this AI do without a person approving each step?',
    systemRecordQuestion: 'Do you have a saved record showing what this AI uses, what job it does, or what it produces?',
    behaviorQuestion: 'What does this AI need to do well?',
  };
}

function aiUsePrompts(stage) {
  const commonMaking = 'For example, drafting words, making images, writing code, researching, or testing.';
  const commonOperating = 'For example, a chatbot, recommendation feature, agent, or automated process runs inside the finished project.';
  return ({
    plan: {
      makingLabel: 'AI will help make this project',
      makingDescription: commonMaking,
      operatingLabel: 'AI will work inside the finished project',
      operatingDescription: commonOperating,
    },
    build: {
      makingLabel: 'AI is helping make this project',
      makingDescription: commonMaking,
      operatingLabel: 'AI will work inside the finished project',
      operatingDescription: commonOperating,
    },
    release: {
      makingLabel: 'AI helped make this project',
      makingDescription: commonMaking,
      operatingLabel: 'AI will keep working inside the finished project',
      operatingDescription: commonOperating,
    },
    live: {
      makingLabel: 'AI helped make this project',
      makingDescription: commonMaking,
      operatingLabel: 'AI works inside the finished project now',
      operatingDescription: commonOperating,
    },
  })[stage] || {
    makingLabel: 'AI helps make this project',
    makingDescription: commonMaking,
    operatingLabel: 'AI works inside the finished project',
    operatingDescription: commonOperating,
  };
}

function reviewPrompts(stage, proposedAuthority) {
  const autonomous = proposedAuthority === 'A3';
  const prompts = {
    plan: {
      heading: 'Confirm what the project plan requires.',
      intro: 'Answer with what is planned or already prepared. These answers show how much work and risk can reach people before someone can step in.',
      accessCallout: 'Confirm the accounts, files, data, publishing access, and other permissions each AI tool is expected to have.',
      approvalQuestion: autonomous
        ? 'Will the person or group responsible for review approve the rules for what AI can and cannot do, and be able to change or stop them?'
        : 'Will the person or group responsible for reviewing this AI’s work approve it before it can affect anyone?',
      reversibleQuestion: 'If AI will take an action, will someone responsible be able to undo it or restore the previous version?',
      sensitiveQuestion: 'Will AI have access to confidential, regulated, personal, or otherwise sensitive information?',
      dataApprovalQuestion: 'If AI will use sensitive information, will an authorized person approve that use?',
      monitoringQuestion: 'If AI will act repeatedly or on its own, will someone responsible be able to see and stop what it is doing?',
      failureQuestion: 'Is there a serious known problem in the plan that still needs to be fixed?',
      evidenceLegend: 'Can you name something saved that shows these plans and controls are defined?',
      evidenceHelp: 'A saved plan, approval, permission record, or test can show what is prepared. It cannot show that the plan worked unless someone has already tested it.',
    },
    build: {
      heading: 'Confirm what is in place while you work.',
      intro: 'These answers show how much work and risk can reach people before someone can step in. They do not grant or deny permission to proceed.',
      accessCallout: 'Confirm the accounts, files, data, publishing access, and other permissions each AI tool has now.',
      approvalQuestion: autonomous
        ? 'Has the person or group responsible for review approved the rules for what AI can and cannot do, and can they change or stop them?'
        : 'Does the person or group responsible for reviewing this AI’s work approve it before it can affect anyone?',
      reversibleQuestion: 'If AI takes an action, can someone responsible undo it or restore the previous version?',
      sensitiveQuestion: 'Does AI have access to confidential, regulated, personal, or otherwise sensitive information?',
      dataApprovalQuestion: 'If AI uses sensitive information, has an authorized person approved that use?',
      monitoringQuestion: 'If AI acts repeatedly or on its own, can someone responsible see and stop what it is doing?',
      failureQuestion: 'Has anyone found a serious problem that still needs to be fixed?',
      evidenceLegend: 'Can you name something saved that shows these answers are true now?',
      evidenceHelp: 'Choose “Yes” only if you can name a current approval, permission record, test, observation, or result that covers every important answer above.',
    },
    release: {
      heading: 'Confirm what was in place before launch.',
      intro: 'These answers show what could reach people before someone reviewed, corrected, or stopped it. They do not grant or deny permission to launch.',
      accessCallout: 'Confirm the accounts, files, data, publishing access, and other permissions each AI tool had while this version was made.',
      approvalQuestion: autonomous
        ? 'Did the person or group responsible for review approve the rules for what AI could and could not do, and can they change or stop them?'
        : 'Did the person or group responsible for reviewing this AI’s work approve it before it could affect anyone?',
      reversibleQuestion: 'If AI took an action, could someone responsible undo it or restore the previous version?',
      sensitiveQuestion: 'Did AI have access to confidential, regulated, personal, or otherwise sensitive information?',
      dataApprovalQuestion: 'If AI used sensitive information, did an authorized person approve that use?',
      monitoringQuestion: 'If AI acted repeatedly or on its own, could someone responsible see and stop what it was doing?',
      failureQuestion: 'Did anyone find a serious problem that still needs to be fixed?',
      evidenceLegend: 'Can you name something saved that shows these answers were true before launch?',
      evidenceHelp: 'Choose “Yes” only if you can name an approval, permission record, test, observation, or result that covers every important answer above.',
    },
    live: {
      heading: 'Confirm what is in place during use.',
      intro: 'These answers show how much work and risk can reach people before someone can step in. They do not grant or deny permission to continue.',
      accessCallout: 'Confirm the accounts, files, data, publishing access, and other permissions each AI tool has during use.',
      approvalQuestion: autonomous
        ? 'Has the person or group responsible for review approved the rules for what AI can and cannot do, and can they change or stop them?'
        : 'Does the person or group responsible for reviewing this AI’s work approve it before it affects anyone?',
      reversibleQuestion: 'If AI takes an action, can someone responsible undo it or restore the previous version?',
      sensitiveQuestion: 'Does AI have access to confidential, regulated, personal, or otherwise sensitive information?',
      dataApprovalQuestion: 'If AI uses sensitive information, has an authorized person approved that use?',
      monitoringQuestion: 'If AI acts repeatedly or on its own, can someone responsible see and stop what it is doing?',
      failureQuestion: 'Has anyone found a serious problem that still needs to be fixed?',
      evidenceLegend: 'Can you name something saved that shows these answers are true during use?',
      evidenceHelp: 'Choose “Yes” only if you can name a current approval, permission record, test, observation, or result that covers every important answer above.',
    },
  };
  return prompts[stage] || prompts.build;
}

function renderReview(error = '') {
  const questions = activeQuestions();
  const p = assessment.project;
  const needsApproval = p.proposedAuthority !== 'A0';
  const needsReversibility = ['A2', 'A3'].includes(p.proposedAuthority) || p.workTypes.includes('automation') || p.workTypes.includes('software');
  const needsMonitoring = p.proposedAuthority === 'A3' || p.workTypes.includes('automation');
  const review = reviewPrompts(assessment.stage, p.proposedAuthority);
  main.innerHTML = `<div class="page">
    <div class="assessment-shell">
      <section class="assessment-main setup-card">
        <div class="progress-row"><span>LOAD TEST REVIEW</span><span>Review before your result</span></div>
        <div class="progress-track" role="progressbar" aria-label="Load Test progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="94" aria-valuetext="Final review before result"><span style="width: 94%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${escapeHTML(review.heading)}</h1>
        <p class="question-why">${escapeHTML(review.intro)}</p>
        ${error ? `<p class="inline-error" role="alert" tabindex="-1">${escapeHTML(error)}</p>` : ''}
        <form id="review-form">
          <div class="callout"><p><strong>Confirm AI access:</strong> ${escapeHTML(review.accessCallout)}</p></div>
          <div class="field-grid">
            ${systemReviewFields(p.systems, assessment.stage)}
            <div class="field" id="approval-field" ${needsApproval ? '' : 'hidden'}>
              <label for="humanApproval">${escapeHTML(review.approvalQuestion)}</label>
              <select id="humanApproval" name="humanApprovalBeforeConsequence" required>${triStateOptions(p.humanApprovalBeforeConsequence, 'No', 'Yes', 'I cannot determine')}</select>
            </div>
            <div class="field" id="reversible-field" ${needsReversibility ? '' : 'hidden'}>
              <label for="reversible">${escapeHTML(review.reversibleQuestion)}</label>
              <select id="reversible" name="actionsAreReversible" required>${triStateOptions(p.actionsAreReversible, 'No', 'Yes', 'I cannot determine')}</select>
            </div>
            <div class="field">
              <label for="sensitiveData">${escapeHTML(review.sensitiveQuestion)}</label>
              <select id="sensitiveData" name="sensitiveData" required>${triStateOptions(p.sensitiveData, 'No', 'Yes', 'I cannot determine')}</select>
            </div>
            <div class="field" id="data-authorization-field" ${p.sensitiveData === true || p.sensitiveData === null ? '' : 'hidden'}>
              <label for="dataAuthorization">${escapeHTML(review.dataApprovalQuestion)}</label>
              <select id="dataAuthorization" name="dataAuthorizationConfirmed" required>${triStateOptions(p.dataAuthorizationConfirmed, 'No', 'Yes', 'I cannot determine')}</select>
            </div>
            <div class="field" id="monitoring-field" ${needsMonitoring ? '' : 'hidden'}>
              <label for="monitoring">${escapeHTML(review.monitoringQuestion)}</label>
              <select id="monitoring" name="monitoringConfirmed" required>${triStateOptions(p.monitoringConfirmed, 'No', 'Yes', 'I cannot determine')}</select>
            </div>
            <div class="field">
              <label for="failure">${escapeHTML(review.failureQuestion)}</label>
              <select id="failure" name="unresolvedMaterialFailure" required>${triStateOptions(p.unresolvedMaterialFailure, 'No', 'Yes', 'I cannot determine')}</select>
            </div>
          </div>

          ${assessment.stage === 'live' ? liveEvidenceFields(p) : ''}

          <fieldset class="fieldset" style="margin-top: 1.5rem">
            <legend>${escapeHTML(review.evidenceLegend)}</legend>
            <p class="helper-text">${escapeHTML(review.evidenceHelp)} If some answers have no record, choose “No.”</p>
            <div class="field-grid">
              <div class="field">
                <label for="review-evidence-basis">Can you name the saved records?</label>
                <select id="review-evidence-basis" name="reviewEvidenceBasis" required>${selectOptions([
                  ['confirmed', 'Yes, I can name or link them'],
                  ['reported', 'No saved record. I am answering from memory, observation, a plan, or what someone told me'],
                  ['unknown', 'I do not know'],
                ], p.reviewEvidenceBasis || 'unknown')}</select>
              </div>
              <div class="field">
                <label for="review-evidence-note">Record or result</label>
                <input id="review-evidence-note" name="reviewEvidenceNote" value="${escapeHTML(p.reviewEvidenceNote || '')}" placeholder="Name the approval, permission, stop, return-to-an-earlier-version, or observation record" />
              </div>
              <div class="field field-span-2">
                <label for="review-evidence-url">Evidence link <span class="helper-text">Optional</span></label>
                <input id="review-evidence-url" name="reviewEvidenceUrl" type="url" value="${escapeHTML(p.reviewEvidenceUrl || '')}" placeholder="https://" />
              </div>
            </div>
          </fieldset>

          <details class="optional-review" ${p.independentReviewerName ? 'open' : ''}>
            <summary>Did someone else review the evidence? <span class="helper-text">Optional</span></summary>
            <p class="helper-text">Complete this only if another qualified person checked the important records and you can say what they reviewed.</p>
            <div class="field-grid">
              <div class="field"><label for="check-reviewer-name">Reviewer name</label><input id="check-reviewer-name" name="independentReviewerName" value="${escapeHTML(p.independentReviewerName)}" /></div>
              <div class="field"><label for="check-reviewer-role">Reviewer role</label><input id="check-reviewer-role" name="independentReviewerRole" value="${escapeHTML(p.independentReviewerRole)}" /></div>
              <div class="field field-span-2"><label for="check-reviewer-scope">What records did they review, and what did they not review?</label><textarea id="check-reviewer-scope" name="independentReviewScope">${escapeHTML(p.independentReviewScope)}</textarea></div>
              <div class="field"><label for="check-reviewer-date">Review date</label><input id="check-reviewer-date" name="independentReviewDate" type="date" value="${escapeHTML(p.independentReviewDate)}" /></div>
              <div class="field"><label for="check-reviewer-evidence">Review record or confirmation</label><input id="check-reviewer-evidence" name="independentReviewEvidence" value="${escapeHTML(p.independentReviewEvidence || '')}" placeholder="Record name, confirmation, or link" /></div>
            </div>
          </details>

          <h2 style="margin-top: 2rem">Review your evidence answers</h2>
          <div class="review-list">
            ${questions.map((question, index) => {
              const answer = assessment.answers[question.id];
              const answerValue = answer?.status === 'unknown' ? 'unknown' : answer?.level;
              const option = question.options.find((item) => String(item.value) === String(answerValue));
              return `<div class="review-item">
                <div><strong>${escapeHTML(question.prompt)}</strong><p>${escapeHTML(option?.label || 'Unanswered')}${answer?.status === 'unknown' ? '' : ` · ${escapeHTML(evidenceBasisDisplay(answer?.basis))}`}</p></div>
                <button class="text-button" type="button" data-edit-question="${index}">Edit</button>
              </div>`;
            }).join('')}
          </div>

          <div class="callout callout-warning" style="margin-top: 1.5rem">
            <p><strong>Before you calculate:</strong> this is a self-assessment. “Yes” means you named something saved from this project that shows why you chose an answer. This tool has not opened or inspected it, and the answer does not mean an independent reviewer certified it.</p>
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

  const reviewForm = document.querySelector('#review-form');
  reviewForm.addEventListener('submit', submitReview);
  const saveReviewDraft = () => {
    captureReviewDraft(reviewForm);
    saveAssessment();
  };
  reviewForm.addEventListener('input', saveReviewDraft);
  reviewForm.addEventListener('change', saveReviewDraft);
  const syncConditionalReviewFields = () => {
    toggleConditionalField('approval-field', needsApproval);
    toggleConditionalField('reversible-field', needsReversibility);
    toggleConditionalField('data-authorization-field', ['true', 'unknown'].includes(document.querySelector('#sensitiveData').value));
    toggleConditionalField('monitoring-field', needsMonitoring);
  };
  document.querySelector('#sensitiveData').addEventListener('change', syncConditionalReviewFields);
  syncConditionalReviewFields();
  document.querySelector('#review-back').addEventListener('click', () => {
    saveReviewDraft();
    currentQuestionIndex = Math.max(0, questions.length - 1);
    checkView = 'questions';
    renderCheck();
  });
  document.querySelectorAll('[data-edit-question]').forEach((button) => {
    button.addEventListener('click', () => {
      saveReviewDraft();
      currentQuestionIndex = Number(button.dataset.editQuestion);
      checkView = 'questions';
      renderCheck();
    });
  });
  focusCurrentStep();
}

function systemReviewFields(systems, stage) {
  const accessQuestion = {
    plan: 'Will it connect to accounts, files, code, data, publishing, or other tools?',
    build: 'Can it connect to accounts, files, code, data, publishing, or other tools now?',
    release: 'Could it connect to accounts, files, code, data, publishing, or other tools while this version was made?',
    live: 'Can it connect to accounts, files, code, data, publishing, or other tools during use?',
  }[stage] || 'Can it connect to accounts, files, code, data, publishing, or other tools?';
  const permissionsQuestion = {
    plan: 'Will its access be limited to what this job needs?',
    build: 'Is its access limited to what this job needs now?',
    release: 'Was its access limited to what this job needed?',
    live: 'Is its access limited to what this job needs during use?',
  }[stage] || 'Is its access limited to what this job needs?';
  return systems.map((system, index) => `<div class="field system-review-field">
    <input type="hidden" name="reviewSystemId" value="${escapeHTML(system.id)}" />
    <label for="review-system-access-${index}">${escapeHTML(system.product || `AI tool ${index + 1}`)} ${system.model ? `(${escapeHTML(system.model)})` : ''}: ${escapeHTML(accessQuestion)}</label>
    <select id="review-system-access-${index}" name="reviewSystemAccess" required>${triStateOptions(system.connectedAccess, 'No', 'Yes', 'I cannot determine')}</select>
    <label for="review-system-permissions-${index}">${escapeHTML(permissionsQuestion)}</label>
    <select id="review-system-permissions-${index}" name="reviewSystemPermissions" required>${triStateOptions(system.permissionsConfirmed, 'No', 'Yes', 'I cannot determine or not applicable')}</select>
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
    <legend>What have you observed?</legend>
    <div class="field-grid">
      <div class="field"><label for="observedRuns">How many times did someone complete the full process from start to finish?</label><input id="observedRuns" name="observedRuns" type="number" min="0" max="999" value="${p.observedRuns === '' || p.observedRuns === undefined ? '' : Number(p.observedRuns)}" required /></div>
      ${booleanSelect('representativeConditions', 'Did people use it under normal working conditions?', p.representativeConditions)}
      ${booleanSelect('atLeastOneEdgeOrFailureCase', 'Did anyone test at least one unusual or failure case?', p.atLeastOneEdgeOrFailureCase)}
      ${booleanSelect('controlsActuallyOperated', 'Did the planned checks and safeguards actually work?', p.controlsActuallyOperated)}
      ${booleanSelect('observedInRealUseForFullOperatingCycle', 'Did someone observe one full use from start to finish?', p.observedInRealUseForFullOperatingCycle)}
      ${booleanSelect('outcomeDataCollected', 'Did anyone record whether the expected result happened?', p.outcomeDataCollected)}
      ${booleanSelect('materialFailuresResolved', 'Were all serious problems fixed?', p.materialFailuresResolved)}
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
  captureReviewDraft(event.currentTarget);
  if (
    assessment.project.reviewEvidenceBasis === 'confirmed' &&
    !assessment.project.reviewEvidenceNote &&
    !assessment.project.reviewEvidenceUrl
  ) {
    return renderReview('Name or link what you saved, or choose the memory, observation, or plan option.');
  }
  assessment.completed = true;
  assessment.completedAt = new Date().toISOString();
  saveAssessment();
  checkView = 'result';
  renderCheck();
}

function captureReviewDraft(formElement) {
  const form = new FormData(formElement);
  const keys = [
    'humanApprovalBeforeConsequence', 'actionsAreReversible', 'sensitiveData', 'dataAuthorizationConfirmed',
    'monitoringConfirmed', 'unresolvedMaterialFailure',
  ];
  keys.forEach((key) => {
    const value = form.get(key);
    assessment.project[key] = value === 'true' ? true : value === 'false' ? false : null;
  });
  assessment.project.reviewEvidenceBasis = ['confirmed', 'reported', 'unknown'].includes(form.get('reviewEvidenceBasis'))
    ? form.get('reviewEvidenceBasis')
    : 'unknown';
  assessment.project.reviewEvidenceNote = String(form.get('reviewEvidenceNote') || '').trim();
  assessment.project.reviewEvidenceUrl = String(form.get('reviewEvidenceUrl') || '').trim();

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
  ['independentReviewerName', 'independentReviewerRole', 'independentReviewScope', 'independentReviewDate', 'independentReviewEvidence'].forEach((key) => {
    assessment.project[key] = String(form.get(key) || '').trim();
  });
  assessment.project.qualifiedIndependentReview = Boolean(
    assessment.project.independentReviewerName &&
    assessment.project.independentReviewerRole &&
    assessment.project.independentReviewScope &&
    assessment.project.independentReviewDate &&
    assessment.project.independentReviewEvidence
  );

  if (assessment.stage === 'live') {
    assessment.project.observedRuns = Number(form.get('observedRuns') || 0);
    ['representativeConditions', 'atLeastOneEdgeOrFailureCase', 'controlsActuallyOperated', 'observedInRealUseForFullOperatingCycle', 'outcomeDataCollected', 'materialFailuresResolved'].forEach((key) => {
      const value = form.get(key);
      assessment.project[key] = value === 'true' ? true : value === 'false' ? false : null;
    });
  }
}

function renderResult() {
  const result = scoreAssessment(assessment);
  const scoreAvailable = result.scoreAvailable !== false;
  const p = assessment.project;
  document.title = `${p.name || stageLabel(assessment.stage)} Load Test Result | evAIdence`;
  const primarySystem = p.systems.find((system) => system.id === p.primarySystemId) || p.systems[0];
  const dimensionLabels = Object.fromEntries(Object.entries(DIMENSIONS).map(([key, value]) => [key, value.label]));
  const loadSummary = result.loadSummary || {
    currentSetupCanCarry: result.authorization?.delegate || [],
    evidenceCovers: result.authorization?.relyOn || [],
    stillNeedsCapableReview: result.authorization?.verify || [],
    exposedLoad: result.authorization?.doNotAuthorize || [],
  };
  const gates = result.gates || [];
  const recommendations = result.recommendations || [];
  const scoreRaiser = scoreAvailable ? [...recommendations]
    .filter((item) => Number(item.scoreEffect?.projectedChange || 0) > 0)
    .sort((a, b) => Number(b.scoreEffect?.projectedChange || 0) - Number(a.scoreEffect?.projectedChange || 0))[0] : null;
  const roleBoundary = recommendations.find((item) => item.category === 'role_adjustment');
  const evidenceRaiser = recommendations.find((item) => item.category === 'evidence');
  const date = assessment.completedAt || assessment.updatedAt;
  const evidenceStrength = result.evidenceStrength || { label: result.evidenceConfidence || 'Unknown', description: '' };
  const loadFit = humanLoadFit(result);
  const unknownLabels = result.unknownInputs?.length
    ? result.unknownInputs.map(({ label }) => label)
    : (result.unknownQuestionIds || []).map((id) => activeQuestions().find((question) => question.id === id)?.prompt || id);
  const operationalRoleText = scoreAvailable
    ? AUTHORITY_LABELS[result.operationalMaxAuthority] || result.operationalMaxAuthority
    : 'Cannot determine until the missing information is added';
  const conclusionRoleText = scoreAvailable
    ? AUTHORITY_LABELS[result.conclusionAuthority || result.maxAuthority] || result.conclusionAuthority || result.maxAuthority
    : 'Cannot determine until the missing information is added';
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
      <p>This result shows what you are relying on AI to do, what still falls on people and the workflow, whether the current setup can carry it, and what is at stake if you continue as-is.</p>
    </header>

    <section class="project-context card" aria-labelledby="result-context-heading">
      <div class="section-heading-compact"><p class="kicker">Project details</p><h2 id="result-context-heading">What did this Load Test cover?</h2></div>
      <dl class="context-list">
        ${contextItem('What you made or did', p.task || 'Not recorded')}
        ${contextItem('AI tool and model', primarySystem ? systemSummary(primarySystem) : 'Not recorded')}
        ${contextItem('Who works directly with this AI', systemOperatorLabel(primarySystem))}
        ${contextItem('Who reviews this AI job', systemCheckerLabel(primarySystem))}
        ${contextItem('What that reviewer can judge, test, and correct', primarySystem?.checkerScope || 'Not recorded')}
        ${contextItem('AI job in the workflow', primarySystem?.role || 'Not recorded')}
        ${contextItem('What AI could do before a person checked it', AUTHORITY_LABELS[primarySystem?.proposedAuthority || p.proposedAuthority] || 'Not recorded')}
        ${contextItem('What you want the work to accomplish', p.intendedOutcome || 'Not recorded')}
        ${contextItem('What people did', p.humanLoad || 'Not recorded')}
        ${contextItem('Most serious problem', p.failureScenario || 'Not recorded')}
        ${contextItem('Possible impact', p.failureImpact || 'Not recorded')}
        ${contextItem('Impact level', consequenceLabel)}
        ${contextItem('Load Test completed', `${formatDate(date)} using method ${METHOD_VERSION}`)}
      </dl>
      <p class="helper-text"><strong>Whose capacity was assessed:</strong> This result uses the recorded answers about ${escapeHTML(systemCheckerLabel(primarySystem))} and that reviewer’s ability to inspect and correct ${escapeHTML(primarySystem?.role || 'the selected AI job')}. Business-owner review does not replace technical or subject-matter review unless that capability was recorded here.</p>
    </section>

    <section class="wager-card card" aria-labelledby="wager-heading">
      <p class="kicker">The decision remains yours</p>
      <h2 id="wager-heading">Your wager if you continue as-is</h2>
      <p>${escapeHTML(wagerLead(assessment.stage))} You are relying on <strong>${escapeHTML(primarySystem?.product || 'the AI tool')}</strong> to ${escapeHTML(primarySystem?.role || 'do the job you described')}. People in the project are responsible for: <strong>${escapeHTML(p.humanLoad || 'reviewing, correcting, monitoring, and recovering the work described in this result')}</strong>.</p>
      <p>If that setup fails, you identified this serious failure: <strong>${escapeHTML(p.failureScenario || 'Not recorded')}</strong> The possible impact is: <strong>${escapeHTML(p.failureImpact || 'Not recorded')}</strong></p>
      <p><strong>The Load Test does not decide whether you proceed.</strong> It shows what you are relying on, which parts have supporting records identified, which parts depend on your report, and what could happen if those assumptions fail.</p>
    </section>

    <section class="result-summary" aria-labelledby="result-decision-heading">
      <div class="result-header">
        <div>
          <p class="eyebrow">Result</p>
          <h2 id="result-decision-heading">${escapeHTML(result.decisionStatus?.label || resultDecision(result))}</h2>
          <p class="lede">${escapeHTML(result.decisionStatus?.description || '')}</p>
        </div>
        <div class="score-lockup" aria-label="${scoreAvailable ? `Load Test score based on the recorded answers: ${result.publicScore} out of 100.` : 'Load Test score not calculated because information is missing.'} Result: ${escapeHTML(result.decisionStatus?.label || resultDecision(result))}. Evidence Strength: ${escapeHTML(evidenceStrength.label)}.">
          <strong>${scoreAvailable ? result.publicScore : 'Not scored'}</strong>
          <span>${scoreAvailable ? '/ 100 based on the recorded answers' : 'Add the missing information before using a score'}</span>
        </div>
      </div>
      <dl class="result-facts" aria-label="Key result facts">
        ${resultFact('Role the recorded setup can carry', operationalRoleText)}
        ${resultFact('Role backed by identified records', conclusionRoleText)}
        ${resultFact('Human review capacity for this load', loadFit.label)}
        ${resultFact('Evidence Strength', evidenceStrength.label)}
      </dl>
      <p class="helper-text">${scoreAvailable ? 'The first role is based on the recorded answers about the setup. The second is limited to the role-critical records identified. The Load Test records those references but does not inspect them. A difference between the two roles is an evidence gap, not automatic proof that the setup cannot carry the larger role.' : 'The Load Test did not replace missing information with a guess or a zero. Add the information below, then recalculate the result.'}</p>
      ${scoreAvailable
        ? `<div class="callout"><p><strong>What ${result.publicScore} means:</strong> The score shows how the recorded answers about human review capacity, AI role fit, AI behavior, workflow controls, and outcome checks line up. Evidence Strength separately shows which answers have supporting records identified. This is not an AI accuracy rating or a human versus AI percentage. A serious gap or weak evidence can narrow the conclusion even when the score is higher.</p></div>`
        : `<div class="callout callout-warning"><p><strong>Information still needed:</strong></p>${listHTML(unknownLabels)}</div>`}
      <div class="quick-result-actions" aria-labelledby="quick-actions-heading">
        <h3 id="quick-actions-heading">Three ways to change the wager</h3>
        <div class="grid-3">
          <article class="card"><p class="kicker">Strengthen the workflow</p><p>${scoreRaiser ? escapeHTML(scoreRaiser.action) : scoreAvailable ? 'No additional score-raising action was generated from the current answers.' : 'Add the missing information first. Then the tool can show which completed action could raise the score.'}</p>${scoreRaiser ? `<p><strong>If completed and confirmed:</strong> up to ${scoreRaiser.scoreEffect.projectedScore} (+${scoreRaiser.scoreEffect.projectedChange}).</p>` : ''}</article>
          <article class="card"><p class="kicker">Reduce the load</p><p>${escapeHTML(roleBoundary?.action || 'Give AI a smaller role so less judgment, checking, monitoring, or recovery depends on the current setup.')}</p><p class="helper-text">This changes the role you rely on AI to perform, not the score.</p></article>
          <article class="card"><p class="kicker">Strengthen what you can show</p><p>${escapeHTML(evidenceRaiser?.action || 'Preserve the tests, decisions, approvals, and outcome records that support this work.')}</p><p class="helper-text">This can strengthen Evidence Strength without changing how well the workflow performs.</p></article>
        </div>
      </div>
      <p class="result-next-link"><button class="text-button" id="show-score-actions" type="button">${scoreAvailable ? 'See what could raise this score or reduce the reliance required' : 'See what information and changes are needed next'} <span aria-hidden="true">↓</span></button></p>
    </section>

    <section class="decision-grid" aria-label="How the load compares with the current setup">
      ${decisionColumn('Record-backed conclusion', 'supported', loadSummary.currentSetupCanCarry || defaultDelegate(result), 'Work covered by the role-critical records you identified for this setup.')}
      ${decisionColumn('What a capable person still needs to do', 'verify', loadSummary.stillNeedsCapableReview || defaultVerify(), 'Judgment, checking, approval, monitoring, or correction that you or another capable person must carry.')}
      ${decisionColumn('Where the load exceeds the setup', 'blocked', loadSummary.exposedLoad || gates.map(gateText), 'Gaps that could become failures or consequences if you continue as-is.')}
    </section>

    <details class="result-disclosure">
      <summary>See the score breakdown and evidence limits</summary>
      ${scoreAvailable ? `<div class="score-explanation">
        <p>The operational score needed for the stakes and role selected is ${result.requiredScore}/100. Evidence Strength is reported separately and may narrow the record-backed conclusion.</p>
        <div class="score-band" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
          <i class="score-marker" style="left: ${Math.min(100, Math.max(0, result.publicScore))}%"></i>
        </div>
        <div class="band-labels band-labels-four" aria-hidden="true"><span>Load exceeds setup</span><span>Smaller role</span><span>Named limits</span><span>Strong alignment</span></div>
      </div>` : `<div class="callout callout-warning"><p><strong>No score was calculated.</strong> One or more answers about the human reviewer or workflow are unknown. Those unknowns remain visible instead of being counted as zero.</p>${listHTML(unknownLabels)}</div>`}
      <div class="grid-2 result-detail-grid">
      <section class="result-panel card">
        <p class="kicker">Load and capacity</p>
        <h2>How the load and current setup line up</h2>
        ${scoreAvailable ? `<div class="dimension-list">
          ${Object.entries(dimensionLabels).map(([key, label]) => dimensionRow(label, result.dimensions?.[key] ?? 0)).join('')}
        </div>` : '<p>The Load Test needs the missing information before it can compare the load with the setup.</p>'}
        ${scoreAvailable && result.capacityCeiling < 100 ? `<div class="callout callout-warning"><p><strong>The recorded reviewer’s capacity sets a current ceiling of ${result.capacityCeiling}/100.</strong> ${escapeHTML(result.capacityLimitReasons.join(' '))}</p></div>` : ''}
      </section>
      <section class="result-panel card">
        <p class="kicker">Evidence and the record-backed conclusion</p>
        <h2>${escapeHTML(evidenceStrength.label)}</h2>
        <p>${escapeHTML(evidenceStrength.description || 'Evidence is reported separately from operational performance.')}</p>
        <p><strong>Role the reported setup could carry:</strong><br />${escapeHTML(operationalRoleText)}</p>
        <p><strong>Role backed by identified records:</strong><br />${escapeHTML(conclusionRoleText)}</p>
        <p><strong>What those identified records cover:</strong></p>
        ${listHTML(loadSummary.evidenceCovers || ['Only outputs reviewed under the conditions recorded in this Load Test.'])}
        <p class="helper-text">The tool does not decide whether you launch. A lower result means the recorded answers or identified records leave part of the load uncovered or uncertain.</p>
      </section>
      </div>
    </details>

    <section class="result-panel card review-load-card">
      <p class="kicker">Human capacity for this load</p>
      <h2>${escapeHTML(loadFit.label)}</h2>
      <p>${escapeHTML(loadFit.description)}</p>
      <p><strong>Human work recorded:</strong> ${escapeHTML(p.humanLoad || 'Not recorded')}</p>
    </section>

    <details class="result-disclosure">
      <summary>See the AI tools and jobs recorded</summary>
      <div class="result-disclosure-body"><p>The model matters in the role it was given.</p><div class="grid-2">${p.systems.map((system) => `<article class="card"><h3>${escapeHTML(system.product || 'Unnamed AI tool')} ${system.model ? `<span class="helper-text">${escapeHTML(system.model)}</span>` : ''}</h3><p>${escapeHTML(system.role || 'Role not described')}</p><p><strong>What this Load Test covered:</strong> ${system.id === p.primarySystemId ? 'Detailed questions were answered for this role' : 'Recorded as part of the workflow; run a separate Load Test to assess this role'}</p><p><strong>AI role tested:</strong> ${escapeHTML(AUTHORITY_LABELS[system.proposedAuthority] || system.proposedAuthority)}</p><p><strong>Access and permissions:</strong> ${system.connectedAccess === false ? 'No connected access reported' : system.permissionsConfirmed === true ? 'Connected access and limited permissions reported' : 'Connected access or permission limits are not fully known'}</p>${result.limitingSystemIds?.includes(system.id) ? '<span class="stamp stamp-warning">Limits this result</span>' : ''}</article>`).join('')}</div>
      ${p.systems.length > 1 ? '<p class="helper-text">The detailed questions cover the AI tool with the most important or risky job. Run a separate Load Test for another important job when needed.</p>' : ''}</div>
    </details>

    ${gates.length ? `<section style="margin-top: 3rem"><p class="kicker">Where the setup could break</p><h2>These gaps matter ${scoreAvailable ? 'even when the average score is higher' : 'before a score can be used'}.</h2><ul class="gate-list">${gates.map((gate) => `<li><strong>${escapeHTML(gate.title || gate.id?.replaceAll('_', ' ') || 'Important gap')}</strong><br />${escapeHTML(gateText(gate))}</li>`).join('')}</ul></section>` : scoreAvailable ? `<div class="callout" style="margin-top: 2rem"><p><strong>The recorded answers did not reveal a critical mismatch that overrides the score.</strong> The score and named limits still apply.</p></div>` : ''}

    <section id="raise-score" style="margin-top: 4rem" tabindex="-1">
      <p class="kicker">If you want to change the wager</p>
      <h2>Ways to reduce the load or strengthen the setup</h2>
      <p class="lede">Each action shows its possible effect. Some actions strengthen the workflow. Others strengthen the evidence, close a serious gap, add capable human help, or reduce the AI role so less load remains with people.</p>
      <p>Planning an action changes nothing. Complete it, record what happened, and run the Load Test again before the score or Evidence Strength changes.</p>
      <div class="action-timeline">
        ${timeBlock('Now', recommendations.filter((item) => item.timing === 'now'), scoreAvailable)}
        ${timeBlock('Within 24 hours', recommendations.filter((item) => item.timing === 'within24h'), scoreAvailable)}
        ${timeBlock('Within days', recommendations.filter((item) => item.timing === 'days'), scoreAvailable)}
        ${timeBlock('Within weeks', recommendations.filter((item) => item.timing === 'weeks'), scoreAvailable)}
      </div>
    </section>

    <section class="reliance-card" id="reliance-card">
      <h1 class="print-only">evAIdence Load Test result</h1>
      <div class="reliance-card-header">
        <div><p class="kicker">Load Test | Self-assessed</p><h2>${escapeHTML(p.name || 'Untitled project')}</h2><p>${escapeHTML(p.task)}</p></div>
        <div class="reliance-card-score">${scoreAvailable ? `${result.publicScore}/100` : 'Not scored'} | ${escapeHTML(result.decisionStatus?.label || result.band)}</div>
      </div>
      <div class="grid-2" style="margin-top: 1.3rem">
        <div><p class="meta-label">Work and AI setup</p><p><strong>AI tools and jobs:</strong> ${p.systems.map((system) => escapeHTML(systemSummary(system))).join('<br />')}</p><p><strong>What you want the work to accomplish:</strong> ${escapeHTML(p.intendedOutcome)}</p></div>
        <div><p class="meta-label">Load Test finding</p><p><strong>Role the recorded setup can carry:</strong> ${escapeHTML(operationalRoleText)}<br /><strong>Role backed by identified records:</strong> ${escapeHTML(conclusionRoleText)}</p><p><strong>Human review capacity for this load:</strong> ${escapeHTML(loadFit.label)}<br /><strong>Evidence Strength:</strong> ${escapeHTML(evidenceStrength.label)}<br /><strong>Real-use testing:</strong> ${escapeHTML(validationStatusDisplay(result.validationStatus))}</p></div>
      </div>
      <p class="helper-text">Dated ${formatDate(date)} | Method ${escapeHTML(METHOD_VERSION)} | This result applies only to the people, AI tools, jobs, workflow, evidence, and stakes recorded here. Supporting records were identified by the person completing the test; the tool did not inspect them. This is not a certification or guarantee.</p>
    </section>

    <div class="result-actions no-print">
      <button class="button" type="button" id="print-result">Print result summary</button>
      <button class="button button-secondary" type="button" id="export-result">Export Load Test</button>
      <a class="button button-secondary" href="#/detailed-record" id="start-record-from-result">Create a detailed Work Record</a>
      <a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Review this preview <span class="new-tab-note">(opens a Google Form in a new tab)</span></a>
      <button class="button button-danger" type="button" id="new-check">Start a new Load Test</button>
    </div>
  </div>`;

  document.querySelector('#print-result').addEventListener('click', () => printMode('printing-result'));
  document.querySelector('#show-score-actions')?.addEventListener('click', () => {
    const target = document.querySelector('#raise-score');
    target?.focus();
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  document.querySelector('#export-result').addEventListener('click', () => {
    downloadJSON(`${slug(p.name || 'human-ai-load-test')}.json`, {
      kind: 'human-ai-load-test-assessment',
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
    if (window.confirm('Start a new Load Test? This will replace the project currently saved in this browser.')) {
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
    return 'The current setup appears able to carry the AI role you described within the limits below.';
  }
  if (result.publicScore < 40) return 'Moving beyond private advice or drafts would place load on people and the workflow that the current setup does not cover.';
  return 'The current setup can carry a narrower AI role more reliably than the role described.';
}

function wagerLead(stage) {
  return {
    plan: 'By starting this work as planned,',
    build: 'By continuing to build this work as it is,',
    release: 'By publishing, sending, or launching this work as it is,',
    live: 'By continuing to use this setup as it is,',
  }[stage] || 'By continuing with this setup,';
}

function humanLoadFit(result) {
  if (result.scoreAvailable === false || result.itemScores?.HUM1?.unknown || result.itemScores?.HUM3?.unknown) {
    return {
      label: 'Not enough information',
      description: 'The Load Test does not yet have enough information about the human reviewer’s knowledge, access, decision power, time, or attention to judge whether that person can carry this load.',
    };
  }
  const capacity = Number(result.itemScores?.HUM1?.level || 0);
  const sustainability = Number(result.itemScores?.HUM3?.level || 0);
  const recordBacked =
    result.itemScores?.HUM1?.basis === 'confirmed' &&
    result.itemScores?.HUM3?.basis === 'confirmed';
  if (capacity < 25) return {
    label: 'Cannot currently carry it',
    description: 'The current knowledge, access, authority, or time does not cover the serious errors this role could create.',
  };
  if (capacity < 50) return {
    label: 'Important capacity gap',
    description: 'Some important work can be reviewed, but a serious gap remains in the ability to judge, inspect, correct, or stop it.',
  };
  if (sustainability < 25) return {
    label: 'Cannot be sustained',
    description: 'The expected pace, volume, or complexity requires more review time and attention than are available.',
  };
  if (sustainability < 50) return {
    label: 'Likely to break down',
    description: 'The human part can be carried briefly or occasionally, but not reliably at the expected pace and volume.',
  };
  if (capacity < 75 || sustainability < 75) return {
    label: 'Can carry it only with limits',
    description: 'The human part can be carried only while the scope, pace, volume, AI role, or capable-review coverage stays within the recorded limits.',
  };
  if (recordBacked) {
    return {
      label: capacity >= 100 && sustainability >= 100 ? 'Record-backed and sustained' : 'Record-backed under stated conditions',
      description: 'The recorded answers and supporting records identified indicate that the human reviewer’s knowledge, access, authority, time, attention, and coverage can carry the human part under the conditions described.',
    };
  }
  return {
    label: 'The recorded answers indicate the human reviewer can carry it',
    description: 'The recorded answers report enough knowledge, access, authority, time, attention, and coverage for the human part, but at least one capacity answer does not have a current supporting record identified.',
  };
}

function prepareWorkRecordFromAssessment() {
  const projectId = assessment.projectId || assessment.id;
  const belongsToAnotherProject = Boolean(creationRecord.title) && creationRecord.projectId !== projectId;
  if (belongsToAnotherProject && !window.confirm('Start a new Work Record for this project? This will replace the Work Record currently saved in this browser.')) {
    return false;
  }
  if (belongsToAnotherProject || !creationRecord.title) {
    creationRecord = makeCreationRecord(projectId);
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
    creationRecord.projectId = projectId;
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

function prepareWorkRecordFromSnapshot(snapshot) {
  const hasCurrentRecord = hasWorkRecordContent(creationRecord);
  const sameProject = Boolean(creationRecord.projectId && creationRecord.projectId === snapshot.projectId);
  if (hasCurrentRecord && !sameProject && !window.confirm(`Replace the Detailed Work Record currently saved in this browser with a record for “${snapshot.projectName || 'this project'}”? Export the current record first if you want to keep it.`)) {
    return false;
  }
  const options = { idFactory: (prefix) => makeId(prefix) };
  let mergedSameVersion = false;
  if (hasCurrentRecord && sameProject) {
    const currentUrl = creationRecord.artifact?.url || '';
    const differentArtifact = Boolean(currentUrl && snapshot.artifactUrl && currentUrl !== snapshot.artifactUrl);
    const currentStage = creationRecord.readiness?.stage || '';
    const differentStage = Boolean(currentStage && snapshot.stage && currentStage !== snapshot.stage);
    if (differentArtifact || differentStage) {
      if (!window.confirm('This Work Receipt appears to describe a different version of the same project. Start a new Detailed Work Record from it? This will replace the record currently saved in this browser. Export the current record first if you want to keep it.')) return false;
      creationRecord = workRecordFromSnapshot(snapshot, options);
    } else {
      if (!window.confirm('A Detailed Work Record already exists for this project. Add only missing details from this Work Receipt? Choose OK only if both describe the same exact work version.')) return false;
      creationRecord = mergeSnapshotIntoWorkRecord(creationRecord, snapshot, options);
      mergedSameVersion = true;
    }
  } else {
    creationRecord = workRecordFromSnapshot(snapshot, options);
  }
  recordStep = 1;
  saveRecordStep();
  saveCreationRecord();
  showToast(mergedSameVersion ? 'Missing Work Receipt details added without replacing your Work Record edits.' : 'Detailed Work Record started from this Work Receipt.');
  return true;
}

function authorityRank(value) {
  return { A0: 0, A1: 1, A2: 2, A3: 3 }[value] ?? 0;
}

function decisionColumn(title, className, items, description) {
  const safeItems = Array.isArray(items) && items.length ? items : ['Nothing is shown in this category by the current answers and identified records.'];
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
  return ['Important factual claims, high-impact choices, and any part outside the reviewer’s demonstrated ability.'];
}

function dimensionRow(label, value) {
  const rounded = Math.round(Number(value) || 0);
  return `<div class="dimension-row"><span id="dimension-${slug(label)}">${escapeHTML(label)}</span><div class="dimension-track" role="progressbar" aria-labelledby="dimension-${slug(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rounded}"><span style="width:${rounded}%"></span></div><output aria-label="${escapeHTML(label)} score">${rounded}</output></div>`;
}

function timeBlock(label, items = [], scoreAvailable = true) {
  const normalized = Array.isArray(items) ? items : items ? [items] : [];
  return `<article class="time-block"><h3>${label}</h3>${normalized.length ? `<div class="recommendation-list">${normalized.slice(0, 4).map((item) => recommendationCard(item, scoreAvailable)).join('')}</div>` : '<p class="helper-text">No additional action generated for this period.</p>'}</article>`;
}

function recommendationCard(item, scoreAvailable = true) {
  if (typeof item === 'string') return `<p class="recommendation-action">${escapeHTML(item)}</p>`;
  const projectedChange = Number(item.scoreEffect?.projectedChange || 0);
  const scoreEffect = !scoreAvailable
    ? 'Complete this step, add the missing information, and run the Load Test again before using a score.'
    : item.modelChangeTest
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
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = '';
    showToast('That file is too large. Import a Load Test JSON file smaller than 5 MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = parsed.assessment || parsed;
      const claimedComplete = Boolean(imported.completed);
      assessment = normalizeImportedAssessment(imported);
      currentQuestionIndex = resumeQuestionIndex(assessment);
      saveAssessment();
      checkView = assessment.completed ? 'result' : 'setup';
      showToast(claimedComplete && !assessment.completed
        ? 'Project imported, but required information is incomplete. Review the setup and answers.'
        : 'Project imported.');
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
  if (!['plan', 'build', 'release', 'live'].includes(imported.stage)) {
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
  project.humanActivities = Array.isArray(imported.project.humanActivities)
    ? imported.project.humanActivities.filter((value) => HUMAN_ACTIVITIES.some(([id]) => id === value))
    : [];
  project.otherHumanActivities = Array.isArray(imported.project.otherHumanActivities)
    ? imported.project.otherHumanActivities.filter((value) => HUMAN_ACTIVITIES.some(([id]) => id === value))
    : [];
  if (!project.humanActivities.length && !project.otherHumanActivities.length && !project.humanOther && project.humanLoad) {
    project.humanOther = String(project.humanLoad);
  }
  project.aiUseFocus = ['making', 'operating'].includes(project.aiUseFocus) ? project.aiUseFocus : '';
  project.otherHumanInvolved = ['yes', 'no', 'unknown'].includes(project.otherHumanInvolved)
    ? project.otherHumanInvolved
    : '';
  project.consequence = ['low', 'moderate', 'high', 'critical'].includes(project.consequence)
    ? project.consequence
    : '';
  const primarySystem = project.systems.find((system) => system.id === project.primarySystemId) || project.systems[0];
  project.proposedAuthority = Object.hasOwn(AUTHORITY_LABELS, primarySystem?.proposedAuthority)
    ? primarySystem.proposedAuthority
    : Object.hasOwn(AUTHORITY_LABELS, project.proposedAuthority) ? project.proposedAuthority : '';

  const answers = Object.fromEntries(Object.entries(imported.answers).filter(([id, answer]) => {
    return typeof id === 'string' && answer && typeof answer === 'object';
  }));

  const isLegacy = imported.schemaVersion !== ASSESSMENT_SCHEMA_VERSION || imported.methodVersion !== METHOD_VERSION;
  const candidate = {
    ...fallback,
    ...imported,
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    methodVersion: METHOD_VERSION,
    stage: imported.stage,
    projectId: canonicalProjectId(imported.projectId || imported.id || fallback.projectId),
    project,
    answers: isLegacy ? {} : answers,
    completed: false,
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
  if (!isLegacy && candidate.scopeKey !== getAssessmentScopeKey(candidate)) {
    candidate.legacySnapshot = {
      methodVersion: imported.methodVersion || METHOD_VERSION,
      completed: Boolean(imported.completed),
      answers,
      completedAt: imported.completedAt || '',
    };
    candidate.answers = {};
    candidate.currentQuestion = 0;
    candidate.currentQuestionId = '';
    candidate.scopeKey = getAssessmentScopeKey(candidate);
    candidate.needsReassessment = true;
  }
  candidate.completed = !isLegacy && Boolean(imported.completed) && assessmentCanShowResult(candidate);
  return candidate;
}

function assessmentCanShowResult(value) {
  const p = value?.project || {};
  const triStateAnswered = (answer) => answer === true || answer === false || answer === null;
  const systems = Array.isArray(p.systems) ? p.systems : [];
  const primary = systems.find((system) => system.id === p.primarySystemId) || systems[0];
  const authority = primary?.proposedAuthority || p.proposedAuthority;
  const setupComplete = Boolean(
    p.task && p.intendedOutcome && p.aiUseFocus && p.humanLoad && p.failureScenario && p.failureImpact &&
    ['yes', 'no', 'unknown'].includes(p.otherHumanInvolved) &&
    (p.humanActivities?.length || p.otherHumanActivities?.length || p.humanOther) &&
    (p.otherHumanInvolved !== 'yes' || (p.otherHumanRole && (p.otherHumanActivities?.length || p.humanOther))) &&
    ['low', 'moderate', 'high', 'critical'].includes(p.consequence) &&
    p.workTypes?.length && p.requiredBehaviors?.length && systems.length && primary &&
    systems.every((system) => system.product && system.model && system.role &&
      ['me', 'other', 'both', 'unknown'].includes(system.operator) &&
      (!['other', 'both'].includes(system.operator) || system.operatorRole) &&
      ['me', 'operator', 'other', 'shared', 'unknown'].includes(system.checker) &&
      (!['other', 'shared'].includes(system.checker) || system.checkerRole) &&
      !(system.checker === 'operator' && system.operator === 'unknown') &&
      (system.checker === 'unknown' || system.checkerScope) &&
      triStateAnswered(system.connectedAccess) &&
      (system.connectedAccess !== true || triStateAnswered(system.permissionsConfirmed)) &&
      Object.hasOwn(AUTHORITY_LABELS, system.proposedAuthority) &&
      (system.evidenceBasis !== 'confirmed' || system.evidence))
  );
  if (!setupComplete) return false;
  if (!getActiveQuestionDefinitions(value).every((question) => isValidAnswer(question, value.answers?.[question.id], value))) return false;
  if (!triStateAnswered(p.sensitiveData) || !triStateAnswered(p.unresolvedMaterialFailure)) return false;
  if (p.sensitiveData !== false && !triStateAnswered(p.dataAuthorizationConfirmed)) return false;
  if (authority !== 'A0' && !triStateAnswered(p.humanApprovalBeforeConsequence)) return false;
  if ((['A2', 'A3'].includes(authority) || p.workTypes.includes('automation') || p.workTypes.includes('software')) && !triStateAnswered(p.actionsAreReversible)) return false;
  if ((authority === 'A3' || p.workTypes.includes('automation')) && !triStateAnswered(p.monitoringConfirmed)) return false;
  if (!['confirmed', 'reported', 'unknown'].includes(p.reviewEvidenceBasis)) return false;
  if (p.reviewEvidenceBasis === 'confirmed' && !p.reviewEvidenceNote && !p.reviewEvidenceUrl) return false;
  if (value.stage === 'live') {
    if (!Number.isFinite(Number(p.observedRuns)) || Number(p.observedRuns) < 0) return false;
    const liveFields = ['representativeConditions', 'atLeastOneEdgeOrFailureCase', 'controlsActuallyOperated', 'observedInRealUseForFullOperatingCycle', 'outcomeDataCollected', 'materialFailuresResolved'];
    if (!liveFields.every((key) => triStateAnswered(p[key]))) return false;
  }
  return true;
}

function renderSample() {
  document.title = 'Example Work Receipt | evAIdence';
  main.innerHTML = `<div class="page sample-record-page">
    <header class="page-header">
      <p class="eyebrow">Fictional example</p>
      <h1>One creator. Two receipts. A changed relationship with AI.</h1>
      <p>This example shows what evAIdence makes visible without grading the change as good or bad.</p>
    </header>
    <article class="record-preview public-record">
      <header class="public-record-header"><p class="kicker">evAIdence™ Work Receipt</p><h2>Community Grant Guide</h2><p class="receipt-created-by"><strong>Created by Jordan Ellis</strong> <span>(fictional)</span></p><p class="record-summary">Three material changes were recorded between January and October.</p><p>Jordan is preparing a public guide that explains how neighborhood groups can apply for local grants.</p></header>
      <section class="record-output-section"><h3>What changed</h3>
        <p class="table-scroll-cue">Scroll horizontally to compare all columns.</p>
        <div class="table-scroll" role="region" aria-label="Example Work Receipt changes" tabindex="0"><table class="change-table"><caption class="sr-only">Changes recorded between the January and October Work Receipts</caption><thead><tr><th scope="col">Area</th><th scope="col">January</th><th scope="col">October</th></tr></thead><tbody>
          <tr><th scope="row">Starting point</th><td>The writer outlined first</td><td>AI proposed the first outline</td></tr>
          <tr><th scope="row">AI’s role</th><td>Challenge and edit</td><td>Generate ideas and first drafts</td></tr>
          <tr><th scope="row">Source checking</th><td>The writer checked every important source</td><td>The writer checked a sample</td></tr>
          <tr><th scope="row">Final approval</th><td>The writer</td><td>The writer</td></tr>
        </tbody></table></div>
        <p><strong>Was the change intentional?</strong> The writer confirmed that two changes were intentional. The reduced source checking was not intentional.</p>
      </section>
      <section class="record-output-section disclosure-box"><h3>Work credits</h3><p><strong>Community Grant Guide, created by Jordan Ellis.</strong></p><p>Jordan originated and directed the guide, supplied its requirements, revised the important sections, made the final decisions, and approved this version. An AI tool assisted with the outline, draft language, and source finding.</p><p class="receipt-meta">evAIdence Work Receipt · October version</p></section>
      <section class="record-output-section"><h3>What supports this receipt</h3><ul class="claim-support-list">
        <li><span>AI conversation and attached source list</span><strong class="status-pill status-shown-in-records">Record provided</strong></li>
        <li><span>The writer’s offline revisions and final approval</span><strong class="status-pill status-confirmed-by-creator">Confirmed by creator</strong></li>
        <li><span>Whether every factual claim was independently verified</span><strong class="status-pill status-unknown">Unknown</strong></li>
      </ul></section>
      <footer class="public-record-footer"><p>This is a fictional example. A Work Receipt records supplied references and creator confirmations. It does not infer authorship from the surface of finished work or assign a human-versus-AI percentage.</p></footer>
    </article>
    <div class="button-row"><a class="button" href="#/snapshot">Create a Work Receipt</a><a class="button button-secondary" href="#/method">See how it works</a></div>
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
    'AI-reviewed': 'AI produced, human substantially revised',
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
  document.title = 'Create a Work Record | evAIdence';
  const normalizedErrors = normalizeFormErrors(errors);
  const [stepId, stepLabel] = RECORD_STEPS[recordStep - 1];
  main.innerHTML = `<div class="page work-record-page">
    <header class="page-header record-page-header">
      <p class="eyebrow">Create a Work Record</p>
      <h1>Show how this work was made.</h1>
      <p>Create a record for one finished or nearly finished piece of work. Show what you, other people, and each AI tool did. Add supporting records, then generate credits you can share with the work.</p>
    </header>
    <div class="callout"><p><strong>This record does not estimate a human-versus-AI percentage.</strong> It shows roles, actions, decisions, and evidence.</p></div>
    <div class="callout"><p><strong>Have these ready:</strong> a link or version for the exact work, the names of people and AI tools involved, and any chats, drafts, commits, notes, or approval records you may want to cite.</p></div>
    ${creationRecord.legacyNotes ? `<div class="callout callout-warning"><p><strong>Review information carried forward from an earlier record.</strong><br />${escapeHTML(creationRecord.legacyNotes).replaceAll('\n', '<br />')}</p></div>` : ''}
    ${recordStepper(recordStep)}
    <section class="record-step-card" aria-labelledby="record-step-heading">
      <div class="progress-row"><span>STEP ${recordStep} OF ${RECORD_STEPS.length}</span><span>${escapeHTML(stepLabel)}</span></div>
      <div class="progress-track" role="progressbar" aria-label="Work Record progress" aria-valuemin="1" aria-valuemax="${RECORD_STEPS.length}" aria-valuenow="${recordStep}" aria-valuetext="Step ${recordStep} of ${RECORD_STEPS.length}: ${escapeHTML(stepLabel)}"><span style="width:${Math.round((recordStep / RECORD_STEPS.length) * 100)}%"></span></div>
      <p id="record-save-status" class="save-status" role="status" aria-live="polite">Saved only in this browser. Export a private backup when you finish.</p>
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
  form.addEventListener('input', (event) => {
    if (['status', 'aiUse', 'contributorStatus', 'reviewStatus'].includes(event.target?.name)) return;
    if (event.target?.matches('input[type="url"]') && event.target.value.trim() && !safeHttpUrl(event.target.value)) {
      const status = document.querySelector('#record-save-status');
      if (status) status.textContent = 'Finish the web address beginning with http:// or https:// before it can be saved.';
      return;
    }
    captureWorkRecordStep(new FormData(form), stepId);
    saveCreationRecord();
    if (stepId === 'review') {
      const preview = document.querySelector('.record-review-preview-body');
      if (preview) preview.innerHTML = workRecordPreview(toPublicWorkRecord(creationRecord));
    }
  });
  form.addEventListener('change', (event) => {
    const dynamicField = ['status', 'aiUse', 'contributorStatus', 'reviewStatus'].includes(event.target?.name);
    if (dynamicField && !validateVisibleUrls(form)) return;
    if (event.target?.name === 'contributorStatus' && event.target.value !== 'listed' && creationRecord.contributors.some((item) => item.name || item.role || item.contribution) && !window.confirm('Hide and remove the contributor details already entered?')) return renderCreationRecord('contributor-status');
    if (event.target?.name === 'aiUse' && event.target.value === 'no-ai-reported' && (creationRecord.aiContributions || creationRecord.systems.some((item) => item.product || item.model || item.role || item.setup)) && !window.confirm('Change this record to no AI use and remove the AI details already entered?')) return renderCreationRecord('aiuse-no-ai-reported');
    if (event.target?.name === 'reviewStatus' && event.target.value !== 'independently-checked' && (creationRecord.review?.reviewerName || creationRecord.review?.reviewerRole || creationRecord.review?.scope || creationRecord.review?.date) && !window.confirm('Change this to self-reviewed and remove the independent reviewer details?')) return renderCreationRecord('review-status');
    captureWorkRecordStep(new FormData(form), stepId);
    saveCreationRecord();
    if (dynamicField) {
      renderCreationRecord(event.target?.id || '');
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!validateVisibleUrls(form)) return;
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
    if (!validateVisibleUrls(form)) return;
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
    if (!hasWorkRecordContent(creationRecord) || window.confirm('Start a new Work Record? This will replace the Work Record currently saved in this browser.')) {
      creationRecord = makeCreationRecord();
      recordStep = 1;
      saveCreationRecord();
      renderCreationRecord('record-title');
    }
  });
  window.requestAnimationFrame(() => {
    document.querySelector('.record-stepper [aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
  if (focusId) window.requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  else focusCurrentStep('#record-step-heading');
}

function validateVisibleUrls(form) {
  let firstInvalid = null;
  form.querySelectorAll('input[type="url"]:not([disabled])').forEach((input) => {
    const value = input.value.trim();
    const invalid = value && !safeHttpUrl(value);
    input.setCustomValidity(invalid ? 'Enter a complete web address beginning with http:// or https://.' : '');
    if (invalid && !firstInvalid) firstInvalid = input;
    input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
  });
  if (!firstInvalid) return true;
  firstInvalid.reportValidity();
  firstInvalid.focus();
  return false;
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
  return `<div class="record-step-intro"><p class="eyebrow">Step 1</p><h2 id="record-step-heading">What work are you documenting?</h2><p>Use one Work Record for one specific version. If the work changes in an important way, update the version or create a new record.</p></div>
    <div class="field-grid">
      <div class="field field-span-2"><label for="record-title">Work or project title <span class="required">Required</span></label><input id="record-title" name="title" value="${escapeHTML(record.title)}" required ${errorAttributes(errors, 'record-title')} />${fieldError(errors, 'record-title')}</div>
      <div class="field field-span-2"><label for="record-work-type">What kind of work is it? <span class="helper-text">Optional</span></label><input id="record-work-type" name="workType" value="${escapeHTML(record.workType || '')}" placeholder="For example, training, research, a website, or an article" /></div>
      <div class="field field-span-2"><label for="record-description">What is the work, and what is it meant to do?</label><textarea id="record-description" name="description">${escapeHTML(record.description)}</textarea></div>
      <div class="field"><label for="record-status">Current status</label><select id="record-status" name="status">${selectOptions(WORK_RECORD_STATUS_OPTIONS, record.status)}</select></div>
      <div class="field"><label for="artifact-date">Date of this version or release <span class="helper-text">Optional</span></label><input id="artifact-date" name="artifactDate" type="date" value="${escapeHTML(record.artifact?.date || '')}" /></div>
      <div class="field field-span-2"><label for="artifact-url">Link to the exact work${publicStatus ? ' <span class="required">Required for this status</span>' : ''}</label><input id="artifact-url" name="artifactUrl" type="url" value="${escapeHTML(record.artifact?.url || '')}" placeholder="https://" ${publicStatus ? 'required' : ''} ${errorAttributes(errors, 'artifact-url')} /><small>A link to this exact version is stronger than a homepage that changes over time.</small>${fieldError(errors, 'artifact-url')}</div>
      <div class="field field-span-2"><label for="artifact-version">Exact version being documented${publicStatus && !record.artifact?.date ? ' <span class="required">Required unless a release date is provided</span>' : ''}</label><input id="artifact-version" name="artifactVersion" value="${escapeHTML(record.artifact?.version || '')}" placeholder="Release date, file name, version number, Git commit, or other identifier" ${errorAttributes(errors, 'artifact-version')} />${fieldError(errors, 'artifact-version')}</div>
    </div>
    <fieldset class="fieldset"><legend>Does the final work need to sound recognizably like you?</legend><div class="choice-grid">
      ${radioChoice('voiceRequired', 'yes', 'Yes', 'My voice is part of what this work should demonstrate.', record.voiceRequired)}
      ${radioChoice('voiceRequired', 'partly', 'Partly', 'Some parts should sound like me; other parts only need to be clear or functional.', record.voiceRequired)}
      ${radioChoice('voiceRequired', 'no', 'No', 'Clarity or function matters more than my recognizable voice.', record.voiceRequired)}
      ${radioChoice('voiceRequired', 'not-applicable', 'Not applicable', 'This work is not meant to have a personal voice.', record.voiceRequired)}
      ${radioChoice('voiceRequired', 'unknown', 'Not sure yet', 'Leave this visible as unanswered in the record.', record.voiceRequired)}
    </div></fieldset>
    <fieldset class="fieldset"><legend>Are you using this work to show what you know or can do?</legend><div class="choice-grid choice-grid-compact">
      ${radioChoice('capabilityDemonstration', 'yes', 'Yes', 'The work is intended to demonstrate my capability.', record.capabilityDemonstration)}
      ${radioChoice('capabilityDemonstration', 'partly', 'Partly', 'It demonstrates some, but not all, of my capability.', record.capabilityDemonstration)}
      ${radioChoice('capabilityDemonstration', 'no', 'No', 'The work only needs to achieve its purpose.', record.capabilityDemonstration)}
      ${radioChoice('capabilityDemonstration', 'unknown', 'Not sure yet', 'Leave this visible as unanswered in the record.', record.capabilityDemonstration)}
    </div></fieldset>`;
}

function renderRecordClaimsStep(record, errors = []) {
  const selectedIds = new Set(record.claims.map(({ id }) => id));
  const customClaim = record.claims.find(({ id }) => id === 'claim-other');
  return `<div class="record-step-intro"><p class="eyebrow">Step 2</p><h2 id="record-step-heading">What do you want this record to show?</h2><p>Select only the statements you want your evidence to support. The record will report support for each statement separately.</p></div>
    <fieldset class="fieldset" id="claim-selection-group" ${groupErrorAttributes(errors, 'claim-selection-group')}><legend>Statements about your work <span class="required">Choose at least one</span></legend><div class="choice-grid">
      ${CLAIM_PRESETS.map(([id, , statement]) => checkboxChoice('recordClaim', id, statement, '', selectedIds.has(id))).join('')}
    </div>${fieldError(errors, 'claim-selection-group')}</fieldset>
    <div class="field"><label for="custom-claim">Another statement <span class="helper-text">Optional</span></label><textarea id="custom-claim" name="customClaim" placeholder="Write one specific statement that evidence could support or fail to establish.">${escapeHTML(customClaim?.statement || '')}</textarea></div>
    <div class="callout callout-warning"><p><strong>Be precise.</strong> “I directed and evaluated the AI-assisted work” is different from “I personally wrote every line of code.” The record should support only what the evidence can show.</p></div>`;
}

function renderRecordCreditsStep(record, errors = []) {
  const showContributors = record.contributorStatus === 'listed';
  const showAI = ['yes', 'uncertain'].includes(record.aiUse);
  const systems = record.systems.length ? record.systems : [{
    id: makeId('system'), product: '', model: '', role: '', setup: '', evidenceBasis: 'unknown', modelHistory: 'unknown',
  }];
  return `<div class="record-step-intro"><p class="eyebrow">Step 3</p><h2 id="record-step-heading">Give the credits.</h2><p>Name what you did, what other people did, and what each AI tool did. Credit actions, not percentages.</p></div>
    <div class="field-grid">
      <div class="field"><label for="creator-name">Your name <span class="required">Required</span></label><input id="creator-name" name="creatorName" value="${escapeHTML(record.creator?.name || '')}" required ${errorAttributes(errors, 'creator-name')} />${fieldError(errors, 'creator-name')}</div>
      <div class="field"><label for="creator-role">Your role</label><input id="creator-role" name="creatorRole" value="${escapeHTML(record.creator?.role || '')}" placeholder="Creator, author, project owner, designer..." /></div>
      <div class="field field-span-2"><label for="idea-source">Where did the main idea first come from?</label><textarea id="idea-source" name="ideaSource" placeholder="Your notes, a client request, a dated conversation, an earlier draft, an AI suggestion, or unknown">${escapeHTML(record.ideaSource)}</textarea><small>Name the earliest source you can identify. It is okay to say unknown.</small></div>
      <div class="field field-span-2"><label for="human-actions">What important work did you do? <span class="required">Required</span></label><textarea id="human-actions" name="humanActions" placeholder="Describe the ideas, context, direction, evaluation, rejection, revision, checking, and decisions you contributed." required ${errorAttributes(errors, 'human-actions')}>${escapeHTML(record.humanActions)}</textarea>${fieldError(errors, 'human-actions')}</div>
      <div class="field"><label for="contributor-status">Did any other person make an important contribution? <span class="required">Required</span></label><select id="contributor-status" name="contributorStatus" required ${errorAttributes(errors, 'contributor-status')}>${selectOptions([
        ['unknown', 'I have not answered yet'], ['none', 'No other person made an important contribution'], ['listed', 'Yes, list the contributors below'],
      ], record.contributorStatus)}</select>${fieldError(errors, 'contributor-status')}</div>
    </div>
    ${showContributors ? `<fieldset class="fieldset record-repeat-group" id="record-contributors-group" ${groupErrorAttributes(errors, 'record-contributors-group')}><legend>Other human contributors <span class="required">Required</span></legend><div class="record-contributor-list">${record.contributors.map((item, index) => recordContributorEditor(item, index, errors)).join('')}</div>${fieldError(errors, 'record-contributors-group')}<button class="button button-secondary" type="button" id="add-record-contributor">Add another person</button></fieldset>` : ''}
    <fieldset class="fieldset systems-fieldset" id="ai-use-group" ${groupErrorAttributes(errors, 'ai-use-group')}><legend>Did you use AI in the documented workflow? <span class="required">Required</span></legend><div class="choice-grid choice-grid-compact">${AI_USE_OPTIONS.map(([value, label]) => radioChoice('aiUse', value, label, '', record.aiUse)).join('')}</div>${fieldError(errors, 'ai-use-group')}</fieldset>
    ${showAI ? `<div class="field"><label for="ai-contributions">What did the AI tool do? <span class="required">Required</span></label><textarea id="ai-contributions" name="aiContributions" placeholder="Organized notes, compared alternatives, drafted language, wrote code, tested behavior, published approved changes..." required ${errorAttributes(errors, 'ai-contributions')}>${escapeHTML(record.aiContributions)}</textarea>${fieldError(errors, 'ai-contributions')}</div>
      <div class="field"><label for="model-history">Do you know the complete model history for this work?</label><select id="model-history" name="modelHistoryCompleteness">${selectOptions([
        ['complete', 'Yes, all AI models used for important work are identified'], ['incomplete', 'No, at least one model is missing or uncertain'], ['unknown', 'I do not know whether the history is complete'],
      ], record.modelHistoryCompleteness)}</select></div>
      <fieldset class="fieldset record-repeat-group" id="record-systems-group" ${groupErrorAttributes(errors, 'record-systems-group')}><legend>AI tools and jobs <span class="required">Required</span></legend><div class="record-system-list">${systems.map((system, index) => recordSystemEditorV03(system, index, systems.length, errors)).join('')}</div>${fieldError(errors, 'record-systems-group')}<button class="button button-secondary" type="button" id="add-record-system-v03">Add another AI tool</button></fieldset>` : ''}`;
}

function renderRecordEvidenceStep(record, errors = []) {
  const evidenceRequired = !['in-progress', 'private'].includes(record.status);
  const publicEvidenceLevel = ['selected', 'full'].includes(record.publicEvidenceLevel) ? 'selected' : 'summary';
  return `<div class="record-step-intro"><p class="eyebrow">Step 4</p><h2 id="record-step-heading">What records support your statements?</h2><p>Add chats, notes, drafts, commits, tests, or approval records that help show how this work was made. Evidence may stay private.</p></div>
    ${evidenceRequired ? '<div class="callout"><p><strong>Required for this status:</strong> Add at least one evidence item with a description, link, or version; say what it shows; and connect it to at least one statement.</p></div>' : ''}
    <div class="field"><label for="public-evidence-level">How much supporting evidence should appear in the public Work Record?</label><select id="public-evidence-level" name="publicEvidenceLevel">${selectOptions([
      ['selected', 'Show evidence items marked Public'], ['summary', 'Show a summary only'],
    ], publicEvidenceLevel)}</select></div>
    <div class="callout"><p><strong>Privacy first:</strong> New evidence starts as private. A public export never includes private URLs or notes. Redacted evidence appears only as a placeholder.</p></div>
    <div class="record-evidence-list" id="record-evidence-list" role="group" aria-label="${evidenceRequired ? 'Evidence items, required for this status' : 'Evidence items'}" ${groupErrorAttributes(errors, 'record-evidence-list')}>${record.evidence.map((item, index) => recordEvidenceEditor(item, index, record.claims)).join('')}</div>
    ${fieldError(errors, 'record-evidence-list')}
    <button class="button button-secondary" type="button" id="add-record-evidence">Add evidence</button>`;
}

function renderRecordHandlingStep(record, errors = []) {
  return `<div class="record-step-intro"><p class="eyebrow">Step 5</p><h2 id="record-step-heading">Who handled each part of the work?</h2><p>Record who led each part and what happened to AI output. Reviewing and changing AI output is different from accepting it as written.</p></div>
    <div class="contribution-card-list" id="contribution-map" role="group" aria-label="Contribution handling, choose at least one" ${groupErrorAttributes(errors, 'contribution-map')}>${CONTRIBUTIONS.map(([key, label]) => `<div class="contribution-card"><div><label for="contribution-${key}">${escapeHTML(label)}</label><p class="helper-text" id="contribution-help-${key}">${escapeHTML(contributionDescription(key))}</p></div><select id="contribution-${key}" name="contribution:${key}" aria-label="How was ${escapeHTML(label)} handled?" aria-describedby="contribution-help-${key}">${selectOptions(CONTRIBUTION_OPTIONS, record.contributions[key])}</select></div>`).join('')}</div>${fieldError(errors, 'contribution-map')}`;
}

function contributionDescription(key) {
  return ({
    idea: 'The main idea, purpose, or question.',
    method: 'The method, process, source material, or approach.',
    sources: 'Finding, selecting, or checking outside information.',
    structure: 'Setting requirements and deciding how the product should work.',
    review: 'Evaluating options, challenging ideas, and deciding what stayed.',
    revision: 'Writing, editing, and protecting the final meaning.',
    production: 'Creating the code, design, media, or finished product.',
    verification: 'Testing important claims, code, links, or behavior.',
    release: 'Deciding when this exact version was ready to share.',
  })[key] || 'This part of the work.';
}

function renderRecordReviewStep(record, errors = []) {
  const publicRecord = toPublicWorkRecord(record);
  const independent = record.review?.status === 'independently-checked';
  const releaseDecisionRequired = !['in-progress', 'private'].includes(record.status);
  return `<div class="record-step-intro"><p class="eyebrow">Step 6</p><h2 id="record-step-heading">Review the record and name who approved this version.</h2><p>For published or shared work, name the person who decided this exact version was ready. For a draft, this may remain blank.</p></div>
    <fieldset class="fieldset"><legend>Who decided this exact version was ready to share?</legend><div class="field-grid">
      <div class="field"><label for="final-name">Name${releaseDecisionRequired ? ' <span class="required">Required</span>' : ''}</label><input id="final-name" name="finalDecisionName" value="${escapeHTML(record.finalDecision?.name || '')}" ${releaseDecisionRequired ? 'required' : ''} ${errorAttributes(errors, 'final-name')} />${fieldError(errors, 'final-name')}</div>
      <div class="field"><label for="final-role">Role${releaseDecisionRequired ? ' <span class="required">Required</span>' : ''}</label><input id="final-role" name="finalDecisionRole" value="${escapeHTML(record.finalDecision?.role || '')}" ${releaseDecisionRequired ? 'required' : ''} ${errorAttributes(errors, 'final-role')} />${fieldError(errors, 'final-role')}</div>
      <div class="field"><label for="final-date">Decision date${releaseDecisionRequired ? ' <span class="required">Required</span>' : ''}</label><input id="final-date" name="finalDecisionDate" type="date" value="${escapeHTML(record.finalDecision?.date || '')}" ${releaseDecisionRequired ? 'required' : ''} ${errorAttributes(errors, 'final-date')} />${fieldError(errors, 'final-date')}</div>
    </div></fieldset>
    <details class="optional-review" ${independent ? 'open' : ''}><summary>Did someone else review the evidence? <span class="helper-text">Optional</span></summary>
      <p class="helper-text">An evidence reviewer checks the records supporting this account. This is different from reviewing only the finished work.</p>
      <div class="field"><label for="review-status">Review status</label><select id="review-status" name="reviewStatus">${selectOptions([['self-reviewed', 'Self-reviewed'], ['independently-checked', 'Independently checked']], record.review?.status || 'self-reviewed')}</select></div>
      ${independent ? `<div class="field-grid">
        <div class="field"><label for="reviewer-name-v03">Reviewer name <span class="required">Required</span></label><input id="reviewer-name-v03" name="reviewerName" value="${escapeHTML(record.review?.reviewerName || '')}" required ${errorAttributes(errors, 'reviewer-name-v03')} />${fieldError(errors, 'reviewer-name-v03')}</div>
        <div class="field"><label for="reviewer-role-v03">Reviewer role <span class="required">Required</span></label><input id="reviewer-role-v03" name="reviewerRole" value="${escapeHTML(record.review?.reviewerRole || '')}" required ${errorAttributes(errors, 'reviewer-role-v03')} />${fieldError(errors, 'reviewer-role-v03')}</div>
        <div class="field field-span-2"><label for="reviewer-scope-v03">What records did they review, what did they find, and what did they not review? <span class="required">Required</span></label><textarea id="reviewer-scope-v03" name="reviewerScope" required ${errorAttributes(errors, 'reviewer-scope-v03')}>${escapeHTML(record.review?.scope || '')}</textarea>${fieldError(errors, 'reviewer-scope-v03')}</div>
        <div class="field"><label for="reviewer-date-v03">Review date <span class="required">Required</span></label><input id="reviewer-date-v03" name="reviewerDate" type="date" value="${escapeHTML(record.review?.date || '')}" required ${errorAttributes(errors, 'reviewer-date-v03')} />${fieldError(errors, 'reviewer-date-v03')}</div>
        <div class="field"><label for="review-visibility">Reviewer details in public record</label><select id="review-visibility" name="reviewVisibility">${selectOptions(EVIDENCE_VISIBILITY_OPTIONS, record.review?.visibility || 'private')}</select></div>
      </div>
      <fieldset class="fieldset" id="review-claims-group" ${groupErrorAttributes(errors, 'review-claims-group')}><legend>Which statements did the reviewer examine? <span class="required">Required</span></legend><label class="choice"><input type="checkbox" name="reviewAllClaims" value="true" ${record.review?.allClaims ? 'checked' : ''} /><span><strong>All selected statements</strong></span></label><div class="choice-grid">${record.claims.map((claim) => checkboxChoice('reviewClaimId', claim.id, claim.statement, '', record.review?.claimIds?.includes(claim.id))).join('')}</div>${fieldError(errors, 'review-claims-group')}</fieldset>` : ''}
    </details>
    <details class="record-review-preview"><summary>Preview the public Work Record</summary><section class="record-review-preview-body" aria-label="Public preview">${workRecordPreview(publicRecord, { draft: !getWorkRecordCompleteness(record).publicReady })}</section></details>`;
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
      <div class="field field-span-2"><label for="contributor-credit-${index}">What important work did this person do? <span class="required">Required</span></label><textarea id="contributor-credit-${index}" name="contributorContribution" required ${errorAttributes(errors, `contributor-credit-${index}`)}>${escapeHTML(item.contribution)}</textarea>${fieldError(errors, `contributor-credit-${index}`)}</div>
      <div class="field"><label for="contributor-visibility-${index}">Public visibility</label><select id="contributor-visibility-${index}" name="contributorVisibility">${selectOptions(EVIDENCE_VISIBILITY_OPTIONS, item.visibility || 'private')}</select></div>
    </div>
  </article>`;
}

function recordSystemEditorV03(system, index, count, errors = []) {
  return `<article class="system-editor">
    <div class="system-editor-heading"><h3>AI tool ${index + 1}</h3>${count > 1 ? `<button class="text-button" type="button" data-remove-record-system-v03="${escapeHTML(system.id)}">Remove</button>` : ''}</div>
    <input type="hidden" name="recordSystemId" value="${escapeHTML(system.id)}" />
    <div class="field-grid">
      <div class="field"><label for="record-system-product-v03-${index}">AI product or tool <span class="required">Required</span></label><input id="record-system-product-v03-${index}" name="recordSystemProduct" value="${escapeHTML(system.product)}" placeholder="For example, ChatGPT" required ${errorAttributes(errors, `record-system-product-v03-${index}`)} />${fieldError(errors, `record-system-product-v03-${index}`)}</div>
      <div class="field"><label for="record-system-model-v03-${index}">Exact model or version <span class="required">Required</span></label><input id="record-system-model-v03-${index}" name="recordSystemModel" value="${escapeHTML(system.model)}" placeholder="Enter Unknown if it was not shown" required ${errorAttributes(errors, `record-system-model-v03-${index}`)} />${fieldError(errors, `record-system-model-v03-${index}`)}</div>
      <div class="field field-span-2"><label for="record-system-setup-v03-${index}">How did you configure or guide it?</label><textarea id="record-system-setup-v03-${index}" name="recordSystemSetup" placeholder="Prompts, custom instructions, memory, tools, source files, or permissions">${escapeHTML(system.setup || '')}</textarea></div>
      <div class="field field-span-2"><label for="record-system-role-v03-${index}">What job did this AI tool do? <span class="required">Required</span></label><textarea id="record-system-role-v03-${index}" name="recordSystemRole" required ${errorAttributes(errors, `record-system-role-v03-${index}`)}>${escapeHTML(system.role)}</textarea>${fieldError(errors, `record-system-role-v03-${index}`)}</div>
      <div class="field"><label for="record-system-basis-v03-${index}">Do you have a saved record of what this AI tool did?</label><select id="record-system-basis-v03-${index}" name="recordSystemEvidenceBasis">${selectOptions([['unknown', 'I do not know yet'], ['confirmed', 'Yes, I can name a saved record'], ['reported', 'No saved record; this is based on my observation or memory']], system.evidenceBasis || 'unknown')}</select></div>
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
      <div class="field field-span-2"><label for="evidence-description-${index}">What is this record, and what does it show?</label><textarea id="evidence-description-${index}" name="evidenceDescription" placeholder="For example: a dated chat showing the original idea and the changes I required">${escapeHTML(item.description || '')}</textarea></div>
      <div class="field field-span-2"><label for="evidence-url-${index}">Link <span class="helper-text">Optional. Public links may appear in the public record.</span></label><input id="evidence-url-${index}" name="evidenceUrl" type="url" value="${escapeHTML(item.url || '')}" placeholder="https://" /></div>
      <div class="field"><label for="evidence-version-${index}">Version, commit, release, or identifier</label><input id="evidence-version-${index}" name="evidenceVersion" value="${escapeHTML(item.version || '')}" /></div>
      <div class="field"><label for="evidence-visibility-${index}">Visibility</label><select id="evidence-visibility-${index}" name="evidenceVisibility">${selectOptions(EVIDENCE_VISIBILITY_OPTIONS, item.visibility || 'private')}</select></div>
      <div class="field"><label for="evidence-integrity-${index}">Can you connect this record to the exact work version?</label><select id="evidence-integrity-${index}" name="evidenceIntegrity">${selectOptions(EVIDENCE_INTEGRITY_OPTIONS, item.integrity || 'unlinked')}</select><small>Choose the protected option only when a signature, credential, verified digest, or similar mechanism would reveal unnoticed changes.</small></div>
      <div class="field"><label for="evidence-relationship-${index}">How does this record relate to the selected statements?</label><select id="evidence-relationship-${index}" name="evidenceRelationship">${selectOptions(EVIDENCE_RELATIONSHIP_OPTIONS, item.relationship || 'unknown')}</select></div>
    </div>
    <fieldset class="fieldset"><legend>Which statements does this record address?</legend><div class="choice-grid">${claims.length ? claims.map((claim) => checkboxChoice(`evidenceClaim:${item.id}`, claim.id, claim.statement, '', item.claimIds?.includes(claim.id))).join('') : '<p class="helper-text">Return to Step 2 and select at least one statement.</p>'}</div></fieldset>
  </article>`;
}

function captureWorkRecordStep(form, stepId) {
  if (stepId === 'work') {
    creationRecord.title = String(form.get('title') || '').trim();
    creationRecord.workType = String(form.get('workType') || '').trim();
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
    if (!record.artifact?.version && !record.artifact?.date) errors.push({ id: 'artifact-version', message: 'Identify the work version, commit, release, file, or release date.' });
    }
  }
  if (stepId === 'claims' && !record.claims.length) errors.push({ id: 'claim-selection-group', message: 'Choose or write at least one statement for this record.' });
  if (stepId === 'credits') {
    if (!record.creator?.name) errors.push({ id: 'creator-name', message: 'Enter your name for the credits.' });
    if (!record.humanActions) errors.push({ id: 'human-actions', message: 'Describe the important work you did.' });
    if (record.contributorStatus === 'unknown') errors.push({ id: 'contributor-status', message: 'Say whether another person made an important contribution.' });
    if (record.contributorStatus === 'listed') {
      if (!record.contributors.length) errors.push({ id: 'record-contributors-group', message: 'Add at least one other person and describe the contribution.' });
      record.contributors.forEach((contributor, index) => {
        if (!contributor.name) errors.push({ id: `contributor-name-${index}`, message: `Enter a name for person ${index + 1}.` });
        if (!contributor.contribution) errors.push({ id: `contributor-credit-${index}`, message: `Describe the important work person ${index + 1} did.` });
      });
    }
    if (record.aiUse === 'unknown') errors.push({ id: 'ai-use-group', message: 'Tell us whether you used AI in the documented workflow.' });
    if (['yes', 'uncertain'].includes(record.aiUse)) {
      if (!record.aiContributions) errors.push({ id: 'ai-contributions', message: 'Describe what the AI tool did.' });
      if (!record.systems.length) errors.push({ id: 'record-systems-group', message: 'Add at least one AI tool and describe what it did.' });
      record.systems.forEach((system, index) => {
        if (!system.product) errors.push({ id: `record-system-product-v03-${index}`, message: `Enter the AI product or tool for system ${index + 1}.` });
        if (!system.model) errors.push({ id: `record-system-model-v03-${index}`, message: `Enter the model or “Unknown” for system ${index + 1}.` });
        if (!system.role) errors.push({ id: `record-system-role-v03-${index}`, message: `Describe what AI tool ${index + 1} did.` });
      });
    }
  }
  if (stepId === 'evidence' && !['in-progress', 'private'].includes(record.status)) {
    const substantive = record.evidence.find((item) => (item.url || item.description || item.version) && item.claimIds?.length && item.relationship !== 'unknown');
    if (!substantive) errors.push({ id: 'record-evidence-list', message: 'Add a description, link, or version; say what it shows; and connect it to a statement.' });
  }
  if (stepId === 'handling' && !Object.values(record.contributions).some((value) => !['Unknown', 'Not applicable'].includes(value))) errors.push({ id: 'contribution-map', message: 'Record how at least one part of the work was handled.' });
  if (stepId === 'review' && record.review?.status === 'independently-checked') {
    if (!record.review.reviewerName) errors.push({ id: 'reviewer-name-v03', message: 'Enter the independent reviewer’s name.' });
    if (!record.review.reviewerRole) errors.push({ id: 'reviewer-role-v03', message: 'Enter the independent reviewer’s role.' });
    if (!record.review.scope) errors.push({ id: 'reviewer-scope-v03', message: 'Describe the records examined, scope, findings, and limits.' });
    if (!record.review.date) errors.push({ id: 'reviewer-date-v03', message: 'Enter the independent review date.' });
    if (!(record.review.allClaims || record.review.claimIds?.length)) errors.push({ id: 'review-claims-group', message: 'Identify which statements the independent reviewer examined.' });
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
      if (!validateVisibleUrls(form)) return;
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
      if (item && (item.product || item.model || item.role || item.setup || item.evidence) && !window.confirm('Remove this AI tool and its job from the record?')) return;
      creationRecord.systems = creationRecord.systems.filter(({ id }) => id !== button.dataset.removeRecordSystemV03);
      saveCreationRecord();
      renderCreationRecord('add-record-system-v03');
    });
  });
  document.querySelector('#add-record-evidence')?.addEventListener('click', () => {
    if (!validateVisibleUrls(form)) return;
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
      if (!validateVisibleUrls(form)) return;
      captureWorkRecordStep(new FormData(form), stepId);
      const item = creationRecord.evidence.find(({ id }) => id === button.dataset.removeRecordEvidence);
      if (item && (item.description || item.url || item.version || item.date || item.claimIds?.length || item.relationship !== 'unknown') && !window.confirm('Remove this evidence item and its statement links?')) return;
      creationRecord.evidence = creationRecord.evidence.filter(({ id }) => id !== button.dataset.removeRecordEvidence);
      creationRecord.claims = creationRecord.claims.map((claim) => ({ ...claim, evidenceIds: claim.evidenceIds.filter((id) => id !== button.dataset.removeRecordEvidence) }));
      saveCreationRecord();
      renderCreationRecord('add-record-evidence');
    });
  });
}

function workRecordCreditsText(recordInput) {
  const record = normalizeWorkRecord(recordInput);
  const title = record.title || 'Untitled work';
  const creator = record.creator.name || 'Creator not named';
  const humanContribution = record.humanActions || 'The human contribution has not yet been described.';
  const humanLine = /[.!?]$/.test(humanContribution) ? humanContribution : `${humanContribution}.`;
  let aiLine = 'Whether AI contributed has not been answered or established.';
  if (record.aiUse === 'no-ai-reported') aiLine = 'No AI use was reported in the documented workflow.';
  if (record.aiUse === 'uncertain') aiLine = 'AI use was reported as uncertain or incompletely documented.';
  if (record.aiUse === 'yes') {
    const systems = record.systems.map(({ product, model }) => [product, model].filter(Boolean).join(' ')).filter(Boolean).join(', ') || 'An AI tool';
    const contributions = record.aiContributions || record.systems.map(({ role }) => role).filter(Boolean).join('; ') || 'the assistance described in the Detailed Work Record';
    aiLine = `${systems} assisted with ${contributions}.`;
  }
  const decisionLine = record.finalDecision.name
    ? `${record.finalDecision.name} made the recorded final release decision${record.finalDecision.date ? ` on ${record.finalDecision.date}` : ''}.`
    : 'The final release decision is not yet recorded.';
  return `${title}\nCreated by ${creator}\n\n${creator}: ${humanLine}\nAI assistance: ${aiLine}\n${decisionLine}`;
}

function workRecordCreditsHTML(record) {
  return workRecordCreditsText(record).split('\n').filter(Boolean).map((line) => `<p>${escapeHTML(line)}</p>`).join('');
}

function renderWorkRecordResult() {
  document.title = `${creationRecord.title || 'Work Record'} | evAIdence`;
  const publicRecord = toPublicWorkRecord(creationRecord);
  const completeness = getWorkRecordCompleteness(creationRecord);
  main.innerHTML = `<div class="page work-record-result-page">
    <header class="page-header">
      <p class="eyebrow">Work Record created</p>
      <h1>Your credits and evidence are ready to review.</h1>
      <p>This public view omits private evidence links, notes, and contributor or reviewer details marked private. Review the complete preview before sharing it, and keep the private backup if you may need the full record later.</p>
    </header>
    ${completeness.publicReady ? '' : `<div class="callout callout-warning"><p><strong>This is a complete private draft, not a public-ready record.</strong> To make it public-ready, add: ${escapeHTML((completeness.publicMissing || completeness.missing).join(' · '))}.</p></div>`}
    <article class="record-preview public-record" id="public-work-record">${workRecordPreview(publicRecord, { draft: !completeness.publicReady })}</article>
    <div class="result-actions no-print">
      <button class="button" type="button" id="print-record-v03">${completeness.publicReady ? 'Print or save as PDF' : 'Print draft'}</button>
      <button class="button button-secondary" type="button" id="download-public-record">${completeness.publicReady ? 'Download public record' : 'Download draft record'}</button>
      <button class="button button-secondary" type="button" id="export-private-record">Export private backup</button>
      <button class="button button-secondary" type="button" id="copy-work-credits-v03">Copy work credits</button>
      <a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Review this preview <span class="new-tab-note">(opens a Google Form in a new tab)</span></a>
      <button class="text-button" type="button" id="edit-work-record">Edit record</button>
    </div>
    <section class="optional-next-step card">
      <p class="eyebrow">Optional next step</p>
      <h2>Did this work depend on AI being right or acting correctly?</h2>
      <p>Run a Load Test if AI influenced a consequential decision, handled work you could not fully judge, used tools or permissions, published or deployed anything, or could affect another person if the work were wrong.</p>
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
  document.querySelector('#copy-work-credits-v03').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(workRecordCreditsText(creationRecord));
      showToast('Work credits copied.');
    } catch {
      showToast('Copy was unavailable. Select the work credits in the record instead.');
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
      <p class="kicker">evAIdence™ Work Record · Founding Preview v0.5</p>
      ${options.draft ? '<p class="draft-stamp">Draft Work Record · Public-ready requirements are incomplete</p>' : ''}
      ${titleMarkup}
      <p class="record-summary">${escapeHTML(credits.headline)}</p>
      <p>${escapeHTML(record.description || 'No description provided.')}</p>
    </header>
    <section class="record-output-section"><h3>Work documented</h3><dl class="record-facts">
      <div><dt>Status</dt><dd>${escapeHTML(statusLabel)}</dd></div>
      <div><dt>Work type</dt><dd>${escapeHTML(record.workType || 'Not identified')}</dd></div>
      <div><dt>Exact version</dt><dd>${escapeHTML(record.artifact?.version || record.artifact?.date || 'Not identified')}</dd></div>
      <div><dt>Project ID</dt><dd>${escapeHTML(record.projectId || 'Not identified')}</dd></div>
      <div><dt>Record ID</dt><dd>${escapeHTML(record.id)}</dd></div>
      <div><dt>Updated</dt><dd>${escapeHTML(formatDate(record.updatedAt))}</dd></div>
      <div><dt>Recognizable voice needed</dt><dd>${escapeHTML(voiceLabel)}</dd></div>
      <div><dt>Used to demonstrate capability</dt><dd>${escapeHTML(capabilityLabel)}</dd></div>
    </dl>${record.artifact?.url ? `<p><a href="${escapeHTML(record.artifact.url)}" target="_blank" rel="noreferrer">Open the documented work <span class="new-tab-note">(opens in a new tab)</span></a></p>` : ''}</section>
    ${record.readiness?.workCheckId || record.outcome?.intended ? `<section class="record-output-section"><h3>Linked Load Test context</h3><dl class="record-facts">
      <div><dt>Result the creator counted on</dt><dd>${escapeHTML(record.outcome?.intended || 'Not recorded')}</dd></div>
      <div><dt>Serious failure</dt><dd>${escapeHTML(record.outcome?.failureScenario || 'Not recorded')}</dd></div>
      <div><dt>Possible impact</dt><dd>${escapeHTML(record.outcome?.failureImpact || 'Not recorded')}</dd></div>
      <div><dt>Load Test result</dt><dd>${escapeHTML(record.readiness?.decision || 'Load Test not completed')}</dd></div>
    </dl></section>` : ''}
    <section class="record-output-section"><h3>Credits</h3><h4>People and systems involved</h4>
      ${credits.human.map((item) => `<div class="credit-row"><strong>${escapeHTML(item.name)}</strong>${item.role ? ` <span>(${escapeHTML(item.role)})</span>` : ''}<p>${escapeHTML(item.credit)}</p></div>`).join('') || '<p>No human creator named.</p>'}
      ${record.aiUse === 'unknown'
        ? '<p>Whether AI was used has not been answered or established.</p>'
        : record.aiUse === 'no-ai-reported'
          ? '<p>No AI use was reported in the documented workflow.</p>'
          : `<h4>AI tools</h4>${credits.ai.map((item) => `<div class="credit-row"><strong>${escapeHTML(item.name)}</strong><p>${escapeHTML(item.role)}</p></div>`).join('')}<p class="helper-text">${escapeHTML(credits.modelHistoryNote)}</p>`}
      <h4>Detailed credits</h4><ul class="mini-record-list credit-role-list">${credits.roles.map((item) => `<li><span><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.credit)}</small></span><strong>${escapeHTML(creditHandlingLabel(item.handling))}</strong></li>`).join('')}</ul>
    </section>
    <section class="record-output-section"><h3>What this record supports</h3><p class="helper-text"><strong>Documented</strong> means at least one linked evidence item supports the statement. It does not mean the statement was independently confirmed.</p><ul class="claim-support-list">${claimRows.map(({ claim, support }) => `<li><span>${escapeHTML(claim.statement)}</span><strong class="status-pill">${escapeHTML(claimSupportLabel(support.label))}</strong></li>`).join('') || '<li>No statements selected.</li>'}</ul></section>
    <section class="record-output-section"><h3>Evidence profile</h3><dl class="record-facts">
      <div><dt>Connection to this work version</dt><dd>${escapeHTML(integrity.label)}</dd></div>
      <div><dt>Who reviewed the evidence</dt><dd>${escapeHTML(review.label === 'Independently checked' ? 'Independent review recorded' : review.label)}</dd></div>
      <div><dt>Evidence items recorded</dt><dd>${evidenceSummary.total ?? record.evidence?.length ?? 0}</dd></div>
      <div><dt>Evidence items shown here</dt><dd>${record.evidence?.length || 0}</dd></div>
      <div><dt>Private items not shown</dt><dd>${evidenceSummary.private || 0}</dd></div>
    </dl><p class="helper-text">The labels are calculated from what was entered in this record. They are not independent verification unless an independent review is named.</p>
      ${record.evidence?.length ? `<h4>Selected evidence</h4><ul>${record.evidence.map((item) => item.visibility === 'redacted' ? '<li>Redacted supporting evidence. Details are withheld from the public record.</li>' : `<li><strong>${escapeHTML(item.label)}</strong>${item.date ? ` · ${escapeHTML(item.date)}` : ''}${item.version ? ` · ${escapeHTML(item.version)}` : ''}${item.url ? `<br /><a href="${escapeHTML(item.url)}" target="_blank" rel="noreferrer">Open evidence <span class="new-tab-note">(opens in a new tab)</span></a>` : ''}${item.description ? `<br />${escapeHTML(item.description)}` : ''}</li>`).join('')}</ul>` : '<p>No evidence items are displayed publicly.</p>'}
    </section>
    <section class="record-output-section"><h3>Final release decision</h3><p>${escapeHTML(finalDecision || 'No final release decision is recorded for this draft.')}</p></section>
    <section class="record-output-section"><h3>Known limits</h3><ul>${limitations.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul></section>
    <section class="record-output-section disclosure-box"><h3>Work credits</h3>${workRecordCreditsHTML(record)}</section>
    <footer class="public-record-footer"><p>The Work Record creates a dated account of where the work began, what people and AI tools did, who made the decisions, and which records support that account. It can connect those records to one exact work version.</p><p>Record schema ${WORK_RECORD_SCHEMA_VERSION}. This is a practice-based public prototype. Records are self-reported unless an independent evidence review is named.</p></footer>`;
}

function claimSupportLabel(label) {
  return label === 'Independently reviewed' ? 'Independent review recorded' : label;
}

function workRecordLimitations(record, claimRows, integrity, review) {
  const limits = [];
  if (record.aiUse === 'unknown') limits.push('Whether AI was used has not been answered or established.');
  else if (record.modelHistoryCompleteness !== 'complete' && record.aiUse !== 'no-ai-reported') limits.push('The complete AI model history has not been verified.');
  if (review.level !== 'independently-checked') limits.push('The supporting account has not been independently checked.');
  if (integrity.level === 'unlinked') limits.push('The public evidence is not fully tied to the exact work version.');
  if (claimRows.some(({ support }) => support.level === 'self-described')) limits.push('At least one statement is self-described without public supporting evidence.');
  if (claimRows.some(({ support }) => support.level === 'contradicted')) limits.push('At least one selected statement is contradicted by evidence.');
  limits.push('The dates in this browser-generated record have not been independently verified.');
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
  const title = escapeHTML(publicRecord.title || 'evAIdence Work Record');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
    body{max-width:850px;margin:0 auto;padding:40px 24px;color:#18211d;font:16px/1.55 system-ui,sans-serif}h1,h2,h3,h4{font-family:Georgia,serif;line-height:1.15}h1{font-size:2.4rem}.draft-stamp{padding:.7rem;border:2px solid #963e38;color:#963e38;font-weight:800;text-transform:uppercase}.kicker,dt{font:700 .75rem ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#0e5b50}.record-summary{padding:1rem 0;border-block:2px solid #18211d;font:600 1.4rem Georgia,serif}.record-output-section{padding:1.25rem 0;border-bottom:1px solid #cbd3cd}.record-facts{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.record-facts div{padding:.75rem;background:#f6f2e9}.record-facts dd{margin:.25rem 0 0}.claim-support-list,.mini-record-list{padding:0;list-style:none}.claim-support-list li,.mini-record-list li{display:flex;justify-content:space-between;gap:1rem;padding:.65rem 0;border-bottom:1px solid #cbd3cd}.credit-role-list small{display:block;margin-top:.2rem;color:#59645e}.status-pill{white-space:nowrap}.credit-row{padding:.75rem 0;border-bottom:1px solid #cbd3cd}.credit-row p{margin:.25rem 0}.helper-text,.public-record-footer{color:#59645e;font-size:.88rem}.disclosure-box{background:#dce8df;padding:1rem}.new-tab-note{font-size:.8em}@media(max-width:600px){.record-facts{grid-template-columns:1fr}.claim-support-list li,.mini-record-list li{display:block}.status-pill{display:block;margin-top:.3rem}}@media print{body{padding:0}.record-output-section{break-inside:auto}.credit-row,.record-facts div,.claim-support-list li,.mini-record-list li{break-inside:avoid}}
  </style></head><body><main>${workRecordPreview(publicRecord, { standalone: true, draft })}</main></body></html>`;
  downloadText(`${slug(publicRecord.title || 'work-record')}-${draft ? 'draft-record' : 'public-record'}.html`, html, 'text/html');
}

function hasWorkRecordContent(record) {
  return Boolean(
    record.title || record.workType || record.description || record.ideaSource || record.humanActions || record.aiContributions ||
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
    'title', 'workType', 'creator', 'creatorName', 'humanActions', 'claims', 'evidence',
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
      if (hasWorkRecordContent(creationRecord) && !window.confirm('Replace the Work Record currently saved in this browser with the imported record?')) {
        event.target.value = '';
        return;
      }
      creationRecord = candidate;
      recordStep = 1;
      saveCreationRecord();
      showToast('Work Record imported. Review every step before publishing it.');
      renderCreationRecord('record-title');
    } catch {
      showToast('That file is not a valid evAIdence Work Record.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function prefillWorkCheckFromRecord() {
  if (assessment.project?.task && assessment.projectId !== creationRecord.projectId && !window.confirm('Replace the current Load Test setup with this Work Record? Export the current Load Test first if you want to keep it.')) return false;
  assessment = makeAssessment();
  assessment.projectId = creationRecord.projectId || assessment.projectId;
  assessment.stage = ['released', 'public-prototype', 'ready'].includes(creationRecord.status)
    ? 'release'
    : creationRecord.status === 'in-progress' ? 'build' : 'plan';
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

function focusCurrentStep(preferredSelector = '') {
  window.requestAnimationFrame(() => {
    const target = main.querySelector('[role="alert"]') || (preferredSelector ? main.querySelector(preferredSelector) : null) || main.querySelector('h1') || main;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
}

function renderMethod() {
  document.title = 'How It Works | evAIdence';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">How it works</p><h1>Create one clear Work Receipt. Return later to see what changed.</h1><p>Start with records your work already creates. evAIdence turns them into a Work Receipt showing what you did, what AI did, what records you provided, and what remains unknown. Save another Work Receipt for comparable work and My Changes shows what moved.</p></header>
    <div class="button-row"><a class="button" href="#/snapshot">Create a Work Receipt</a><a class="button button-secondary" href="#/changes">View My Changes</a></div>
    <div class="prose">
      <h2>The main method</h2>
      <h3>1. Work Receipt: What happened in this work?</h3>
      <p>A Work Receipt uses the AI conversation, what AI already had, what you added, source material, the finished work, and available version history to bring one collaboration into focus.</p>
      <ol><li>Name the project and add the records you have.</li><li>Confirm what you did, what AI did, what AI could access or do, and when it needed approval.</li><li>Save the Work Receipt as a baseline or compare it with earlier work.</li></ol>
      <p>You can export one private Work Receipt data file, print the receipt, or copy its work credits without sharing your complete private history.</p>
      <h3>Why this is not an AI detector</h3>
      <p>An AI detector guesses from patterns in a finished product. A Work Receipt uses records from the process. It does not classify the work as human or AI, assign a human-versus-AI percentage, or help someone bypass detection.</p>
      <h3>2. My Changes: What moved over time?</h3>
      <p>My Changes compares Work Receipts from similar work. It can show that AI entered earlier, performed different work, received more permission, or that your checking changed. It does not grade the change as good or bad. It shows what moved so you can decide whether the change was intentional and still fits the work.</p>
      <h3>Optional: Load Test when a change needs a closer look</h3>
      <p>Use the Load Test when a Work Receipt shows that AI entered earlier, gained access, acted before review, or took on work you may not be able to judge fully. It compares the assigned AI role with human capacity, workflow controls, evidence, and possible consequences.</p>
      <ol><li>Choose whether the work is planned, in progress, ready to launch, or already in use.</li><li>Describe what you are making, what each AI tool does, who works directly with it, what people do, and what could go wrong.</li><li>See what the current setup can carry, where the wager is exposed, and what could change it.</li></ol>
      <h2>Load Test central question</h2>
      <blockquote class="callout"><p><strong>What does the role you gave AI require from you and anyone else doing or checking the work? Can those people and the workflow carry that load? What could happen if they cannot?</strong></p></blockquote>
      <p><strong>The Load Test does not decide whether you may proceed.</strong> It shows the wager you are making so you can decide with your eyes open.</p>
      <p class="helper-text">Here, “load” means the judgment, checking, approval, monitoring, correction, stopping, and recovery work that still has to be carried by people and the workflow.</p>
      <h2>The five questions being scored</h2>
      <div class="table-scroll" role="region" aria-label="Five questions scored by the method" tabindex="0"><table><thead><tr><th scope="col">Question</th><th scope="col">Method term</th></tr></thead><tbody>
        <tr><td><strong>Can the human reviewer catch and correct a serious problem?</strong><br />Does that person have the knowledge, access, decision power, time, and attention this review requires?</td><td>Human Review Capacity</td></tr>
        <tr><td><strong>Can this exact AI setup perform its assigned role?</strong><br />Has it been tested on normal work and important failure cases?</td><td>AI Role Fit</td></tr>
        <tr><td><strong>Does the AI tool respond the way this work requires?</strong><br />Can it question a weak idea, explain doubt, test, and stop when needed?</td><td>Working Relationship</td></tr>
        <tr><td><strong>Can the workflow carry its part of the load?</strong><br />Are access, permissions, records, checks, approvals, stopping, and recovery matched to the AI role and possible consequences?</td><td>Workflow and Controls</td></tr>
        <tr><td><strong>Can I tell whether the outcome I am betting on was achieved?</strong><br />The evidence needed changes from a plan, to launch, to real use.</td><td>Outcome and Stakes</td></tr>
      </tbody></table></div>
      <h2>AI fluency and this tool answer different questions</h2>
      <p><a href="https://aifluencyframework.org/" target="_blank" rel="noreferrer">The AI Fluency Framework <span class="new-tab-note">(opens in a new tab)</span></a> develops broad human competencies for deciding how to use AI, describing what is needed, evaluating what comes back, and using AI responsibly.</p>
      <p>Fluency matters, but it does not establish that you can catch a serious error in this task, inspect the important work, control the AI tool’s access, stop a harmful action, or sustain the required review. The Load Test examines those conditions in one real setup.</p>
      <details class="result-disclosure"><summary>See detailed scoring rules and score ranges</summary><div class="result-disclosure-body">
      <h2>How the score works</h2>
      <ol>
        <li>Each answer has a transparent rubric value.</li>
        <li>“I do not know” is not scored as zero. When a required answer or the human reviewer is unknown, the result says what information is missing instead of showing a number.</li>
        <li>The Load Test score describes how the recorded answers about human review capacity, AI role fit, AI behavior, workflow controls, and outcome checks line up in this setup. It is not the probability that AI is correct.</li>
        <li>Evidence Strength is reported separately. Thin evidence creates uncertainty, but it does not automatically turn reported ability into poor ability.</li>
        <li>The stakes and the authority assigned to AI determine how much the people and workflow must be able to carry.</li>
        <li>Serious gaps can show that the assigned role exceeds the current setup even when the average score is high.</li>
        <li>Planned improvements do not change the current result. They affect the operational result only after they are completed and the Load Test is run again. Evidence Strength changes only when a current supporting record is identified.</li>
        <li>A different model may be suggested for comparison when model behavior is the weak point. A newer or larger model receives no automatic credit.</li>
      </ol>
      <p>If several systems are involved, record each one and identify the most important or risky role. The detailed questions focus on that role. Run a separate Load Test when another important role needs its own evaluation.</p>
      <h2>Four working score ranges</h2>
      <p>The scope statement applies to every range: <strong>the human reviewer’s capacity, AI role fit, working relationship, workflow controls, and outcome for this project and proposed AI role.</strong> Evidence Strength is reported separately.</p>
      <div class="table-scroll" role="region" aria-label="Four working score ranges" tabindex="0"><table><thead><tr><th scope="col">Score</th><th scope="col">Result</th><th scope="col">Meaning</th></tr></thead><tbody>
        <tr><td>0 to 39</td><td>The load exceeds the current setup</td><td>The assigned AI role requires more than the human reviewer or workflow can carry.</td></tr>
        <tr><td>40 to 59</td><td>A smaller AI role fits the current setup</td><td>A narrower role would reduce the judgment, checking, control, or recovery load.</td></tr>
        <tr><td>60 to 79</td><td>The role depends on named limits</td><td>The current setup can carry the role only while stated limits, checks, or capable human coverage remain in place.</td></tr>
        <tr><td>80 to 100</td><td>Strong alignment under current conditions</td><td>Your answers about capacity and workflow align strongly with the role under the stated conditions.</td></tr>
      </tbody></table></div>
      <p>A serious gap or missing record can make the result more cautious than the numeric range alone suggests.</p>
      <h2>What 0 and 100 mean</h2>
      <p>A score of <strong>0</strong> means the current answers do not show that the human capacity and workflow can carry the load created by the assigned AI role. It does not prove that the person or system has no ability.</p>
      <p>A score of <strong>100</strong> means the recorded answers about human review capacity, AI behavior, workflow controls, and outcome checks line up strongly with the assigned AI role under the stated conditions. It is not a guarantee of accuracy, safety, success, or future performance.</p>
      <h2>Evidence Strength and real-use testing</h2>
      <p><strong>Evidence Strength</strong> describes which answers the person tied to a current supporting record and whether an independent review was recorded. The Load Test does not inspect those records. <strong>Real-use testing</strong> describes whether use was reported or recorded as planned, piloted, repeated, or sustained.</p>
      <p>A project can have a strong workflow and weak documentation. It can also be thoroughly documented and perform poorly. The result shows both.</p>
      <h2>Problems that can override the average</h2>
      <ul>
        <li>Unknown permissions leave the consequences of sensitive, external, or autonomous action exposed.</li>
        <li>Unverified important factual claims cannot be presented as verified.</li>
        <li>A production deployment without the relevant technical checks leaves important failures uncovered, even when a person approved the release.</li>
        <li>A high-consequence decision without capable human review leaves no one able to catch and correct an important AI error.</li>
        <li>A review process that cannot be sustained makes the assigned role more than the workflow can carry.</li>
        <li>A project without outcome evidence may be piloted but cannot claim demonstrated effectiveness.</li>
      </ul>
      <h2>What recommendations mean</h2>
      <p>Recommendations are grouped by what can be done now, within 24 hours, within days, or within weeks. Each one explains whether it could strengthen the setup, strengthen evidence, reduce exposure, add human capacity, or make a smaller AI role fit. A numeric projection is an illustrative maximum based on closing the named gap, not a guaranteed increase. The operational result changes only after the action is completed and the Load Test is recalculated. Evidence Strength changes only when a current supporting record is identified.</p>
      </div></details>
      <h2>Accountability</h2>
      <p>AI can produce recommendations, influence decisions, and initiate actions when connected to tools. It cannot absorb the accountability that follows human agency. The person who can authorize, reject, limit, stop, or correct an action remains accountable for how that agency is used.</p>
      <h2>When to refresh</h2>
      <p>Repeat the Load Test when the model, instructions, memory, tools, data, permissions, human reviewer, task, audience, stakes, acceptance criteria, workflow, or observed outcomes materially change.</p>
      <h2>Research and standards basis</h2>
      <p>This practice-based method is informed by established work on digital provenance, contributor roles, appropriate reliance, levels of automation, model documentation, and human oversight. Those sources informed the method. They have not tested or validated this tool or its scoring.</p>
      <p><a class="button button-secondary" href="#/research">Read the research basis</a></p>
      <div class="callout callout-warning"><p><strong>Current status:</strong> Work Receipts, My Changes, Detailed Work Records, and the optional Load Test are transparent, practice-based working methods. They have not been independently validated as scientific instruments. Their findings and comparisons should improve through testing and real use.</p></div>
    </div>
    <div class="button-row"><a class="button" href="#/snapshot">Create a Work Receipt</a><a class="button button-secondary" href="#/changes">View My Changes</a><a class="text-button" href="#/load-test">Run the optional Load Test</a></div>
  </div>`;
}

function renderResearch() {
  document.title = 'Research Basis | evAIdence';
  const sources = [
    ['AI Fluency Framework', 'https://aifluencyframework.org/', 'AI fluency includes human competencies for deciding how to use AI, describing the work, judging AI outputs and behavior, and using AI responsibly.', 'Work Receipts record how a person described, directed, judged, and used AI in actual work. My Changes shows how that pattern moves over time.'],
    ['NIST AI Risk Management Framework', 'https://www.nist.gov/itl/ai-risk-management-framework', 'AI risk depends on the tool, its use, the people involved, the operating context, and possible consequences.', 'The optional Load Test examines the person, AI tool, assigned job, workflow, controls, and possible consequences together.'],
    ['Levels of automation', 'https://doi.org/10.1109/3468.844354', 'Automation can support information gathering, analysis, decision selection, and action. The right level can differ at each stage.', 'Work Receipts record how far AI could act before human review. My Changes reveals when that authority changes.'],
    ['Appropriate reliance in human-AI decision-making', 'https://doi.org/10.1145/3544548.3581058', 'Appropriate reliance depends on more than the chance that AI is right. The person’s ability also matters.', 'Work Receipts record the human role and checking pattern. The optional Load Test examines the person’s capacity more closely.'],
    ['Model Cards for Model Reporting', 'https://research.google/pubs/model-cards-for-model-reporting/', 'Models should be documented with intended uses, tested conditions, performance, and limits.', 'Work Receipts record the AI product, model, setup, and job so later comparisons do not treat every AI arrangement as the same.'],
    ['AI Usage Cards', 'https://doi.org/10.1109/JCDL57899.2023.00060', 'AI use can be disclosed through a structured record covering transparency, integrity, and accountability.', 'Work Receipts apply a related disclosure approach to project records and comparable change over time.'],
    ['W3C PROV', 'https://www.w3.org/TR/prov-overview/', 'Provenance can record people, software, activities, sources, and changes involved in producing something.', 'Work Receipts connect people, AI tools, actions, sources, and artifact versions. My Changes compares those structured records.'],
    ['CRediT Contributor Role Taxonomy', 'https://credit.niso.org/contributor-roles-defined/', 'Contributions can be described by role. CRediT describes contributions but does not determine authorship.', 'Work Receipt credits describe what each human and AI tool did instead of reducing the relationship to a percentage.'],
    ['C2PA Content Credentials', 'https://c2pa.org/', 'Signed credentials can create a tamper-evident history tied to a digital asset. Integrity does not prove every statement is true.', 'A Work Receipt can identify whether evidence is merely named, connected to a version, or protected against unnoticed changes.'],
    ['U.S. Copyright Office: Copyright and Artificial Intelligence, Part 2', 'https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf', 'Using AI does not automatically erase human-created expression. Human selection, arrangement, and creative modification can matter, and each work depends on its facts.', 'A Work Receipt records human origination, direction, selection, revision, and final decisions. A Detailed Work Record can share a richer account for one project.'],
  ];
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">Research basis</p><h1>Informed by provenance, contributor roles, appropriate reliance, and human oversight.</h1><p>These sources helped determine what a Work Receipt records and what the optional Load Test examines. They have not validated this tool, its comparisons, or its results.</p></header>
    <div class="callout callout-warning"><p><strong>Important:</strong> These sources inform the method. They have not tested or validated this tool, its questions, or its results.</p></div>
    <div class="table-scroll research-table" role="region" aria-label="Research and standards informing the method" tabindex="0"><table><thead><tr><th scope="col">Source</th><th scope="col">Plain-language point</th><th scope="col">How it informs this tool</th></tr></thead><tbody>${sources.map(([name, url, point, use]) => `<tr><th scope="row"><a href="${url}" target="_blank" rel="noreferrer">${escapeHTML(name)} <span class="new-tab-note">(opens in a new tab)</span></a></th><td>${escapeHTML(point)}</td><td>${escapeHTML(use)}</td></tr>`).join('')}</tbody></table></div>
    <section class="prose"><h2>How these sources shaped the method</h2><p>Together, these sources led the Work Receipt to examine more than the model or finished product. It records where the work began, what the human and AI did, what AI already had, what authority it received, what records exist, and what remains unknown.</p><p>My Changes compares the same fields across similar work. It describes movement without assuming that more or less AI is automatically better. The optional Load Test adds a closer examination of capacity, workflow, and consequences when needed.</p><p>The result is not an AI detector or a human-versus-AI percentage. It is a structured account of the work and the records behind it.</p></section>
    <div class="button-row"><a class="button" href="#/snapshot">Create a Work Receipt</a><a class="button button-secondary" href="#/changes">View My Changes</a></div>
  </div>`;
}

function renderExamples() {
  document.title = 'Examples | evAIdence';
  const examples = [
    ['Track changes in your writing practice', 'Create a Work Receipt showing where the direction began, when AI entered, what you drafted or changed, and how you checked the work. Save another later to see whether those roles moved.', 'Work Receipt, then My Changes.'],
    ['Build a website with AI', 'Link the relevant AI conversation, source material, current website, and optional repository. Later Work Receipts can show whether AI gained more access or your review changed.', 'Work Receipt, then My Changes.'],
    ['Change from regular chat to a custom AI', 'Record whether AI began with only the conversation, saved memory or files, or a custom assistant. A later Work Receipt makes the setup change visible.', 'Work Receipt.'],
    ['Share how one finished project was made', 'Use a Work Receipt to create clear credits and an exported project record without publishing your complete private history.', 'Work Receipt, then export.'],
    ['Give AI access or consequential authority', 'If AI can act, publish, change accounts, or perform work you cannot fully judge, use the optional Load Test to examine whether the current setup can carry that arrangement.', 'Work Receipt, then an optional Load Test.'],
  ];
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">Examples</p><h1>See what a Work Receipt can reveal.</h1><p>Start with one project. Return with comparable work and My Changes shows what moved. Use the optional Load Test only when the arrangement needs a closer review.</p></header><section aria-labelledby="example-types-heading"><h2 class="sr-only" id="example-types-heading">Project examples</h2><div class="grid-2">${examples.map(([title, copy, output], index) => `<article class="card"><span class="card-number">0${index + 1}</span><h3>${title}</h3><p>${copy}</p><p class="kicker">Start with</p><p><strong>${output}</strong></p></article>`).join('')}</div></section><div class="button-row"><a class="button" href="#/snapshot">Create a Work Receipt</a><a class="button button-secondary" href="#/changes">View My Changes</a></div></div>`;
}

function renderPricing() {
  document.title = 'Pricing | evAIdence';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">Pricing</p><h1>Full access is open during the Founding Preview.</h1><p>Create Work Receipts, build a private change history, and try the optional Load Test free while the product is being tested. Future paid plans will make it easier to preserve longer histories, manage several projects, and publish complete Detailed Work Records.</p></header>
    <div class="grid-2">
      <article class="card pricing-card featured"><span class="stamp">Available now</span><h2>Founding Preview</h2><p class="price">$0 during testing</p><p>Create a useful baseline and see what changes in later comparable work.</p><ul><li>Create and save Work Receipts in this browser</li><li>Compare comparable work in My Changes</li><li>See human work, AI work, authorization, records, and unknowns</li><li>Export and import private Work Receipt history</li><li>Export private receipt data, print the receipt, and copy its work credits</li><li>Try the optional Load Test</li></ul><a class="button" href="#/snapshot">Create a Work Receipt</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned one-time purchase</span><h2>Project Record</h2><p class="price">Price to be announced</p><p>Create one evidence-linked Work Receipt and a shareable Detailed Work Record for a work product you plan to publish, submit, deliver, or defend.</p><ul><li>One complete Work Receipt</li><li>AI setup, roles, and supporting records</li><li>Evidence-linked work credits</li><li>Downloadable Detailed Work Record</li><li>Optional Load Test for the same project</li></ul><a class="button button-secondary" href="#/sample">See an example</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned subscription</span><h2>Creator</h2><p class="price">Monthly pricing to be announced</p><p>Keep a private history of how your relationship with AI changes across projects.</p><ul><li>Ongoing Work Receipts</li><li>My Changes timeline</li><li>Comparisons of AI entry point, work, permission, and human checking</li><li>Reusable creator and AI profiles</li><li>Evidence library</li><li>Shareable Detailed Work Records for selected projects</li></ul><a class="button button-secondary" href="#/examples">See when to use it</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned subscription</span><h2>Team</h2><p class="price">Pricing to be announced</p><p>See how people, AI tools, review roles, and permissions change across shared work.</p><ul><li>Shared project Work Receipts</li><li>Contributor confirmations</li><li>Reviewer and approval records</li><li>Role and workflow changes over time</li><li>Reusable team profiles</li><li>Organization history and audit export</li></ul><a class="button button-secondary" href="#/method">Review the method</a></article>
    </div>
    <div class="callout" style="margin-top:2rem"><p><strong>Pricing principle:</strong> Free access should let someone create a useful baseline and see what changes in a later Work Receipt. Paid plans will make it easier to preserve longer histories, manage several projects, collaborate, and publish complete Detailed Work Records. Payment will never produce a more favorable finding.</p></div>
  </div>`;
}

function renderCopyright() {
  document.title = 'Copyright and use | evAIdence';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">Copyright and use</p><h1>Copyright protects the expression, not the method.</h1><p><strong>© 2026 Cheryl Abram. All rights reserved.</strong></p></header>
    <section class="prose">
      <h2>What this notice covers</h2>
      <p>This notice applies to the original human-authored writing, examples, explanations, interface content, code, and creative selection and arrangement of material on this site, to the extent copyright law protects them.</p>
      <h2>What it does not claim</h2>
      <p>It does not claim copyright in ideas, facts, systems, methods of operation, scoring rules, algorithms, third-party material, user-supplied content, or material that is not eligible for copyright protection.</p>
      <h2>AI-assisted material</h2>
      <p>AI tools assisted with parts of this site. The copyright claim covers only expression created by a person and the person’s protectable selection, organization, and changes. AI tools are not listed as authors.</p>
      <h2>Permission and reuse</h2>
      <p>This repository is public for inspection, but no open-source license has been granted. Public access does not grant permission to copy, redistribute, modify, or sell protected material. Uses allowed by law remain allowed.</p>
      <h2>Official guidance</h2>
      <p>See the U.S. Copyright Office guidance on <a href="https://www.copyright.gov/circs/circ01.pdf" target="_blank" rel="noreferrer">copyright basics <span class="new-tab-note">(opens in a new tab)</span></a>, <a href="https://www.copyright.gov/circs/circ66.pdf" target="_blank" rel="noreferrer">websites and website content <span class="new-tab-note">(opens in a new tab)</span></a>, and <a href="https://www.copyright.gov/ai/" target="_blank" rel="noreferrer">copyright and artificial intelligence <span class="new-tab-note">(opens in a new tab)</span></a>.</p>
    </section>
  </div>`;
}

function renderFAQ() {
  document.title = 'FAQ | evAIdence';
  const faqs = [
    ['How do you pronounce evAIdence?', 'Evidence. The letters AI are emphasized because AI is inside the evidence and the workflow. It is part of the work, not the whole work.'],
    ['What does this site do?', 'evAIdence creates a Work Receipt for one human and AI collaboration from the account and records you provide. Save another Work Receipt for comparable work and My Changes shows what moved. You can also create a Detailed Work Record or use the optional Load Test when an arrangement needs closer review.'],
    ['Where should I start?', 'Start with a Work Receipt. Add the AI conversation, what AI already had, what you added, and any source, finished-work, or version-history records you have. Your first Work Receipt becomes the baseline.'],
    ['What is My Changes?', 'My Changes compares similar Work Receipts and shows where AI entered, what it did, what you did, what access it had, when it needed approval, and what the records support. It describes change without calling more or less AI automatically good or bad.'],
    ['What is a Detailed Work Record?', 'A Detailed Work Record is a richer shareable account for one project. It can connect claims and credits to selected supporting records without revealing your full private Work Receipt history.'],
    ['When should I use the Load Test?', 'Use the optional Load Test when AI can act outside the conversation, receives more access, enters an important workflow, influences consequential work, or performs work you may not be able to judge fully.'],
    ['How does this tool define trust?', 'Trust is the decision to rely on a tool for a defined role. The Load Test asks whether your capacity and the capacity of anyone else doing or checking the work, together with the workflow, controls, and stakes, support that reliance.'],
    ['Is having a human in the loop enough?', 'No. The person needs the knowledge, access, authority, time, attention, and stamina to recognize a serious problem, correct it, or stop the work. A named reviewer counts only if that person is actually in the workflow and has what the role requires.'],
    ['Is this an AI detector?', 'No. AI detectors guess from patterns in a finished product. A Work Receipt records the process, contributions, decisions, and records you provide. It does not scan writing style or help people bypass detection.'],
    ['Can the Work Record support an authorship claim?', 'The Work Record creates a dated account of where the work began, what the human and AI did, and who made the final decisions. It can connect that account to one exact work version and supporting records. The account becomes stronger when important statements are linked to evidence and another person reviews that evidence.'],
    ['Does evAIdence score how much of the work is human?', 'No. A single percentage cannot honestly represent originating, directing, drafting, revising, checking, authorizing, and approving. A Work Receipt shows those actions separately.'],
    ['What does “basis provided” mean?', 'It counts findings that are either shown in supplied records or confirmed by the creator. The result also reports those categories separately from what remains unknown. It is not an authorship score, trust score, or judgment about whether the collaboration was good.'],
    ['If I run the optional Load Test, is its score the probability that AI is correct?', 'No. The Load Test score shows how the recorded answers about human review capacity, AI role fit, AI behavior, workflow controls, and outcome checks line up for this work. Evidence Strength separately shows which answers have supporting records identified.'],
    ['What happens if I do not know a Load Test answer?', 'The Load Test does not turn “I do not know” into zero or ask you to guess. It shows which information is missing and does not calculate a score until the required answers are known.'],
    ['What is Evidence Strength?', 'Evidence Strength shows which answers you tied to a current supporting record and whether an independent review was recorded. The tool does not inspect those records. It is separate from the Load Test score. Missing evidence creates uncertainty, not automatic proof of poor ability.'],
    ['Does a newer or more powerful model automatically improve the result?', 'No. Another model may perform better in a specific role, but it needs to be compared on the same representative tasks. A model change does not improve human capacity, permissions, workflow controls, or outcome evidence.'],
    ['What if several AI tools were used?', 'Record each tool, model or version, setup, and job. Identify the most important or risky job for this Load Test. Run another Load Test if a second important job needs separate evaluation.'],
    ['Do I have to make my AI conversations public?', 'No. The Work Receipt stores a reference and optional fingerprint, not raw pasted conversation text. You decide whether any record is later shared. If key records are unavailable, the Work Receipt shows the gap as unknown.'],
    ['What if I did not use AI?', 'The detailed Work Record can state: “No AI use reported in the documented workflow.” That is a bounded statement, not proof that no AI was used anywhere.'],
    ['Does a lower Load Test score mean I cannot publish or launch?', 'No. The Load Test does not decide whether you proceed. A lower score means the assigned AI role places more load on people or the workflow than the current answers show they can carry. The result shows that wager and ways to change it.'],
    ['Who remains accountable?', 'Accountability follows agency. You remain accountable for choices you had the authority and capacity to make, including how much authority you gave the AI tool.'],
    ['When should I create another Work Receipt?', 'Create another Work Receipt after comparable work or when the model, AI setup, instructions, source material, permissions, your role, or your checking changes. Run the optional Load Test again when a change could materially affect capacity, workflow, or consequences.'],
    ['Where is my information stored?', 'In this preview, Work Receipts and My Changes stay in the current browser unless you export them. Do not enter confidential, regulated, or sensitive information.'],
    ['Is this scientifically validated?', 'No. Work Receipts, comparisons, Detailed Work Records, and Load Test results use transparent, practice-based working methods. They have not been independently validated as scientific instruments.'],
  ];
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">FAQ</p><h1>Plain answers about what this tool can and cannot say.</h1></header><div class="faq-list">${faqs.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div><div class="button-row"><a class="button" href="#/snapshot">Create a Work Receipt</a><a class="button button-secondary" href="#/changes">View My Changes</a></div></div>`;
}

function renderNotFound() {
  document.title = 'Page not found | evAIdence';
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">404</p><h1>This page was not found.</h1><p>The link may be outdated or incomplete.</p></header><a class="button" href="#/">Return home</a></div>`;
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

nav.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  const wasOpen = nav.classList.contains('open');
  const sameRoute = link.getAttribute('href') === location.hash;
  setMenuOpen(false);
  if (wasOpen && sameRoute) window.requestAnimationFrame(() => menuButton.focus());
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

const navigationMedia = window.matchMedia('(max-width: 1080px)');
navigationMedia.addEventListener('change', (event) => {
  if (!event.matches) setMenuOpen(false);
});

route();
