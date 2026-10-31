import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { HtmlValidate } from 'html-validate';
import { getAssessmentScopeKey } from '../src/questions.js';

const assets = path.resolve('dist/assets');
const appSource = fs.readFileSync(path.resolve('src/app.js'), 'utf8');
const snapshotUiSource = fs.readFileSync(path.resolve('src/snapshot-ui.js'), 'utf8');
const indexSource = fs.readFileSync(path.resolve('index.html'), 'utf8');
assert.match(indexSource, /<nav id="site-nav"[^>]*>[\s\S]*href="#\/pricing">Pricing<\/a>/, 'Pricing must appear in the primary navigation');
assert.match(indexSource, /Founding Preview v0\.5\. Free access for now\./, 'The top notice must state that access is currently free');
assert.match(indexSource, /No payment is required to use this version\./, 'The free-access notice must explain what free means');
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
assert.match(appSource, /Records provided/, 'The public copy must use the approved records label');
assert.match(appSource, /projectId: makeId\('project'\)/, 'A Load Test must keep a project identity separate from its check identity');
assert.doesNotMatch(appSource, /creationRecord\.projectId = assessment\.id/, 'A Load Test must not replace the stable project identity');
assert.match(appSource, /same exact work version/, 'A Snapshot must not silently merge into a Work Record for another version');
assert.match(appSource, /AI can help with the work\. It should not cost you your credibility\./, 'The homepage must lead with the credibility risk that brings a visitor to evAIdence');
assert.match(appSource, /A receipt for work made with AI/, 'The homepage must identify the product at first glance');
assert.match(appSource, /document\.title = 'evAIdence \| Protect your credibility when AI helps'/, 'The loaded homepage title must keep the credibility promise');
assert.match(appSource, /Created by Cheryl Abram\./, 'The homepage must identify the creator');
assert.match(appSource, /https:\/\/www\.ypifany\.org\/about/, 'The homepage must link to the creator’s About page');
assert.match(appSource, /Before You Ship<\/strong> will be a separate tool for AI-assisted software projects\./, 'The homepage must describe Before You Ship in plain language');
assert.doesNotMatch(appSource, /will use the same evAIdence record|own focused experience instead of making this one harder to use/, 'The homepage must not promise an integration or use unclear product language');
assert.match(snapshotUiSource, /name="creatorName"/, 'A Work Receipt must collect the creator name');
assert.match(snapshotUiSource, /checkboxOptions\('startingContext'/, 'Starting AI context must permit more than one answer');
assert.match(snapshotUiSource, /checkboxOptions\('addedContext'/, 'Context added during the work must permit more than one answer');
assert.match(snapshotUiSource, /radioOptions\('accessLevel'/, 'AI access and action must be recorded separately');
assert.match(snapshotUiSource, /radioOptions\('approvalMode'/, 'The human approval boundary must be recorded separately');
assert.match(
  snapshotUiSource,
  /name="conversationFiles"[^>]*multiple/,
  'A Work Receipt must accept more than one conversation export',
);
assert.match(snapshotUiSource, /\['AI conversations', recordCountText\(draft\.chatReferences\)\]/, 'Conversation records must use the provided-versus-named count');
assert.match(snapshotUiSource, /return parts\.join\('; '\) \|\| 'Not provided';/, 'Missing records must be labeled Not provided');
assert.match(snapshotUiSource, /<h2 id="work-credits-heading">Work credits<\/h2>/, 'The saved result must show human-first Work credits');
assert.match(snapshotUiSource, /with a record ·.*creator-confirmed ·.*unknown/, 'Change comparisons must show how the evidence basis changed, not only a combined coverage total');
assert.match(snapshotUiSource, /id="edit-snapshot-information">Edit information<\/button>/, 'The saved result must let the creator edit its information');
assert.match(snapshotUiSource, /id="add-snapshot-records">Add or change records<\/button>/, 'The saved result must let the creator add or change records');
assert.match(snapshotUiSource, /saveDraft\(draftFromSnapshot\(snapshot\)\);/, 'Editing must reopen the saved receipt rather than an unrelated browser draft');
assert.match(snapshotUiSource, /beforeAi: draftValues\(draft\.retainedBeforeAi, draft\.entryPoint, ENTRY_OPTIONS\)/, 'Editing must preserve imported starting-point wording the current choices cannot represent');
assert.match(snapshotUiSource, /aiRoles: draftValues\(draft\.retainedAiRoles, draft\.aiRoles, AI_ROLE_OPTIONS\)/, 'Editing must preserve imported AI-role wording the current choices cannot represent');
assert.match(snapshotUiSource, /humanRoles: draftValues\(draft\.retainedHumanRoles, draft\.humanRoles, HUMAN_ROLE_OPTIONS\)/, 'Editing must preserve imported human-role wording the current choices cannot represent');
const builtIndex = fs.readFileSync(path.resolve('dist/index.html'), 'utf8');
assert.match(builtIndex, /<title>evAIdence \| Protect your credibility when AI helps<\/title>/, 'The page title must lead with credibility, not change tracking');
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
  generic.elements = {
    conversationFiles: { ...generic, files: [] },
    sourceFiles: { ...generic, files: [] },
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
  { name: 'home', route: '#/', expected: 'AI can help with the work. It should not cost you your credibility.' },
  { name: 'home-product', route: '#/', expected: 'A receipt for work made with AI' },
  { name: 'home-human-first', route: '#/', expected: 'A Work Receipt connects the credits to records from the work.' },
  { name: 'home-founder', route: '#/', expected: 'Created by Cheryl Abram.' },
  { name: 'home-feedback', route: '#/', expected: 'Was evAIdence useful?' },
  { name: 'snapshot-step-1', route: '#/snapshot', expected: 'Name the work and add what you have.' },
  { name: 'legacy-creation-record-route', route: '#/creation-record', expected: 'Name the work and add what you have.' },
  { name: 'changes-empty', route: '#/changes', expected: 'Each project starts with its own baseline.' },
  { name: 'detailed-record-step-1', route: '#/detailed-record', expected: 'What work are you documenting?' },
  { name: 'sample', route: '#/sample', expected: 'Community Grant Guide' },
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
  { name: 'method', route: '#/method', expected: 'Create one clear Work Receipt. Return later to see what changed.' },
  { name: 'research', route: '#/research', expected: 'Informed by provenance, contributor roles, appropriate reliance, and human oversight.' },
  { name: 'examples', route: '#/examples', expected: 'See what a Work Receipt can reveal.' },
  { name: 'pricing', route: '#/pricing', expected: 'Full access is open during the Founding Preview.' },
  { name: 'faq', route: '#/faq', expected: 'Plain answers about what this tool can and cannot say.' },
];

const snapshotHistory = {
  schemaVersion: 3,
  baselineId: 'snapshot-january',
  snapshots: [
    {
      schemaVersion: 3,
      id: 'snapshot-january',
      projectId: 'project-comparable-writing',
      createdAt: '2026-01-15T12:00:00.000Z',
      creatorName: 'Jordan Ellis',
      projectName: 'Comparable writing project',
      workType: 'writing',
      stage: 'build',
      aiSystems: [{ product: 'Example AI', model: 'Example model' }],
      aiSetup: 'regular-chat',
      startingContext: ['nothing-added'],
      addedContext: ['conversation'],
      accessLevel: 'chat-only',
      approvalMode: 'no-external-actions',
      connectedTools: [],
      chatReferences: [],
      beforeAi: ['The human outlined first'],
      aiRoles: ['Edit'],
      humanRoles: ['Draft'],
      finalAuthority: 'Human approved the work',
      findings: [],
      intent: 'not-answered',
    },
    {
      schemaVersion: 3,
      id: 'snapshot-october',
      projectId: 'project-comparable-writing',
      createdAt: '2026-10-15T12:00:00.000Z',
      creatorName: 'Jordan Ellis',
      projectName: 'Comparable writing project',
      workType: 'writing',
      stage: 'build',
      aiSystems: [{ product: 'Example AI', model: 'Example model' }],
      aiSetup: 'regular-chat',
      startingContext: ['nothing-added'],
      addedContext: ['conversation'],
      accessLevel: 'chat-only',
      approvalMode: 'no-external-actions',
      connectedTools: [],
      chatReferences: [],
      beforeAi: ['The human outlined first'],
      aiRoles: ['Draft'],
      humanRoles: ['Draft'],
      finalAuthority: 'Human approved the work',
      findings: [],
      intent: 'not-answered',
    },
  ],
};
const outOfOrderSnapshotHistory = structuredClone(snapshotHistory);
outOfOrderSnapshotHistory.snapshots.reverse();

routes.push({
  name: 'changes-with-comparable-history',
  route: '#/changes',
  expected: '1 tracked change for Comparable writing project.',
  initial: {
    localStorage: { 'evaidence:snapshots:v1': JSON.stringify(snapshotHistory) },
  },
});

routes.push({
  name: 'changes-project-selector',
  route: '#/changes',
  expected: 'Project to compare',
  initial: {
    localStorage: { 'evaidence:snapshots:v1': JSON.stringify(snapshotHistory) },
  },
});

routes.push({
  name: 'changes-out-of-order-import',
  route: '#/changes',
  expected: '1 tracked change for Comparable writing project.',
  initial: {
    localStorage: { 'evaidence:snapshots:v1': JSON.stringify(outOfOrderSnapshotHistory) },
  },
});

routes.push({
  name: 'snapshot-existing-project-choice',
  route: '#/snapshot',
  expected: 'Continue: Comparable writing project',
  initial: {
    localStorage: { 'evaidence:snapshots:v1': JSON.stringify(snapshotHistory) },
  },
});

routes.push({
  name: 'snapshot-result-to-detailed-record',
  route: '#/snapshot',
  expected: 'evAIdence Work Receipt saved',
  initial: {
    localStorage: {
      'evaidence:snapshots:v1': JSON.stringify(snapshotHistory),
      'evaidence:snapshot-draft:v1': JSON.stringify({ step: 3, savedSnapshotId: 'snapshot-october' }),
    },
  },
});

for (const [name, expected] of [
  ['snapshot-result-work-credits', 'Work credits'],
  ['snapshot-result-edit', 'Edit information'],
  ['snapshot-result-add-records', 'Add or change records'],
]) {
  routes.push({
    name,
    route: '#/snapshot',
    expected,
    initial: {
      localStorage: {
        'evaidence:snapshots:v1': JSON.stringify(snapshotHistory),
        'evaidence:snapshot-draft:v1': JSON.stringify({ step: 3, savedSnapshotId: 'snapshot-october' }),
      },
    },
  });
}

routes.push({
  name: 'snapshot-review-no-conversation',
  route: '#/snapshot',
  expected: 'AI conversations</dt><dd>Not provided',
  initial: {
    localStorage: {
      'evaidence:snapshot-draft:v1': JSON.stringify({
        step: 2,
        projectId: 'project-no-conversation',
        projectName: 'No conversation example',
        creatorName: 'Jordan Ellis',
        workType: 'writing',
        stage: 'build',
        aiSystemsText: 'Example AI | Example model',
        startingContext: ['nothing-added'],
        addedContext: ['conversation'],
        accessLevel: 'chat-only',
        approvalMode: 'no-external-actions',
        chatReferences: [],
        sourceReferences: [],
        otherEvidence: [],
      }),
    },
  },
});

routes.push({
  name: 'legacy-output-only-does-not-invent-chat-access',
  route: '#/snapshot',
  expected: 'name="accessLevel" value="unknown" checked',
  forbidden: 'name="accessLevel" value="chat-only" checked',
  initial: {
    localStorage: {
      'evaidence:snapshot-draft:v1': JSON.stringify({ authority: 'output-only' }),
    },
  },
});

for (const expected of [
  'Some wording came from an older or imported Work Receipt.',
  'Custom imported AI role',
]) {
  routes.push({
    name: `snapshot-retains-imported-role-${expected.startsWith('Custom') ? 'value' : 'notice'}`,
    route: '#/snapshot',
    expected,
    initial: {
      localStorage: {
        'evaidence:snapshot-draft:v1': JSON.stringify({
          step: 2,
          projectId: 'project-imported-role',
          projectName: 'Imported role example',
          creatorName: 'Jordan Ellis',
          workType: 'writing',
          aiSystemsText: 'Example AI | Example model',
          startingContext: ['unknown'],
          addedContext: ['unknown'],
          accessLevel: 'unknown',
          approvalMode: 'unknown',
          chatReferences: [],
          sourceReferences: [],
          otherEvidence: [],
          entryPoint: 'unknown',
          aiRoles: ['unknown'],
          humanRoles: ['unknown'],
          retainedAiRoles: ['Custom imported AI role'],
        }),
      },
    },
  });
}

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

routes.push({
  name: 'snapshot-can-continue-work-record-project',
  route: '#/snapshot',
  expected: 'Continue: Smoke test work',
  initial: {
    localStorage: { 'ai-reliance-check:work-record:v0.3': JSON.stringify(smokeRecord) },
  },
});

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
