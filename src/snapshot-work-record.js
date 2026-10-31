import { normalizeSnapshot } from './snapshot-history.js';
import { createWorkRecord, normalizeWorkRecord } from './work-record.js';

const WORK_TYPE_LABELS = Object.freeze({
  writing: 'Writing, research, or publishing',
  software: 'Website, application, code, or configuration',
  training: 'Training or learning material',
  creative: 'Image, audio, video, or design',
  decision: 'Analysis, recommendation, or decision',
  other: 'Other work',
});

const AI_SETUP_LABELS = Object.freeze({
  'regular-chat': 'A fresh conversation with no added context',
  'context-enabled-chat': 'Saved instructions, memory, files, tools, or project context',
  'custom-ai': 'A custom assistant, GPT, or agent',
  multiple: 'More than one setup',
  unknown: 'AI setup not identified',
});

const STARTING_CONTEXT_LABELS = Object.freeze({
  'nothing-added': 'Nothing the creator added before the project began',
  'saved-instructions-memory': 'Saved instructions or memory',
  'custom-ai': 'A custom GPT, assistant, or agent',
  'existing-project-workspace': 'An existing project or workspace',
  'prior-conversations': 'Earlier conversations about this work',
  'connected-apps-tools': 'Connected apps, accounts, or tools',
  'legacy-context-enabled': 'Earlier record: saved context was available, but details were not recorded',
  'legacy-multiple': 'Earlier record: more than one setup was used, but details were not recorded',
  unknown: 'Starting context not identified',
});

const ADDED_CONTEXT_LABELS = Object.freeze({
  conversation: 'Prompts or conversation',
  documents: 'Documents or source material',
  links: 'Links or websites',
  examples: 'Examples or templates',
  instructions: 'New instructions or requirements',
  'connected-apps-tools': 'Connected apps, accounts, or tools',
  'nothing-else': 'Nothing else was added',
  unknown: 'What was added is unknown',
});

const ACCESS_LEVEL_LABELS = Object.freeze({
  'chat-only': 'Respond in the conversation only',
  read: 'Read files, pages, or connected apps',
  create: 'Create drafts, files, images, or code',
  'edit-run': 'Change files or code and run tools or tests',
  'external-action': 'Send, publish, submit, deploy, or change a connected service',
  unknown: 'Access level not identified',
});

const APPROVAL_MODE_LABELS = Object.freeze({
  'per-change': 'Approval required before each change outside the conversation',
  'before-external-action': 'Approval required before sending, publishing, submitting, or deploying',
  'standing-permission': 'Could act within previously approved limits',
  'no-external-actions': 'Could not change anything outside the conversation or workspace',
  unknown: 'Approval boundary not identified',
});

const STATUS_BY_STAGE = Object.freeze({
  plan: 'in-progress',
  build: 'in-progress',
  release: 'ready',
  live: 'released',
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function joined(values) {
  return Array.isArray(values) ? values.map(text).filter(Boolean).join('; ') : '';
}

function evidenceKey(item) {
  const url = text(item?.url).toLocaleLowerCase();
  if (url) return `url:${url}`;
  return `record:${[item?.label, item?.version, item?.description].map(text).join('|').toLocaleLowerCase()}`;
}

function referenceToEvidence(reference, fallbackLabel) {
  if (!reference) return null;
  const label = text(reference.label) || fallbackLabel;
  const description = text(reference.summary);
  const url = text(reference.url);
  const version = text(reference.digest || reference.version);
  if (!label && !description && !url && !version) return null;
  return {
    label: label || fallbackLabel,
    description,
    url,
    version,
    date: text(reference.date),
    visibility: 'private',
    integrity: 'unlinked',
    relationship: 'unknown',
    claimIds: [],
  };
}

function snapshotEvidence(snapshot) {
  const candidates = [];
  const chatReferences = snapshot.chatReferences?.length
    ? snapshot.chatReferences
    : snapshot.chatReference
      ? [snapshot.chatReference]
      : [];
  chatReferences.forEach((reference) => {
    const chat = referenceToEvidence(reference, 'AI conversation');
    if (chat) candidates.push(chat);
  });
  snapshot.sourceReferences.forEach((reference) => {
    const item = referenceToEvidence(reference, 'Source material');
    if (item) candidates.push(item);
  });
  if (snapshot.githubUrl) candidates.push({
    label: 'Repository or version history',
    description: 'Repository or version-history link supplied with the Work Receipt. Its contents were not inspected.',
    url: snapshot.githubUrl,
    version: '',
    date: '',
    visibility: 'private',
    integrity: 'unlinked',
    relationship: 'unknown',
    claimIds: [],
  });
  snapshot.otherEvidence.forEach((reference) => {
    if (reference.url && reference.url === snapshot.artifactUrl) return;
    const item = referenceToEvidence(reference, 'Supporting record');
    if (item) candidates.push(item);
  });

  const seen = new Set();
  return candidates.filter((item) => {
    const key = evidenceKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mappedSystems(snapshot) {
  const roles = joined(snapshot.aiRoles);
  const role = snapshot.aiSystems.length > 1 && roles
    ? `Roles recorded across the listed AI tools: ${roles}`
    : roles;
  const arrangementDetails = [
    snapshot.startingContext?.length
      ? `Starting context: ${snapshot.startingContext.map((value) => STARTING_CONTEXT_LABELS[value] || value).join('; ')}`
      : AI_SETUP_LABELS[snapshot.aiSetup] || snapshot.aiSetup,
    snapshot.addedContext?.length
      ? `Added during the work: ${snapshot.addedContext.map((value) => ADDED_CONTEXT_LABELS[value] || value).join('; ')}`
      : '',
    snapshot.accessLevel ? `Access or action level: ${ACCESS_LEVEL_LABELS[snapshot.accessLevel] || snapshot.accessLevel}` : '',
    snapshot.approvalMode ? `Approval boundary: ${APPROVAL_MODE_LABELS[snapshot.approvalMode] || snapshot.approvalMode}` : '',
    snapshot.connectedTools?.length ? `Connected apps or tools: ${snapshot.connectedTools.join('; ')}` : '',
    snapshot.finalAuthority ? `Authorization recorded in the Work Receipt: ${snapshot.finalAuthority}` : '',
  ].filter(Boolean).join('. ');
  const setup = snapshot.aiSystems.length > 1 && arrangementDetails
    ? `Overall arrangement across the listed AI tools; per-tool access was not recorded: ${arrangementDetails}`
    : arrangementDetails;
  return snapshot.aiSystems.map(({ product, model }) => ({
    product,
    model,
    role,
    setup,
    evidenceBasis: 'reported',
    evidence: '',
    modelHistory: 'unknown',
  }));
}

export function workRecordFromSnapshot(snapshotInput, options = {}) {
  const snapshot = normalizeSnapshot(snapshotInput, options);
  const record = createWorkRecord({
    ...options,
    projectId: snapshot.projectId,
  });
  return normalizeWorkRecord({
    ...record,
    projectId: snapshot.projectId,
    status: STATUS_BY_STAGE[snapshot.stage] || 'in-progress',
    title: snapshot.projectName,
    workType: WORK_TYPE_LABELS[snapshot.workType] || snapshot.workType,
    description: '',
    creator: { name: snapshot.creatorName, role: 'Creator' },
    artifact: { url: snapshot.artifactUrl, version: '', date: '' },
    aiUse: snapshot.aiSystems.length || snapshot.aiRoles.length ? 'yes' : 'unknown',
    modelHistoryCompleteness: 'unknown',
    ideaSource: joined(snapshot.beforeAi),
    humanActions: joined(snapshot.humanRoles),
    aiContributions: joined(snapshot.aiRoles),
    systems: mappedSystems(snapshot),
    evidence: snapshotEvidence(snapshot),
    readiness: { workCheckId: '', stage: snapshot.stage, decision: '', checkedAt: '' },
  }, options);
}

function mergeSystems(existing, incoming) {
  const result = existing.map((item) => ({ ...item }));
  incoming.forEach((item) => {
    const key = `${text(item.product)}\u0000${text(item.model)}`.toLocaleLowerCase();
    const match = result.find((candidate) => `${text(candidate.product)}\u0000${text(candidate.model)}`.toLocaleLowerCase() === key);
    if (!match) {
      result.push(item);
      return;
    }
    for (const field of ['role', 'setup', 'evidence']) {
      if (!text(match[field]) && text(item[field])) match[field] = item[field];
    }
    if (match.evidenceBasis === 'unknown' && item.evidenceBasis !== 'unknown') match.evidenceBasis = item.evidenceBasis;
  });
  return result;
}

function mergeEvidence(existing, incoming) {
  const result = existing.map((item) => ({ ...item }));
  incoming.forEach((item) => {
    const key = evidenceKey(item);
    const match = result.find((candidate) => evidenceKey(candidate) === key);
    if (!match) {
      result.push(item);
      return;
    }
    for (const field of ['label', 'description', 'url', 'version', 'date']) {
      if (!text(match[field]) && text(item[field])) match[field] = item[field];
    }
  });
  return result;
}

export function mergeSnapshotIntoWorkRecord(recordInput, snapshotInput, options = {}) {
  const current = normalizeWorkRecord(recordInput, options);
  const incoming = workRecordFromSnapshot(snapshotInput, options);
  if (current.projectId && incoming.projectId && current.projectId !== incoming.projectId) {
    throw new Error('The Work Receipt and Detailed Work Record belong to different projects.');
  }
  return normalizeWorkRecord({
    ...current,
    projectId: current.projectId || incoming.projectId,
    title: current.title || incoming.title,
    workType: current.workType || incoming.workType,
    description: current.description || incoming.description,
    artifact: {
      url: current.artifact?.url || incoming.artifact?.url || '',
      version: current.artifact?.version || '',
      date: current.artifact?.date || '',
    },
    aiUse: current.aiUse === 'unknown' ? incoming.aiUse : current.aiUse,
    ideaSource: current.ideaSource || incoming.ideaSource,
    humanActions: current.humanActions || incoming.humanActions,
    aiContributions: current.aiContributions || incoming.aiContributions,
    systems: mergeSystems(current.systems, incoming.systems),
    evidence: mergeEvidence(current.evidence, incoming.evidence),
    readiness: {
      ...current.readiness,
      stage: current.readiness?.stage || incoming.readiness?.stage || '',
    },
  }, options);
}
