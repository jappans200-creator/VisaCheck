const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const runtime = require('../../js/rules/runtime-release.js');
const integration = require('../../js/rules/v1-integration.js');
const { normalizeApplicantFacts: normalize } = require('../../js/rules/applicant-facts.js');
const { adapt } = require('../../js/rules/v1-form-adapter.js');
const { fields, config, assets, complete } = require('../v1-form-fixtures.cjs');
const golden = require('../fixtures/stage-c-semantic-golden.json');
const copy = value => structuredClone(value);
const release = config.releases[0];
const normal = () => adapt(complete(), fields, config);
const read = async path => JSON.parse(fs.readFileSync(path, 'utf8'));
function altered(path, value) {
  const adapted = normal(), parts = path.split('.');
  parts.slice(0, -1).reduce((o, p) => o[p], adapted.model.facts)[parts.at(-1)] = value;
  return adapted;
}
const select = adapted => runtime.resolve(adapted, config.releases);

test('one actual preview release pins the original 22 assets plus assessment configuration', async () => {
  assert.equal(config.releases.length, 1);
  assert.equal(release.release_id, 'VISACHECK_FRANCE_V1');
  assert.equal(release.version, '0.1.0');
  assert.equal(release.publication.status, 'DEVELOPMENT_PREVIEW');
  assert.equal(release.publication.release_ready, false);
  assert.equal(runtime.refs(release).length, 23);
  assert.deepEqual(Object.fromEntries(runtime.refs(release).filter(a => a.role !== 'assessment').map(a => [a.key, a.path])), config.assets);
  assert.deepEqual(await runtime.loadRegistry(config.runtime_releases, read), config.releases);
  // Build-time validation covers every pin, including conditional groups.
  const loaded = await runtime.loadAssets({ asset_refs: runtime.refs(release) }, read);
  assert.deepEqual(loaded, assets);
  assert.ok(Object.values(loaded).every(a => a.publication.release_ready === false));
});

for (const [name, values] of Object.entries(golden.cases)) test(`Stage C preserves pre-migration semantic report: ${name}`, () => {
  const report = integration.evaluate(adapt(values, fields, config), config, assets);
  // Exact legal/readiness/procedure/baseline/provenance/attention output, excluding
  // route diagnostic wording and newly added release audit metadata; no UI snapshot.
  for (const key of ['route', 'facts', 'issues', 'runtime', 'assessment_configuration']) delete report[key];
  assert.equal(createHash('sha256').update(JSON.stringify(report)).digest('hex'), golden.hashes[name]);
});

for (const [path, value] of [
  ['trip.destination_country', 'ES'], ['trip.destination_country', 'GB'],
  ['residence.country', 'AE'], ['residence.country', 'GB'],
  ['identity.nationality', 'BR'], ['trip.purpose', 'employment']
]) test(`unsupported ${path}=${value} loads no assets or sources and evaluates no rules`, async () => {
  const adapted = altered(path, value), selection = select(adapted), calls = [];
  assert.equal(selection.route.status, 'UNSUPPORTED');
  assert.equal(selection.release, null);
  assert.deepEqual(await runtime.loadAssets(selection, async p => { calls.push(p); return read(p); }), {});
  assert.deepEqual(calls, []);
  // Even a caller supplying an old assets object cannot leak it into a report.
  const report = integration.evaluate(adapted, config, assets);
  assert.deepEqual(report.legal, []); assert.deepEqual(report.documents, []);
  for (const key of ['procedure', 'biometrics', 'irish_return', 'baseline', 'purpose']) assert.equal(report[key], null);
  assert.deepEqual(report.runtime.asset_refs, []); assert.deepEqual(report.source_refs, []);
});

test('route switching FR to ES to FR never retains a stale selected set', async () => {
  for (const [destination, count] of [['FR', 23], ['ES', 0], ['FR', 23]]) {
    const selection = select(altered('trip.destination_country', destination));
    assert.equal(Object.keys(await runtime.loadAssets(selection, read)).length, count);
  }
});

test('canonical nationality is authoritative; legacy route input cannot override or supply it', () => {
  const other = altered('identity.nationality', 'BR');
  assert.equal(other.route_input.nationality, 'IN');
  assert.equal(other.model.facts.passport.issuing_country, 'IN');
  assert.equal(select(other).route.status, 'UNSUPPORTED');
  const missing = altered('identity.nationality', null);
  assert.equal(select(missing).route.status, 'PARTIAL');
  assert.equal(select(missing).release, null);
});

test('missing or invalid material route dimensions are unresolved and load nothing', () => {
  for (const path of ['identity.nationality', 'residence.country', 'trip.destination_country', 'trip.purpose', 'trip.visa_regime', 'trip.visa_type']) {
    const result = select(altered(path, null));
    assert.equal(result.route.status, 'PARTIAL', path); assert.equal(result.release, null);
    assert.ok(result.route.diagnostics.some(d => d.code === 'UNRESOLVED_ROUTE'));
  }
  const invalid = normal(); invalid.model.issues.push({ path: 'identity.nationality', code: 'INVALID_FACT' });
  assert.equal(select(invalid).release, null);
});

test('private visit remains explicitly partial and unestablished local groups do not run', () => {
  const adapted = adapt(complete({ purpose: 'private_visit' }), fields, config), result = select(adapted);
  assert.equal(result.route.status, 'PARTIAL');
  assert.ok(result.release);
  assert.ok(!result.asset_refs.some(a => a.role === 'submission' || a.key.startsWith('FRANCE_IE_') || a.key === 'FRANCE_APPLICATION_FILE'));
});

test('unknown group applicability is diagnosed as partial instead of silently complete', () => {
  const r = copy(release);
  r.groups[0].when = { fact: 'identity.country_of_origin', op: 'eq', value: 'IN' };
  const selection = runtime.resolve(normal(), [r]);
  assert.equal(selection.route.status, 'PARTIAL');
  assert.ok(selection.route.diagnostics.some(d => d.code === 'UNRESOLVED_ASSET_GROUP'));
  assert.ok(!selection.asset_refs.some(a => a.key.startsWith('FRANCE_IE_')));
});

test('ambiguous matching or potentially matching releases never silently win', () => {
  const second = copy(release); second.release_id = 'TEST_ONLY_OVERLAP';
  const result = runtime.resolve(normal(), [release, second]);
  assert.equal(result.route.status, 'PARTIAL'); assert.equal(result.release, null);
  assert.deepEqual(result.asset_refs, []);
  assert.ok(result.route.diagnostics.some(d => d.code === 'AMBIGUOUS_RELEASE'));
  second.applicability.all.push({ fact: 'identity.country_of_origin', op: 'eq', value: 'IN' });
  assert.equal(runtime.resolve(normal(), [release, second]).release, null);
});

test('duplicate release identities are rejected before selection', () => {
  assert.throws(() => runtime.resolve(normal(), [release, copy(release)]), /DUPLICATE_RELEASE/);
});

for (const [name, expression] of [
  ['unknown operator', { fact: 'trip.purpose', op: 'magic', value: 'tourism' }],
  ['empty all', { all: [] }], ['bad path', { fact: '__proto__.value', op: 'eq', value: true }],
  ['missing applicability', null], ['mixed operators', { always: true, all: [] }]
]) test(`malformed applicability rejected: ${name}`, () => {
  const r = copy(release); r.applicability = expression;
  assert.throws(() => runtime.validateRelease(r), /INVALID_APPLICABILITY/);
});

test('required sections, unsupported composition and broader coverage claims are rejected', () => {
  for (const section of ['coverage', 'groups', 'evaluation_context', 'report']) {
    const r = copy(release); delete r[section]; assert.throws(() => runtime.validateRelease(r), /INVALID_RELEASE_STRUCTURE/);
  }
  for (const key of ['inherits', 'overrides', 'relationships']) {
    const r = copy(release); r[key] = []; assert.throws(() => runtime.validateRelease(r), /INVALID_RELEASE_STRUCTURE/);
    const g = copy(release); g.groups[0][key] = []; assert.throws(() => runtime.validateRelease(g), /INVALID_GROUP/);
  }
  const broad = copy(release); broad.coverage.scope = 'ALL_COUNTRIES';
  assert.throws(() => runtime.validateRelease(broad), /INVALID_COVERAGE/);
  const complete = copy(release); complete.coverage.complete_when = { always: true };
  assert.equal(runtime.resolve(altered('trip.destination_country', 'ES'), [complete]).release, null);
});

test('preview release cannot assert verified or production publication', () => {
  for (const field of ['status', 'release_ready', 'evidence_review_status']) {
    const r = copy(release); r.publication[field] = field === 'release_ready' ? true : 'VERIFIED';
    assert.throws(() => runtime.validateRelease(r), /UNSUPPORTED_PUBLICATION_STATE/);
  }
});

test('duplicate exact revisions and conflicting revisions are configuration errors', () => {
  for (const conflicting of [false, true]) {
    const r = copy(release), duplicate = copy(r.groups[0].assets[0]);
    duplicate.key = 'TEST_ONLY_DUPLICATE';
    if (conflicting) { duplicate.revision = '9.9.9'; duplicate.path = duplicate.path.replace('0.1.0.json', '9.9.9.json'); }
    r.groups[1].assets.push(duplicate);
    assert.throws(() => runtime.validateRelease(r), /DUPLICATE_OR_CONFLICTING_ASSET/);
  }
});

test('missing assets are configuration errors, with no fallback or partial evaluation', async () => {
  const selection = select(normal()), missing = copy(assets);
  delete missing[selection.asset_refs[0].key];
  assert.throws(() => integration.evaluate(normal(), config, missing), /MISSING_ASSET/);
  await assert.rejects(runtime.loadAssets(selection, async () => { throw new Error('404'); }), /ASSET_LOAD_FAILED/);
});

test('wrong asset identity/revision and baseline reference pins are rejected', () => {
  const selection = select(normal()), key = selection.asset_refs.find(a => a.role === 'rule').key;
  for (const field of ['rule_id', 'rule_revision']) {
    const wrong = copy(assets); wrong[key][field] = 'wrong';
    assert.throws(() => runtime.validateAssets(selection, wrong), /ASSET_PIN_MISMATCH/);
  }
  const wrong = copy(assets); wrong.SCHENGEN_SHORT_STAY_VISA_REQUIREMENT_BASELINE.reference_data.reference_version = 'wrong';
  assert.throws(() => runtime.validateAssets(selection, wrong), /BASELINE_REFERENCE_PIN_MISMATCH/);
});

test('asset relationship declarations are never silently executed', () => {
  const wrong = copy(assets); wrong.SCHENGEN_TRAVEL_DOCUMENT_BLANK_PAGES.relationships = [{ replaces: 'TEST_ONLY' }];
  assert.throws(() => runtime.validateAssets(select(normal()), wrong), /UNSUPPORTED_ASSET_RELATIONSHIPS/);
});

test('registry loading enforces exact pins and never seeks latest or another version', async () => {
  const requested = [];
  await assert.rejects(runtime.loadRegistry(config.runtime_releases, async p => { requested.push(p); return { ...release, version: '9.9.9' }; }), /RELEASE_PIN_MISMATCH/);
  assert.deepEqual(requested, [config.runtime_releases[0].path]);
  await assert.rejects(runtime.loadRegistry(config.runtime_releases, async () => { throw new Error('404'); }), /RELEASE_LOAD_FAILED/);
  const bad = copy(release); bad.groups[0].assets[0].path = 'data/official-requirements/../secret.json';
  assert.throws(() => runtime.validateRelease(bad), /INVALID_ASSET_REFERENCE/);
});

function synthetic() {
  // TEST ONLY: no jurisdictional requirement or country support is asserted.
  const r = copy(release); r.release_id = 'TEST_ONLY_SYNTHETIC_ROUTE'; r.version = '0.0.1';
  r.applicability.all.find(e => e.fact === 'trip.destination_country').value = 'ZZ';
  r.applicability.all.find(e => e.fact === 'trip.destination_territory').value = 'test_only';
  r.coverage.notes = 'TEST ONLY; no legal requirements or real country coverage.';
  r.report = { document_attention_ids: [], assessment_ids: [] };
  r.groups = [{ id: 'TEST_ONLY', when: { always: true }, assets: [{ key: 'TEST_ONLY', role: 'rule', id: 'TEST_ONLY', revision: '0.0.1', path: 'data/official-requirements/rules/TEST_ONLY/0.0.1.json' }] }];
  const a = { rule_id: 'TEST_ONLY', rule_revision: '0.0.1', requirement: 'TEST ONLY engineering predicate', evaluator: 'condition_match', parameters: { condition: { always: true } }, applicability: { always: true }, source_refs: [], publication: copy(release.publication) };
  const adapted = altered('trip.destination_country', 'ZZ'); adapted.model.facts.trip.destination_territory = 'test_only';
  const policy = copy(assets.assessment);
  policy.configuration_id = 'TEST_ONLY_ASSESSMENT'; policy.release = {release_id:r.release_id,version:r.version};
  policy.results = [{...policy.results[0],asset_key:'TEST_ONLY',result_id:'TEST_ONLY',revision:'0.0.1'}];
  r.groups.push({id:'TEST_ONLY_ASSESSMENT',when:{always:true},assets:[{key:'assessment',role:'assessment',id:policy.configuration_id,revision:policy.revision,path:`data/official-requirements/assessment-configurations/TEST_ONLY_ASSESSMENT/${policy.revision}.json`}]});
  return { release: r, assets: { TEST_ONLY: a, assessment: policy }, adapted };
}

test('a test-only second release registers, resolves, loads and evaluates without country code branches', async () => {
  const fixture = synthetic(), cfg = { releases: [release, fixture.release] };
  const selection = runtime.resolve(fixture.adapted, cfg.releases);
  assert.equal(selection.route.status, 'SUPPORTED');
  assert.equal(selection.release.release_id, fixture.release.release_id);
  const loaded = await runtime.loadAssets(selection, async path => path.includes('assessment-configurations') ? fixture.assets.assessment : fixture.assets.TEST_ONLY);
  const report = integration.evaluate(fixture.adapted, cfg, loaded);
  assert.equal(report.legal.length, 1); assert.equal(report.legal[0].rule_id, 'TEST_ONLY');
  assert.equal(report.legal[0].status, 'PASS'); assert.equal(report.procedure, null);
  assert.equal(runtime.resolve(normal(), cfg.releases).release.release_id, release.release_id);
});

test('explicit assessment context reaches rules without hidden current-time defaults', () => {
  const f = synthetic(); f.assets.TEST_ONLY.effective_from = '2030-01-01';
  const cfg = { releases: [f.release] };
  assert.equal(integration.evaluate(f.adapted, cfg, f.assets).legal[0].status, 'UNKNOWN');
  const report = integration.evaluate(f.adapted, cfg, f.assets, { assessment_date: '2030-06-01' });
  assert.equal(report.legal[0].status, 'PASS'); assert.equal(report.legal[0].assessment_date, '2030-06-01');
  assert.equal(report.runtime.evaluation_context.release_version, '0.0.1');
  assert.equal(integration.evaluate(f.adapted, cfg, f.assets, { assessment_date: '2029-01-01' }).legal[0].status, 'NOT_APPLICABLE');
  assert.throws(() => integration.evaluate(f.adapted, cfg, f.assets, { assessment_date: 'tomorrow' }), /INVALID_CONTEXT/);
  assert.equal(integration.evaluate(normal(), config, assets).runtime.evaluation_context.assessment_date, null);
});

test('release migration retains explicit generic IRP return PASS/FAIL and normal-form UNKNOWN', () => {
  for (const [expiry, expected] of [['2030-12-10', 'PASS'], ['2030-06-20', 'FAIL']]) {
    const adapted = normal(), raw = copy(adapted.model.facts);
    raw.identity.country_of_origin = 'IN'; raw.trip.return_destination_country = 'IE'; raw.trip.intended_return_date = '2030-06-10';
    raw.residence.document.expiry_date = expiry; raw.residence.irish_residence_card_expiry_date = null;
    adapted.model = normalize(raw);
    assert.equal(integration.evaluate(adapted, config, assets).legal.find(r => r.rule_id === 'FRANCE_IE_IRP_POST_RETURN_VALIDITY').status, expected);
  }
  assert.equal(integration.evaluate(normal(), config, assets).legal.find(r => r.rule_id === 'FRANCE_IE_IRP_POST_RETURN_VALIDITY').status, 'UNKNOWN');
});
