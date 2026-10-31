import {
  AI_SETUP_OPTIONS,
  FINDING_LABELS,
  FINDING_STATUS,
  appendSnapshot,
  compareSnapshots,
  createProjectId,
  createSnapshot,
  evidenceCoverage,
  exportSnapshotHistory,
  importSnapshotHistory,
  isComparableSnapshot,
  isProjectBaseline,
} from './snapshot-history.js';

const HISTORY_KEY = 'evaidence:snapshots:v1';
const DRAFT_KEY = 'evaidence:snapshot-draft:v1';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSef4UnjJR67d2zV0Osuu85TVtd5lqXrHCVWwdcOzPwCxNOrSw/viewform';

const WORK_TYPES = [
  ['writing', 'Writing, research, or publishing'],
  ['software', 'Website, application, code, or configuration'],
  ['training', 'Training or learning material'],
  ['creative', 'Image, audio, video, or design'],
  ['decision', 'Analysis, recommendation, or decision'],
  ['other', 'Something else'],
];

const STAGES = [
  ['plan', 'Planning'],
  ['build', 'In progress'],
  ['release', 'Ready to share or launch'],
  ['live', 'Already in use'],
];

const WORK_TYPE_LABELS = Object.fromEntries(WORK_TYPES);
const STAGE_LABELS = Object.fromEntries(STAGES);

const AI_SETUP_LABELS = {
  'regular-chat': 'Only this conversation',
  'context-enabled-chat': 'Saved instructions, memory, files, tools, or project context',
  'custom-ai': 'A custom assistant, GPT, or agent',
  multiple: 'More than one setup',
  unknown: 'I do not know',
};

const AUTHORITY_OPTIONS = [
  ['output-only', 'AI produced suggestions or work, but could not act outside the conversation'],
  ['approval-each-time', 'AI could act only after I approved each action'],
  ['standing-permission', 'AI could act within permission I had already granted'],
  ['unknown', 'I do not know what AI could access or do'],
];

const AUTHORITY_LABELS = Object.fromEntries(AUTHORITY_OPTIONS);

const ENTRY_OPTIONS = [
  ['human-first', 'I had the purpose or starting direction before AI entered'],
  ['shared-start', 'AI and I developed the starting direction together'],
  ['ai-first', 'I asked AI to propose the starting direction'],
  ['unknown', 'The available records do not make this clear'],
];

const ENTRY_LABELS = Object.fromEntries(ENTRY_OPTIONS);

const AI_ROLE_OPTIONS = [
  ['challenge', 'Challenge ideas or compare alternatives'],
  ['research', 'Find or check outside information'],
  ['organize', 'Organize, outline, or clarify'],
  ['draft', 'Generate content or a first draft'],
  ['edit', 'Edit or refine human-created work'],
  ['code', 'Write or modify code'],
  ['test', 'Run tests or identify problems'],
  ['act', 'Use tools, accounts, or connections to carry out actions'],
  ['unknown', 'I cannot tell from the records'],
];

const HUMAN_ROLE_OPTIONS = [
  ['originate', 'Set the purpose or originate the main direction'],
  ['sources', 'Supply experience, examples, sources, or requirements'],
  ['direct', 'Direct, question, or redirect the AI'],
  ['create', 'Create or substantially rewrite part of the work'],
  ['verify', 'Check facts, sources, code, links, or behavior'],
  ['decide', 'Accept, reject, select, or change important parts'],
  ['authorize', 'Decide what AI could access or do'],
  ['approve', 'Approve the version that was shared or released'],
  ['unknown', 'I cannot clearly separate my work from AI’s work'],
];

function makeDraft() {
  return {
    step: 1,
    projectMode: 'new',
    projectId: '',
    projectName: '',
    workType: '',
    stage: 'build',
    artifactUrl: '',
    aiSystemsText: '',
    aiSetup: 'unknown',
    authority: 'output-only',
    conversationUrl: '',
    conversationText: '',
    chatReference: null,
    sourceText: '',
    sourceReferences: [],
    githubUrl: '',
    otherEvidenceText: '',
    otherEvidence: [],
    entryPoint: '',
    aiRoles: [],
    humanRoles: [],
    savedSnapshotId: '',
  };
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHttpUrl(value = '') {
  try {
    const parsed = new URL(String(value).trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function snapshotTime(snapshot) {
  const value = Date.parse(snapshot?.createdAt);
  return Number.isNaN(value) ? 0 : value;
}

function chronologicalSnapshots(snapshots) {
  return [...snapshots].sort((left, right) => snapshotTime(left) - snapshotTime(right));
}

function loadHistory() {
  try {
    return importSnapshotHistory(loadJSON(HISTORY_KEY, { snapshots: [] }));
  } catch {
    return importSnapshotHistory({ snapshots: [] });
  }
}

function savedProjects(history) {
  const latestByProject = new Map();
  chronologicalSnapshots(history.snapshots).forEach((snapshot) => latestByProject.set(snapshot.projectId, snapshot));
  return [...latestByProject.values()].sort((left, right) => snapshotTime(right) - snapshotTime(left));
}

function availableProjects(history, additionalProjects = []) {
  const projects = new Map();
  const add = (project) => {
    if (!project?.projectId) return;
    const current = projects.get(project.projectId);
    if (!current || snapshotTime(project) >= snapshotTime(current)) projects.set(project.projectId, project);
  };
  additionalProjects.forEach(add);
  savedProjects(history).forEach(add);
  return [...projects.values()].sort((left, right) => snapshotTime(right) - snapshotTime(left));
}

function projectChoiceLabel(project) {
  const name = project.projectName || 'Unnamed work';
  const type = WORK_TYPE_LABELS[project.workType] || project.workType || 'Type not recorded';
  const dateValue = Date.parse(project.createdAt);
  const date = Number.isNaN(dateValue) ? 'Date not recorded' : new Date(dateValue).toLocaleDateString();
  return `${name} · ${type} · ${date}`;
}

function loadDraft() {
  const stored = loadJSON(DRAFT_KEY, null);
  return stored && typeof stored === 'object' ? { ...makeDraft(), ...stored } : makeDraft();
}

function saveDraft(draft) {
  const safeDraft = { ...draft, conversationText: '' };
  return saveJSON(DRAFT_KEY, safeDraft);
}

function selectOptions(options, selected) {
  return options.map(([value, label]) => `<option value="${escapeHTML(value)}"${value === selected ? ' selected' : ''}>${escapeHTML(label)}</option>`).join('');
}

function radioOptions(name, options, selected) {
  return options.map(([value, label]) => `<label class="choice"><input type="radio" name="${escapeHTML(name)}" value="${escapeHTML(value)}"${value === selected ? ' checked' : ''} /><span><strong>${escapeHTML(label)}</strong></span></label>`).join('');
}

function checkboxOptions(name, options, selected = []) {
  return options.map(([value, label]) => `<label class="choice"><input type="checkbox" name="${escapeHTML(name)}" value="${escapeHTML(value)}"${selected.includes(value) ? ' checked' : ''} /><span><strong>${escapeHTML(label)}</strong></span></label>`).join('');
}

function labelsFor(values, options) {
  const labels = Object.fromEntries(options);
  return values.map((value) => labels[value] || value).filter(Boolean);
}

function parseSystems(value) {
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [product, ...modelParts] = line.split('|');
    return { product: product.trim(), model: modelParts.join('|').trim() };
  });
}

function parseReferenceLines(value, prefix) {
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const url = safeHttpUrl(line);
    return {
      id: `${prefix}-${index + 1}`,
      label: url ? `Linked ${prefix.replaceAll('-', ' ')}` : line,
      url,
      summary: url ? '' : 'Record named by the creator. Its contents were not stored.',
    };
  });
}

async function sha256(value) {
  const buffer = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function referenceFromFile(file, id, kind) {
  if (!file) return null;
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
  const bytes = await file.arrayBuffer();
  return {
    id,
    label: file.name,
    summary: `${kind}; ${file.size.toLocaleString()} bytes. The file contents are not stored in the snapshot.`,
    digest: `sha256:${await sha256(bytes)}`,
  };
}

async function buildChatReference(form) {
  const url = safeHttpUrl(form.elements.conversationUrl.value);
  const pasted = form.elements.conversationText.value.trim();
  const file = form.elements.conversationFile.files?.[0];
  if (file) return referenceFromFile(file, 'chat-primary', 'AI conversation file');
  if (pasted) {
    return {
      id: 'chat-primary',
      label: 'Pasted AI conversation',
      summary: `${pasted.length.toLocaleString()} characters were supplied. The conversation text is not stored in the snapshot.`,
      digest: `sha256:${await sha256(pasted)}`,
    };
  }
  return url ? { id: 'chat-primary', label: 'AI conversation link', url, summary: 'Link supplied by the creator. The page did not inspect the linked conversation.' } : null;
}

async function buildFileReferences(fileList, prefix, kind) {
  const files = [...(fileList || [])];
  return Promise.all(files.map((file, index) => referenceFromFile(file, `${prefix}-${index + 1}`, kind)));
}

function renderError(message) {
  return message ? `<div class="error-summary" role="alert"><h2>Check this part</h2><p>${escapeHTML(message)}</p></div>` : '';
}

function recordInventory(draft) {
  const rows = [
    ['AI conversation', draft.chatReference ? draft.chatReference.label : 'Not added'],
    ['What AI started with', AI_SETUP_LABELS[draft.aiSetup] || 'Unknown'],
    ['Source material', draft.sourceReferences.length ? `${draft.sourceReferences.length} record${draft.sourceReferences.length === 1 ? '' : 's'} added` : 'Not added'],
    ['GitHub history', draft.githubUrl || 'Not added'],
    ['Finished work', draft.artifactUrl || 'Not added'],
  ];
  return `<dl class="snapshot-inventory">${rows.map(([term, value]) => `<div><dt>${escapeHTML(term)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>`;
}

function renderSnapshotStepOne(main, draft, history, additionalProjects, error = '') {
  const projects = availableProjects(history, additionalProjects);
  const selectedProjectId = draft.projectMode === 'existing' ? draft.projectId : '';
  const projectChooser = projects.length ? `<div class="field field-span-2"><label for="snapshot-project-choice">Which project are you adding a snapshot to?</label><select id="snapshot-project-choice" name="projectChoice"><option value="">Start a new project</option>${projects.map((project) => `<option value="${escapeHTML(project.projectId)}"${project.projectId === selectedProjectId ? ' selected' : ''}>Continue: ${escapeHTML(projectChoiceLabel(project))}</option>`).join('')}</select><small>Each project keeps the same identity even if you rename it later.</small></div>` : '';
  main.innerHTML = `<div class="page snapshot-page">
    <header class="page-header"><p class="eyebrow">New snapshot · Step 1 of 2</p><h1>Add the records you already have.</h1><p>Start with the AI conversation, what AI already had, and the work or version history. Raw conversation and file contents stay on this page. The saved snapshot keeps only references, short summaries, and fingerprints.</p></header>
    ${renderError(error)}
    <form id="snapshot-records-form" class="snapshot-form setup-card" novalidate>
      <section aria-labelledby="snapshot-project-heading"><h2 id="snapshot-project-heading" class="form-section-heading">The work</h2>
        <div class="field-grid">
          ${projectChooser}
          <div class="field field-span-2"><label for="snapshot-project-name">Project or work name <span class="required">Required</span></label><input id="snapshot-project-name" name="projectName" value="${escapeHTML(draft.projectName)}" required /></div>
          <div class="field"><label for="snapshot-work-type">What kind of work is it? <span class="required">Required</span></label><select id="snapshot-work-type" name="workType" required><option value="">Choose one</option>${selectOptions(WORK_TYPES, draft.workType)}</select></div>
          <div class="field"><label for="snapshot-stage">Where is the work now?</label><select id="snapshot-stage" name="stage">${selectOptions(STAGES, draft.stage)}</select></div>
          <div class="field field-span-2"><label for="snapshot-artifact-url">Link to the finished or current work <span class="helper-text">Optional</span></label><input id="snapshot-artifact-url" name="artifactUrl" type="url" value="${escapeHTML(draft.artifactUrl)}" placeholder="https://" /></div>
        </div>
      </section>
      <section aria-labelledby="snapshot-ai-heading"><h2 id="snapshot-ai-heading" class="form-section-heading">The AI setup</h2>
        <div class="field"><label for="snapshot-ai-systems">Which AI tools or models materially contributed? <span class="required">Required</span></label><textarea id="snapshot-ai-systems" name="aiSystemsText" placeholder="One per line. Example: ChatGPT | 6.1 Sol\nClaude | model unknown" required>${escapeHTML(draft.aiSystemsText)}</textarea><small>If you do not know a model, say “model unknown.”</small></div>
        <fieldset class="fieldset"><legend>What did AI already have when this work began?</legend><div class="choice-list">${radioOptions('aiSetup', AI_SETUP_OPTIONS.map((value) => [value, AI_SETUP_LABELS[value]]), draft.aiSetup)}</div></fieldset>
        <fieldset class="fieldset"><legend>What could AI do beyond producing a response?</legend><div class="choice-list">${radioOptions('authority', AUTHORITY_OPTIONS, draft.authority)}</div></fieldset>
      </section>
      <section aria-labelledby="snapshot-records-heading"><h2 id="snapshot-records-heading" class="form-section-heading">The records</h2>
        <div class="field-grid">
          <div class="field field-span-2"><label for="snapshot-conversation-url">AI conversation link <span class="helper-text">Optional</span></label><input id="snapshot-conversation-url" name="conversationUrl" type="url" value="${escapeHTML(draft.conversationUrl)}" placeholder="https://" /></div>
          <div class="field field-span-2"><label for="snapshot-conversation-text">Or paste the relevant conversation <span class="helper-text">Optional</span></label><textarea id="snapshot-conversation-text" name="conversationText" placeholder="Paste only the part connected to this work. It will be fingerprinted, then discarded."></textarea></div>
          <div class="field field-span-2"><label for="snapshot-conversation-file">Or choose a conversation export <span class="helper-text">Optional, 5 MB maximum</span></label><input id="snapshot-conversation-file" name="conversationFile" type="file" accept=".txt,.md,.json,text/plain,application/json" /></div>
          <div class="field field-span-2"><label for="snapshot-source-text">Source material you gave AI <span class="helper-text">Optional</span></label><textarea id="snapshot-source-text" name="sourceText" placeholder="One link or record name per line">${escapeHTML(draft.sourceText)}</textarea></div>
          <div class="field field-span-2"><label for="snapshot-source-files">Or choose source files <span class="helper-text">Optional, 5 MB each</span></label><input id="snapshot-source-files" name="sourceFiles" type="file" multiple /></div>
          <div class="field field-span-2"><label for="snapshot-github-url">Public GitHub repository <span class="helper-text">Optional</span></label><input id="snapshot-github-url" name="githubUrl" type="url" value="${escapeHTML(draft.githubUrl)}" placeholder="https://github.com/owner/repository" /></div>
          <div class="field field-span-2"><label for="snapshot-other-evidence">Other useful records <span class="helper-text">Optional</span></label><textarea id="snapshot-other-evidence" name="otherEvidenceText" placeholder="Draft history, notes, test results, screenshots, or approval records. One per line.">${escapeHTML(draft.otherEvidenceText)}</textarea></div>
        </div>
      </section>
      <div class="form-actions"><a class="button button-secondary" href="#/">Cancel</a><button class="button" type="submit">Check the picture <span aria-hidden="true">→</span></button></div>
    </form>
  </div>`;
}

function renderSnapshotStepTwo(main, draft, error = '') {
  main.innerHTML = `<div class="page snapshot-page">
    <header class="page-header"><p class="eyebrow">New snapshot · Step 2 of 2</p><h1>Check the picture.</h1><p>The records show what was saved. They may not show work that happened in your head, offline, or outside the AI conversation. Confirm these three parts before saving the snapshot.</p></header>
    ${renderError(error)}
    <section class="record-panel snapshot-records-review" aria-labelledby="records-received-heading"><h2 id="records-received-heading">Records received</h2>${recordInventory(draft)}<p class="helper-text">A supplied link is recorded as a reference. A fingerprint shows which pasted text or file was supplied. Neither one proves a claim by itself.</p></section>
    <form id="snapshot-confirm-form" class="snapshot-form setup-card" novalidate>
      <fieldset class="fieldset"><legend>1. When did AI enter the work?</legend><div class="choice-list">${radioOptions('entryPoint', ENTRY_OPTIONS, draft.entryPoint)}</div></fieldset>
      <fieldset class="fieldset"><legend>2. What did AI materially do?</legend><p class="helper-text">Choose every role that mattered to this version.</p><div class="choice-grid">${checkboxOptions('aiRoles', AI_ROLE_OPTIONS, draft.aiRoles)}</div></fieldset>
      <fieldset class="fieldset"><legend>3. What did you materially do?</legend><p class="helper-text">Choose actions you can personally account for.</p><div class="choice-grid">${checkboxOptions('humanRoles', HUMAN_ROLE_OPTIONS, draft.humanRoles)}</div></fieldset>
      <div class="form-actions"><button class="button button-secondary" type="button" id="snapshot-back">Back</button><button class="button" type="submit">Save snapshot <span aria-hidden="true">→</span></button></div>
    </form>
  </div>`;
}

function buildFindings(draft) {
  const findings = [];
  if (draft.chatReference) findings.push({
    topic: 'AI conversation',
    summary: draft.chatReference.summary || draft.chatReference.label,
    status: draft.chatReference.digest ? FINDING_STATUS.SHOWN_IN_RECORDS : FINDING_STATUS.CONFIRMED_BY_CREATOR,
    evidenceRefs: [draft.chatReference.id],
  });
  else findings.push({ topic: 'AI conversation', summary: 'No conversation record was added.', status: FINDING_STATUS.UNKNOWN });

  findings.push({ topic: 'What AI started with', summary: AI_SETUP_LABELS[draft.aiSetup] || 'Unknown', status: draft.aiSetup === 'unknown' ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'Starting point', summary: ENTRY_LABELS[draft.entryPoint] || 'Not answered', status: draft.entryPoint === 'unknown' || !draft.entryPoint ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'AI work', summary: labelsFor(draft.aiRoles, AI_ROLE_OPTIONS).join('; ') || 'Not identified', status: draft.aiRoles.includes('unknown') || !draft.aiRoles.length ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'Human work', summary: labelsFor(draft.humanRoles, HUMAN_ROLE_OPTIONS).join('; ') || 'Not identified', status: draft.humanRoles.includes('unknown') || !draft.humanRoles.length ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'AI authorization', summary: AUTHORITY_LABELS[draft.authority] || 'Unknown', status: draft.authority === 'unknown' ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });

  if (draft.sourceReferences.length) findings.push({
    topic: 'Source material',
    summary: `${draft.sourceReferences.length} source reference${draft.sourceReferences.length === 1 ? '' : 's'} supplied. File fingerprints are shown in the record; links and record names are not inspected.`,
    status: draft.sourceReferences.some(({ digest }) => digest) ? FINDING_STATUS.SHOWN_IN_RECORDS : FINDING_STATUS.CONFIRMED_BY_CREATOR,
    evidenceRefs: draft.sourceReferences.map(({ id }) => id),
  });
  else findings.push({ topic: 'Source material', summary: 'No source-material record was added.', status: FINDING_STATUS.UNKNOWN });

  if (draft.githubUrl) findings.push({ topic: 'Version history', summary: 'A public GitHub repository was linked. This browser preview did not inspect its contents.', status: FINDING_STATUS.CONFIRMED_BY_CREATOR });
  if (draft.artifactUrl) findings.push({ topic: 'Current work', summary: 'A link to the current or finished work was supplied.', status: FINDING_STATUS.CONFIRMED_BY_CREATOR });
  return findings;
}

function snapshotFromDraft(draft) {
  const sourceReferences = draft.sourceReferences;
  const otherEvidence = [...draft.otherEvidence];
  if (draft.githubUrl) otherEvidence.push({ id: 'github-history', label: 'GitHub repository', url: draft.githubUrl, summary: 'Repository link supplied by the creator.' });
  if (draft.artifactUrl) otherEvidence.push({ id: 'current-work', label: 'Current or finished work', url: draft.artifactUrl });
  return createSnapshot({
    projectId: draft.projectId,
    projectName: draft.projectName,
    workType: draft.workType,
    stage: draft.stage,
    artifactUrl: draft.artifactUrl,
    aiSystems: parseSystems(draft.aiSystemsText),
    aiSetup: draft.aiSetup,
    chatReference: draft.chatReference,
    sourceReferences,
    githubUrl: draft.githubUrl,
    otherEvidence,
    beforeAi: [ENTRY_LABELS[draft.entryPoint] || 'Unknown'],
    aiRoles: labelsFor(draft.aiRoles, AI_ROLE_OPTIONS),
    humanRoles: labelsFor(draft.humanRoles, HUMAN_ROLE_OPTIONS),
    finalAuthority: AUTHORITY_LABELS[draft.authority] || 'Unknown',
    findings: buildFindings(draft),
    intent: 'not-answered',
  });
}

function findPreviousComparable(history, snapshot) {
  const currentTime = snapshotTime(snapshot);
  return chronologicalSnapshots(history.snapshots)
    .filter((item) => item.id !== snapshot.id && snapshotTime(item) <= currentTime && isComparableSnapshot(item, snapshot))
    .at(-1) || null;
}

function listText(value, key = '') {
  if (Array.isArray(value)) return value.length ? value.join('; ') : 'None recorded';
  if (value && typeof value === 'object') return value.percent === null ? 'Not calculated' : `${value.coveredFindings} of ${value.totalFindings} findings have a stated basis`;
  if (key === 'ai-setup') return AI_SETUP_LABELS[value] || 'Unknown';
  return String(value || 'Not recorded');
}

function snapshotCreditsSequence(snapshot, duplicate = false) {
  const systems = snapshot.aiSystems.map(({ product, model }) => [product, model].filter(Boolean).join(' · ')).join('; ') || 'AI system not identified';
  const coverage = evidenceCoverage(snapshot);
  return `<div class="credits-sequence"${duplicate ? ' aria-hidden="true"' : ''}>
    <p class="credits-overline">Collaboration snapshot</p>
    <h2>${escapeHTML(snapshot.projectName)}</h2>
    <div class="credits-entry"><p>Starting point</p><strong>Human + AI relationship</strong><span>${escapeHTML(snapshot.beforeAi.join('; ') || 'Unknown')}</span></div>
    <div class="credits-entry"><p>Human work</p><strong>Human</strong><span>${escapeHTML(snapshot.humanRoles.join('; ') || 'Unknown')}</span></div>
    <div class="credits-entry"><p>AI work</p><strong>${escapeHTML(systems)}</strong><span>${escapeHTML(snapshot.aiRoles.join('; ') || 'Unknown')}</span></div>
    <div class="credits-entry"><p>Authorization</p><strong>Human decision</strong><span>${escapeHTML(snapshot.finalAuthority || 'Unknown')}</span></div>
    <div class="credits-entry credits-evidence"><p>Basis for the findings</p><strong>${coverage.shownInRecords} record${coverage.shownInRecords === 1 ? '' : 's'} provided · ${coverage.confirmedByCreator} confirmed by the creator · ${coverage.unknown} unknown</strong></div>
    <p class="credits-end">End of snapshot</p>
  </div>`;
}

function changeTable(comparison) {
  if (!comparison.comparable || !comparison.changes.length) return '';
  return `<div class="table-scroll" role="region" aria-label="Changes between snapshots" tabindex="0"><table class="change-table"><thead><tr><th scope="col">Area</th><th scope="col">Earlier</th><th scope="col">Current</th></tr></thead><tbody>${comparison.changes.map((change) => `<tr><th scope="row">${escapeHTML(change.label)}</th><td>${escapeHTML(listText(change.before, change.key))}</td><td>${escapeHTML(listText(change.after, change.key))}</td></tr>`).join('')}</tbody></table></div>`;
}

function shortDisclosure(snapshot) {
  const systems = snapshot.aiSystems.map(({ product, model }) => [product, model].filter(Boolean).join(' ')).join(', ') || 'AI tools';
  return `Human + AI work disclosure: AI tools: ${systems}. AI contributions: ${snapshot.aiRoles.join('; ') || 'not specified'}. Human contributions: ${snapshot.humanRoles.join('; ') || 'not specified'}. A dated evAIdence snapshot records the supplied references and creator confirmations.`;
}

function downloadText(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function slug(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'snapshot';
}

function renderSnapshotResult(main, snapshot, history, showToast, onCreateWorkRecord, knownProjects) {
  const previous = findPreviousComparable(history, snapshot);
  const comparison = compareSnapshots(previous, snapshot);
  const coverage = evidenceCoverage(snapshot);
  const headline = comparison.baseline
    ? 'This is your baseline.'
    : comparison.comparable && comparison.changes.length
      ? `${comparison.changes.length} tracked change${comparison.changes.length === 1 ? '' : 's'} found.`
      : comparison.reason;
  main.innerHTML = `<div class="page snapshot-result-page">
    <header class="page-header"><p class="eyebrow">Snapshot saved</p><h1>${escapeHTML(headline)}</h1><p>${comparison.baseline ? 'Save another snapshot for comparable work and evAIdence will show what moved.' : 'The comparison describes movement in the recorded relationship. It does not grade the change as good or bad.'}</p></header>
    <div class="snapshot-result-grid">
      <aside class="credits-screen snapshot-credits" aria-label="Scrolling credits for this snapshot">
        <div class="credits-screen-toolbar"><span>Credits for this snapshot</span><button class="credits-motion-toggle" id="snapshot-credits-toggle" type="button">Pause credits</button></div>
        <div class="credits-viewport"><div class="credits-track">${snapshotCreditsSequence(snapshot)}${snapshotCreditsSequence(snapshot, true)}</div></div>
      </aside>
      <section class="record-panel" aria-labelledby="snapshot-summary-heading"><h2 id="snapshot-summary-heading">What this snapshot shows</h2>
        <dl class="record-facts"><div><dt>Project</dt><dd>${escapeHTML(snapshot.projectName)}</dd></div><div><dt>Work type</dt><dd>${escapeHTML(WORK_TYPE_LABELS[snapshot.workType] || snapshot.workType)}</dd></div><div><dt>Saved</dt><dd>${escapeHTML(new Date(snapshot.createdAt).toLocaleString())}</dd></div><div><dt>Basis provided</dt><dd>${coverage.coveredFindings} of ${coverage.totalFindings} findings</dd></div><div><dt>Records provided</dt><dd>${coverage.shownInRecords}</dd></div><div><dt>Confirmed by creator</dt><dd>${coverage.confirmedByCreator}</dd></div><div><dt>Unknown</dt><dd>${coverage.unknown}</dd></div></dl>
        <p class="helper-text"><strong>These counts are not an authorship or trust score.</strong> They separate what supplied records show, what the creator confirmed, and what remains unknown.</p>
      </section>
    </div>
    ${comparison.comparable && comparison.changes.length ? `<section class="section-inline" aria-labelledby="snapshot-changes-heading"><p class="kicker">Compared with ${escapeHTML(new Date(previous.createdAt).toLocaleDateString())}</p><h2 id="snapshot-changes-heading">Here is what moved.</h2>${changeTable(comparison)}<form id="snapshot-intent-form" class="intent-form"><fieldset class="fieldset"><legend>Was this change intentional?</legend><div class="choice-list choice-list-inline">${radioOptions('intent', [['intentional', 'Yes'], ['not-intentional', 'No'], ['unsure', 'Not sure']], snapshot.intent)}</div></fieldset><button class="button button-secondary" type="submit">Save this answer</button></form><div class="callout"><p><strong>Does the current arrangement still fit what matters in this work and what you can personally judge?</strong></p><p>If the answer is unclear, use the optional Load Test for a closer look at capacity, workflow, and consequences.</p><a href="#/load-test">Run a Load Test</a></div></section>` : ''}
    <section class="section-inline" aria-labelledby="snapshot-findings-heading"><h2 id="snapshot-findings-heading">Findings and their basis</h2><ul class="finding-list">${snapshot.findings.map((finding) => `<li><div><strong>${escapeHTML(finding.topic)}</strong><p>${escapeHTML(finding.summary)}</p></div><span class="status-pill status-${escapeHTML(finding.status)}">${escapeHTML(FINDING_LABELS[finding.status])}</span></li>`).join('')}</ul></section>
    <section class="section-inline disclosure-box"><h2>Short disclosure</h2><p id="snapshot-disclosure">${escapeHTML(shortDisclosure(snapshot))}</p></section>
    <div class="button-row no-print"><button class="button" type="button" id="create-detailed-work-record">Create Detailed Work Record</button><button class="button button-secondary" type="button" id="download-snapshot">Download snapshot</button><button class="button button-secondary" type="button" id="copy-snapshot-disclosure">Copy disclosure</button><button class="button button-secondary" type="button" id="print-snapshot">Print or save PDF</button><a class="button button-secondary" href="#/changes">View my changes</a><button class="text-button" type="button" id="new-snapshot">Start another snapshot</button></div>
    <section class="section-inline feedback-prompt no-print" aria-labelledby="snapshot-feedback-heading"><p class="kicker">Help test the preview</p><h2 id="snapshot-feedback-heading">Did this bring the work into focus?</h2><p>Tell me what became clearer, where you got stuck, and whether you would return for another Snapshot.</p><a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Share Snapshot feedback <span class="new-tab-note">(opens in a new tab)</span></a></section>
  </div>`;

  const credits = document.querySelector('.snapshot-credits');
  document.querySelector('#snapshot-credits-toggle')?.addEventListener('click', (event) => {
    const paused = credits.classList.toggle('credits-paused');
    event.currentTarget.textContent = paused ? 'Resume credits' : 'Pause credits';
  });
  document.querySelector('#download-snapshot')?.addEventListener('click', () => downloadText(`${slug(snapshot.projectName)}-evaidence-snapshot.json`, JSON.stringify(snapshot, null, 2)));
  document.querySelector('#copy-snapshot-disclosure')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shortDisclosure(snapshot));
      showToast('Disclosure copied.');
    } catch {
      showToast('Copy was unavailable. Select the disclosure text instead.');
    }
  });
  document.querySelector('#print-snapshot')?.addEventListener('click', () => window.print());
  document.querySelector('#create-detailed-work-record')?.addEventListener('click', () => {
    if (typeof onCreateWorkRecord !== 'function' || onCreateWorkRecord(snapshot) === false) return;
    location.hash = '#/detailed-record';
  });
  document.querySelector('#new-snapshot')?.addEventListener('click', () => {
    localStorage.removeItem(DRAFT_KEY);
    location.hash = '#/snapshot';
    renderSnapshotPage(main, { showToast, onCreateWorkRecord, knownProjects });
  });
  document.querySelector('#snapshot-intent-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const intent = new FormData(event.currentTarget).get('intent');
    if (!intent) return showToast('Choose whether the change was intentional.');
    const updated = appendSnapshot(history, { id: snapshot.id, intent });
    saveJSON(HISTORY_KEY, updated);
    showToast('Intent saved with this snapshot.');
  });
}

export function renderSnapshotPage(main, { showToast = () => {}, onCreateWorkRecord, knownProjects = [] } = {}) {
  document.title = 'New Snapshot | evAIdence';
  let draft = loadDraft();
  const history = loadHistory();
  if (draft.step === 3 && draft.savedSnapshotId) {
    const snapshot = history.snapshots.find(({ id }) => id === draft.savedSnapshotId);
    if (snapshot) return renderSnapshotResult(main, snapshot, history, showToast, onCreateWorkRecord, knownProjects);
  }
  const showFormError = (form, message) => {
    document.querySelector('.snapshot-form-error')?.remove();
    const error = document.createElement('div');
    error.className = 'error-summary snapshot-form-error';
    error.setAttribute('role', 'alert');
    error.setAttribute('tabindex', '-1');
    error.innerHTML = `<h2>Check this part</h2><p>${escapeHTML(message)}</p>`;
    form.before(error);
    error.focus();
  };

  const bindStepTwo = () => {
    document.querySelector('#snapshot-back')?.addEventListener('click', () => {
      draft.step = 1;
      saveDraft(draft);
      renderSnapshotPage(main, { showToast, onCreateWorkRecord, knownProjects });
    });
    document.querySelector('#snapshot-confirm-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const entryPoint = String(data.get('entryPoint') || '');
      const aiRoles = data.getAll('aiRoles').map(String);
      const humanRoles = data.getAll('humanRoles').map(String);
      draft = { ...draft, entryPoint, aiRoles, humanRoles };
      saveDraft(draft);
      if (!entryPoint || !aiRoles.length || !humanRoles.length) {
        showFormError(event.currentTarget, 'Answer all three confirmation questions.');
        return;
      }
      const snapshot = snapshotFromDraft(draft);
      const updatedHistory = appendSnapshot(loadHistory(), snapshot);
      if (!saveJSON(HISTORY_KEY, updatedHistory)) {
        showFormError(event.currentTarget, 'This browser could not save the snapshot. Export other browser data or free some browser storage and try again.');
        return;
      }
      draft = { ...draft, step: 3, savedSnapshotId: snapshot.id };
      saveDraft(draft);
      renderSnapshotResult(main, snapshot, updatedHistory, showToast, onCreateWorkRecord, knownProjects);
      main.focus();
    });
  };

  const bindStepOne = () => {
    const projectsById = new Map(availableProjects(history, knownProjects).map((project) => [project.projectId, project]));
    document.querySelector('#snapshot-project-choice')?.addEventListener('change', (event) => {
      const projectId = String(event.currentTarget.value || '');
      const previousProjectId = draft.projectMode === 'existing' ? draft.projectId : '';
      if (projectId === previousProjectId) return;
      const currentForm = event.currentTarget.form;
      const currentValues = new FormData(currentForm);
      const hasEnteredInformation = Boolean(
        ['projectName', 'workType', 'artifactUrl', 'aiSystemsText', 'conversationUrl', 'conversationText', 'sourceText', 'githubUrl', 'otherEvidenceText']
          .some((name) => String(currentValues.get(name) || '').trim()) ||
        currentForm.elements.conversationFile.files?.length || currentForm.elements.sourceFiles.files?.length ||
        draft.chatReference || draft.sourceReferences.length || draft.otherEvidence.length,
      );
      if (hasEnteredInformation && !window.confirm('Change projects and clear the information entered on this page? This prevents records from one project being saved under another project.')) {
        event.currentTarget.value = previousProjectId;
        return;
      }
      if (!projectId) {
        draft = makeDraft();
        saveDraft(draft);
        renderSnapshotPage(main, { showToast, onCreateWorkRecord, knownProjects });
        showToast('New project selected.');
        window.requestAnimationFrame(() => document.querySelector('#snapshot-project-choice')?.focus());
        return;
      }
      const project = projectsById.get(projectId);
      if (!project) return;
      draft = {
        ...makeDraft(),
        projectMode: 'existing',
        projectId,
        projectName: project.projectName,
        workType: project.workType,
        stage: project.stage,
      };
      saveDraft(draft);
      renderSnapshotPage(main, { showToast, onCreateWorkRecord, knownProjects });
      showToast('Project selected. Review the current details before saving this snapshot.');
      window.requestAnimationFrame(() => document.querySelector('#snapshot-project-name')?.focus());
    });
    document.querySelector('#snapshot-records-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const projectName = String(formData.get('projectName') || '').trim();
      const workType = String(formData.get('workType') || '');
      const aiSystemsText = String(formData.get('aiSystemsText') || '').trim();
      if (!projectName || !workType || !aiSystemsText) {
        showFormError(form, 'Add the project name, work type, and AI tool or model.');
        form.querySelector(':invalid')?.focus();
        return;
      }
      try {
        const selectedProjectId = String(formData.get('projectChoice') || '');
        if (selectedProjectId && !projectsById.has(selectedProjectId)) {
          showFormError(form, 'Choose a saved project again or start a new project.');
          return;
        }
        const projectMode = selectedProjectId ? 'existing' : 'new';
        const projectId = selectedProjectId || (draft.projectMode === 'new' && draft.projectId ? draft.projectId : createProjectId());
        const chatReference = await buildChatReference(form);
        const sourceFiles = await buildFileReferences(form.elements.sourceFiles.files, 'source-file', 'Source file');
        draft = {
          ...draft,
          step: 2,
          projectMode,
          projectId,
          projectName,
          workType,
          stage: String(formData.get('stage') || 'build'),
          artifactUrl: safeHttpUrl(formData.get('artifactUrl')),
          aiSystemsText,
          aiSetup: String(formData.get('aiSetup') || 'unknown'),
          authority: String(formData.get('authority') || 'unknown'),
          conversationUrl: safeHttpUrl(formData.get('conversationUrl')),
          conversationText: '',
          chatReference,
          sourceText: String(formData.get('sourceText') || ''),
          sourceReferences: [...parseReferenceLines(formData.get('sourceText'), 'source-note'), ...sourceFiles],
          githubUrl: safeHttpUrl(formData.get('githubUrl')),
          otherEvidenceText: String(formData.get('otherEvidenceText') || ''),
          otherEvidence: parseReferenceLines(formData.get('otherEvidenceText'), 'other-record'),
        };
        saveDraft(draft);
        renderSnapshotStepTwo(main, draft);
        bindStepTwo();
        main.focus();
      } catch (error) {
        showFormError(form, error.message || 'One of the records could not be read.');
      }
    });
  };

  if (draft.step === 2) {
    renderSnapshotStepTwo(main, draft);
    bindStepTwo();
  } else {
    renderSnapshotStepOne(main, draft, history, knownProjects);
    bindStepOne();
  }
}

function latestComparablePair(history, projectId = '') {
  const candidates = chronologicalSnapshots(projectId
    ? history.snapshots.filter((snapshot) => snapshot.projectId === projectId)
    : history.snapshots);
  const current = candidates.at(-1);
  if (!current) return { previous: null, current: null };
  const previous = findPreviousComparable(history, current);
  return { previous, current };
}

export function renderChangesPage(main, { showToast = () => {}, selectedProjectId = '' } = {}) {
  document.title = 'My Changes | evAIdence';
  const history = loadHistory();
  if (!history.snapshots.length) {
    main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">My changes</p><h1>Each project starts with its own baseline.</h1><p>No snapshots are stored in this browser yet.</p></header><a class="button" href="#/snapshot">Create your first snapshot</a></div>`;
    return;
  }
  const projects = savedProjects(history);
  const activeProjectId = projects.some(({ projectId }) => projectId === selectedProjectId)
    ? selectedProjectId
    : history.snapshots.at(-1).projectId;
  const { previous, current } = latestComparablePair(history, activeProjectId);
  const projectSnapshots = chronologicalSnapshots(history.snapshots.filter((snapshot) => snapshot.projectId === activeProjectId));
  const comparison = compareSnapshots(previous, current);
  const projectName = current.projectName || 'this project';
  const headline = comparison.baseline
    ? `The baseline for ${projectName} is saved.`
    : comparison.comparable && comparison.changes.length
      ? `${comparison.changes.length} tracked change${comparison.changes.length === 1 ? '' : 's'} for ${projectName}.`
      : comparison.reason;
  main.innerHTML = `<div class="page changes-page">
    <header class="page-header"><p class="eyebrow">Private change view</p><h1>${escapeHTML(headline)}</h1><p>This history stays in this browser unless you export it. A public Work Record for one project does not include this complete timeline.</p><div class="field"><label for="changes-project-choice">Project to compare</label><select id="changes-project-choice">${projects.map((project) => `<option value="${escapeHTML(project.projectId)}"${project.projectId === activeProjectId ? ' selected' : ''}>${escapeHTML(projectChoiceLabel(project))}</option>`).join('')}</select></div></header>
    ${changeTable(comparison)}
    <section class="section-inline" aria-labelledby="snapshot-history-heading"><h2 id="snapshot-history-heading">Snapshots for ${escapeHTML(projectName)}</h2><div class="snapshot-history-list">${[...projectSnapshots].reverse().map((snapshot) => { const coverage = evidenceCoverage(snapshot); return `<article class="card"><p class="kicker">${isProjectBaseline(history, snapshot) ? 'Baseline' : escapeHTML(new Date(snapshot.createdAt).toLocaleDateString())}</p><h3>${escapeHTML(snapshot.projectName || 'Unnamed work')}</h3><p>${escapeHTML(WORK_TYPE_LABELS[snapshot.workType] || snapshot.workType || 'Work type not recorded')} · ${escapeHTML(STAGE_LABELS[snapshot.stage] || snapshot.stage || 'Stage unknown')}</p><dl class="mini-facts"><div><dt>AI setup</dt><dd>${escapeHTML(AI_SETUP_LABELS[snapshot.aiSetup] || 'Unknown')}</dd></div><div><dt>Basis provided</dt><dd>${coverage.coveredFindings} of ${coverage.totalFindings} findings</dd></div><div><dt>Unknown</dt><dd>${coverage.unknown}</dd></div></dl></article>`; }).join('')}</div></section>
    <div class="button-row"><a class="button" href="#/snapshot">Create another snapshot</a><button class="button button-secondary" id="export-snapshot-history" type="button">Export private history</button><button class="button button-secondary" id="import-snapshot-history-trigger" type="button">Import history</button><input id="import-snapshot-history" type="file" accept="application/json" hidden /><button class="text-button danger-link" id="clear-snapshot-history" type="button">Erase this browser history</button></div>
    ${comparison.comparable ? `<section class="section-inline feedback-prompt" aria-labelledby="changes-feedback-heading"><p class="kicker">Help test the preview</p><h2 id="changes-feedback-heading">Did this comparison show you something useful?</h2><p>Tell me what became clearer and what still needs work.</p><a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Share comparison feedback <span class="new-tab-note">(opens in a new tab)</span></a></section>` : ''}
  </div>`;
  document.querySelector('#changes-project-choice')?.addEventListener('change', (event) => {
    renderChangesPage(main, { showToast, selectedProjectId: String(event.currentTarget.value || '') });
    main.focus();
  });
  document.querySelector('#export-snapshot-history')?.addEventListener('click', () => downloadText('evaidence-private-snapshot-history.json', exportSnapshotHistory(history)));
  document.querySelector('#import-snapshot-history-trigger')?.addEventListener('click', () => document.querySelector('#import-snapshot-history')?.click());
  document.querySelector('#import-snapshot-history')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = importSnapshotHistory(await file.text());
      if (!window.confirm(`Replace this browser's ${history.snapshots.length} saved snapshot${history.snapshots.length === 1 ? '' : 's'} with the ${imported.snapshots.length} snapshot${imported.snapshots.length === 1 ? '' : 's'} in this file?`)) return;
      saveJSON(HISTORY_KEY, imported);
      localStorage.removeItem(DRAFT_KEY);
      renderChangesPage(main, { showToast });
      showToast('Snapshot history imported.');
    } catch (error) {
      showToast(error.message || 'That history file could not be imported.');
    }
  });
  document.querySelector('#clear-snapshot-history')?.addEventListener('click', () => {
    if (!window.confirm('Erase every evAIdence snapshot saved in this browser? Export first if you may need them later.')) return;
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(DRAFT_KEY);
    renderChangesPage(main, { showToast });
    showToast('Snapshot history erased from this browser.');
  });
}

