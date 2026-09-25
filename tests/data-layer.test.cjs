const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
for (const file of ['csv-parse.js', 'outcome-data.js', 'match.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
const api = name => (...args) => JSON.parse(JSON.stringify(context[name](...args)));
const normalize = values => api('normalizeOutcome')(values);
const base = { nationality: 'Indian', residence_country: 'Ireland', permit_type: 'Stamp 1', permit_months_remaining: '8', destination_country: 'France', visa_purpose: 'Tourist/Visit', other_visas: 'US|UK', countries_visited: '4', prior_rejection: 'No', outcome: 'Approved' };
const profile = { nationality: 'india', residence: 'Ireland', permitType: 'Stamp 1', monthsRemaining: 8, destination: 'France', otherVisas: ['US', 'UK'], countriesVisited: 4, priorRejection: 'No' };
const headers = 'nationality,destination_country,visa_purpose,outcome';

test('missing fields remain null; explicit zero, false, and None are observations', () => {
  const missing = normalize({}).record;
  for (const [key, value] of Object.entries(missing)) if (key !== 'provenance') assert.equal(value, null, key);
  const { record, issues } = normalize({ permit_months_remaining: '0', countries_visited: '0', prior_rejection: 'No', previous_international_travel: false, other_visas: 'None', permit_type: 'None' });
  assert.equal(record.residence_permit_validity_remaining, 0);
  assert.equal(record.countries_visited, 0);
  assert.equal(record.previous_visa_refusal, false);
  assert.equal(record.previous_international_travel, false);
  assert.equal(record.residence_permit_type, 'None');
  assert.deepEqual(record.other_visas, []);
  assert.deepEqual(issues, []);
});

test('aliases normalize consistently and unknown markers do not become observations', () => {
  for (const nationality of ['India', 'Indian', 'india', ' INDIAN ']) assert.equal(normalize({ nationality }).record.passport_country, 'India');
  assert.equal(normalize({ outcome: 'approved' }).record.application_result, 'Approved');
  assert.equal(normalize({ outcome: 'rejected' }).record.application_result, 'Rejected');
  assert.equal(normalize({ nationality: 'Unknown', prior_rejection: 'N/A' }).record.previous_visa_refusal, null);
  assert.equal(normalize({ rejection_reason: 'Unknown' }).record.rejection_reason, 'Unknown');
});

test('negative/nonfinite/malformed numbers and impossible dates are reported, not coerced', () => {
  for (const value of ['-1', 'Infinity', 'NaN', '8 months', '0x10', true]) {
    const result = normalize({ permit_months_remaining: value });
    assert.equal(result.record.residence_permit_validity_remaining, null);
    assert.equal(result.issues.length, 1);
  }
  assert.equal(normalize({ countries_visited: '1.5' }).issues.length, 1);
  assert.equal(normalize({ application_date: '2025-02-29' }).issues.length, 1);
  assert.equal(normalize({ application_date: '2024-02-29' }).record.application_date, '2024-02-29');
  assert.equal(normalize({ prior_rejection: 'perhaps', outcome: 'maybe' }).issues.length, 2);
});

test('CSV handles BOM, CRLF, quoted commas, escaped quotes, newlines and null cells', () => {
  const parsed = api('parseCSV')('\uFEFFa,b,c\r\n"one, two","say ""hello""\nnext",\r\n');
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.records[0].values, { a: 'one, two', b: 'say "hello"\nnext', c: null });
  assert.equal(parsed.records[0].provenance.rowNumber, 2);
  assert.equal(parsed.records[0].provenance.raw.c, '');
});

test('malformed rows are excluded and diagnostics carry physical row numbers', () => {
  const result = api('ingestOutcomeCSV')(`${headers}\nIndia,France,Tourist/Visit,approved\nIndia,France\n"India"oops,France,Tourist/Visit,Approved\n"unterminated`);
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.issues.map(i => i.rowNumber), [3, 4, 5]);
  assert.ok(result.issues.every(i => i.code === 'malformed_row'));
});

test('duplicate, absent, empty, or missing required headers reject ingestion', () => {
  for (const text of ['', 'a,a\n1,2', 'a,\n1,2', 'nationality,outcome\nIndia,Approved']) {
    const result = api('ingestOutcomeCSV')(text);
    assert.equal(result.records.length, 0);
    assert.ok(result.issues.length > 0);
  }
});

test('canonical schema works directly and explicit null takes precedence over legacy aliases', () => {
  const result = api('ingestOutcomeCSV')('passport_country,destination_country,visa_type,application_result\nIndian,France,Tourist/Visit,approved');
  assert.equal(result.records[0].passport_country, 'India');
  assert.deepEqual(result.issues, []);
  assert.equal(normalize({ passport_country: null, nationality: 'Indian' }).record.passport_country, null);
});

test('source types remain extensible and are never inferred more specifically than evidence', () => {
  assert.equal(normalize({ source: 'r/SchengenVisa' }).record.source_type, 'Forum');
  assert.equal(normalize({ source: 'cardexpert.in blog' }).record.source_type, 'Blog');
  assert.equal(normalize({ source: 'https://example.com' }).record.source_type, null);
  assert.equal(normalize({ source: 'r/SchengenVisa', source_type: null }).record.source_type, null);
  assert.equal(normalize({ source_type: 'government statistics' }).record.source_type, 'Government statistics');
  assert.equal(normalize({ source_type: 'Future source category' }).record.source_type, 'Future source category');
});

test('unknown comparisons earn no points, including unknown numeric buckets', () => {
  assert.equal(api('similarityScore')({}, normalize({}).record), 0);
  assert.equal(api('bucketMonths')(null), null);
  assert.equal(api('bucketVisited')(null), null);
  const row = normalize({}).record;
  assert.equal(api('similarityScore')({ monthsRemaining: 0, countriesVisited: 0, priorRejection: 'No' }, row), 0);
  assert.equal(api('monthsRemaining')(''), null);
  assert.equal(api('monthsRemaining')('invalid'), null);
  assert.equal(api('normalizeMatchingProfile')({ monthsRemaining: -2 }).residence_permit_validity_remaining, null);
});

test('complete records retain original weights and reach sample selection', () => {
  const row = normalize(base).record;
  assert.equal(api('similarityScore')(profile, row), 12);
  assert.equal(api('selectSample')([row], profile).length, 1);
  assert.deepEqual(api('computeApproval')([row]), { percent: 100, sampleSize: 1 });
  assert.equal(api('similarityScore')({ ...profile, nationality: 'Indian' }, row), 12);
});

test('pending/unknown outcomes and unknown purpose do not contaminate percentages', () => {
  const rows = ['Approved', 'Rejected', 'Pending', null].map(outcome => normalize({ ...base, outcome }).record);
  assert.deepEqual(api('computeApproval')(rows), { percent: 50, sampleSize: 2 });
  assert.deepEqual(api('computeApproval')(rows.slice(2)), { percent: null, sampleSize: 0 });
  assert.equal(api('selectSample')(rows, profile).length, 2);
  assert.equal(api('selectSample')([normalize({ ...base, visa_purpose: null }).record], profile).length, 0);
  const embassyRows = [...rows, ...rows];
  assert.deepEqual(api('bestEmbassies')(embassyRows, profile), [{ country: 'France', rate: 50, total: 4 }]);
  assert.equal(embassyRows[0].embassy_country, null);
});

test('all existing records survive ingestion; omissions remain null and ambiguous passport is flagged', () => {
  const result = api('ingestOutcomeCSV')(fs.readFileSync(path.join(root, 'data/visa_outcomes.csv'), 'utf8'));
  assert.equal(result.records.length, 105);
  assert.equal(result.records.filter(r => r.residence_permit_validity_remaining === null).length, 105);
  assert.equal(result.records.filter(r => r.countries_visited === null).length, 88);
  assert.equal(result.records.filter(r => r.application_date === null).length, 105);
  assert.equal(result.records.filter(r => r.previous_international_travel === null).length, 105);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].field, 'passport_country');
  assert.equal(result.issues[0].value, 'Brazilian (naturalized Portuguese/EU)');
  assert.equal(api('selectSample')(result.records, profile).length, 9);
  console.log('Dataset validation:', JSON.stringify({ records: result.records.length, issues: result.issues, missing: Object.fromEntries(Object.keys(result.records[0]).filter(k => k !== 'provenance').map(k => [k, result.records.filter(r => r[k] === null).length])) }));
});
