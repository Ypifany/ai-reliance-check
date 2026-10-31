import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeSnapshotIntoWorkRecord, workRecordFromSnapshot } from '../src/snapshot-work-record.js';

const NOW = '2026-10-31T12:00:00.000Z';

function deterministicOptions() {
  let count = 0;
  return {
    now: NOW,
    idFactory: (prefix) => `${prefix}-${++count}`,
  };
}

function snapshot(overrides = {}) {
  return {
    schemaVersion: 2,
    id: 'snapshot-one',
    projectId: 'project-one',
    createdAt: NOW,
    projectName: 'Research guide',
    workType: 'writing',
    stage: 'release',
    artifactUrl: 'https://example.com/guide',
    aiSystems: [{ product: 'ChatGPT', model: '6.1 Sol' }],
    aiSetup: 'context-enabled-chat',
    chatReference: { id: 'chat-one', label: 'Development conversation', url: 'https://example.com/chat' },
    sourceReferences: [{ id: 'source-one', label: 'Source notes', digest: 'sha256:abc' }],
    githubUrl: 'https://github.com/example/guide',
    otherEvidence: [
      { id: 'github-copy', label: 'GitHub repository', url: 'https://github.com/example/guide' },
      { id: 'artifact-copy', label: 'Current work', url: 'https://example.com/guide' },
      { id: 'decision-one', label: 'Approval note', summary: 'Creator approved the direction.' },
    ],
    beforeAi: ['The human chose the purpose before AI entered'],
    aiRoles: ['Organize and revise'],
    humanRoles: ['Direct, evaluate, and approve'],
    finalAuthority: 'AI produced responses but could not publish.',
    findings: [],
    intent: 'intentional',
    ...overrides,
  };
}

test('a Snapshot starts a conservative Detailed Work Record for the same project', () => {
  const record = workRecordFromSnapshot(snapshot(), deterministicOptions());

  assert.equal(record.projectId, 'project-one');
  assert.equal(record.title, 'Research guide');
  assert.equal(record.workType, 'Writing, research, or publishing');
  assert.equal(record.description, '');
  assert.equal(record.status, 'ready');
  assert.equal(record.artifact.url, 'https://example.com/guide');
  assert.equal(record.aiUse, 'yes');
  assert.equal(record.systems[0].product, 'ChatGPT');
  assert.match(record.systems[0].setup, /saved instructions/i);
  assert.match(record.systems[0].setup, /could not publish/i);
  assert.equal(record.ideaSource, 'The human chose the purpose before AI entered');
  assert.equal(record.humanActions, 'Direct, evaluate, and approve');
  assert.equal(record.aiContributions, 'Organize and revise');
  assert.equal(record.readiness.stage, 'release');
  assert.equal(record.readiness.workCheckId, '');
  assert.equal(record.creator.name, '');
  assert.deepEqual(record.claims, []);
  assert.equal(record.evidence.length, 4);
  assert.ok(record.evidence.every(({ visibility, integrity, relationship }) => visibility === 'private' && integrity === 'unlinked' && relationship === 'unknown'));
  assert.equal(record.evidence.some(({ url }) => url === 'https://example.com/guide'), false);
});

test('adding another Snapshot for the same project preserves Work Record edits', () => {
  const existing = workRecordFromSnapshot(snapshot(), deterministicOptions());
  existing.title = 'Human-edited title';
  existing.description = 'Human-edited description';
  existing.humanActions = 'A specific human account.';
  existing.systems[0].role = 'Human-edited AI role';
  existing.evidence[0].visibility = 'public';

  const merged = mergeSnapshotIntoWorkRecord(existing, snapshot({
    id: 'snapshot-two',
    sourceReferences: [
      ...snapshot().sourceReferences,
      { id: 'source-two', label: 'Second source', url: 'https://example.com/source-two' },
    ],
    humanRoles: ['A newer generic role'],
  }), deterministicOptions());

  assert.equal(merged.title, 'Human-edited title');
  assert.equal(merged.description, 'Human-edited description');
  assert.equal(merged.humanActions, 'A specific human account.');
  assert.equal(merged.systems[0].role, 'Human-edited AI role');
  assert.equal(merged.evidence.find(({ url }) => url === 'https://example.com/chat').visibility, 'public');
  assert.equal(merged.evidence.some(({ url }) => url === 'https://example.com/source-two'), true);
});

test('a Snapshot cannot silently merge into another project record', () => {
  const existing = workRecordFromSnapshot(snapshot(), deterministicOptions());
  assert.throws(
    () => mergeSnapshotIntoWorkRecord(existing, snapshot({ projectId: 'project-two' }), deterministicOptions()),
    /different projects/i,
  );
});
