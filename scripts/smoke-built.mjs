import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { HtmlValidate } from 'html-validate';

const assets = path.resolve('dist/assets');
const bundleName = fs.readdirSync(assets).find((name) => /^index-.*\.js$/.test(name));
assert.ok(bundleName, 'Built JavaScript bundle not found. Run npm run build first.');
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

const routes = [
  { name: 'home', route: '#/', expected: 'Your credibility is being questioned.' },
  { name: 'record-step-1', route: '#/creation-record', expected: 'Identify the work and its exact version.' },
  { name: 'sample', route: '#/sample', expected: 'How this website was made.' },
  { name: 'load-test', route: '#/load-test', expected: 'When are you checking the arrangement?' },
  { name: 'legacy-check-route', route: '#/check', expected: 'When are you checking the arrangement?' },
  { name: 'copyright', route: '#/copyright', expected: 'Copyright protects the expression, not the method.' },
  {
    name: 'check-missing-legacy-authority',
    route: '#/check',
    expected: '<dt>Requested AI authority</dt><dd>Not recorded</dd>',
    forbidden: '<dt>Requested AI authority</dt><dd>Produce for human approval</dd>',
    initial: {
      localStorage: {
        'ai-reliance-check:v0.2': JSON.stringify({
          schemaVersion: 2,
          methodVersion: '0.2',
          completed: true,
          stage: 'release',
          project: { name: 'Legacy authority check', system: 'Legacy AI', systems: [], proposedAuthority: '' },
          answers: {},
        }),
      },
    },
  },
  {
    name: 'check-explicit-legacy-authority',
    route: '#/load-test',
    expected: '<dt>Requested AI authority</dt><dd>Produce for human approval</dd>',
    initial: {
      localStorage: {
        'ai-reliance-check:v0.2': JSON.stringify({
          schemaVersion: 2,
          methodVersion: '0.2',
          completed: true,
          stage: 'release',
          project: { name: 'Explicit authority check', system: 'Legacy AI', systems: [], proposedAuthority: 'A1' },
          answers: {},
        }),
      },
    },
  },
  { name: 'method', route: '#/method', expected: 'Follow the work, not the writing style.' },
  { name: 'research', route: '#/research', expected: 'Practice-based, then compared with established work.' },
  { name: 'examples', route: '#/examples', expected: 'Different work needs different records and boundaries.' },
  { name: 'pricing', route: '#/pricing', expected: 'Full access is open during the Founding Preview.' },
  { name: 'faq', route: '#/faq', expected: 'Plain answers about what this tool can and cannot say.' },
];

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
  [2, 'What should this record support?'],
  [3, 'Give the credits.'],
  [4, 'Connect claims to evidence.'],
  [5, 'Create the detailed credits.'],
  [6, 'Review the record and name the release decision.'],
  [7, 'Your credits and evidence are ready to review.'],
]) {
  routes.push({
    name: `record-step-${step}`,
    route: '#/creation-record',
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
