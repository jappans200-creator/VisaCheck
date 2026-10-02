const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { scoreStamp, communityScoreStamp } = require('../../js/v1-report.js');
const { adapt } = require('../../js/rules/v1-form-adapter.js');
const { evaluate } = require('../../js/rules/v1-integration.js');
const { fields, config, assets, complete } = require('../v1-form-fixtures.cjs');

for (const [percent, tone, label] of [
  [0, 'red', 'ACTION NEEDED'],
  [49, 'red', 'ACTION NEEDED'],
  [50, 'amber', 'NEEDS ATTENTION'],
  [75, 'amber', 'NEEDS ATTENTION'],
  [75.01, 'green', 'STRONG PROFILE'],
  [76, 'green', 'STRONG PROFILE'],
  [100, 'green', 'STRONG PROFILE']
]) {
  test(`passport stamp presentation preserves ${percent} and selects ${tone}`, () => {
    assert.deepEqual(scoreStamp(percent), { value: percent, tone, label });
    assert.doesNotMatch(label, /APPROVED|REJECTED|ACCEPTED|DENIED|ELIGIBLE|GUARANTEED/);
  });
}

test('passport stamp never coerces missing, malformed or out-of-range values into a score', () => {
  for (const input of [null, undefined, '', '82', false, true, NaN, Infinity, -Infinity, -1, 101, {}, []]) assert.equal(scoreStamp(input), null);
});

test('passport stamp preserves the existing community sample and destination display guards', () => {
  const community = { statistics: { percent: 82, sampleSize: 3 } };
  assert.equal(communityScoreStamp(community, 'FR').value, 82);
  assert.equal(communityScoreStamp(community, 'US'), null);
  assert.equal(communityScoreStamp(community, 'United States'), null);
  for (const sampleSize of [0, 1, 2, null, undefined, '3', NaN, Infinity]) assert.equal(communityScoreStamp({ statistics: { percent: 82, sampleSize } }, 'FR'), null);
  assert.equal(communityScoreStamp(null, 'FR'), null);
  assert.equal(communityScoreStamp({ statistics: { percent: null, sampleSize: 10 } }, 'FR'), null);
});

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
function reportFor(values) { return evaluate(adapt(values, fields, config), config, assets); }
function render(report, community, sources = {}) {
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.className = ''; this.attributes = {}; this.text = ''; }
    set textContent(text) { this.text = String(text); this.children = []; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
    append(child) { this.children.push(child); }
    replaceChildren() { this.text = ''; this.children = []; }
    setAttribute(name, value) { this.attributes[name] = value; }
  }
  const context = vm.createContext({ document: { createElement: tag => new Node(tag) } });
  for(const file of ['js/rules/assessment.js','js/rules/assessment-adapter.js','js/v1-report.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), context);
  const output = new Node('div');
  context.VisaCheckV1Report.render(output, freeze(report), freeze(sources), freeze(community));
  return output;
}
function nodes(root, predicate) { return root.children.flatMap(child => [...(predicate(child) ? [child] : []), ...nodes(child, predicate)]); }
function classNodes(root, name) { return nodes(root, node => node.className.split(' ').includes(name)); }

test('high community stamp preserves a prominent official FAIL and never mutates report data', () => {
  const report = reportFor(complete({ expiry: '2030-07-01' }));
  const community = { statistics: { percent: 82, sampleSize: 10 }, message: 'Presentation fixture only.' };
  const before = JSON.stringify({ report, community });
  const output = render(report, community);
  const cover = classNodes(output, 'report-cover')[0];
  const alert = classNodes(output, 'official-alert')[0];
  assert.ok(alert);
  assert.match(alert.textContent, /Requirement not met/);
  assert.equal(classNodes(cover, 'stamp-red').length, 1);
  assert.equal(classNodes(cover, 'stamp-label')[0].textContent, 'REQUIREMENT NOT MET');
  assert.match(classNodes(output, 'community-metric')[0].textContent, /82 \/ 100/);
  assert.equal(classNodes(output, 'stamp-green').length, 0);
  assert.equal(JSON.stringify({ report, community }), before);
  for (const heading of ['Official Eligibility Checks', 'Application Readiness', 'Historical / Community Context', 'How to Strengthen Your Application', 'Application Checklist / Next Steps']) assert.ok(output.textContent.includes(heading));
  assert.match(output.textContent, /not a visa decision or guarantee/);
});

test('low community stamp does not invent an official failure or approval conclusion', () => {
  const report = reportFor(complete());
  assert.equal(report.legal.filter(result => result.status === 'FAIL').length, 0);
  const output = render(report, { statistics: { percent: 45, sampleSize: 10 } });
  assert.equal(classNodes(output, 'official-alert').length, 0);
  assert.equal(classNodes(output, 'stamp-amber').length, 1);
  assert.match(classNodes(output, 'community-metric')[0].textContent, /45 \/ 100/);
  assert.equal(classNodes(output, 'stamp-label')[0].textContent, 'CHECK REQUIRED');
  assert.doesNotMatch(classNodes(output, 'score-stamp')[0].textContent, /APPROVED|REJECTED|ACCEPTED|DENIED|ELIGIBLE|GUARANTEED/);
});

test('UNKNOWN-heavy report displays unavailable score without manufacturing zero', () => {
  const report = reportFor({ nationality: 'IN', residence: 'IE', destination: 'FR', document: 'ordinary', purpose: 'tourism', age: '30', special: 'no' });
  const unknownCount = report.legal.filter(result => result.status === 'UNKNOWN').length;
  const output = render(report, { statistics: { percent: null, sampleSize: 0 } });
  assert.equal(classNodes(output, 'stamp-amber').length, 1);
  assert.equal(classNodes(output, 'community-metric')[0].textContent, 'Comparison unavailable');
  assert.equal(classNodes(output, 'official-summary')[0].textContent, 'CHECK REQUIRED');
  assert.ok(unknownCount > 0);
  assert.ok(output.textContent.includes('Application Checklist / Next Steps'));
  assert.equal(classNodes(output, 'official-alert').length, 0);
});

test('official source links remain expandable with their original URL and verification warning', () => {
  const report = reportFor(complete());
  const reference = report.legal.flatMap(result => result.source_refs)[0];
  const source = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../..', reference.path), 'utf8'));
  const output = render(report, null, { [reference.path]: source });
  const details = classNodes(output, 'source-details')[0];
  assert.equal(details.tagName, 'details');
  assert.match(details.textContent, /verification pending/);
  assert.equal(classNodes(details, 'source-link')[0].href, source.url);
  const icon = classNodes(output, 'status-icon')[0];
  assert.equal(icon.attributes['aria-hidden'], 'true');
  assert.ok(classNodes(output, 'status')[0].textContent.length > 0, 'Status text accompanies the decorative icon');
});
