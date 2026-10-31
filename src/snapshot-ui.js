import {
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
const MAX_FILES_PER_GROUP = 20;
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
  'regular-chat': 'A fresh conversation with no added context',
  'context-enabled-chat': 'Saved instructions, memory, files, tools, or project context',
  'custom-ai': 'A custom assistant, GPT, or agent',
  multiple: 'More than one setup',
  unknown: 'I do not know',
};

const STARTING_CONTEXT_OPTIONS = [
  ['nothing-added', 'Nothing I added'],
  ['saved-instructions-memory', 'Saved instructions or memory'],
  ['custom-ai', 'A custom GPT, assistant, or agent'],
  ['existing-project-workspace', 'An existing project or workspace'],
  ['prior-conversations', 'Earlier conversations about this work'],
  ['connected-apps-tools', 'Connected apps, accounts, or tools'],
  ['unknown', 'I do not know'],
];

const STARTING_CONTEXT_LABELS = {
  ...Object.fromEntries(STARTING_CONTEXT_OPTIONS),
  'legacy-context-enabled': 'Earlier record: saved context was available, but the details were not recorded',
  'legacy-multiple': 'Earlier record: more than one setup was used, but the details were not recorded',
};

const ADDED_CONTEXT_OPTIONS = [
  ['conversation', 'Prompts or conversation'],
  ['documents', 'Documents or source material'],
  ['links', 'Links or websites'],
  ['examples', 'Examples or templates'],
  ['instructions', 'New instructions or requirements'],
  ['connected-apps-tools', 'Connected apps, accounts, or tools'],
  ['nothing-else', 'Nothing else'],
  ['unknown', 'I do not know'],
];

const ADDED_CONTEXT_LABELS = Object.fromEntries(ADDED_CONTEXT_OPTIONS);

const ACCESS_LEVEL_OPTIONS = [
  ['chat-only', 'Respond in the conversation only'],
  ['read', 'Respond and read files, pages, or connected apps'],
  ['create', 'Read and create drafts, files, images, or code'],
  ['edit-run', 'Create or change files or code, and run tools or tests'],
  ['external-action', 'Send, publish, submit, deploy, or change a connected service'],
  ['unknown', 'I do not know'],
];

const ACCESS_LEVEL_LABELS = Object.fromEntries(ACCESS_LEVEL_OPTIONS);

const APPROVAL_MODE_OPTIONS = [
  ['per-change', 'AI had to ask before each change outside the conversation'],
  ['before-external-action', 'AI could work inside the workspace, but had to ask before sending, publishing, submitting, or deploying'],
  ['standing-permission', 'AI could act within limits I had already approved'],
  ['no-external-actions', 'AI could not change anything outside the conversation or workspace'],
  ['unknown', 'I do not know when approval was required'],
];

const APPROVAL_MODE_LABELS = Object.fromEntries(APPROVAL_MODE_OPTIONS);

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
    creatorName: '',
    workType: '',
    stage: 'build',
    artifactUrl: '',
    githubUrl: '',
    aiSystemsText: '',
    startingContext: [],
    addedContext: [],
    accessLevel: 'unknown',
    approvalMode: 'unknown',
    connectedToolsText: '',
    conversationLinksText: '',
    conversationText: '',
    chatReferences: [],
    sourceText: '',
    sourceReferences: [],
    otherEvidenceText: '',
    otherEvidence: [],
    entryPoint: '',
    aiRoles: [],
    humanRoles: [],
    retainedBeforeAi: [],
    retainedAiRoles: [],
    retainedHumanRoles: [],
    intent: 'not-answered',
    editingSnapshotId: '',
    snapshotCreatedAt: '',
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

function referenceLines(value = '') {
  return String(value).split('\n').map((line) => line.trim()).filter(Boolean);
}

function invalidReferenceLine(value, { linksOnly = false } = {}) {
  return referenceLines(value).find((line) => {
    if (safeHttpUrl(line)) return false;
    if (linksOnly) return true;
    return /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(line) || /^www\./i.test(line);
  }) || '';
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
  if (!stored || typeof stored !== 'object') return makeDraft();
  const legacyStartingContext = ({
    'regular-chat': ['nothing-added'],
    'context-enabled-chat': ['legacy-context-enabled'],
    'custom-ai': ['custom-ai'],
    multiple: ['legacy-multiple'],
    unknown: ['unknown'],
  })[stored.aiSetup] || [];
  const legacyAuthority = ({
    'output-only': { accessLevel: 'unknown', approvalMode: 'no-external-actions' },
    'approval-each-time': { accessLevel: 'external-action', approvalMode: 'per-change' },
    'standing-permission': { accessLevel: 'external-action', approvalMode: 'standing-permission' },
    unknown: { accessLevel: 'unknown', approvalMode: 'unknown' },
  })[stored.authority] || {};
  return {
    ...makeDraft(),
    ...stored,
    startingContext: Array.isArray(stored.startingContext) ? stored.startingContext : legacyStartingContext,
    addedContext: Array.isArray(stored.addedContext) ? stored.addedContext : [],
    accessLevel: stored.accessLevel || legacyAuthority.accessLevel || 'unknown',
    approvalMode: stored.approvalMode || legacyAuthority.approvalMode || 'unknown',
    conversationLinksText: stored.conversationLinksText || stored.conversationUrl || '',
    chatReferences: Array.isArray(stored.chatReferences)
      ? stored.chatReferences
      : stored.chatReference
        ? [stored.chatReference]
        : [],
    retainedBeforeAi: Array.isArray(stored.retainedBeforeAi) ? stored.retainedBeforeAi : [],
    retainedAiRoles: Array.isArray(stored.retainedAiRoles) ? stored.retainedAiRoles : [],
    retainedHumanRoles: Array.isArray(stored.retainedHumanRoles) ? stored.retainedHumanRoles : [],
  };
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

function labeledValues(values, labels) {
  return (Array.isArray(values) ? values : []).map((value) => labels[value] || value).filter(Boolean);
}

function deriveLegacyAiSetup(startingContext) {
  const known = (Array.isArray(startingContext) ? startingContext : []).filter((value) => value !== 'unknown');
  if (!known.length || startingContext.includes('unknown')) return 'unknown';
  if (known.includes('legacy-multiple') || known.length > 1) return 'multiple';
  if (known[0] === 'nothing-added') return 'regular-chat';
  if (known[0] === 'custom-ai') return 'custom-ai';
  return 'context-enabled-chat';
}

function authoritySummary(accessLevel, approvalMode) {
  const access = ACCESS_LEVEL_LABELS[accessLevel] || ACCESS_LEVEL_LABELS.unknown;
  const approval = APPROVAL_MODE_LABELS[approvalMode] || APPROVAL_MODE_LABELS.unknown;
  return `${access}. ${approval}.`;
}

function parseSystems(value) {
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [product, ...modelParts] = line.split('|');
    return { product: product.trim(), model: modelParts.join('|').trim() };
  });
}

function parseReferenceLines(value, prefix, linkedLabel = '') {
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const url = safeHttpUrl(line);
    return {
      id: `${prefix}-${index + 1}`,
      label: url ? linkedLabel || `Linked ${prefix.replaceAll('-', ' ')}` : line,
      url,
      summary: url ? '' : 'Record named by the creator. Its contents were not stored.',
    };
  });
}

function referenceKey(reference = {}) {
  return reference.digest || reference.url || `${reference.label || ''}\u0000${reference.summary || ''}`;
}

function mergeReferences(existing = [], incoming = []) {
  const records = new Map();
  [...existing, ...incoming].filter(Boolean).forEach((reference) => {
    const key = referenceKey(reference);
    const current = records.get(key);
    records.set(key, current ? {
      ...current,
      ...reference,
      label: current.label || reference.label,
      summary: current.summary || reference.summary,
      date: current.date || reference.date,
      version: current.version || reference.version,
      digest: current.digest || reference.digest,
    } : reference);
  });
  return [...records.values()];
}

function retainedReferences(existing = [], incoming = [], { preserveDigests = false, preserveWithoutUrl = false } = {}) {
  const incomingKeys = new Set(incoming.map(referenceKey));
  return existing.filter((reference) => (
    (preserveDigests && reference.digest)
    || (preserveWithoutUrl && !reference.url)
    || incomingKeys.has(referenceKey(reference))
  ));
}

function reindexReferences(references = [], prefix = 'record') {
  return references.filter(Boolean).map((reference, index) => ({
    ...reference,
    id: `${prefix}-${index + 1}`,
  }));
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
    summary: `${kind}; ${file.size.toLocaleString()} bytes. The file contents are not stored in the Work Receipt.`,
    digest: `sha256:${await sha256(bytes)}`,
  };
}

async function buildChatReferences(form, existing = []) {
  const linked = parseReferenceLines(form.elements.conversationLinksText.value, 'chat-link', 'AI conversation link');
  const pasted = form.elements.conversationText.value.trim();
  const files = await buildFileReferences(form.elements.conversationFiles.files, 'chat-file', 'AI conversation file');
  const records = [...linked, ...files];
  if (pasted) {
    records.push({
      id: 'chat-pasted',
      label: 'Pasted AI conversation',
      summary: `${pasted.length.toLocaleString()} characters were supplied. The conversation text is not stored in the Work Receipt.`,
      digest: `sha256:${await sha256(pasted)}`,
    });
  }
  const retained = retainedReferences(existing, linked, { preserveWithoutUrl: true });
  return reindexReferences(mergeReferences(retained, records), 'chat');
}

async function buildFileReferences(fileList, prefix, kind) {
  const files = [...(fileList || [])];
  if (files.length > MAX_FILES_PER_GROUP) throw new Error(`Choose no more than ${MAX_FILES_PER_GROUP} files at one time.`);
  return Promise.all(files.map((file, index) => referenceFromFile(file, `${prefix}-${index + 1}`, kind)));
}

function renderError(message) {
  return message ? `<div class="error-summary" role="alert"><h2>Check this part</h2><p>${escapeHTML(message)}</p></div>` : '';
}

function retainedReferenceList(references, kind, heading) {
  if (!references.length) return '';
  return `<div class="retained-records" aria-live="polite"><p><strong>${escapeHTML(heading)}</strong></p><ul>${references.map((reference) => `<li><span>${escapeHTML(reference.label || reference.url || 'Saved record')}</span><button class="text-button" type="button" data-remove-reference="${escapeHTML(kind)}" data-reference-id="${escapeHTML(reference.id)}">Remove</button></li>`).join('')}</ul></div>`;
}

function selectedFileList(id, label) {
  return `<ul class="selected-file-list" id="${escapeHTML(id)}" aria-label="${escapeHTML(label)}" aria-live="polite"></ul>`;
}

function creatorAccountInventory(draft) {
  const rows = [
    ['Creator', draft.creatorName || 'Not provided'],
    ['What AI started with', labeledValues(draft.startingContext, STARTING_CONTEXT_LABELS).join('; ') || 'Not answered'],
    ['What was added during the work', labeledValues(draft.addedContext, ADDED_CONTEXT_LABELS).join('; ') || 'Not answered'],
    ['What AI could access or do', ACCESS_LEVEL_LABELS[draft.accessLevel] || 'Unknown'],
    ['When AI needed approval', APPROVAL_MODE_LABELS[draft.approvalMode] || 'Unknown'],
    ['Connected apps or tools', draft.connectedToolsText || 'None named'],
  ];
  return `<dl class="snapshot-inventory">${rows.map(([term, value]) => `<div><dt>${escapeHTML(term)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>`;
}

function recordCountText(references = []) {
  const provided = references.filter(({ url, digest }) => url || digest).length;
  const named = references.length - provided;
  const parts = [];
  if (provided) parts.push(`${provided} record${provided === 1 ? '' : 's'} provided`);
  if (named) parts.push(`${named} named, not provided`);
  return parts.join('; ') || 'Not provided';
}

function recordInventory(draft) {
  const rows = [
    ['AI conversations', recordCountText(draft.chatReferences)],
    ['Source material', recordCountText(draft.sourceReferences)],
    ['Finished or current work', draft.artifactUrl || 'Not provided'],
    ['Repository or version history', draft.githubUrl || 'Not provided'],
    ['Other records', recordCountText(draft.otherEvidence)],
  ];
  return `<dl class="snapshot-inventory">${rows.map(([term, value]) => `<div><dt>${escapeHTML(term)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>`;
}

function recordReviewItem(reference) {
  const label = reference.url || reference.label || 'Unnamed record';
  const basis = reference.digest
    ? 'File or pasted-text fingerprint saved'
    : reference.url
      ? 'Link provided'
      : 'Named only, not provided';
  const title = reference.url
    ? `<a href="${escapeHTML(reference.url)}" target="_blank" rel="noreferrer">${escapeHTML(label)} <span class="new-tab-note">(opens in a new tab)</span></a>`
    : `<span>${escapeHTML(label)}</span>`;
  return `<li><span>${title}</span><small>${escapeHTML(basis)}</small></li>`;
}

function recordReviewGroups(draft) {
  const groups = [
    ['AI conversations', draft.chatReferences],
    ['Source material', draft.sourceReferences],
    ['Other records', draft.otherEvidence],
  ].filter(([, references]) => references.length);
  if (!groups.length) return '';
  return `<div class="record-review-groups">${groups.map(([heading, references]) => `<details><summary>Review ${escapeHTML(heading.toLowerCase())} (${references.length})</summary><ul>${references.map(recordReviewItem).join('')}</ul></details>`).join('')}</div>`;
}

function renderSnapshotStepOne(main, draft, history, additionalProjects, error = '') {
  const projects = availableProjects(history, additionalProjects);
  const selectedProjectId = draft.projectMode === 'existing' ? draft.projectId : '';
  const projectChooser = projects.length ? `<div class="field field-span-2"><label for="snapshot-project-choice">Which project is this Work Receipt for?</label><select id="snapshot-project-choice" name="projectChoice"><option value="">Start a new project</option>${projects.map((project) => `<option value="${escapeHTML(project.projectId)}"${project.projectId === selectedProjectId ? ' selected' : ''}>Continue: ${escapeHTML(projectChoiceLabel(project))}</option>`).join('')}</select><small>Each project keeps the same identity even if you rename it later.</small></div>` : '';
  const exitControl = draft.editingSnapshotId
    ? '<button class="button button-secondary" type="button" id="cancel-snapshot-edit">Return to saved Work Receipt</button>'
    : '<a class="button button-secondary" href="#/">Cancel</a>';
  main.innerHTML = `<div class="page snapshot-page">
    <header class="page-header"><p class="eyebrow">Work Receipt · Step 1 of 2</p><h1>Name the work and add what you have.</h1><p>Describe the working arrangement, then add any conversations, sources, current work, and version history available. Raw conversation and file contents stay on this page. The saved receipt keeps only references, short summaries, and fingerprints.</p></header>
    ${renderError(error)}
    <form id="snapshot-records-form" class="snapshot-form setup-card" novalidate>
      <section aria-labelledby="snapshot-project-heading"><h2 id="snapshot-project-heading" class="form-section-heading">The work</h2>
        <div class="field-grid">
          ${projectChooser}
          <div class="field field-span-2"><label for="snapshot-project-name">Project or work name <span class="required">Required</span></label><input id="snapshot-project-name" name="projectName" value="${escapeHTML(draft.projectName)}" required /></div>
          <div class="field field-span-2"><label for="snapshot-creator-name">Creator name for the Work Receipt <span class="required">Required</span></label><input id="snapshot-creator-name" name="creatorName" value="${escapeHTML(draft.creatorName)}" autocomplete="name" required /><small>Enter the person or group that should appear after “Created by.”</small></div>
          <div class="field"><label for="snapshot-work-type">What kind of work is it? <span class="required">Required</span></label><select id="snapshot-work-type" name="workType" required><option value="">Choose one</option>${selectOptions(WORK_TYPES, draft.workType)}</select></div>
          <div class="field"><label for="snapshot-stage">Where is the work now?</label><select id="snapshot-stage" name="stage">${selectOptions(STAGES, draft.stage)}</select></div>
          <div class="field field-span-2"><label for="snapshot-artifact-url">Link to the finished or current work <span class="helper-text">Optional</span></label><input id="snapshot-artifact-url" name="artifactUrl" type="url" value="${escapeHTML(draft.artifactUrl)}" placeholder="https://" /></div>
          <div class="field field-span-2"><label for="snapshot-github-url">Repository or version history <span class="helper-text">Optional</span></label><input id="snapshot-github-url" name="githubUrl" type="url" value="${escapeHTML(draft.githubUrl)}" placeholder="https://github.com/owner/repository" aria-describedby="snapshot-github-help" /><small id="snapshot-github-help">Use the repository link, such as github.com/name/project, not the public website link above.</small></div>
        </div>
      </section>
      <section aria-labelledby="snapshot-ai-heading"><h2 id="snapshot-ai-heading" class="form-section-heading">The AI setup</h2>
        <div class="field"><label for="snapshot-ai-systems">Which AI tools or models materially contributed? <span class="required">Required</span></label><textarea id="snapshot-ai-systems" name="aiSystemsText" placeholder="One per line. Example: ChatGPT | 6.1 Sol\nClaude | model unknown" required>${escapeHTML(draft.aiSystemsText)}</textarea><small>If you do not know a model, say “model unknown.”</small></div>
        <fieldset class="fieldset" aria-describedby="starting-context-help"><legend>What did the AI already have before you started this project? <span class="required">Required</span></legend><p class="helper-text" id="starting-context-help">Select all that apply.</p><div class="choice-list">${checkboxOptions('startingContext', STARTING_CONTEXT_OPTIONS, draft.startingContext)}</div></fieldset>
        <fieldset class="fieldset" aria-describedby="added-context-help"><legend>What did you add while doing this work? <span class="required">Required</span></legend><p class="helper-text" id="added-context-help">Select all that apply.</p><div class="choice-list">${checkboxOptions('addedContext', ADDED_CONTEXT_OPTIONS, draft.addedContext)}</div></fieldset>
        <fieldset class="fieldset"><legend>What was the highest level of access or action AI had?</legend><div class="choice-list">${radioOptions('accessLevel', ACCESS_LEVEL_OPTIONS, draft.accessLevel)}</div></fieldset>
        <fieldset class="fieldset"><legend>When did AI need your approval?</legend><div class="choice-list">${radioOptions('approvalMode', APPROVAL_MODE_OPTIONS, draft.approvalMode)}</div></fieldset>
        <div class="field"><label for="snapshot-connected-tools">Which connected apps, accounts, or tools could AI use? <span class="helper-text">Optional</span></label><textarea id="snapshot-connected-tools" name="connectedToolsText" placeholder="One per line. Example: GitHub | read and write\nCanva | read and create">${escapeHTML(draft.connectedToolsText)}</textarea><small>Name the access that mattered to this work.</small></div>
      </section>
      <section aria-labelledby="snapshot-records-heading"><h2 id="snapshot-records-heading" class="form-section-heading">The records</h2>
        <div class="field-grid">
          <div class="field field-span-2"><label for="snapshot-conversation-links">AI conversation links <span class="helper-text">Optional</span></label><textarea id="snapshot-conversation-links" name="conversationLinksText" placeholder="One link per line">${escapeHTML(draft.conversationLinksText)}</textarea></div>
          <div class="field field-span-2"><label for="snapshot-conversation-text">Or paste the relevant conversation <span class="helper-text">Optional</span></label><textarea id="snapshot-conversation-text" name="conversationText" placeholder="Paste only the part connected to this work. It will be fingerprinted, then discarded."></textarea></div>
          <div class="field field-span-2"><label for="snapshot-conversation-files">Or choose conversation exports <span class="helper-text">Optional, up to 20 files, 5 MB each</span></label><input id="snapshot-conversation-files" name="conversationFiles" type="file" accept=".txt,.md,.json,text/plain,application/json" multiple aria-describedby="conversation-file-selection" />${selectedFileList('conversation-file-selection', 'Selected conversation files')}${retainedReferenceList(draft.chatReferences.filter(({ url }) => !url), 'chat', 'Already added conversation records')}</div>
          <div class="field field-span-2"><label for="snapshot-source-text">Source material you gave AI <span class="helper-text">Optional</span></label><textarea id="snapshot-source-text" name="sourceText" placeholder="One link or record name per line">${escapeHTML(draft.sourceText)}</textarea></div>
          <div class="field field-span-2"><label for="snapshot-source-files">Or choose source files <span class="helper-text">Optional, up to 20 files, 5 MB each</span></label><input id="snapshot-source-files" name="sourceFiles" type="file" multiple aria-describedby="source-file-selection" />${selectedFileList('source-file-selection', 'Selected source files')}${retainedReferenceList(draft.sourceReferences.filter(({ digest }) => digest), 'source', 'Already added source files')}</div>
          <div class="field field-span-2"><label for="snapshot-other-evidence">Other useful records <span class="helper-text">Optional</span></label><textarea id="snapshot-other-evidence" name="otherEvidenceText" placeholder="Draft history, notes, test results, screenshots, or approval records. One per line.">${escapeHTML(draft.otherEvidenceText)}</textarea>${retainedReferenceList(draft.otherEvidence.filter(({ digest }) => digest), 'other', 'Already added other records')}</div>
        </div>
      </section>
      <div class="form-actions">${exitControl}<button class="button" type="submit">Review the picture <span aria-hidden="true">→</span></button></div>
    </form>
  </div>`;
}

function renderSnapshotStepTwo(main, draft, error = '') {
  const retainedImportedWording = [
    ...uniqueText(draft.retainedBeforeAi),
    ...uniqueText(draft.retainedAiRoles),
    ...uniqueText(draft.retainedHumanRoles),
  ];
  const retainedNotice = retainedImportedWording.length
    ? `<div class="callout" role="note"><p><strong>Some wording came from an older or imported Work Receipt.</strong></p><p>The current choices do not represent it exactly, so evAIdence will keep it unchanged when you save:</p><ul>${retainedImportedWording.map((value) => `<li>${escapeHTML(value)}</li>`).join('')}</ul></div>`
    : '';
  main.innerHTML = `<div class="page snapshot-page">
    <header class="page-header"><p class="eyebrow">Work Receipt · Step 2 of 2</p><h1>Review the picture before saving.</h1><p>Your answers describe the working arrangement. The links and files below are the records you provided. Check both, then save the receipt.</p></header>
    ${renderError(error)}
    <section class="record-panel snapshot-records-review" aria-labelledby="creator-account-heading"><h2 id="creator-account-heading">Your account of the work</h2>${creatorAccountInventory(draft)}</section>
    <section class="record-panel snapshot-records-review" aria-labelledby="records-provided-heading"><h2 id="records-provided-heading">Records provided</h2>${recordInventory(draft)}${recordReviewGroups(draft)}<p class="helper-text">Open a record group to check its filenames and links. Links are saved as references. File and pasted-text fingerprints show what was supplied without storing the content.</p></section>
    ${retainedNotice}
    <form id="snapshot-confirm-form" class="snapshot-form setup-card" novalidate>
      <fieldset class="fieldset"><legend>1. When did AI enter the work?</legend><div class="choice-list">${radioOptions('entryPoint', ENTRY_OPTIONS, draft.entryPoint)}</div></fieldset>
      <fieldset class="fieldset"><legend>2. What did AI materially do?</legend><p class="helper-text">Choose every role that mattered to this version.</p><div class="choice-grid">${checkboxOptions('aiRoles', AI_ROLE_OPTIONS, draft.aiRoles)}</div></fieldset>
      <fieldset class="fieldset"><legend>3. What did you materially do?</legend><p class="helper-text">Choose actions you can personally account for.</p><div class="choice-grid">${checkboxOptions('humanRoles', HUMAN_ROLE_OPTIONS, draft.humanRoles)}</div></fieldset>
      <div class="form-actions"><button class="button button-secondary" type="button" id="snapshot-back">Back</button><button class="button" type="submit">Save Work Receipt <span aria-hidden="true">→</span></button></div>
    </form>
  </div>`;
}

function buildFindings(draft) {
  const findings = [];
  const beforeAi = draftValues(draft.retainedBeforeAi, draft.entryPoint, ENTRY_OPTIONS);
  const aiRoles = draftValues(draft.retainedAiRoles, draft.aiRoles, AI_ROLE_OPTIONS);
  const humanRoles = draftValues(draft.retainedHumanRoles, draft.humanRoles, HUMAN_ROLE_OPTIONS);
  if (draft.chatReferences.length) findings.push({
    topic: 'AI conversations',
    summary: `${recordCountText(draft.chatReferences)}. Raw conversation content is not stored in the receipt.`,
    status: draft.chatReferences.some(({ url, digest }) => url || digest) ? FINDING_STATUS.SHOWN_IN_RECORDS : FINDING_STATUS.CONFIRMED_BY_CREATOR,
    evidenceRefs: draft.chatReferences.map(({ id }) => id),
  });
  else findings.push({ topic: 'AI conversations', summary: 'No conversation record was provided.', status: FINDING_STATUS.UNKNOWN });

  findings.push({ topic: 'What AI started with', summary: labeledValues(draft.startingContext, STARTING_CONTEXT_LABELS).join('; ') || 'Unknown', status: draft.startingContext.includes('unknown') || !draft.startingContext.length ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'What was added during the work', summary: labeledValues(draft.addedContext, ADDED_CONTEXT_LABELS).join('; ') || 'Unknown', status: draft.addedContext.includes('unknown') || !draft.addedContext.length ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'Starting point', summary: beforeAi.join('; ') || 'Not answered', status: draft.entryPoint === 'unknown' && !draft.retainedBeforeAi.length ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'AI work', summary: aiRoles.join('; ') || 'Not identified', status: draft.aiRoles.includes('unknown') && !draft.retainedAiRoles.length ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'Human work', summary: humanRoles.join('; ') || 'Not identified', status: draft.humanRoles.includes('unknown') && !draft.retainedHumanRoles.length ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'What AI could access or do', summary: ACCESS_LEVEL_LABELS[draft.accessLevel] || 'Unknown', status: draft.accessLevel === 'unknown' ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  findings.push({ topic: 'When AI needed approval', summary: APPROVAL_MODE_LABELS[draft.approvalMode] || 'Unknown', status: draft.approvalMode === 'unknown' ? FINDING_STATUS.UNKNOWN : FINDING_STATUS.CONFIRMED_BY_CREATOR });
  if (draft.connectedToolsText.trim()) findings.push({ topic: 'Connected apps or tools', summary: draft.connectedToolsText.split('\n').map((line) => line.trim()).filter(Boolean).join('; '), status: FINDING_STATUS.CONFIRMED_BY_CREATOR });

  if (draft.sourceReferences.length) findings.push({
    topic: 'Source material',
    summary: `${recordCountText(draft.sourceReferences)}. File fingerprints and links are recorded; their contents are not inspected.`,
    status: draft.sourceReferences.some(({ url, digest }) => url || digest) ? FINDING_STATUS.SHOWN_IN_RECORDS : FINDING_STATUS.CONFIRMED_BY_CREATOR,
    evidenceRefs: draft.sourceReferences.map(({ id }) => id),
  });
  else findings.push({ topic: 'Source material', summary: 'No source-material record was added.', status: FINDING_STATUS.UNKNOWN });

  if (draft.githubUrl) findings.push({
    topic: 'Version history',
    summary: 'A repository or version-history link was supplied. This browser preview did not inspect its contents.',
    status: FINDING_STATUS.SHOWN_IN_RECORDS,
    evidenceRefs: ['github-history'],
  });
  if (draft.artifactUrl) findings.push({
    topic: 'Current work',
    summary: 'A link to the current or finished work was supplied. This browser preview did not inspect its contents.',
    status: FINDING_STATUS.SHOWN_IN_RECORDS,
    evidenceRefs: ['current-work'],
  });
  return findings;
}

function snapshotFromDraft(draft) {
  const sourceReferences = draft.sourceReferences;
  const otherEvidence = [...draft.otherEvidence];
  if (draft.githubUrl) otherEvidence.push({ id: 'github-history', label: 'Repository or version history', url: draft.githubUrl, summary: 'Repository or version-history link supplied by the creator.' });
  if (draft.artifactUrl) otherEvidence.push({ id: 'current-work', label: 'Current or finished work', url: draft.artifactUrl });
  return createSnapshot({
    id: draft.editingSnapshotId || undefined,
    projectId: draft.projectId,
    createdAt: draft.snapshotCreatedAt || undefined,
    creatorName: draft.creatorName,
    projectName: draft.projectName,
    workType: draft.workType,
    stage: draft.stage,
    artifactUrl: draft.artifactUrl,
    aiSystems: parseSystems(draft.aiSystemsText),
    aiSetup: deriveLegacyAiSetup(draft.startingContext),
    startingContext: draft.startingContext,
    addedContext: draft.addedContext,
    accessLevel: draft.accessLevel,
    approvalMode: draft.approvalMode,
    connectedTools: draft.connectedToolsText.split('\n').map((line) => line.trim()).filter(Boolean),
    chatReferences: draft.chatReferences,
    sourceReferences,
    githubUrl: draft.githubUrl,
    otherEvidence,
    beforeAi: draftValues(draft.retainedBeforeAi, draft.entryPoint, ENTRY_OPTIONS),
    aiRoles: draftValues(draft.retainedAiRoles, draft.aiRoles, AI_ROLE_OPTIONS),
    humanRoles: draftValues(draft.retainedHumanRoles, draft.humanRoles, HUMAN_ROLE_OPTIONS),
    finalAuthority: authoritySummary(draft.accessLevel, draft.approvalMode),
    findings: buildFindings(draft),
    intent: draft.intent || 'not-answered',
  });
}

function uniqueText(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))];
}

function draftValues(retained, selected, options) {
  const selectedCodes = Array.isArray(selected) ? selected : [selected];
  const unknownLabel = options.find(([code]) => code === 'unknown')?.[1];
  const selectedLabels = labelsFor(selectedCodes, options)
    .filter((label) => !(uniqueText(retained).length && label === unknownLabel));
  return uniqueText([...uniqueText(retained), ...selectedLabels]);
}

function splitOptionValues(values, options, { single = false } = {}) {
  const byLabel = new Map(options.map(([code, label]) => [label, code]));
  const validCodes = new Set(options.map(([code]) => code));
  const selected = [];
  const retained = [];
  uniqueText(values).forEach((value) => {
    const code = validCodes.has(value) ? value : byLabel.get(value);
    if (!code || (single && selected.length)) retained.push(value);
    else if (!selected.includes(code)) selected.push(code);
  });
  return { selected, retained };
}

function referenceDraftLine(reference) {
  return reference?.url || (!reference?.digest ? reference?.label : '') || '';
}

function draftFromSnapshot(snapshot) {
  const otherEvidence = (snapshot.otherEvidence || []).filter((reference) => (
    reference.url !== snapshot.artifactUrl
    && reference.url !== snapshot.githubUrl
    && reference.id !== 'current-work'
    && reference.id !== 'github-history'
  ));
  const chatReferences = snapshot.chatReferences?.length
    ? snapshot.chatReferences
    : snapshot.chatReference
      ? [snapshot.chatReference]
      : [];
  const beforeAiParts = splitOptionValues(snapshot.beforeAi, ENTRY_OPTIONS, { single: true });
  const aiRoleParts = splitOptionValues(snapshot.aiRoles, AI_ROLE_OPTIONS);
  const humanRoleParts = splitOptionValues(snapshot.humanRoles, HUMAN_ROLE_OPTIONS);
  return {
    ...makeDraft(),
    step: 1,
    projectMode: 'existing',
    projectId: snapshot.projectId,
    projectName: snapshot.projectName,
    creatorName: snapshot.creatorName,
    workType: snapshot.workType,
    stage: snapshot.stage,
    artifactUrl: snapshot.artifactUrl,
    githubUrl: snapshot.githubUrl,
    aiSystemsText: (snapshot.aiSystems || []).map(({ product, model }) => `${product}${model ? ` | ${model}` : ''}`).join('\n'),
    startingContext: [...(snapshot.startingContext || [])],
    addedContext: [...(snapshot.addedContext || [])],
    accessLevel: snapshot.accessLevel || 'unknown',
    approvalMode: snapshot.approvalMode || 'unknown',
    connectedToolsText: (snapshot.connectedTools || []).join('\n'),
    conversationLinksText: chatReferences.filter(({ url }) => url).map(({ url }) => url).join('\n'),
    chatReferences: reindexReferences(chatReferences, 'chat'),
    sourceText: (snapshot.sourceReferences || []).map(referenceDraftLine).filter(Boolean).join('\n'),
    sourceReferences: reindexReferences(snapshot.sourceReferences || [], 'source'),
    otherEvidenceText: otherEvidence.map(referenceDraftLine).filter(Boolean).join('\n'),
    otherEvidence,
    entryPoint: beforeAiParts.selected[0] || 'unknown',
    aiRoles: aiRoleParts.selected.length ? aiRoleParts.selected : ['unknown'],
    humanRoles: humanRoleParts.selected.length ? humanRoleParts.selected : ['unknown'],
    retainedBeforeAi: beforeAiParts.retained,
    retainedAiRoles: aiRoleParts.retained,
    retainedHumanRoles: humanRoleParts.retained,
    intent: snapshot.intent || 'not-answered',
    editingSnapshotId: snapshot.id,
    snapshotCreatedAt: snapshot.createdAt,
    savedSnapshotId: '',
  };
}

function findPreviousComparable(history, snapshot) {
  const currentTime = snapshotTime(snapshot);
  return chronologicalSnapshots(history.snapshots)
    .filter((item) => item.id !== snapshot.id && snapshotTime(item) <= currentTime && isComparableSnapshot(item, snapshot))
    .at(-1) || null;
}

function listText(value, key = '') {
  if (key === 'starting-context') return labeledValues(value, STARTING_CONTEXT_LABELS).join('; ') || 'None recorded';
  if (key === 'added-context') return labeledValues(value, ADDED_CONTEXT_LABELS).join('; ') || 'None recorded';
  if (key === 'access-level') return ACCESS_LEVEL_LABELS[value] || 'Unknown';
  if (key === 'approval-mode') return APPROVAL_MODE_LABELS[value] || 'Unknown';
  if (Array.isArray(value)) return value.length ? value.join('; ') : 'None recorded';
  if (value && typeof value === 'object') {
    if (value.percent === null) return 'Not calculated';
    return `${value.shownInRecords} with a record · ${value.confirmedByCreator} creator-confirmed · ${value.unknown} unknown`;
  }
  if (key === 'ai-setup') return AI_SETUP_LABELS[value] || 'Unknown';
  return String(value || 'Not recorded');
}

function naturalList(values) {
  const items = values.filter(Boolean);
  if (items.length < 2) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function hasRole(values, options, code) {
  const label = Object.fromEntries(options)[code];
  return values.includes(code) || values.includes(label);
}

function humanCreditSummary(snapshot) {
  const name = snapshot.creatorName || 'The creator';
  const roles = snapshot.humanRoles || [];
  if (hasRole(roles, HUMAN_ROLE_OPTIONS, 'unknown')) return `${name}'s contribution was not clearly separated in this receipt.`;
  const originated = hasRole(roles, HUMAN_ROLE_OPTIONS, 'originate');
  const directed = hasRole(roles, HUMAN_ROLE_OPTIONS, 'direct');
  const decided = hasRole(roles, HUMAN_ROLE_OPTIONS, 'decide');
  const approved = hasRole(roles, HUMAN_ROLE_OPTIONS, 'approve');
  const clauses = [];
  if (originated && directed) clauses.push('originated and directed this work');
  else if (originated) clauses.push('originated the purpose and main direction');
  else if (directed) clauses.push('directed and redirected the AI');
  if (hasRole(roles, HUMAN_ROLE_OPTIONS, 'sources')) clauses.push('supplied its sources, examples, or requirements');
  if (hasRole(roles, HUMAN_ROLE_OPTIONS, 'create')) clauses.push('created or substantially rewrote part of it');
  if (hasRole(roles, HUMAN_ROLE_OPTIONS, 'verify')) clauses.push('checked important facts, sources, code, links, or behavior');
  if (hasRole(roles, HUMAN_ROLE_OPTIONS, 'authorize')) clauses.push('decided what AI could access or do');
  if (decided && approved) clauses.push('made the final decisions and approved this version');
  else if (decided) clauses.push('made the important final decisions');
  else if (approved) clauses.push('approved this version');
  if (!clauses.length) return `${name}'s contribution was not clearly separated in this receipt.`;
  return `${name} ${naturalList(clauses)}.`;
}

function aiCreditSummary(snapshot) {
  const systems = snapshot.aiSystems.map(({ product, model }) => [product, model].filter(Boolean).join(' ')).join(', ') || 'The AI tool';
  const roles = snapshot.aiRoles || [];
  if (hasRole(roles, AI_ROLE_OPTIONS, 'unknown')) return `${systems}'s contribution was not clearly separated in this receipt.`;
  const phrases = [
    ['challenge', 'challenging ideas and comparing alternatives'],
    ['research', 'research or source checking'],
    ['organize', 'organization and outlining'],
    ['draft', 'drafting'],
    ['edit', 'editing'],
    ['code', 'code'],
    ['test', 'testing'],
    ['act', 'actions through connected tools or accounts'],
  ].filter(([code]) => hasRole(roles, AI_ROLE_OPTIONS, code)).map(([, phrase]) => phrase);
  if (!phrases.length) return `${systems}'s contribution was not clearly separated in this receipt.`;
  return `${systems} assisted with ${naturalList(phrases)}.`;
}

function workCreditsText(snapshot) {
  const creator = snapshot.creatorName || 'Creator name not provided';
  const date = new Date(snapshot.createdAt).toLocaleDateString();
  return `${snapshot.projectName}\nCreated by ${creator}\n\n${humanCreditSummary(snapshot)} ${aiCreditSummary(snapshot)}\n\nevAIdence Work Receipt · ${date}`;
}

function workCreditsHTML(snapshot) {
  const creator = snapshot.creatorName || 'Creator name not provided';
  return `<div class="work-credits"><p class="kicker">${escapeHTML(snapshot.projectName)}</p><h3>Created by ${escapeHTML(creator)}</h3><p>${escapeHTML(humanCreditSummary(snapshot))}</p><p>${escapeHTML(aiCreditSummary(snapshot))}</p><p class="receipt-meta">evAIdence Work Receipt · ${escapeHTML(new Date(snapshot.createdAt).toLocaleDateString())}</p></div>`;
}

function snapshotCreditsSequence(snapshot, duplicate = false) {
  const systems = snapshot.aiSystems.map(({ product, model }) => [product, model].filter(Boolean).join(' · ')).join('; ') || 'AI system not identified';
  const creator = snapshot.creatorName || 'Creator name not provided';
  const coverage = evidenceCoverage(snapshot);
  return `<div class="credits-sequence"${duplicate ? ' aria-hidden="true"' : ''}>
    <p class="credits-overline">evAIdence Work Receipt</p>
    <h2>${escapeHTML(snapshot.projectName)}</h2>
    <div class="credits-entry"><p>Created by</p><strong>${escapeHTML(creator)}</strong><span>${escapeHTML(humanCreditSummary(snapshot))}</span></div>
    <div class="credits-entry"><p>AI assistance</p><strong>${escapeHTML(systems)}</strong><span>${escapeHTML(aiCreditSummary(snapshot))}</span></div>
    <div class="credits-entry"><p>Approval boundary</p><strong>Set by the creator</strong><span>${escapeHTML(APPROVAL_MODE_LABELS[snapshot.approvalMode] || snapshot.finalAuthority || 'Unknown')}</span></div>
    <div class="credits-entry credits-evidence"><p>Basis for the findings</p><strong>${coverage.shownInRecords} finding${coverage.shownInRecords === 1 ? '' : 's'} with a record · ${coverage.confirmedByCreator} confirmed by the creator · ${coverage.unknown} unknown</strong></div>
    <p class="credits-end">End of Work Receipt</p>
  </div>`;
}

function changeTable(comparison) {
  if (!comparison.comparable || !comparison.changes.length) return '';
  return `<p class="table-scroll-cue">Swipe or scroll to compare all columns.</p><div class="table-scroll" role="region" aria-label="Changes between Work Receipts" tabindex="0"><table class="change-table"><caption class="sr-only">Changes between the earlier and current Work Receipt</caption><thead><tr><th scope="col">Area</th><th scope="col">Earlier</th><th scope="col">Current</th></tr></thead><tbody>${comparison.changes.map((change) => `<tr><th scope="row">${escapeHTML(change.label)}</th><td>${escapeHTML(listText(change.before, change.key))}</td><td>${escapeHTML(listText(change.after, change.key))}</td></tr>`).join('')}</tbody></table></div>`;
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
    <header class="page-header"><p class="eyebrow">evAIdence Work Receipt saved</p><h1>${escapeHTML(headline)}</h1><p>${comparison.baseline ? 'Save another Work Receipt for comparable work and evAIdence will show what moved.' : 'The comparison describes movement in the recorded relationship. It does not grade the change as good or bad.'}</p></header>
    <div class="snapshot-result-grid">
      <aside class="credits-screen snapshot-credits" aria-label="Scrolling credits for this Work Receipt">
        <div class="credits-screen-toolbar"><span>Credits for this Work Receipt</span><button class="credits-motion-toggle" id="snapshot-credits-toggle" type="button">Pause credits</button></div>
        <div class="credits-viewport"><div class="credits-track">${snapshotCreditsSequence(snapshot)}${snapshotCreditsSequence(snapshot, true)}</div></div>
      </aside>
      <section class="record-panel" aria-labelledby="snapshot-summary-heading"><h2 id="snapshot-summary-heading">What this Work Receipt shows</h2>
        <dl class="record-facts"><div><dt>Project</dt><dd>${escapeHTML(snapshot.projectName)}</dd></div><div><dt>Work type</dt><dd>${escapeHTML(WORK_TYPE_LABELS[snapshot.workType] || snapshot.workType)}</dd></div><div><dt>Saved</dt><dd>${escapeHTML(new Date(snapshot.createdAt).toLocaleString())}</dd></div><div><dt>Basis provided</dt><dd>${coverage.coveredFindings} of ${coverage.totalFindings} findings</dd></div><div><dt>Findings with a record</dt><dd>${coverage.shownInRecords}</dd></div><div><dt>Confirmed by creator</dt><dd>${coverage.confirmedByCreator}</dd></div><div><dt>Unknown</dt><dd>${coverage.unknown}</dd></div></dl>
        <p class="helper-text"><strong>These counts are not an authorship or trust score.</strong> They separate what supplied records show, what the creator confirmed, and what remains unknown.</p>
      </section>
    </div>
    ${comparison.comparable && comparison.changes.length ? `<section class="section-inline" aria-labelledby="snapshot-changes-heading"><p class="kicker">Compared with ${escapeHTML(new Date(previous.createdAt).toLocaleDateString())}</p><h2 id="snapshot-changes-heading">Here is what moved.</h2>${changeTable(comparison)}<form id="snapshot-intent-form" class="intent-form"><fieldset class="fieldset"><legend>Was this change intentional?</legend><div class="choice-list choice-list-inline">${radioOptions('intent', [['intentional', 'Yes'], ['not-intentional', 'No'], ['unsure', 'Not sure']], snapshot.intent)}</div></fieldset><button class="button button-secondary" type="submit">Save this answer</button></form><div class="callout"><p><strong>Does the current arrangement still fit what matters in this work and what you can personally judge?</strong></p><p>If the answer is unclear, use the optional Load Test for a closer look at capacity, workflow, and consequences.</p><a href="#/load-test">Run a Load Test</a></div></section>` : ''}
    <section class="section-inline" aria-labelledby="snapshot-findings-heading"><h2 id="snapshot-findings-heading">Findings and their basis</h2><ul class="finding-list">${snapshot.findings.map((finding) => `<li><div><strong>${escapeHTML(finding.topic)}</strong><p>${escapeHTML(finding.summary)}</p></div><span class="status-pill status-${escapeHTML(finding.status)}">${escapeHTML(FINDING_LABELS[finding.status])}</span></li>`).join('')}</ul></section>
    <section class="section-inline disclosure-box" aria-labelledby="work-credits-heading"><h2 id="work-credits-heading">Work credits</h2>${workCreditsHTML(snapshot)}</section>
    <div class="button-row no-print"><button class="button" type="button" id="create-detailed-work-record">Create Detailed Work Record</button><button class="button button-secondary" type="button" id="edit-snapshot-information">Edit information</button><button class="button button-secondary" type="button" id="add-snapshot-records">Add or change records</button><button class="button button-secondary" type="button" id="download-snapshot">Export private receipt data</button><button class="button button-secondary" type="button" id="copy-work-credits">Copy work credits</button><button class="button button-secondary" type="button" id="print-snapshot">Print or save PDF</button><a class="button button-secondary" href="#/changes">View my changes</a><button class="text-button" type="button" id="new-snapshot">Start another Work Receipt</button></div>
    <section class="section-inline feedback-prompt no-print" aria-labelledby="snapshot-feedback-heading"><p class="kicker">Review the founding preview</p><h2 id="snapshot-feedback-heading">Was evAIdence useful?</h2><p>Use this short Google Form to tell me what was clear, confusing, or missing. Your feedback will help make evAIdence more meaningful before public release.</p><a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Review this preview <span class="new-tab-note">(opens a Google Form in a new tab)</span></a></section>
  </div>`;

  const credits = document.querySelector('.snapshot-credits');
  document.querySelector('#snapshot-credits-toggle')?.addEventListener('click', (event) => {
    const paused = credits.classList.toggle('credits-paused');
    event.currentTarget.textContent = paused ? 'Resume credits' : 'Pause credits';
  });
  document.querySelector('#download-snapshot')?.addEventListener('click', () => {
    if (!window.confirm('This private export can include conversation, source, repository, and work links. Save or share it only where you intend to keep that information.')) return;
    downloadText(`${slug(snapshot.projectName)}-evaidence-private-work-receipt.json`, JSON.stringify(snapshot, null, 2));
  });
  document.querySelector('#copy-work-credits')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(workCreditsText(snapshot));
      showToast('Work credits copied.');
    } catch {
      showToast('Copy was unavailable. Select the work credits instead.');
    }
  });
  document.querySelector('#print-snapshot')?.addEventListener('click', () => window.print());
  document.querySelector('#create-detailed-work-record')?.addEventListener('click', () => {
    if (typeof onCreateWorkRecord !== 'function' || onCreateWorkRecord(snapshot) === false) return;
    location.hash = '#/detailed-record';
  });
  const beginEdit = (focusId) => {
    saveDraft(draftFromSnapshot(snapshot));
    renderSnapshotPage(main, { showToast, onCreateWorkRecord, knownProjects });
    window.requestAnimationFrame(() => document.querySelector(focusId)?.focus());
  };
  document.querySelector('#edit-snapshot-information')?.addEventListener('click', () => beginEdit('#snapshot-project-name'));
  document.querySelector('#add-snapshot-records')?.addEventListener('click', () => beginEdit('#snapshot-conversation-links'));
  document.querySelector('#new-snapshot')?.addEventListener('click', () => {
    localStorage.removeItem(DRAFT_KEY);
    location.hash = '#/snapshot';
    renderSnapshotPage(main, { showToast, onCreateWorkRecord, knownProjects });
    window.requestAnimationFrame(() => document.querySelector('#snapshot-project-name')?.focus());
  });
  document.querySelector('#snapshot-intent-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const intent = new FormData(event.currentTarget).get('intent');
    if (!intent) return showToast('Choose whether the change was intentional.');
    const updated = appendSnapshot(history, { id: snapshot.id, intent });
    if (!saveJSON(HISTORY_KEY, updated)) {
      showToast('The answer could not be saved in this browser.');
      return;
    }
    const saved = updated.snapshots.find(({ id }) => id === snapshot.id);
    if (saved) Object.assign(snapshot, saved);
    showToast('Intent saved with this Work Receipt.');
  });
}

function bindExclusiveCheckboxes(form, name, exclusiveValues) {
  if (!form) return;
  const inputs = [...form.querySelectorAll(`input[name="${name}"]`)];
  inputs.forEach((input) => input.addEventListener('change', () => {
    if (!input.checked) return;
    if (exclusiveValues.includes(input.value)) {
      inputs.forEach((candidate) => {
        if (candidate !== input) candidate.checked = false;
      });
      return;
    }
    inputs.forEach((candidate) => {
      if (exclusiveValues.includes(candidate.value)) candidate.checked = false;
    });
  }));
}

function bindFileSelection(input, list) {
  if (!input || !list) return;
  input?.addEventListener('change', () => {
    const files = [...(input.files || [])];
    list.innerHTML = files.map((file) => `<li>${escapeHTML(file.name)} <span>${escapeHTML(`${file.size.toLocaleString()} bytes`)}</span></li>`).join('');
  });
}

export function renderSnapshotPage(main, { showToast = () => {}, onCreateWorkRecord, knownProjects = [] } = {}) {
  document.title = 'New Work Receipt | evAIdence';
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
    const confirmForm = document.querySelector('#snapshot-confirm-form');
    bindExclusiveCheckboxes(confirmForm, 'aiRoles', ['unknown']);
    bindExclusiveCheckboxes(confirmForm, 'humanRoles', ['unknown']);
    document.querySelector('#snapshot-back')?.addEventListener('click', () => {
      draft.step = 1;
      saveDraft(draft);
      renderSnapshotPage(main, { showToast, onCreateWorkRecord, knownProjects });
      window.requestAnimationFrame(() => document.querySelector('#snapshot-project-name')?.focus());
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
        showFormError(event.currentTarget, 'This browser could not save the Work Receipt. Export other browser data or free some browser storage and try again.');
        return;
      }
      draft = {
        ...draft,
        step: 3,
        editingSnapshotId: snapshot.id,
        snapshotCreatedAt: snapshot.createdAt,
        savedSnapshotId: snapshot.id,
      };
      saveDraft(draft);
      renderSnapshotResult(main, snapshot, updatedHistory, showToast, onCreateWorkRecord, knownProjects);
      main.focus();
    });
  };

  const bindStepOne = () => {
    const projectsById = new Map(availableProjects(history, knownProjects).map((project) => [project.projectId, project]));
    const recordsForm = document.querySelector('#snapshot-records-form');
    bindExclusiveCheckboxes(recordsForm, 'startingContext', ['nothing-added', 'unknown']);
    bindExclusiveCheckboxes(recordsForm, 'addedContext', ['nothing-else', 'unknown']);
    bindFileSelection(recordsForm?.elements.conversationFiles, document.querySelector('#conversation-file-selection'));
    bindFileSelection(recordsForm?.elements.sourceFiles, document.querySelector('#source-file-selection'));
    document.querySelector('#cancel-snapshot-edit')?.addEventListener('click', () => {
      if (!window.confirm('Return to the saved Work Receipt and discard changes on this page?')) return;
      draft = { ...draft, step: 3, savedSnapshotId: draft.editingSnapshotId };
      saveDraft(draft);
      renderSnapshotPage(main, { showToast, onCreateWorkRecord, knownProjects });
      main.focus();
    });
    document.querySelectorAll('[data-remove-reference]').forEach((button) => button.addEventListener('click', () => {
      const kind = button.dataset.removeReference;
      const referenceId = button.dataset.referenceId;
      if (kind === 'chat') draft.chatReferences = draft.chatReferences.filter(({ id }) => id !== referenceId);
      if (kind === 'source') draft.sourceReferences = draft.sourceReferences.filter(({ id }) => id !== referenceId);
      if (kind === 'other') draft.otherEvidence = draft.otherEvidence.filter(({ id }) => id !== referenceId);
      saveDraft(draft);
      const list = button.closest('ul');
      button.closest('li')?.remove();
      if (list && !list.children.length) list.closest('.retained-records')?.remove();
      showToast('Record removed from this draft.');
      const focusSelector = ({ chat: '#snapshot-conversation-files', source: '#snapshot-source-files', other: '#snapshot-other-evidence' })[kind];
      window.requestAnimationFrame(() => document.querySelector(focusSelector)?.focus());
    }));
    document.querySelector('#snapshot-project-choice')?.addEventListener('change', (event) => {
      const projectId = String(event.currentTarget.value || '');
      const previousProjectId = draft.projectMode === 'existing' ? draft.projectId : '';
      if (projectId === previousProjectId) return;
      const currentForm = event.currentTarget.form;
      const currentValues = new FormData(currentForm);
      const hasEnteredInformation = Boolean(
        ['projectName', 'creatorName', 'workType', 'artifactUrl', 'githubUrl', 'aiSystemsText', 'connectedToolsText', 'conversationLinksText', 'conversationText', 'sourceText', 'otherEvidenceText']
          .some((name) => String(currentValues.get(name) || '').trim()) ||
        currentForm.elements.conversationFiles.files?.length || currentForm.elements.sourceFiles.files?.length ||
        draft.chatReferences.length || draft.sourceReferences.length || draft.otherEvidence.length,
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
        creatorName: project.creatorName || project.creator?.name || '',
        workType: project.workType,
        stage: project.stage,
      };
      saveDraft(draft);
      renderSnapshotPage(main, { showToast, onCreateWorkRecord, knownProjects });
      showToast('Project selected. Review the current details before saving this Work Receipt.');
      window.requestAnimationFrame(() => document.querySelector('#snapshot-project-name')?.focus());
    });
    document.querySelector('#snapshot-records-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const projectName = String(formData.get('projectName') || '').trim();
      const creatorName = String(formData.get('creatorName') || '').trim();
      const workType = String(formData.get('workType') || '');
      const aiSystemsText = String(formData.get('aiSystemsText') || '').trim();
      const startingContext = formData.getAll('startingContext').map(String);
      const addedContext = formData.getAll('addedContext').map(String);
      const artifactUrlText = String(formData.get('artifactUrl') || '').trim();
      const githubUrlText = String(formData.get('githubUrl') || '').trim();
      const conversationLinksText = String(formData.get('conversationLinksText') || '').trim();
      const sourceText = String(formData.get('sourceText') || '');
      const otherEvidenceText = String(formData.get('otherEvidenceText') || '');
      const accessLevel = String(formData.get('accessLevel') || 'unknown');
      const approvalMode = String(formData.get('approvalMode') || 'unknown');
      if (!projectName || !creatorName || !workType || !aiSystemsText || !startingContext.length || !addedContext.length) {
        showFormError(form, 'Add the project name, creator name, work type, AI tool or model, starting context, and what you added.');
        form.querySelector(':invalid')?.focus();
        return;
      }
      if (artifactUrlText && !safeHttpUrl(artifactUrlText)) {
        showFormError(form, 'Correct or remove the finished-work link. It must begin with http:// or https://.');
        return;
      }
      if (githubUrlText && !safeHttpUrl(githubUrlText)) {
        showFormError(form, 'Correct or remove the repository or version-history link. It must begin with http:// or https://.');
        return;
      }
      const invalidConversationLink = invalidReferenceLine(conversationLinksText, { linksOnly: true });
      if (invalidConversationLink) {
        showFormError(form, `Correct or remove this AI conversation link: ${invalidConversationLink}`);
        return;
      }
      const invalidNamedLink = invalidReferenceLine(`${sourceText}\n${otherEvidenceText}`);
      if (invalidNamedLink) {
        showFormError(form, `Correct or remove this link: ${invalidNamedLink}`);
        return;
      }
      if ((accessLevel === 'external-action' && approvalMode === 'no-external-actions')
        || (accessLevel === 'chat-only' && !['no-external-actions', 'unknown'].includes(approvalMode))) {
        showFormError(form, 'The access and approval answers conflict. Review what AI could do and when it needed approval.');
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
        const chatReferences = await buildChatReferences(form, draft.chatReferences);
        const sourceFiles = await buildFileReferences(form.elements.sourceFiles.files, 'source-file', 'Source file');
        draft = {
          ...draft,
          step: 2,
          projectMode,
          projectId,
          projectName,
          creatorName,
          workType,
          stage: String(formData.get('stage') || 'build'),
          artifactUrl: safeHttpUrl(artifactUrlText),
          githubUrl: safeHttpUrl(githubUrlText),
          aiSystemsText,
          startingContext,
          addedContext,
          accessLevel,
          approvalMode,
          connectedToolsText: String(formData.get('connectedToolsText') || ''),
          conversationLinksText,
          conversationText: '',
          chatReferences,
          sourceText,
          sourceReferences: reindexReferences(mergeReferences(
            retainedReferences(draft.sourceReferences, parseReferenceLines(sourceText, 'source-note', 'Linked source material'), { preserveDigests: true }),
            [...parseReferenceLines(sourceText, 'source-note', 'Linked source material'), ...sourceFiles],
          ), 'source'),
          otherEvidenceText,
          otherEvidence: reindexReferences(mergeReferences(
            retainedReferences(draft.otherEvidence, parseReferenceLines(otherEvidenceText, 'other-record'), { preserveDigests: true }),
            parseReferenceLines(otherEvidenceText, 'other-record'),
          ), 'other'),
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
    main.innerHTML = `<div class="page"><header class="page-header"><p class="eyebrow">My changes</p><h1>Each project starts with its own baseline.</h1><p>No Work Receipts are stored in this browser yet.</p></header><a class="button" data-new-snapshot href="#/snapshot">Create your first Work Receipt</a></div>`;
    main.querySelector('[data-new-snapshot]')?.addEventListener('click', () => localStorage.removeItem(DRAFT_KEY));
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
    <section class="section-inline" aria-labelledby="snapshot-history-heading"><h2 id="snapshot-history-heading">Work Receipts for ${escapeHTML(projectName)}</h2><div class="snapshot-history-list">${[...projectSnapshots].reverse().map((snapshot) => { const coverage = evidenceCoverage(snapshot); return `<article class="card"><p class="kicker">${isProjectBaseline(history, snapshot) ? 'Baseline' : escapeHTML(new Date(snapshot.createdAt).toLocaleDateString())}</p><h3>${escapeHTML(snapshot.projectName || 'Unnamed work')}</h3><p>${escapeHTML(WORK_TYPE_LABELS[snapshot.workType] || snapshot.workType || 'Work type not recorded')} · ${escapeHTML(STAGE_LABELS[snapshot.stage] || snapshot.stage || 'Stage unknown')}</p><dl class="mini-facts"><div><dt>Starting context</dt><dd>${escapeHTML(labeledValues(snapshot.startingContext, STARTING_CONTEXT_LABELS).join('; ') || AI_SETUP_LABELS[snapshot.aiSetup] || 'Unknown')}</dd></div><div><dt>Basis provided</dt><dd>${coverage.coveredFindings} of ${coverage.totalFindings} findings</dd></div><div><dt>Unknown</dt><dd>${coverage.unknown}</dd></div></dl></article>`; }).join('')}</div></section>
    <div class="button-row"><a class="button" data-new-snapshot href="#/snapshot">Create another Work Receipt</a><button class="button button-secondary" id="export-snapshot-history" type="button">Export private history</button><button class="button button-secondary" id="import-snapshot-history-trigger" type="button">Import history</button><input id="import-snapshot-history" type="file" accept="application/json" hidden /><button class="text-button danger-link" id="clear-snapshot-history" type="button">Erase this browser history</button></div>
    ${comparison.comparable ? `<section class="section-inline feedback-prompt" aria-labelledby="changes-feedback-heading"><p class="kicker">Review the founding preview</p><h2 id="changes-feedback-heading">Was this comparison useful?</h2><p>Use this short Google Form to tell me what was clear, confusing, or missing. Your feedback will help make evAIdence more meaningful before public release.</p><a class="button button-secondary" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noreferrer">Review this preview <span class="new-tab-note">(opens a Google Form in a new tab)</span></a></section>` : ''}
  </div>`;
  document.querySelector('#changes-project-choice')?.addEventListener('change', (event) => {
    renderChangesPage(main, { showToast, selectedProjectId: String(event.currentTarget.value || '') });
    main.focus();
  });
  main.querySelector('[data-new-snapshot]')?.addEventListener('click', () => localStorage.removeItem(DRAFT_KEY));
  document.querySelector('#export-snapshot-history')?.addEventListener('click', () => downloadText('evaidence-private-work-receipt-history.json', exportSnapshotHistory(history)));
  document.querySelector('#import-snapshot-history-trigger')?.addEventListener('click', () => document.querySelector('#import-snapshot-history')?.click());
  document.querySelector('#import-snapshot-history')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = importSnapshotHistory(await file.text());
      if (!window.confirm(`Replace this browser's ${history.snapshots.length} saved Work Receipt${history.snapshots.length === 1 ? '' : 's'} with the ${imported.snapshots.length} Work Receipt${imported.snapshots.length === 1 ? '' : 's'} in this file?`)) return;
      if (!saveJSON(HISTORY_KEY, imported)) {
        showToast('This browser could not save the imported Work Receipt history.');
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      renderChangesPage(main, { showToast });
      showToast('Work Receipt history imported.');
    } catch (error) {
      showToast(error.message || 'That history file could not be imported.');
    }
  });
  document.querySelector('#clear-snapshot-history')?.addEventListener('click', () => {
    if (!window.confirm('Erase every evAIdence Work Receipt saved in this browser? Export first if you may need them later.')) return;
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(DRAFT_KEY);
    renderChangesPage(main, { showToast });
    showToast('Work Receipt history erased from this browser.');
  });
}

