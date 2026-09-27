const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { complete } = require('../v1-form-fixtures.cjs');

const root = path.resolve(__dirname, '../..');
const tick = () => new Promise(resolve => setImmediate(resolve));

// This small DOM fixture exercises the real controller, adapter, integration and
// renderer. Layout is explicitly simulated here; the Chrome smoke test checks
// the actual stylesheet cascade and rendered element geometry.
function fixture({ delayedCommunity = false, layout = {} } = {}) {
  let document;
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.parentElement = null;
      this.dataset = {};
      this.listeners = new Map();
      this.className = '';
      this.id = '';
      this.value = '';
      this.hidden = false;
      this.disabled = false;
      this._text = '';
    }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    append(...children) {
      for (const child of children) {
        child.remove();
        child.parentElement = this;
        this.children.push(child);
      }
    }
    remove() {
      if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      this.parentElement = null;
    }
    replaceChildren(...children) {
      for (const child of this.children) child.parentElement = null;
      this.children = [];
      this._text = '';
      this.append(...children);
    }
    matches(selector) {
      if (selector.startsWith('#')) return this.id === selector.slice(1);
      if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
      if (selector === '[data-stay]') return Object.hasOwn(this.dataset, 'stay');
      return this.tagName === selector.toUpperCase();
    }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    setAttribute(name, value) { this[name] = String(value); }
    addEventListener(name, handler) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(handler);
    }
    async dispatch(name) {
      for (const handler of this.listeners.get(name) || []) await handler({ target: this, preventDefault() {} });
    }
    focus() { document.activeElement = this; }
    getBoundingClientRect() {
      const visible = !this.hidden && layout.display !== 'none' && this.children.length > 0;
      return { width: visible ? layout.width ?? 800 : 0, height: visible ? layout.height ?? 1000 : 0 };
    }
  }
  document = { createElement: tag => new Element(tag), body: new Element('body') };
  document.getElementById = id => document.body.querySelector('#' + id);
  document.querySelector = selector => document.body.querySelector(selector);
  const add = (tag, id, parent = document.body) => {
    const element = new Element(tag); element.id = id; parent.append(element); return element;
  };
  const form = add('form', 'check-form');
  add('div', 'form-sections', form);
  add('p', 'purpose-note', form);
  const submit = add('button', 'check-submit', form);
  const notice = add('p', 'form-status');
  const output = add('div', 'results'); output.hidden = true;
  const errors = [], reports = [];
  let releaseCommunity;
  const communityGate = delayedCommunity ? new Promise(resolve => { releaseCommunity = resolve; }) : Promise.resolve();
  const context = vm.createContext({
    document,
    console: { error: (...args) => errors.push(args), log() {}, warn() {} },
    setTimeout,
    localStorage: { getItem: () => null, setItem() {} },
    getComputedStyle: element => ({ display: element.hidden ? 'none' : layout.display ?? 'block', visibility: layout.visibility ?? 'visible' }),
    fetch: async relative => {
      if (relative === 'data/visa_outcomes.csv') await communityGate;
      const file = path.join(root, relative);
      return { ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, 'utf8')), text: async () => fs.readFileSync(file, 'utf8') };
    }
  });
  const scripts = [...fs.readFileSync(path.join(root, 'check.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
  for (const script of scripts.filter(script => script !== 'js/checker.js')) {
    vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), context, { filename: script });
  }
  const evaluate = context.VisaCheckV1Integration.evaluate;
  context.VisaCheckV1Integration.evaluate = (...args) => { const report = evaluate(...args); reports.push(report); return report; };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/checker.js'), 'utf8'), context, { filename: 'js/checker.js' });
  return {
    context, document, form, output, notice, submit, errors, reports,
    async fill(values) {
      for (const [id, value] of Object.entries(values)) {
        const input = document.getElementById(id);
        assert.ok(input, 'Fixture uses a current question: ' + id);
        input.value = value;
      }
      await form.dispatch('change');
    },
    async submitForm() { await form.dispatch('submit'); await tick(); },
    async releaseCommunity() { releaseCommunity(); await tick(); await tick(); }
  };
}

const headings = ['Official Eligibility Checks', 'Application Readiness', 'Historical / Community Context', 'How to Strengthen Your Application', 'Application Checklist / Next Steps'];
function assertRendered(f) {
  assert.ok(f.reports.length > 0, 'Integration produced a report model');
  assert.ok(f.reports.at(-1).legal.length > 0);
  assert.ok(f.reports.at(-1).documents.length > 0);
  assert.equal(f.output.hidden, false);
  assert.ok(f.output.querySelector('h2'));
  assert.ok(f.output.querySelectorAll('.report-section').length >= headings.length);
  for (const heading of headings) assert.ok(f.output.textContent.includes(heading), heading);
  assert.ok(f.output.getBoundingClientRect().height > 0);
  assert.match(f.notice.textContent, /Report ready/);
  assert.equal(f.submit.disabled, false);
  assert.deepEqual(f.errors, []);
}
function assertError(f, privateDetail) {
  assert.doesNotMatch(f.notice.textContent, /Report ready/);
  assert.match(f.notice.textContent, /could not|unable|try again/i);
  assert.equal(f.output.hidden, true);
  assert.equal(f.output.children.length, 0);
  assert.equal(f.submit.disabled, false);
  assert.ok(f.errors.length > 0, 'Development console receives error details');
  if (privateDetail) {
    assert.ok(f.errors.some(args => args.some(value => String(value).includes(privateDetail))));
    assert.ok(!f.notice.textContent.includes(privateDetail), 'User error does not disclose internal details');
  }
}

test('report submission renders the supported tourism model and all major sections', async () => {
  const f = fixture(); await f.fill(complete()); await f.submitForm();
  assert.equal(f.reports[0].route.status, 'SUPPORTED');
  assertRendered(f);
});

test('report submission renders UNKNOWN-heavy facts without removed optional question IDs', async () => {
  const f = fixture();
  await f.fill({ nationality: 'IN', residence: 'IE', age: '30', special: 'no', document: 'ordinary', destination: 'FR', purpose: 'tourism' });
  await f.submitForm();
  assert.equal(f.reports[0].route.status, 'PARTIAL');
  assert.ok(f.reports[0].legal.filter(result => result.status === 'UNKNOWN').length > 3);
  assert.match(f.output.textContent, /UNKNOWN/);
  for (const id of ['return', 'activity', 'other_schengen', 'insurance_from', 'physical', 'actual_lodging']) assert.equal(f.document.getElementById(id), null);
  assertRendered(f);
});

test('a no-op renderer cannot claim Report ready or retain a previous report', async () => {
  const f = fixture(); await f.fill(complete()); await f.submitForm(); assertRendered(f);
  f.context.VisaCheckV1Report.render = () => {};
  await f.submitForm(); assertError(f);
});

test('renderer exception produces a safe visible error and detailed console diagnostic', async () => {
  const f = fixture(); await f.fill(complete());
  f.context.VisaCheckV1Report.render = () => { throw new Error('private-render-detail'); };
  await f.submitForm(); assertError(f, 'private-render-detail');
});

test('evaluation exception never advertises a report and does not expose internal details', async () => {
  const f = fixture(); await f.fill(complete());
  f.context.VisaCheckV1Integration.evaluate = () => { throw new Error('private-evaluation-detail'); };
  await f.submitForm(); assertError(f, 'private-evaluation-detail');
});

test('inserted report content with display none cannot claim Report ready', async () => {
  const f = fixture({ layout: { display: 'none' } });
  await f.fill(complete()); await f.submitForm(); assertError(f);
});

test('inserted report content with zero layout area cannot claim Report ready', async () => {
  const f = fixture({ layout: { width: 0 } });
  await f.fill(complete()); await f.submitForm(); assertError(f);
});

test('delayed community refresh render failure is caught and replaces ready with safe error', async () => {
  const f = fixture({ delayedCommunity: true });
  await f.fill(complete()); await f.submitForm(); assertRendered(f);
  f.context.VisaCheckV1Report.render = () => { throw new Error('private-refresh-detail'); };
  await f.releaseCommunity();
  assertError(f, 'private-refresh-detail');
});
