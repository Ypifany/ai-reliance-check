import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalProjectId } from '../src/project-identity.js';
import { normalizeSnapshot } from '../src/snapshot-history.js';
import { normalizeWorkRecord } from '../src/work-record.js';

test('project identities normalize the same way across Snapshots and Work Records', () => {
  const rawId = 'client project 1';
  const snapshot = normalizeSnapshot({ id: 'snapshot-one', projectId: rawId, projectName: 'Client work' });
  const record = normalizeWorkRecord({ id: 'record-one', projectId: rawId, title: 'Client work' });

  assert.equal(canonicalProjectId(rawId), 'client-project-1');
  assert.equal(snapshot.projectId, 'client-project-1');
  assert.equal(record.projectId, snapshot.projectId);
});

test('project identity normalization preserves already safe ids and rejects blanks', () => {
  assert.equal(canonicalProjectId('project_Client-1'), 'project_Client-1');
  assert.equal(canonicalProjectId('   '), '');
  assert.equal(canonicalProjectId('123 client'), 'project-123-client');
});
