const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { fields, config, assets, complete } = require('../v1-form-fixtures.cjs');
const { adapt } = require('../../js/rules/v1-form-adapter.js');
const { evaluate } = require('../../js/rules/v1-integration.js');
const adapter = values => adapt(values, fields, config);
const run = values => evaluate(adapter(values), config, assets);
const status = (report, id) => report.legal.find(r => r.rule_id === id).status;

test('Stage A: exact normal tourism legal outcomes remain stable', () => {
  const report = run(complete());
  const passes = ['FRANCE_IE_APPLICATION_JURISDICTION', 'FRANCE_IE_IRP_DOCUMENT_PRESENCE', 'SCHENGEN_INSURANCE_PRESENCE', 'SCHENGEN_SHORT_STAY_90_IN_180', 'SCHENGEN_TRAVEL_DOCUMENT_BLANK_PAGES', 'SCHENGEN_TRAVEL_DOCUMENT_REMAINING_VALIDITY'];
  const unknowns = ['FRANCE_IE_IRP_POST_RETURN_VALIDITY', 'SCHENGEN_EARLIEST_LODGING', 'SCHENGEN_INSURANCE_COVERAGE_AMOUNT', 'SCHENGEN_INSURANCE_DATE_COVERAGE', 'SCHENGEN_INSURANCE_EMERGENCY_OR_HOSPITAL_COVERAGE', 'SCHENGEN_INSURANCE_MEDICAL_REPATRIATION', 'SCHENGEN_INSURANCE_TERRITORY', 'SCHENGEN_TRAVEL_DOCUMENT_MAX_AGE'];
  assert.deepEqual(Object.fromEntries(report.legal.map(r => [r.rule_id, r.status])), Object.fromEntries([...passes.map(id => [id, 'PASS']), ...unknowns.map(id => [id, 'UNKNOWN'])]));
  assert.equal(report.route.status, 'SUPPORTED');
  assert.equal(report.baseline.classification, 'ANNEX_I_VISA_REQUIRED');
  assert.equal(report.irish_return.status, 'UNKNOWN');
});

test('Stage A: passport age uses actual lodging; validity and pages still fail independently', () => {
  for (const [date, expected] of [['2030-01-01', 'PASS'], ['2039-01-01', 'FAIL']]) {
    const input = adapter(complete());
    input.model.facts.application.lodging_date = date;
    assert.equal(status(evaluate(input, config, assets), 'SCHENGEN_TRAVEL_DOCUMENT_MAX_AGE'), expected);
  }
  assert.equal(status(run(complete({ expiry: '2030-07-01' })), 'SCHENGEN_TRAVEL_DOCUMENT_REMAINING_VALIDITY'), 'FAIL');
  assert.equal(status(run(complete({ pages: '1' })), 'SCHENGEN_TRAVEL_DOCUMENT_BLANK_PAGES'), 'FAIL');
});

test('Stage A: legacy return and IRP observations retain PASS/FAIL and absent-return UNKNOWN', () => {
  for (const [expiry, expected] of [['2030-12-10', 'PASS'], ['2030-06-20', 'FAIL']]) {
    const input = adapter(complete({ irp_expiry: expiry }));
    input.model.facts.identity.country_of_origin = 'IN';
    input.model.facts.trip.intended_return_to_ireland_date = '2030-06-10';
    assert.equal(status(evaluate(input, config, assets), 'FRANCE_IE_IRP_POST_RETURN_VALIDITY'), expected);
    input.model.facts.trip.intended_return_to_ireland_date = null;
    assert.equal(status(evaluate(input, config, assets), 'FRANCE_IE_IRP_POST_RETURN_VALIDITY'), 'UNKNOWN');
  }
});

test('Stage A: complete question definitions, including conditions and choices, remain unchanged', () => {
  // Semantic questionnaire configuration only; no HTML/CSS snapshot.
  assert.equal(createHash('sha256').update(JSON.stringify(fields)).digest('hex'), 'b52d011a9ba0b9893be288dc74f07d859d98bf8410285b56c73d56da23b7e200');
});

test('Stage A: actual community pipeline retains normal-profile golden statistics', () => {
  const context = vm.createContext({});
  for (const file of ['js/csv-parse.js', 'js/outcome-data.js', 'js/match.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  context.csv = fs.readFileSync('data/visa_outcomes.csv', 'utf8');
  vm.runInContext("const dataset = {...ingestOutcomeCSV(csv), state: 'loaded'};", context);
  const controller = fs.readFileSync('js/checker.js', 'utf8');
  vm.runInContext(controller.slice(controller.indexOf('function community(values)'), controller.indexOf('let generation=')), context);
  const input = adapter(complete());
  const result = context.community({ ...input.active_values, permit_type: input.model.facts.residence.permit_type, irp_expiry: input.model.facts.residence.irish_residence_card_expiry_date });
  assert.equal(result.statistics.percent, 78);
  assert.equal(result.statistics.sampleSize, 9);
});
