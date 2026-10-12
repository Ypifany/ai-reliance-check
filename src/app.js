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
import kitchenRelationshipIllustration from './kitchen-relationship.svg';

const STORAGE_KEY = 'ai-reliance-check:v0.1';
const RECORD_KEY = 'ai-reliance-check:creation-record:v0.1';

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
  'Purpose and originating idea',
  'Sources and context',
  'Concept development',
  'Structure and organization',
  'Draft or technical production',
  'Evaluation and rejection',
  'Revision and final meaning',
  'Verification and testing',
  'Final approval',
];

const CONTRIBUTION_OPTIONS = [
  ['Human-led', 'Person did this'],
  ['Shared', 'Person and AI both did this'],
  ['AI-led', 'AI contributed this'],
  ['Unknown', 'Unknown'],
  ['Not applicable', 'Not applicable'],
];

const main = document.querySelector('#main-content');
const nav = document.querySelector('#site-nav');
const menuButton = document.querySelector('.menu-button');
const toast = document.querySelector('#toast');

let assessment = loadAssessment();
let creationRecord = loadCreationRecord();
let checkView = assessment.completed ? 'result' : 'entry';
let currentQuestionIndex = assessment.currentQuestion || 0;

function makeAssessment() {
  return {
    methodVersion: METHOD_VERSION,
    stage: '',
    project: {
      name: '',
      task: '',
      system: '',
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
      representativeConditions: false,
      atLeastOneEdgeOrFailureCase: false,
      controlsActuallyOperated: false,
      observedInRealUseForFullOperatingCycle: false,
      outcomeDataCollected: false,
      materialFailuresResolved: false,
    },
    answers: {},
    completed: false,
    currentQuestion: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeCreationRecord() {
  return {
    title: '',
    description: '',
    humanActions: '',
    aiContributions: '',
    artifactUrl: '',
    system: '',
    accountability: '',
    evidenceLevel: 'Declared',
    evidenceLinks: '',
    contributions: Object.fromEntries(CONTRIBUTIONS.map((item) => [item, 'Unknown'])),
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
  const stored = loadJSON(STORAGE_KEY, null);
  if (!stored || typeof stored !== 'object') return fallback;
  const project = { ...fallback.project, ...(stored.project || {}) };
  project.workTypes = Array.isArray(project.workTypes) ? project.workTypes : [];
  project.requiredBehaviors = Array.isArray(project.requiredBehaviors) ? project.requiredBehaviors.slice(0, 3) : [];
  return {
    ...fallback,
    ...stored,
    project,
    answers: stored.answers && typeof stored.answers === 'object' ? stored.answers : {},
  };
}

function loadCreationRecord() {
  const fallback = makeCreationRecord();
  const stored = loadJSON(RECORD_KEY, null);
  if (!stored || typeof stored !== 'object') return fallback;
  return {
    ...fallback,
    ...stored,
    contributions: { ...fallback.contributions, ...(stored.contributions || {}) },
  };
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
  const parsed = new Date(date);
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
  document.body.classList.remove('nav-open');
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
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
  window.scrollTo({ top: 0, behavior: 'auto' });
  window.requestAnimationFrame(() => main.focus({ preventScroll: true }));
}

function setActiveNav(path) {
  document.querySelectorAll('.site-nav a').forEach((link) => {
    const current = link.getAttribute('href') === `#${path}`;
    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function renderHome() {
  document.title = 'Human + AI Work Check — Know what AI may do';
  main.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-kicker">When AI is involved</p>
        <h1>Know what AI may do—and what still needs you.</h1>
        <p class="hero-definition"><strong>Human + AI Work Check is the tool.</strong> It uses the AI Reliance Check method to examine one real project: the person, the AI setup, the job, the steps, and what could happen if it goes wrong.</p>
        <p class="hero-promise">You get a score, a clear list of what AI may do, what must be checked, and where a person must decide.</p>
        <p class="assurance-note"><strong>A human in the loop is not enough.</strong> The person must know enough, have enough time, and be able to correct or stop the work.</p>
        <div class="hero-actions">
          <a class="button" href="#/check">Check a project <span aria-hidden="true">→</span></a>
          <a class="button button-secondary" href="#/creation-record">Show how the work was made</a>
        </div>
        <p class="hero-limit"><strong>Not an AI detector.</strong> Not a general score for a model. It checks one person–AI setup doing one job.</p>
      </div>
      <figure class="kitchen-figure">
        <img src="${kitchenRelationshipIllustration}" alt="A person directs an AI-assisted workflow, reviews a marked-up plan, and checks a finished cake before it is served." />
        <figcaption><strong>The output is the cake. The collaboration is the kitchen.</strong> This tool checks the kitchen—not just the cake.</figcaption>
      </figure>
    </section>

    <section class="section section-compact situations-section">
      <div class="section-heading">
        <div>
          <p class="kicker">Why this matters</p>
          <h2>The final product does not show how the work was done.</h2>
        </div>
        <p class="lede">These are different problems, but each one is missing the same thing: a clear view of what the person did, what AI contributed, what was checked, and what AI was allowed to do.</p>
      </div>
      <ul class="situation-list" aria-label="Common situations involving AI">
        <li><span>Teacher</span><q>This sounds like AI wrote it.</q></li>
        <li><span>Publisher</span><q>The checker says you didn’t write this.</q></li>
        <li><span>Manager</span><q>Let the AI agent do it—we’ll save time. You’re responsible for checking it.</q></li>
        <li><span>Business owner</span><q>If an expert checks everything, what are we saving?</q></li>
      </ul>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="kicker">Use it when you need it</p>
          <h2>Check the work at any point.</h2>
        </div>
        <p class="lede">Use it before you begin, just before you publish or launch, or after people have used the work. The questions change to match the moment.</p>
      </div>
      <div class="grid-3">
        ${stageCard('01', 'Before you start', 'Decide AI’s role', 'Choose what AI may do, what the person must do, and where review or approval belongs.', 'plan', 'Plan AI’s role')}
        ${stageCard('02', 'Before you publish, send, or launch', 'Check what actually happened', 'Compare the plan with the work that was really done before it reaches other people or systems.', 'release', 'Check before release')}
        ${stageCard('03', 'After people use it', 'Decide whether to keep, limit, or stop it', 'Look at results, errors, and consequences before you continue using the same setup.', 'live', 'Review live work')}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="kicker">What the check looks at</p>
          <h2>It checks the whole setup—not just the AI model.</h2>
        </div>
        <p class="lede">A powerful model can still be used badly. A simpler model may work well inside a narrow, tested process. The answer depends on all five parts together.</p>
      </div>
      <div class="formula" aria-label="The person or team plus the AI tool and setup plus the job plus the steps and checks plus what is at stake">
        <span>Person or team</span><span class="formula-symbol">+</span>
        <span>AI tool and setup</span><span class="formula-symbol">+</span>
        <span>Job</span><span class="formula-symbol">+</span>
        <span>Steps and checks</span><span class="formula-symbol">+</span>
        <span>What is at stake</span>
      </div>
      <div class="grid-3">
        <article class="card"><h3>Supported for this project</h3><p>The person, proof, and checks support this use of AI for this job.</p></article>
        <article class="card"><h3>Needs stronger checks</h3><p>The current setup is not strong enough for everything you want AI to do.</p></article>
        <article class="card"><h3>Not enough information yet</h3><p>You need more proof before deciding. Unknown does not automatically mean unsafe or incapable.</p></article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div><p class="kicker">What you receive</p><h2>A score, clear limits, and next steps.</h2></div>
        <p class="lede">The score starts the answer. The useful part is knowing what AI may do now, what still needs checking, and what would make the setup stronger.</p>
      </div>
      <div class="sample-result">
        <div class="sample-result-copy">
          <p class="kicker">Example result</p>
          <h3>55/100 for this project—not 55% human.</h3>
          <p>The score shows how strongly the person, proof, and checks support this use of AI. It does not measure how much of the finished work is “human” or “AI.”</p>
        </div>
        <aside class="sample-card" aria-label="Example task-specific Reliance Score">
          <span class="stamp stamp-warning">Use with limits</span>
          <div class="sample-score"><strong>55</strong><span>/ 100</span></div>
          <p><strong>Drafting and supervised changes are supported.</strong> Independent verification and release approval are not.</p>
          <ul class="boundary-list">
            <li class="allow">Organize and draft under review</li>
            <li class="allow">Propose website changes</li>
            <li class="block">Do not self-verify material claims</li>
            <li class="block">Do not publish without approval</li>
          </ul>
        </aside>
      </div>
      <div class="grid-3">
        ${featureCard('01', 'Current score', 'A score for this person, AI setup, job, process, and outcome—not a general rating of the model.')}
        ${featureCard('02', 'What AI may do', 'What you may hand to AI, what a person must check, and what AI should not do yet.')}
        ${featureCard('03', 'How solid the score is', 'Whether the answer rests on things you confirmed, things you reported, or things you do not know yet.')}
        ${featureCard('04', 'Problems to fix first', 'Serious gaps that a high average cannot cancel, such as unknown access or no capable reviewer.')}
        ${featureCard('05', 'What to do next', 'Actions you can take now, in 24 hours, in days, and in weeks.')}
        ${featureCard('06', 'A result you can save or share', 'A printable score card and an optional record showing how the work was made.')}
      </div>
      <p class="quote">Use the parts that are ready. Limit the parts that are not.</p>
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
  document.title = 'Check a Project — Human + AI Work Check';
  if (checkView === 'setup') renderSetup();
  else if (checkView === 'questions') renderQuestion();
  else if (checkView === 'review') renderReview();
  else if (checkView === 'result' && assessment.completed) renderResult();
  else renderCheckEntry();
  focusCurrentStep();
}

function renderCheckEntry() {
  const savedNotice = assessment.project?.task && !assessment.completed
    ? `<div class="callout"><p><strong>You have a saved check in this browser.</strong> ${escapeHTML(assessment.project.task)}</p><button class="text-button" id="resume-check" type="button">Resume where you left off</button></div>`
    : '';

  main.innerHTML = `<div class="page">
    <header class="page-header">
      <p class="eyebrow">Check a project</p>
      <h1>When are you checking the work?</h1>
      <p>Choose the point that matches your project. Use the check before you start, just before release, or after people have used the work.</p>
    </header>
    ${savedNotice}
    <div class="grid-3">
      ${stageCard('01', 'Before you start', 'Plan AI’s role', 'I have not started, or I am deciding what AI should be allowed to do.', 'plan', 'Start here')}
      ${stageCard('02', 'Before you publish, send, or launch', 'Check the finished work', 'The work is mostly complete, and I need to check what really happened before release.', 'release', 'Start here')}
      ${stageCard('03', 'After people use it', 'Review the results', 'The work has been released or used, and I have results, errors, or feedback to examine.', 'live', 'Start here')}
    </div>
    <div class="button-row no-print">
      <button class="button button-secondary" type="button" id="import-trigger">Import a saved project</button>
      <input class="sr-only" id="import-assessment" type="file" accept="application/json" />
    </div>
    <p class="helper-text">Preview data stays in this browser unless you export it. Do not enter confidential, regulated, or sensitive information.</p>
  </div>`;

  bindStageLinks();
  document.querySelector('#resume-check')?.addEventListener('click', () => {
    checkView = Object.keys(assessment.answers || {}).length ? 'questions' : 'setup';
    renderCheck();
  });
  document.querySelector('#import-trigger').addEventListener('click', () => document.querySelector('#import-assessment').click());
  document.querySelector('#import-assessment').addEventListener('change', importAssessment);
}

function renderSetup(error = '') {
  const p = assessment.project;
  main.innerHTML = `<div class="page">
    <div class="assessment-shell">
      <section class="assessment-main setup-card">
        <div class="progress-row"><span>PROJECT SETUP</span><span>Setup takes about 2 minutes; the full check depends on your project</span></div>
        <div class="progress-track" aria-hidden="true"><span style="width: 8%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>Tell us about the work.</h1>
        <p class="question-why">Describe the AI setup you are using or plan to use. This check is about this project—not every possible use of the model.</p>
        ${error ? `<p class="inline-error" role="alert" tabindex="-1">${escapeHTML(error)}</p>` : ''}
        <form id="setup-form" novalidate>
          <div class="field-grid">
            <div class="field field-span-2">
              <label for="project-name">Project name <span class="helper-text">Optional</span></label>
              <input id="project-name" name="name" value="${escapeHTML(p.name)}" autocomplete="off" />
            </div>
            <div class="field field-span-2">
              <label for="task">What are you asking AI to produce, recommend, decide, change, or do? <span class="required">*</span></label>
              <textarea id="task" name="task" required>${escapeHTML(p.task)}</textarea>
            </div>
            <div class="field field-span-2">
              <label for="system">What system and setup are you using? <span class="required">*</span></label>
              <textarea id="system" name="system" required>${escapeHTML(p.system)}</textarea>
              <small>Include the product or model, important instructions or memory, connected tools, and permissions you know about.</small>
            </div>
            <div class="field field-span-2">
              <label for="outcome">What are you counting on happening? <span class="required">*</span></label>
              <textarea id="outcome" name="intendedOutcome" required>${escapeHTML(p.intendedOutcome)}</textarea>
              <small>What should happen—and what could happen if the work is wrong, incomplete, late, biased, insecure, or unused?</small>
            </div>
            <div class="field">
              <label for="consequence">Consequence if it fails</label>
              <select id="consequence" name="consequence">
                ${selectOptions([
                  ['low', 'Low — easy to notice and correct'],
                  ['moderate', 'Moderate — real cost, delay, or confusion'],
                  ['high', 'High — serious harm or difficult recovery'],
                  ['critical', 'Critical — safety, rights, major loss, or irreversible harm'],
                ], p.consequence)}
              </select>
            </div>
            <div class="field">
              <label for="authority">What do you want AI to be allowed to do?</label>
              <select id="authority" name="proposedAuthority">
                ${Object.entries(AUTHORITY_LABELS).map(([value, label]) => `<option value="${value}" ${p.proposedAuthority === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('')}
              </select>
            </div>
          </div>

          <fieldset class="fieldset">
            <legend>What kind of work is involved? <span class="required">*</span></legend>
            <div class="choice-grid">
              ${WORK_TYPES.map(([value, label, description]) => checkboxChoice('workTypes', value, label, description, p.workTypes.includes(value))).join('')}
            </div>
          </fieldset>

          <fieldset class="fieldset">
            <legend>Which behaviors matter most? Choose up to three. <span class="required">*</span></legend>
            <div class="choice-grid choice-grid-compact">
              ${BEHAVIORS.map(([value, label]) => checkboxChoice('requiredBehaviors', value, label, '', p.requiredBehaviors.includes(value))).join('')}
            </div>
            <small id="behavior-count">${p.requiredBehaviors.length} of 3 selected</small>
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
  focusCurrentStep();
}

function selectOptions(options, selected) {
  return options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('');
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
  const form = new FormData(event.currentTarget);
  const workTypes = form.getAll('workTypes');
  const requiredBehaviors = form.getAll('requiredBehaviors');
  const task = String(form.get('task') || '').trim();
  const system = String(form.get('system') || '').trim();
  const intendedOutcome = String(form.get('intendedOutcome') || '').trim();

  assessment.project = {
    ...assessment.project,
    name: String(form.get('name') || '').trim(),
    task,
    system,
    intendedOutcome,
    consequence: form.get('consequence'),
    proposedAuthority: form.get('proposedAuthority'),
    workTypes,
    requiredBehaviors,
  };
  assessment.completed = false;
  saveAssessment();

  if (!task || !system || !intendedOutcome || !workTypes.length || !requiredBehaviors.length) {
    return renderSetup('Complete the task, system, outcome, work type, and at least one required behavior.');
  }
  currentQuestionIndex = Math.min(currentQuestionIndex, activeQuestions().length - 1);
  checkView = 'questions';
  renderCheck();
}

function activeQuestions() {
  return getActiveQuestionDefinitions(assessment);
}

function renderQuestion(error = '') {
  const questions = activeQuestions();
  const question = questions[currentQuestionIndex];
  if (!question) {
    checkView = 'review';
    return renderReview();
  }
  assessment.currentQuestion = currentQuestionIndex;
  saveAssessment();
  const answer = assessment.answers[question.id] || {};
  const progress = Math.round(((currentQuestionIndex + 1) / (questions.length + 1)) * 100);

  main.innerHTML = `<div class="page">
    <div class="assessment-shell">
      <section class="assessment-main question-card">
        <div class="progress-row"><span>${escapeHTML(DIMENSIONS[question.dimension]?.label || question.dimension || 'EVIDENCE')}</span><span>Question ${currentQuestionIndex + 1} of about ${questions.length}</span></div>
        <div class="progress-track" aria-hidden="true"><span style="width: ${progress}%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${escapeHTML(question.prompt)}</h1>
        <p class="question-why">${escapeHTML(question.why || 'Choose the answer that best describes what is true now, not what you intend to do later.')}</p>
        ${error ? `<p class="inline-error" role="alert" tabindex="-1">${escapeHTML(error)}</p>` : ''}
        <form id="question-form">
          <fieldset class="fieldset">
            <legend>Choose the description that is true now.</legend>
            <div class="option-stack">
            ${question.options.map((option) => `<label class="option-card">
              <input type="radio" name="level" value="${option.value}" ${Number(answer.level) === Number(option.value) ? 'checked' : ''} />
              <span><strong>${escapeHTML(option.label)}</strong><span>${escapeHTML(option.description || '')}</span></span>
            </label>`).join('')}
            </div>
          </fieldset>
          <div class="evidence-box">
            <h2>What supports this answer?</h2>
            <p class="helper-text">An instruction or plan is not proof that the behavior occurred. “I don’t know” is a valid and useful answer.</p>
            <fieldset class="fieldset"><legend class="sr-only">Evidence basis</legend><div class="choice-grid choice-grid-compact">
                ${evidenceChoice('confirmed', 'Confirmed', 'Directly observed or supported by a result, record, or link', answer.basis)}
                ${evidenceChoice('reported', 'Reported', 'Intended, recalled, or asserted without a current record', answer.basis)}
                ${evidenceChoice('unknown', 'Unknown', 'I cannot determine this yet', answer.basis)}
              </div></fieldset>
            <div class="field-grid" style="margin-top: 1rem">
              <div class="field">
                <label for="evidence-note">Evidence note <span class="helper-text">Optional</span></label>
                <input id="evidence-note" name="evidenceNote" value="${escapeHTML(answer.evidenceNote || '')}" placeholder="Test result, observation, or gap" />
              </div>
              <div class="field">
                <label for="evidence-url">Evidence link <span class="helper-text">Optional</span></label>
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
  assessment.answers[question.id] = {
    level: form.get('level') === null ? undefined : Number(form.get('level')),
    basis: form.get('basis') || undefined,
    evidenceNote: String(form.get('evidenceNote') || '').trim(),
    evidenceUrl: String(form.get('evidenceUrl') || '').trim(),
  };
  saveAssessment();
  if (form.get('level') === null || !form.get('basis')) {
    return renderQuestion('Choose one answer and identify whether its basis is confirmed, reported, or unknown.');
  }
  if (form.get('basis') === 'confirmed' && !String(form.get('evidenceNote') || '').trim() && !String(form.get('evidenceUrl') || '').trim()) {
    return renderQuestion('Add a brief evidence note or link to support a Confirmed answer, or choose Reported.');
  }
  if (currentQuestionIndex >= count - 1) checkView = 'review';
  else currentQuestionIndex += 1;
  renderCheck();
}

function arrangementSummary() {
  const p = assessment.project;
  const open = !window.matchMedia('(max-width: 900px)').matches;
  return `<details class="assessment-summary" ${open ? 'open' : ''}>
    <summary>Project setup</summary>
    <h2 class="summary-heading">Project setup</h2>
    <dl class="summary-list">
      <div><dt>Stage</dt><dd>${escapeHTML(stageLabel(assessment.stage))}</dd></div>
      <div><dt>Person</dt><dd>You or the named reviewing team</dd></div>
      <div><dt>AI setup</dt><dd>${escapeHTML(p.system || 'Not defined yet')}</dd></div>
      <div><dt>Job</dt><dd>${escapeHTML(p.task || 'Not defined yet')}</dd></div>
      <div><dt>AI role</dt><dd>${escapeHTML(AUTHORITY_LABELS[p.proposedAuthority] || 'Not defined yet')}</dd></div>
      <div><dt>Expected result</dt><dd>${escapeHTML(p.intendedOutcome || 'Not defined yet')}</dd></div>
    </dl>
    <p class="helper-text">Saved on this device when you continue.</p>
  </details>`;
}

function stageLabel(stage) {
  return {
    plan: 'Before you start',
    release: 'Before you publish, send, or launch',
    live: 'After people have used it',
  }[stage] || 'Project check';
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
        <div class="progress-track" aria-hidden="true"><span style="width: 94%"></span></div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>Check what AI may and may not do.</h1>
        <p class="question-why">Some gaps limit AI’s role even when the other answers are strong. That includes unknown access, missing approval, or a serious problem that has not been fixed.</p>
        ${error ? `<p class="inline-error" role="alert" tabindex="-1">${escapeHTML(error)}</p>` : ''}
        <form id="review-form">
          <div class="field-grid">
            <div class="field">
              <label for="connectedAccess">Can the system connect to accounts, repositories, data, publishing, or other tools?</label>
              <select id="connectedAccess" name="connectedAccess">${triStateOptions(p.connectedAccess, 'No', 'Yes', 'Unknown')}</select>
            </div>
            <div class="field" id="permissions-field" ${p.connectedAccess === false ? 'hidden' : ''}>
              <label for="permissionsConfirmed">Are its permissions known and limited to what this task needs?</label>
              <select id="permissionsConfirmed" name="permissionsConfirmed">${triStateOptions(p.permissionsConfirmed, 'No', 'Yes—confirmed', 'Unknown')}</select>
            </div>
            <div class="field" id="approval-field" ${needsApproval ? '' : 'hidden'}>
              <label for="humanApproval">Does a human approve the work before it creates an external consequence?</label>
              <select id="humanApproval" name="humanApprovalBeforeConsequence">${triStateOptions(p.humanApprovalBeforeConsequence, 'No', 'Yes—confirmed', 'Unknown')}</select>
            </div>
            <div class="field" id="reversible-field" ${needsReversibility ? '' : 'hidden'}>
              <label for="reversible">Can consequential actions be reversed or rolled back?</label>
              <select id="reversible" name="actionsAreReversible">${triStateOptions(p.actionsAreReversible, 'No', 'Yes—confirmed', 'Unknown')}</select>
            </div>
            <div class="field">
              <label for="sensitiveData">Will the system receive confidential, regulated, personal, or otherwise sensitive information?</label>
              <select id="sensitiveData" name="sensitiveData">${triStateOptions(p.sensitiveData, 'No', 'Yes', 'Unknown')}</select>
            </div>
            <div class="field" id="data-authorization-field" ${p.sensitiveData === false ? 'hidden' : ''}>
              <label for="dataAuthorization">If sensitive data is involved, is its use explicitly authorized?</label>
              <select id="dataAuthorization" name="dataAuthorizationConfirmed">${triStateOptions(p.dataAuthorizationConfirmed, 'No', 'Yes—confirmed', 'Unknown')}</select>
            </div>
            <div class="field" id="monitoring-field" ${needsMonitoring ? '' : 'hidden'}>
              <label for="monitoring">If the system acts repeatedly or independently, can the activity be seen and stopped?</label>
              <select id="monitoring" name="monitoringConfirmed">${triStateOptions(p.monitoringConfirmed, 'No', 'Yes—confirmed', 'Unknown')}</select>
            </div>
            <div class="field">
              <label for="failure">Is there a known material failure that remains unresolved?</label>
              <select id="failure" name="unresolvedMaterialFailure">${triStateOptions(p.unresolvedMaterialFailure, 'No', 'Yes', 'Unknown')}</select>
            </div>
          </div>

          ${assessment.stage === 'live' ? liveEvidenceFields(p) : ''}

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
            <p><strong>Before you calculate:</strong> this is a self-assessment. “Confirmed” means you have direct evidence, not that an independent reviewer has certified it.</p>
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
    toggleConditionalField('permissions-field', document.querySelector('#connectedAccess').value !== 'false');
    toggleConditionalField('data-authorization-field', document.querySelector('#sensitiveData').value !== 'false');
  };
  document.querySelector('#connectedAccess').addEventListener('change', syncConditionalReviewFields);
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
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}">${selectOptions([['false', 'No'], ['true', 'Yes']], String(Boolean(selected)))}</select></div>`;
}

function submitReview(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const keys = [
    'connectedAccess', 'permissionsConfirmed', 'humanApprovalBeforeConsequence',
    'actionsAreReversible', 'sensitiveData', 'dataAuthorizationConfirmed',
    'monitoringConfirmed', 'unresolvedMaterialFailure',
  ];
  keys.forEach((key) => {
    const value = form.get(key);
    assessment.project[key] = value === 'true' ? true : value === 'false' ? false : null;
  });

  if (assessment.stage === 'live') {
    assessment.project.observedRuns = Number(form.get('observedRuns') || 0);
    ['representativeConditions', 'atLeastOneEdgeOrFailureCase', 'controlsActuallyOperated', 'observedInRealUseForFullOperatingCycle', 'outcomeDataCollected', 'materialFailuresResolved'].forEach((key) => {
      assessment.project[key] = form.get(key) === 'true';
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
  const dimensionLabels = {
    capabilityFit: 'Capability Fit',
    behavioralFit: 'Behavioral Fit',
    humanAssurance: 'Human Assurance',
    workflowControl: 'Workflow Control',
    outcomeTestability: 'Outcome Testability',
  };
  const authorization = result.authorization || {};
  const gates = result.gates || [];
  const actions = result.actions || {};
  const date = assessment.completedAt || assessment.updatedAt;

  main.innerHTML = `<div class="page results-page print-all">
    <header class="result-header">
      <div>
        <p class="eyebrow">${stageLabel(assessment.stage)}</p>
        <h1>${resultDecision(result)}</h1>
      </div>
      <div class="score-lockup" aria-label="Project score ${result.publicScore} out of 100, ${escapeHTML(plainBandLabel(result.band?.label || result.band))}">
        <strong>${result.publicScore}</strong>
        <span>/ 100 · ${escapeHTML(plainBandLabel(result.band?.label || result.band || getBand(result.publicScore)))}</span>
      </div>
    </header>

    <div class="result-meta">
      <span class="meta-chip">Proof behind this result: ${escapeHTML(result.evidenceConfidence)}</span>
      <span class="meta-chip">Real-use testing: ${escapeHTML(result.validationStatus)}</span>
      <span class="meta-chip">AI role requested: ${escapeHTML(AUTHORITY_LABELS[p.proposedAuthority])}</span>
      <span class="meta-chip">AI role supported: ${escapeHTML(AUTHORITY_LABELS[result.maxAuthority])}</span>
      <span class="meta-chip">Method ${escapeHTML(METHOD_VERSION)}</span>
      <span class="meta-chip">${formatDate(date)}</span>
    </div>

    <section aria-labelledby="score-heading">
      <h2 id="score-heading" class="sr-only">Score range</h2>
      <div class="score-band" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
        <i class="score-marker" style="left: ${Math.min(100, Math.max(0, result.publicScore))}%"></i>
      </div>
      <div class="band-labels" aria-hidden="true"><span>Not supported</span><span>Very limited</span><span>Use with limits</span><span>Controlled</span><span>Strong</span><span>95–100</span></div>
      <p class="helper-text">Score needed for the risk and AI role you selected: ${result.requiredScore}/100. This score is rounded to the nearest five. It is not the chance that AI is correct.</p>
    </section>

    <section class="decision-grid" aria-label="What AI may and may not do">
      ${decisionColumn('AI may do this now', 'supported', authorization.delegate || defaultDelegate(result), 'Uses supported by the current project setup.')}
      ${decisionColumn('A person must check this', 'verify', authorization.verify || defaultVerify(), 'Checks that still need to happen before the work is used.')}
      ${decisionColumn('AI should not do this yet', 'blocked', authorization.doNotAuthorize || gates.map(gateText), 'Uses that are not supported by the current proof, human ability, or safeguards.')}
    </section>

    <div class="grid-2">
      <section class="result-panel card">
        <p class="kicker">Five parts of the score</p>
        <h2>Why you received this score</h2>
        <div class="dimension-list">
          ${Object.entries(dimensionLabels).map(([key, label]) => dimensionRow(label, result.dimensions?.[key] ?? 0)).join('')}
        </div>
      </section>
      <section class="result-panel card">
        <p class="kicker">Highest AI role supported</p>
        <h2>${escapeHTML(AUTHORITY_LABELS[result.maxAuthority] || result.maxAuthority)}</h2>
        <p><strong>You may rely on:</strong></p>
        ${listHTML(authorization.relyOn || ['Only outputs reviewed under the conditions recorded in this check.'])}
        <p class="helper-text">A lower score does not always mean “do not launch.” It may mean giving AI a smaller role.</p>
      </section>
    </div>

    ${gates.length ? `<section style="margin-top: 3rem"><p class="kicker">Problems to fix first</p><h2>These limits override the average score.</h2><ul class="gate-list">${gates.map((gate) => `<li><strong>${escapeHTML(gate.title || gate.id?.replaceAll('_', ' ') || 'Use limit')}</strong><br />${escapeHTML(gateText(gate))}</li>`).join('')}</ul></section>` : `<div class="callout" style="margin-top: 2rem"><p><strong>Your answers did not trigger a stop sign.</strong> The score and stated limits still apply.</p></div>`}

    <section style="margin-top: 4rem">
      <p class="kicker">Make this setup stronger</p>
      <h2>What can raise the score?</h2>
      <p class="lede">Doing an action changes the score only after you record what happened. Start with the fastest step that removes a stop sign or answers an important unknown.</p>
      <div class="action-timeline">
        ${timeBlock('Now', actions.now)}
        ${timeBlock('Within 24 hours', actions.within24h)}
        ${timeBlock('Within days', actions.days)}
        ${timeBlock('Within weeks', actions.weeks)}
      </div>
    </section>

    <section class="reliance-card" id="reliance-card">
      <div class="reliance-card-header">
        <div><p class="kicker">Human + AI Work Card · Self-assessed</p><h2>${escapeHTML(p.name || 'Untitled project')}</h2><p>${escapeHTML(p.task)}</p></div>
        <div class="reliance-card-score">${result.publicScore}/100 · ${escapeHTML(plainBandLabel(result.band?.label || result.band))}</div>
      </div>
      <div class="grid-2" style="margin-top: 1.3rem">
        <div><p class="meta-label">Project setup</p><p><strong>AI setup:</strong> ${escapeHTML(p.system)}</p><p><strong>Expected result:</strong> ${escapeHTML(p.intendedOutcome)}</p></div>
        <div><p class="meta-label">Limits</p><p><strong>Highest AI role supported:</strong> ${escapeHTML(AUTHORITY_LABELS[result.maxAuthority] || result.maxAuthority)}</p><p><strong>Proof:</strong> ${escapeHTML(result.evidenceConfidence)} · <strong>Real-use testing:</strong> ${escapeHTML(result.validationStatus)}</p></div>
      </div>
      <p class="helper-text">Dated ${formatDate(date)} · Method ${escapeHTML(METHOD_VERSION)} · This is a task-specific decision record, not a certification or guarantee.</p>
    </section>

    <div class="result-actions no-print">
      <button class="button" type="button" id="print-result">Print project card</button>
      <button class="button button-secondary" type="button" id="export-result">Export project JSON</button>
      <a class="button button-secondary" href="#/creation-record">Show how the work was made</a>
      <button class="button button-danger" type="button" id="new-check">Start a new check</button>
    </div>
  </div>`;

  document.querySelector('#print-result').addEventListener('click', () => printMode('printing-result'));
  document.querySelector('#export-result').addEventListener('click', () => {
    downloadJSON(`${slug(p.name || 'human-ai-work-check')}.json`, { assessment, result });
  });
  document.querySelector('#new-check').addEventListener('click', () => {
    if (window.confirm('Start a new check? Export this project first if you want to keep a separate copy.')) {
      assessment = makeAssessment();
      localStorage.removeItem(STORAGE_KEY);
      checkView = 'entry';
      currentQuestionIndex = 0;
      renderCheck();
    }
  });
}

function resultDecision(result) {
  const proposed = authorityRank(assessment.project.proposedAuthority);
  const supported = authorityRank(result.maxAuthority);
  if (result.proposedAuthoritySupported && supported >= proposed && !(result.gates || []).length) {
    return 'This project setup supports the AI role you selected—within the limits below.';
  }
  if (result.publicScore < 40) return 'Keep the system in a private, advisory role for now.';
  return 'Proceed only within a narrower, supervised boundary.';
}

function plainBandLabel(value) {
  return {
    Unsupported: 'Not supported',
    Limited: 'Use only in a small role',
    Conditional: 'Use with limits',
    Controlled: 'Supported with controls',
    'Strong but bounded': 'Strong support with limits',
    'Exceptional current assurance': 'Strongest current support',
  }[value] || value || '';
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
  return `<div class="dimension-row"><span>${label}</span><div class="dimension-track" aria-hidden="true"><span style="width:${rounded}%"></span></div><output>${rounded}</output></div>`;
}

function timeBlock(label, items = []) {
  const normalized = Array.isArray(items) ? items : items ? [items] : [];
  return `<article class="time-block"><h3>${label}</h3>${normalized.length ? `<ol>${normalized.slice(0, 2).map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ol>` : '<p class="helper-text">No additional action generated for this period.</p>'}</article>`;
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
  if (imported.methodVersion && imported.methodVersion !== METHOD_VERSION) {
    throw new Error('Unsupported method version');
  }
  if (!['plan', 'release', 'live'].includes(imported.stage)) {
    throw new Error('Invalid stage');
  }

  const fallback = makeAssessment();
  const project = { ...fallback.project, ...imported.project };
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

  return {
    ...fallback,
    ...imported,
    methodVersion: METHOD_VERSION,
    stage: imported.stage,
    project,
    answers,
    completed: Boolean(imported.completed),
  };
}

function renderSample() {
  document.title = 'Sample Result — Human + AI Work Check';
  main.innerHTML = `<div class="page">
    <header class="result-header">
      <div><p class="eyebrow">Sample result · Before release</p><h1>Use AI for drafting and supervised changes. Keep final checking and release approval with a person.</h1></div>
      <div class="score-lockup"><strong>55</strong><span>/ 100 · Use with limits</span></div>
    </header>
    <div class="result-meta"><span class="meta-chip">Proof behind score: Medium</span><span class="meta-chip">Real-use testing: Untested</span><span class="meta-chip">AI role requested: Take a reversible approved action</span><span class="meta-chip">AI role supported: Produce for human approval</span></div>
    <div class="callout callout-warning"><p><strong>Project setup:</strong> A subject-matter creator uses conversational AI to organize, draft, research, edit, and help build a public learning website. The creator reviews selected content and approves publication.</p></div>
    <section class="decision-grid">
      ${decisionColumn('AI may do this now', 'supported', ['Organize ideas and source material', 'Draft and edit language', 'Propose structure and code changes', 'Run named tests and report results'], 'Uses supported by this project setup.')}
      ${decisionColumn('A person must check this', 'verify', ['Important facts and claims', 'Links and visible behavior', 'Phone and accessibility behavior', 'Code and deployment the creator cannot judge'], 'Human or independent checks still required.')}
      ${decisionColumn('AI should not do this yet', 'blocked', ['Verify its own facts', 'Approve the final release', 'Change the live site without review', 'Claim that the website improves user performance'], 'Uses the current proof and safeguards do not support.')}
    </section>
    <section><p class="kicker">Fastest improvements</p><h2>What would raise the score?</h2><div class="action-timeline">
      ${timeBlock('Now', ['Give AI one wrong assumption and see whether it pushes back.', 'Check and narrow which tools, accounts, and files it can access.'])}
      ${timeBlock('Within 24 hours', ['Save results from build, link, phone, accessibility, and deployment checks.', 'Have one intended user try the main task.'])}
      ${timeBlock('Within days', ['Obtain targeted code or accessibility review.', 'Observe three intended users.'])}
      ${timeBlock('Within weeks', ['Compare the results with the stated target.', 'Issue an updated project card.'])}
    </div></section>
    <div class="button-row"><a class="button" href="#/check">Check your project</a><a class="button button-secondary" href="#/method">See how scoring works</a></div>
    <p class="helper-text" style="margin-top:2rem">Illustrative self-assessment only. This is not a certification or guarantee.</p>
  </div>`;
}

function renderCreationRecord() {
  document.title = 'How the Work Was Made — Human + AI Work Check';
  const r = creationRecord;
  main.innerHTML = `<div class="page">
    <header class="page-header">
      <p class="eyebrow">How the work was made</p>
      <h1>Show what the person did and what AI contributed.</h1>
      <p>“Human-made” and “AI-made” hide the work in the middle. Record the person’s actions, AI’s role, what was checked, and who approved the final result.</p>
    </header>
    <div class="callout"><p><strong>This is not a human-versus-AI percentage.</strong> Writing the words is not the same as choosing the purpose, shaping the meaning, checking the result, or approving the work.</p></div>
    <div class="record-grid" style="margin-top: 2rem">
      <form class="record-panel" id="creation-form">
        <div class="field"><label for="record-title">Work or project title</label><input id="record-title" name="title" value="${escapeHTML(r.title)}" /></div>
        <div class="field"><label for="record-description">What is it?</label><textarea id="record-description" name="description">${escapeHTML(r.description)}</textarea></div>
        <div class="field"><label for="record-human-actions">What did the person do?</label><textarea id="record-human-actions" name="humanActions" placeholder="For example: chose the purpose, supplied source material, made decisions, rejected suggestions, rewrote sections, checked claims, and approved the final work">${escapeHTML(r.humanActions)}</textarea></div>
        <div class="field"><label for="record-ai-contributions">What did AI contribute?</label><textarea id="record-ai-contributions" name="aiContributions" placeholder="For example: organized notes, suggested options, drafted language, found possible sources, wrote code, or ran named checks">${escapeHTML(r.aiContributions)}</textarea></div>
        <div class="field"><label for="record-system">AI system(s) used</label><input id="record-system" name="system" value="${escapeHTML(r.system)}" /></div>
        <div class="field"><label for="record-url">Public artifact link <span class="helper-text">Optional</span></label><input id="record-url" name="artifactUrl" type="url" value="${escapeHTML(r.artifactUrl)}" placeholder="https://" /></div>
        <div class="field"><label for="record-accountability">Who approved and stands behind the final work?</label><input id="record-accountability" name="accountability" value="${escapeHTML(r.accountability)}" /></div>
        <div class="field"><label for="evidence-level">Evidence level</label><select id="evidence-level" name="evidenceLevel">${selectOptions([
          ['Declared', 'Declared — process described without linked records'],
          ['Evidence-linked', 'Evidence-linked — relevant records are linked'],
          ['Integrity-verified', 'Integrity-verified — records include timestamps or fingerprints'],
          ['Independently reviewed', 'Independently reviewed — another person examined the record'],
        ], r.evidenceLevel)}</select></div>
        <div class="field"><label for="evidence-links">Evidence links or notes <span class="helper-text">One per line</span></label><textarea id="evidence-links" name="evidenceLinks" placeholder="Selected chats, notes, drafts, sources, commits, test results">${escapeHTML(r.evidenceLinks)}</textarea></div>
        <p class="helper-text"><strong>Optional detail:</strong> Mark how each part of the work was handled.</p>
        <table class="contribution-table">
          <thead><tr><th>Part of the work</th><th>How was it handled?</th></tr></thead>
          <tbody>${CONTRIBUTIONS.map((item) => {
            const id = `contribution-${slug(item)}`;
            return `<tr><th scope="row" id="${id}" data-label="Part of the work">${escapeHTML(item)}</th><td data-label="How was it handled?"><select name="contribution:${escapeHTML(item)}" aria-labelledby="${id}">${CONTRIBUTION_OPTIONS.map(([value, label]) => `<option value="${value}" ${r.contributions[item] === value ? 'selected' : ''}>${label}</option>`).join('')}</select></td></tr>`;
          }).join('')}</tbody>
        </table>
        <div class="form-actions no-print">
          <button class="button" type="submit">Update record</button>
          <button class="button button-secondary" type="button" id="export-record">Export JSON</button>
        </div>
      </form>
      <aside class="record-preview" id="record-preview" aria-label="How the Work Was Made preview">
        ${creationRecordPreview(r)}
      </aside>
    </div>
    <div class="result-actions no-print">
      <button class="button" type="button" id="print-record" ${recordIsComplete(r) ? '' : 'disabled'}>${recordIsComplete(r) ? 'Print record' : 'Complete approval to print'}</button>
          <button class="button button-secondary" type="button" id="copy-disclosure" ${recordIsComplete(r) ? '' : 'disabled'}>${recordIsComplete(r) ? 'Copy short disclosure' : 'Complete approval to copy disclosure'}</button>
    </div>
    <div class="callout callout-warning" style="margin-top: 2rem"><p><strong>Important limit:</strong> This record documents the disclosed process and supporting evidence. It cannot prove what first occurred inside someone’s mind, that no other tool was used, that every claim is correct, or that one person owns every legal right.</p></div>
  </div>`;

  const form = document.querySelector('#creation-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    updateCreationRecord(new FormData(form));
    showToast('How the Work Was Made record updated on this device.');
    renderCreationRecord();
  });
  form.addEventListener('input', () => {
    updateCreationRecord(new FormData(form));
    document.querySelector('#record-preview').innerHTML = creationRecordPreview(creationRecord);
    updateCreationActions();
  });
  document.querySelector('#export-record').addEventListener('click', () => downloadJSON(`${slug(r.title || 'how-the-work-was-made')}.json`, creationRecord));
  document.querySelector('#print-record')?.addEventListener('click', () => {
    if (recordIsComplete(creationRecord)) printMode('printing-record');
  });
  document.querySelector('#copy-disclosure')?.addEventListener('click', async () => {
    if (!recordIsComplete(creationRecord)) return;
    const text = `${recordHeadline(creationRecord)} I used ${creationRecord.system || 'AI'} to assist with this work. ${creationRecord.accountability} reviewed and approved the final result and remains accountable for what is presented.`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Short disclosure copied.');
    } catch {
      showToast('Copy was unavailable. Select the disclosure from the printed record instead.');
    }
  });
  updateCreationActions();
}

function updateCreationActions() {
  const complete = recordIsComplete(creationRecord);
  const copy = document.querySelector('#copy-disclosure');
  const print = document.querySelector('#print-record');
  if (copy) {
    copy.disabled = !complete;
    copy.textContent = complete ? 'Copy short disclosure' : 'Complete approval to copy disclosure';
  }
  if (print) {
    print.disabled = !complete;
    print.textContent = complete ? 'Print record' : 'Complete approval to print';
  }
}

function updateCreationRecord(form) {
  ['title', 'description', 'humanActions', 'aiContributions', 'system', 'artifactUrl', 'accountability', 'evidenceLevel', 'evidenceLinks'].forEach((key) => {
    creationRecord[key] = String(form.get(key) || '').trim();
  });
  CONTRIBUTIONS.forEach((item) => {
    creationRecord.contributions[item] = form.get(`contribution:${item}`) || 'Unknown';
  });
  saveCreationRecord();
}

function creationRecordPreview(record) {
  return `<p class="kicker">How the Work Was Made · ${escapeHTML(record.evidenceLevel)}</p>
    <h2>${escapeHTML(record.title || 'Untitled work')}</h2>
    <p>${escapeHTML(record.description || 'Describe the work to give this record context.')}</p>
    <p class="record-summary">${escapeHTML(recordHeadline(record))}</p>
    <div class="record-action-summary">
      <p><strong>What the person did</strong><br />${escapeHTML(record.humanActions || 'Not yet described')}</p>
      <p><strong>What AI contributed</strong><br />${escapeHTML(record.aiContributions || 'Not yet described')}</p>
    </div>
    <ul class="mini-record-list">
      ${CONTRIBUTIONS.map((item) => `<li><span>${escapeHTML(item)}</span><strong>${escapeHTML(contributionLabel(record.contributions[item]))}</strong></li>`).join('')}
    </ul>
    <p style="margin-top: 1rem"><strong>Final approval and accountability:</strong><br />${escapeHTML(record.accountability || 'Not yet named')}</p>
    <p><strong>AI system(s):</strong><br />${escapeHTML(record.system || 'Not yet named')}</p>
    ${safeLink(record.artifactUrl) ? `<p><strong>Artifact:</strong><br /><a href="${escapeHTML(safeLink(record.artifactUrl))}" target="_blank" rel="noreferrer">Open the documented work</a></p>` : ''}
    ${renderEvidenceLinks(record.evidenceLinks)}
    <p class="helper-text">Updated ${formatDate(record.updatedAt)} · Self-declared unless independent review is explicitly recorded.</p>`;
}

function recordHeadline(record) {
  if (!recordIsComplete(record)) return 'Record incomplete · Final approval not established';
  const values = Object.values(record.contributions || {});
  const human = values.filter((item) => item === 'Human-led').length;
  const ai = values.filter((item) => item === 'AI-led').length;
  const shared = values.filter((item) => item === 'Shared').length;
  if (human >= 5 && ai <= 2) return 'Human-originated · Human-directed · AI-assisted';
  if (shared >= 4) return 'Human–AI collaborative · Human-approved';
  if (ai >= 5) return 'AI-produced · Human-reviewed';
  return 'Contribution documented by role · Human-approved';
}

function contributionLabel(value) {
  return CONTRIBUTION_OPTIONS.find(([storedValue]) => storedValue === value)?.[1] || value || 'Unknown';
}

function recordIsComplete(record) {
  const approval = record.contributions?.['Final approval'];
  return Boolean(record.accountability?.trim()) && ['Human-led', 'Shared'].includes(approval);
}

function safeLink(value) {
  try {
    const parsed = new URL(String(value || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function renderEvidenceLinks(value) {
  const entries = String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
  if (!entries.length) return '';
  return `<div><strong>Supporting evidence:</strong><ul>${entries.map((item) => {
    const link = safeLink(item);
    return link
      ? `<li><a href="${escapeHTML(link)}" target="_blank" rel="noreferrer">${escapeHTML(item)}</a></li>`
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
  });
}

function renderMethod() {
  document.title = 'How It Works — Human + AI Work Check';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">AI Reliance Check method ${escapeHTML(METHOD_VERSION)}</p><h1>How the project score works.</h1><p>The score looks at five parts of one real project. It also checks the proof behind your answers and serious gaps that can limit AI’s role even when the average score is high.</p></header>
    <div class="prose">
      <h2>The question</h2>
      <blockquote class="callout"><p><strong>For this person, AI setup, job, work process, and expected result: what may AI do, what must a person check, and what should wait?</strong></p></blockquote>
      <h2>The five things being scored</h2>
      <table><thead><tr><th>Plain-language question</th><th>Method term</th></tr></thead><tbody>
        <tr><td><strong>Can this AI setup do this job?</strong><br />Has it handled normal work and likely failure cases?</td><td>Capability Fit</td></tr>
        <tr><td><strong>Does it behave the way this role requires?</strong><br />Can it follow, compare, challenge, verify, test, express uncertainty, or stop when needed?</td><td>Behavioral Fit</td></tr>
        <tr><td><strong>Can the person catch and correct a serious error?</strong><br />Do they have the knowledge, access, authority, and time?</td><td>Human Assurance</td></tr>
        <tr><td><strong>Are the right limits and checks in the process?</strong><br />This includes access, approvals, records, monitoring, stopping, and recovery.</td><td>Workflow Control</td></tr>
        <tr><td><strong>Can you tell whether the result worked?</strong><br />Are success and harm clear enough to observe and revisit?</td><td>Outcome Testability</td></tr>
      </tbody></table>
      <h2>How a score is calculated</h2>
      <ol>
        <li>Each answer begins with a transparent rubric value from 0 to 100.</li>
        <li>An answer you can confirm keeps its full value. Something only reported receives 75%. An unknown receives no proof credit.</li>
        <li>The active questions are combined into five scores. Each of the five parts contributes 20%.</li>
        <li>The public score is rounded to the nearest five to avoid false precision.</li>
        <li>What is at stake and the AI role you want determine how high the score needs to be. They do not change the score you earned.</li>
        <li>Serious problems can limit AI’s role even when the average score is high.</li>
      </ol>
      <h2>Score bands</h2>
      <table><thead><tr><th>Score</th><th>Result</th><th>Meaning</th></tr></thead><tbody>
        <tr><td>0–19</td><td>Not supported</td><td>There is little proof for giving AI the proposed role.</td></tr>
        <tr><td>20–39</td><td>Use only in a small role</td><td>AI is suitable only for narrow help with low consequences.</td></tr>
        <tr><td>40–59</td><td>Use with limits</td><td>You may continue within stated limits and with added checks.</td></tr>
        <tr><td>60–79</td><td>Supported with controls</td><td>The proof and work process support a defined AI role.</td></tr>
        <tr><td>80–94</td><td>Strong support with limits</td><td>There is strong current support for this job and these conditions.</td></tr>
        <tr><td>95–100</td><td>Strongest current support</td><td>The strongest current criteria are shown, but the result still applies only to this project setup.</td></tr>
      </tbody></table>
      <h2>Proof and real-use testing are separate</h2>
      <p><strong>How solid the score is</strong> (evidence confidence) describes how much the result rests on things you confirmed instead of reports and unknowns. <strong>Real-use testing</strong> (validation status) describes whether the project setup is untested, observed in a pilot, repeated, or sustained in real use.</p>
      <p>A project can have a high projected score and still be untested.</p>
      <h2>Problems that override the score</h2>
      <p>The method calls these <strong>hard gates</strong>.</p>
      <ul>
        <li>Unknown permissions block sensitive, external, or autonomous action.</li>
        <li>Unverified material claims cannot be presented as verified.</li>
        <li>Production changes without relevant technical checks cannot receive unsupervised release authority.</li>
        <li>High-consequence decisions without capable human review cannot be delegated solely to AI.</li>
        <li>A project without outcome evidence may be piloted but cannot claim demonstrated effectiveness.</li>
      </ul>
      <h2>Accountability</h2>
      <p>AI can produce recommendations, influence decisions, and initiate actions when connected to tools. It cannot absorb the accountability that follows human agency. The person who can authorize, reject, limit, stop, or correct an action remains accountable for how that agency is used.</p>
      <h2>When to refresh</h2>
      <p>Repeat the check when the model, instructions, memory, tools, data, permissions, human reviewer, task, audience, stakes, acceptance criteria, workflow, or observed outcomes materially change.</p>
      <div class="callout callout-warning"><p><strong>Current status:</strong> Method v0.1 is a transparent, practice-based working method. It has not been independently validated as a scientific instrument.</p></div>
    </div>
  </div>`;
}

function renderExamples() {
  document.title = 'Examples — Human + AI Work Check';
  const examples = [
    ['Create an article or report', 'AI may organize, challenge, research, draft, or edit. The check identifies who controls the argument, which claims require verification, and whether the creator can explain and defend the result.', 'Project card + How the Work Was Made record'],
    ['Build a website', 'AI may propose structure, write code, create content, and run tests. The check separates visible review from security, accessibility, code, or deployment areas the creator cannot inspect.', 'Release boundary + test plan'],
    ['Use an agent to take actions', 'An agent may send messages, change files, operate accounts, or trigger its next step. Permissions, reversibility, monitoring, and approval gates receive more weight than fluent responses.', 'AI role limits + problems to fix first'],
    ['Develop training content', 'Content accuracy does not prove that people can learn from or use it. The check separates subject review, instructional flow, learner testing, and observed outcomes.', 'Pilot plan + validation status'],
    ['Review a completed project', 'A polished result may still have weak evidence about what worked. The Outcome Check compares the intended wager with observed use, errors, and consequences.', 'Updated boundary + next review'],
  ];
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">Examples</p><h1>Different projects require different reliance.</h1><p>The same system can deserve very different authority in two tasks. Start with the situation where a consequential choice is being made.</p></header><div class="grid-2">${examples.map(([title, copy, output], index) => `<article class="card"><span class="card-number">0${index + 1}</span><h3>${title}</h3><p>${copy}</p><p class="kicker">Useful output</p><p><strong>${output}</strong></p></article>`).join('')}</div><div class="button-row"><a class="button" href="#/check">Check a real project</a><a class="button button-secondary" href="#/sample">View the website example</a></div></div>`;
}

function renderPricing() {
  document.title = 'Pricing — Human + AI Work Check';
  main.innerHTML = `<div class="page">
    <header class="page-header"><p class="eyebrow">Pricing</p><h1>Start free. Pay for continuity and review—not a better score.</h1><p>The first public release is a browser-based preview. No payment is collected on this GitHub-hosted version.</p></header>
    <div class="grid-2">
      <article class="card pricing-card featured"><span class="stamp">Available in preview</span><h2>Free Preview</h2><p class="price">$0</p><ul><li>Checks before, during, or after a project</li><li>Project score and how solid it is</li><li>What AI may and may not do</li><li>Problems to fix first</li><li>Steps to take now or later</li><li>Printable project card</li><li>How the Work Was Made record</li><li>Local browser save and JSON export</li></ul><a class="button" href="#/check">Check a project for free</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned</span><h2>Project Record</h2><p class="price">Coming later</p><ul><li>Secure project storage</li><li>Plan-to-release comparison</li><li>Evidence management</li><li>Dated refreshes</li><li>Public, unlisted, or private records</li></ul><a class="button button-secondary" href="#/method">Review the method</a></article>
      <article class="card pricing-card"><span class="stamp stamp-warning">Planned</span><h2>Individual &amp; Team</h2><p class="price">Coming later</p><ul><li>Multiple projects and score history</li><li>Reusable templates</li><li>Reviewer assignments</li><li>Approval gates and activity history</li><li>Embeddable project cards</li></ul><a class="button button-secondary" href="#/examples">See use cases</a></article>
      <article class="card pricing-card"><span class="stamp">Human service</span><h2>Guided Review</h2><p class="price">Contact</p><p>A facilitated review for projects that need outside examination or lack needed human capacity.</p><ul><li>Scope and authority review</li><li>Evidence-gap identification</li><li>Independent challenge</li><li>Documented findings</li></ul><span class="button button-secondary" aria-disabled="true">Contact option coming later</span></article>
    </div>
    <div class="callout" style="margin-top:2rem"><p><strong>Pricing principle:</strong> You pay for saved records, collaboration, integrations, and human review—not for a more favorable score.</p></div>
  </div>`;
}

function renderFAQ() {
  document.title = 'FAQ — Human + AI Work Check';
  const faqs = [
    ['What exactly does this tool score?', 'One real project: the person, AI setup, job, steps and checks, and what is at stake. It does not score the model by itself.'],
    ['How does this tool define trust?', 'Trust means your capacity, evidence, and workflow can support the reliance you are placing on the system for this task. Distrust means they currently cannot. Uncertainty means there is not enough evidence to decide.'],
    ['Is this an AI detector?', 'No. It does not examine a finished artifact and guess whether AI produced it.'],
    ['Is the score the probability that the AI is correct?', 'No. The score shows how strongly the person, proof, and checks support this use of AI. It is not an accuracy percentage.'],
    ['Does a more powerful model automatically raise the score?', 'No. A stronger model may improve capability fit, but it does not automatically improve human review, permissions, testing, recovery, or outcome measurement.'],
    ['Do I have to use the tool before starting?', 'No. Use it before starting, before release, or after a project is complete or live.'],
    ['Does a lower score mean I cannot publish or launch?', 'Not always. It means the proposed reliance should be limited. You may release low-risk parts while keeping untested or high-authority functions inactive.'],
    ['Can this record prove that work is a certain percentage human?', 'No. A percentage cannot honestly describe the different actions a person took and the different things AI contributed. The record shows those parts separately, along with any supporting evidence.'],
    ['Is the project card a certificate?', 'No. It is a dated record for one project. It does not certify that an AI system is safe, accurate, or generally trustworthy.'],
    ['Who remains accountable?', 'Accountability follows agency. A person remains accountable for choices they had the authority and capacity to make, including how much authority they gave the system.'],
    ['Why does the result need to be refreshed?', 'Models, instructions, permissions, people, workflows, audiences, and consequences change. A result applies only to the project setup that was checked.'],
    ['Where is my information stored in this preview?', 'Project information is stored only in this browser unless you export it. Do not enter confidential, regulated, or sensitive information.'],
  ];
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">FAQ</p><h1>Plain answers about what this tool can—and cannot—say.</h1></header><div class="faq-list">${faqs.map(([question, answer]) => `<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}</div><div class="button-row"><a class="button" href="#/check">Check a project</a><a class="button button-secondary" href="#/method">See the full method</a></div></div>`;
}

function renderNotFound() {
  document.title = 'Page not found — Human + AI Work Check';
  main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">404</p><h1>This page is outside the current boundary.</h1><p>The link may be outdated or incomplete.</p></header><a class="button" href="#/">Return home</a></div>`;
}

function slug(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'record';
}

menuButton.addEventListener('click', () => {
  const open = !nav.classList.contains('open');
  nav.classList.toggle('open', open);
  document.body.classList.toggle('nav-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  if (open) nav.querySelector('a')?.focus();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    nav.classList.remove('open');
    document.body.classList.remove('nav-open');
    menuButton.setAttribute('aria-expanded', 'false');
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

route();
