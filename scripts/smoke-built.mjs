import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { HtmlValidate } from 'html-validate';
import { getAssessmentScopeKey } from '../src/questions.js';

const assets = path.resolve('dist/assets');
const appSource = fs.readFileSync(path.resolve('src/app.js'), 'utf8');
assert.doesNotMatch(appSource, /href=["']#raise-score["']/, 'The score-actions control must not replace the hash route');
assert.doesNotMatch(
  appSource,
  /what AI (?:can reasonably be|should be) allowed to do|decide what role AI should have/i,
  'The Load Test must describe the load and wager instead of acting as a permission giver',
);
assert.match(
  appSource,
  /The Load Test does not decide whether you proceed\./,
  'The Load Test must state that the decision remains with the person',
);
assert.match(
  appSource,
  /The Load Test records those references but does not inspect them\./,
  'The Load Test must not present user-identified records as independently verified',
);
assert.match(
  appSource,
  /What work did you personally do to make or check this project\?/,
  'The Before Launch setup must ask plainly what the person did',
);
assert.doesNotMatch(
  appSource,
  /How do you know these details are accurate\?|Evidence about this system in this role|Which AI systems and models are being used\?|Was AI used in the documented workflow\?/,
  'The system-record question must not use the old ambiguous wording',
);
assert.match(
  appSource,
  /Do you have a saved record showing what this AI used, what job it did, or what it produced\?/,
  'The Before Launch setup must ask plainly what records of AI use exist',
);
assert.match(appSource, /I’m working on it now/, 'The Load Test must include a work-in-progress stage');
assert.match(appSource, /Who works directly with this AI tool\?/, 'The setup must identify who directly uses each AI tool');
assert.match(appSource, /About this project/, 'The setup must open with a plain project heading');
assert.doesNotMatch(appSource, /Describe the work and the result you are counting on/, 'The setup must not use the old abstract project heading');
assert.match(
  appSource,
  /return renderSetup\(errors, errors\[0\]\?\.id \|\| ''\);/,
  'A setup validation error must focus the exact field that needs attention',
);
for (const fieldId of ['approval-field', 'reversible-field', 'data-authorization-field', 'monitoring-field']) {
  assert.match(appSource, new RegExp(`toggleConditionalField\\('${fieldId}'`), `${fieldId} must be disabled when hidden`);
}
assert.doesNotMatch(appSource, /human-ai-work-check-assessment/, 'New exports must use the Load Test name');
const builtIndex = fs.readFileSync(path.resolve('dist/index.html'), 'utf8');
const bundleName = builtIndex.match(/assets\/(index-[^"']+\.js)/)?.[1];
assert.ok(bundleName, 'Built JavaScript bundle not found in dist/index.html. Run npm run build first.');
const bundle = fs.readFileSync(path.join(assets, bundleName), 'utf8')
  .replaceAll('import.meta.url', '"https://example.test/assets/index.js"');

function storage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function renderRoute(hash, initial = {}) {
  let rendered = '';
  const listeners = new Map();
  const classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const generic = {
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute() { return ''; },
    hasAttribute() { return false; },
    querySelector() { return generic; },
    querySelectorAll() { return []; },
    focus() {},
    scrollIntoView() {},
    click() {},
    classList,
    dataset: {},
    style: {},
    relList: { supports: () => true },
    textContent: '',
    hidden: false,
    disabled: false,
    inert: false,
  };
  const main = { ...generic };
  Object.defineProperty(main, 'innerHTML', {
    get: () => rendered,
    set: (value) => { rendered = String(value); },
  });
  main.querySelector = () => generic;

  const document = {
    title: '',
    body: { classList },
    activeElement: generic,
    createElement: () => ({ ...generic }),
    querySelector: (selector) => ({
      '#main-content': main,
      '#site-nav': generic,
      '.menu-button': generic,
      '#toast': generic,
      '.site-footer': generic,
    }[selector] || generic),
    querySelectorAll: () => [],
    getElementById: () => generic,
    addEventListener() {},
  };
  const location = { hash };
  const window = {
    document,
    location,
    navigator: { clipboard: { writeText: async () => {} } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: (callback) => callback(),
    addEventListener: (name, callback) => listeners.set(name, callback),
    clearTimeout,
    setTimeout,
    confirm: () => true,
    print() {},
  };
  const context = {
    window,
    document,
    location,
    navigator: window.navigator,
    localStorage: storage(initial.localStorage),
    sessionStorage: storage(initial.sessionStorage),
    MutationObserver: class { observe() {} },
    Blob,
    URL,
    setTimeout,
    clearTimeout,
    console,
  };
  vm.runInNewContext(bundle, context, { filename: bundleName, timeout: 3000 });
  return rendered;
}

const completedLoadTestAnswers = Object.fromEntries(
  ['HUM1', 'HUM3', 'CAP1', 'CAP2', 'BEH1', 'WF1', 'WF2', 'OUT1']
    .map((id) => [id, { level: 100, basis: 'confirmed', evidenceNote: `Current record for ${id}` }]),
);

const completedLoadTest = {
  schemaVersion: 4,
  methodVersion: '0.5',
  id: 'load-test-smoke',
  stage: 'release',
  completed: true,
  completedAt: '2026-10-15T12:00:00.000Z',
  updatedAt: '2026-10-15T12:00:00.000Z',
  project: {
    name: 'Completed Load Test example',
    task: 'Prepare and publish a short public guide.',
    aiUseFocus: 'making',
    intendedOutcome: 'Readers can follow the guide without being misled.',
    humanLoad: 'A capable person must check the claims, links, wording, and final release.',
    humanActivities: [],
    otherHumanInvolved: 'no',
    otherHumanRole: '',
    otherHumanActivities: [],
    humanOther: 'A capable person must check the claims, links, wording, and final release.',
    failureScenario: 'A serious unsupported claim reaches readers.',
    failureImpact: 'Readers could make a poor decision and the creator could lose credibility.',
    consequence: 'moderate',
    proposedAuthority: 'A1',
    systems: [{
      id: 'system-smoke',
      product: 'Example AI',
      model: 'Example model',
      role: 'Draft and organize the guide for human approval',
      operator: 'me',
      operatorRole: '',
      checker: 'me',
      checkerRole: '',
      checkerScope: 'Check the claims, links, wording, and final release',
      proposedAuthority: 'A1',
      connectedAccess: false,
      permissionsConfirmed: true,
      setup: 'Uses supplied source material and written acceptance criteria.',
      evidence: 'Saved test and draft record',
      evidenceBasis: 'confirmed',
    }],
    primarySystemId: 'system-smoke',
    workTypes: ['creative'],
    requiredBehaviors: ['follow'],
    connectedAccess: false,
    permissionsConfirmed: true,
    humanApprovalBeforeConsequence: true,
    sensitiveData: false,
    dataAuthorizationConfirmed: null,
    unresolvedMaterialFailure: false,
    actionsAreReversible: true,
    monitoringConfirmed: false,
    reviewEvidenceBasis: 'confirmed',
    reviewEvidenceNote: 'Saved approval and safeguard review',
    reviewEvidenceUrl: '',
    qualifiedIndependentReview: false,
  },
  answers: completedLoadTestAnswers,
};
completedLoadTest.scopeKey = getAssessmentScopeKey(completedLoadTest);
Object.values(completedLoadTest.answers).forEach((answer) => {
  answer.status = 'known';
  answer.scopeKey = completedLoadTest.scopeKey;
});

const unknownLoadTest = structuredClone(completedLoadTest);
unknownLoadTest.id = 'load-test-unknown-smoke';
unknownLoadTest.project.systems[0].operator = 'unknown';
unknownLoadTest.project.systems[0].operatorRole = '';
unknownLoadTest.project.systems[0].checker = 'unknown';
unknownLoadTest.project.systems[0].checkerScope = '';
unknownLoadTest.scopeKey = getAssessmentScopeKey(unknownLoadTest);
Object.values(unknownLoadTest.answers).forEach((answer) => {
  answer.scopeKey = unknownLoadTest.scopeKey;
});

const routes = [
  { name: 'home', route: '#/', expected: 'See how your work with AI changes.' },
  { name: 'home-short-path', route: '#/', expected: 'Bring the records. Check the picture. Save the change.' },
  { name: 'home-neutral-change', route: '#/', expected: 'It shows what moved so you can decide whether the change was intentional and still fits the work.' },
  { name: 'home-feedback', route: '#/', expected: 'Try a Snapshot, then tell me how it went.' },
  { name: 'snapshot-step-1', route: '#/snapshot', expected: 'Add the records you already have.' },
  { name: 'legacy-creation-record-route', route: '#/creation-record', expected: 'Add the records you already have.' },
  { name: 'changes-empty', route: '#/changes', expected: 'Your first snapshot becomes the baseline.' },
  { name: 'detailed-record-step-1', route: '#/detailed-record', expected: 'What work are you documenting?' },
  { name: 'sample', route: '#/sample', expected: 'One writer. Two snapshots. A changed relationship with AI.' },
  { name: 'load-test', route: '#/load-test', expected: 'How far along is the work?' },
  { name: 'load-test-result-copy', route: '#/load-test', expected: 'You get more than a score.', forbidden: 'You will not get only a score.' },
  { name: 'load-test-load-framing', route: '#/load-test', expected: 'what the role you gave AI requires from you and anyone else doing or checking the work' },
  { name: 'load-test-decision-boundary', route: '#/load-test', expected: 'The Load Test does not decide whether you proceed.' },
  {
    name: 'completed-load-test-wager',
    route: '#/load-test',
    expected: 'Your wager if you continue as-is',
    forbidden: 'what AI can reasonably be allowed to do',
    initial: {
      localStorage: { 'ai-reliance-check:v0.2': JSON.stringify(completedLoadTest) },
    },
  },
  {
    name: 'unknown-load-test-withholds-score',
    route: '#/load-test',
    expected: 'Not enough information to calculate a score',
    forbidden: 'Supported for this exact setup',
    initial: {
      localStorage: { 'ai-reliance-check:v0.2': JSON.stringify(unknownLoadTest) },
    },
  },
  {
    name: 'completed-load-test-human-load',
    route: '#/load-test',
    expected: 'What a capable person still needs to do',
    initial: {
      localStorage: { 'ai-reliance-check:v0.2': JSON.stringify(completedLoadTest) },
    },
  },
  {
    name: 'completed-load-test-human-decision',
    route: '#/load-test',
    expected: 'The Load Test does not decide whether you proceed.',
    initial: {
      localStorage: { 'ai-reliance-check:v0.2': JSON.stringify(completedLoadTest) },
    },
  },
  {
    name: 'completed-load-test-record-limit',
    route: '#/load-test',
    expected: 'The Load Test records those references but does not inspect them.',
    initial: {
      localStorage: { 'ai-reliance-check:v0.2': JSON.stringify(completedLoadTest) },
    },
  },
  { name: 'legacy-check-route', route: '#/check', expected: 'How far along is the work?' },
  { name: 'copyright', route: '#/copyright', expected: 'Copyright protects the expression, not the method.' },
  {
    name: 'incomplete-completed-check',
    route: '#/load-test',
    expected: 'How far along is the work?',
    forbidden: '<p class="eyebrow">Result</p>',
    initial: {
      localStorage: {
        'ai-reliance-check:v0.2': JSON.stringify({
          schemaVersion: 2,
          methodVersion: '0.2',
          completed: true,
          stage: 'release',
          project: { name: 'Incomplete check', system: 'Example AI', systems: [], proposedAuthority: 'A1' },
          answers: {},
        }),
      },
    },
  },
  { name: 'method', route: '#/method', expected: 'Create one clear Snapshot. Return later to see what changed.' },
  { name: 'research', route: '#/research', expected: 'Informed by provenance, contributor roles, appropriate reliance, and human oversight.' },
  { name: 'examples', route: '#/examples', expected: 'See what a Snapshot can reveal.' },
  { name: 'pricing', route: '#/pricing', expected: 'Full access is open during the Founding Preview.' },
  { name: 'faq', route: '#/faq', expected: 'Plain answers about what this tool can and cannot say.' },
];

const snapshotHistory = {
  schemaVersion: 1,
  baselineId: 'snapshot-january',
  snapshots: [
    {
      schemaVersion: 1,
      id: 'snapshot-january',
      createdAt: '2026-01-15T12:00:00.000Z',
      projectName: 'Comparable writing project',
      workType: 'writing',
      stage: 'build',
      aiSystems: [{ product: 'Example AI', model: 'Example model' }],
      aiSetup: 'regular-chat',
      beforeAi: ['The human outlined first'],
      aiRoles: ['Edit'],
      humanRoles: ['Draft'],
      finalAuthority: 'Human approved the work',
      findings: [],
      intent: 'not-answered',
    },
    {
      schemaVersion: 1,
      id: 'snapshot-october',
      createdAt: '2026-10-15T12:00:00.000Z',
      projectName: 'Comparable writing project',
      workType: 'writing',
      stage: 'build',
      aiSystems: [{ product: 'Example AI', model: 'Example model' }],
      aiSetup: 'regular-chat',
      beforeAi: ['The human outlined first'],
      aiRoles: ['Draft'],
      humanRoles: ['Draft'],
      finalAuthority: 'Human approved the work',
      findings: [],
      intent: 'not-answered',
    },
  ],
};

routes.push({
  name: 'changes-with-comparable-history',
  route: '#/changes',
  expected: '1 tracked change in the latest comparable work.',
  initial: {
    localStorage: { 'evaidence:snapshots:v1': JSON.stringify(snapshotHistory) },
  },
});

const smokeRecord = {
  schemaVersion: 3,
  id: 'record-smoke',
  status: 'in-progress',
  title: 'Smoke test work',
  description: 'A safe fixture for built-route checks.',
  creator: { name: 'Test creator', role: 'Creator' },
  artifact: { url: '', version: '', date: '' },
  voiceRequired: 'no',
  capabilityDemonstration: 'no',
  aiUse: 'yes',
  modelHistoryCompleteness: 'complete',
  humanActions: 'Directed and reviewed the work.',
  aiContributions: 'Assisted with organization.',
  systems: [{ id: 'system-smoke', product: 'Test AI', model: 'Test model', role: 'Organized material', evidenceBasis: 'reported' }],
  contributorStatus: 'none',
  contributors: [],
  publicEvidenceLevel: 'selected',
  contributions: { idea: 'Human-led' },
  claims: [{ id: 'claim-smoke', statement: 'The creator directed the work.', category: 'direction', evidenceIds: ['evidence-smoke'] }],
  evidence: [{ id: 'evidence-smoke', label: 'Test record', description: 'Documents direction.', visibility: 'private', integrity: 'unlinked', relationship: 'supports', claimIds: ['claim-smoke'] }],
  review: { status: 'self-reviewed', visibility: 'private', claimIds: [], allClaims: false },
  finalDecision: { name: '', role: '', date: '' },
};

for (const [step, expected] of [
  [2, 'What do you want this record to show?'],
  [3, 'Give the credits.'],
  [4, 'What records support your statements?'],
  [5, 'Who handled each part of the work?'],
  [6, 'Review the record and name who approved this version.'],
  [7, 'Your credits and evidence are ready to review.'],
]) {
  routes.push({
    name: `record-step-${step}`,
    route: '#/detailed-record',
    expected,
    initial: {
      localStorage: { 'ai-reliance-check:work-record:v0.3': JSON.stringify(smokeRecord) },
      sessionStorage: { 'human-ai-work-record:step': String(step) },
    },
  });
}

const htmlValidate = new HtmlValidate({ rules: { 'doctype-style': 'off', 'void-style': 'off' } });

for (const { name, route, expected, forbidden, initial } of routes) {
  const html = renderRoute(route, initial);
  assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name} did not render its expected heading`);
  if (forbidden) assert.doesNotMatch(html, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name} rendered forbidden content`);
  const report = await htmlValidate.validateString(`<!doctype html><html lang="en"><head><title>Route check</title></head><body><main>${html}</main></body></html>`);
  assert.equal(report.valid, true, `${name} rendered invalid HTML:\n${report.results.flatMap(({ messages }) => messages.map(({ line, column, message }) => `${line}:${column} ${message}`)).join('\n')}`);
}

console.log(`Built-route smoke test passed for ${routes.length} route states.`);
