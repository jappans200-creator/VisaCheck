const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { errors, loadSchema } = require('../data/evidence/validation/schema.cjs');
const { validateData, validateRepository, schemaSet, checkLock, sha256 } = require('../data/evidence/validation/repository.cjs');
const { sourceFixture, evidenceFixture, verifiedFixture, timestamp } = require('./evidence-fixtures.cjs');
const root = path.resolve(__dirname, '../data/evidence');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const schemas = schemaSet();
const manifest = read('packs/EP-001/manifest.json');
const accepts = (kind, record) => assert.deepEqual(errors(schemas[kind], record), []);
const rejects = (kind, record) => assert.ok(errors(schemas[kind], record).length);
function completeSource() {
  return { ...sourceFixture(), schema_version: '2.0.0', metadata_completeness: 'COMPLETE', authority: 'Synthetic authority', title: 'Synthetic source', source_type: 'Synthetic', language: 'en', official_status: 'CONFIRMED', official_status_basis: 'Synthetic fixture only', verified_at: timestamp, provenance: { state: 'RETRIEVED_INSPECTED', retrieval_method: 'Synthetic capture', inspected_by: 'TEST-REVIEWER', inspected_at: timestamp, inspection_basis: 'Synthetic fixture, no actual visa material' } };
}
function completeEvidence() {
  const e = verifiedFixture();
  e.schema_version = '2.0.0'; e.metadata_completeness = 'COMPLETE';
  e.citations[0].translation_relied_on = false;
  e.citations[0].date_version_review = { status: 'UNKNOWN_NON_BLOCKING', unknown_details: 'Synthetic source version and effective date are not stated.', non_blocking_reason: 'Synthetic fixture demonstrates the disposition gate only.', basis: 'Synthetic review', review_reference: 'TEST-SOURCE@0.1.0', reviewer_id: 'TEST-REVIEWER', reviewed_at: timestamp };
  return e;
}
function dataFixture() {
  const m = structuredClone(manifest);
  m.source_references = [{ id: 'TEST-SOURCE', revision: '0.1.0', path: 'sources/TEST-SOURCE/0.1.0.json' }];
  m.evidence_record_references = [{ id: 'TEST-EVIDENCE', revision: '0.1.0', path: 'records/TEST-EVIDENCE/0.1.0.json' }];
  return { sources: [completeSource()], evidence: [completeEvidence()], manifest: m };
}
const validRepository = d => assert.deepEqual(validateData(d, schemas), []);
function rejectsRepository(d, pattern) { const issues = validateData(d, schemas); assert.ok(issues.some(i => pattern.test(i)), JSON.stringify(issues)); }

test('legacy 1.0.0 source and evidence retain their exact original contract', () => {
  accepts('source', sourceFixture()); accepts('evidence-record', evidenceFixture()); accepts('evidence-record', verifiedFixture());
  const source = sourceFixture(); source.retrieved_at = null; rejects('source', source);
  const evidence = verifiedFixture(); evidence.research_status = 'UNRESOLVED'; evidence.citations[0].supporting_excerpt = null; rejects('evidence-record', evidence);
  for (const n of ['source', 'evidence-record', 'pack-manifest']) assert.equal(read(`schemas/1.0.0/${n}.schema.json`).properties.schema_version.const, '1.0.0');
});
test('retained 1.1.0 revisions validate without being reinterpreted as retrieved', () => {
  for (const id of ['EU-2018-1806','EU-2004-38','EC-2023-1392','FRANCE-VISAS-IRELAND','FRANCE-VISAS-SCHENGEN']) {
    const old = read(`sources/${id}/0.1.0.json`); accepts('source', old); assert.equal(old.schema_version, '1.1.0'); assert.equal(old.retrieved_at, null);
  }
  for (const ref of manifest.evidence_record_references.filter(r => r.id.startsWith('EP001-01-'))) accepts('evidence-record', read(ref.path.replace('0.2.0.json', '0.1.0.json')));
});
test('all dispatcher schemas load with only supported validation keywords', () => {
  for (const name of ['source', 'evidence-record', 'pack-manifest']) loadSchema(path.join(root, 'schemas', `${name}.schema.json`));
});
test('supplied references and incomplete metadata preserve unknowns explicitly', () => {
  for (const ref of manifest.source_references) {
    const s = read(ref.path); accepts('source', s); assert.equal(s.metadata_completeness, 'INCOMPLETE'); assert.equal(s.provenance.state, 'SUPPLIED_REFERENCE');
    assert.equal(s.retrieved_at, null); assert.equal(s.verified_at, null); assert.equal(s.provenance.inspected_by, null);
  }
  for (const ref of manifest.evidence_record_references) {
    const e = read(ref.path); accepts('evidence-record', e); assert.equal(e.metadata_completeness, 'INCOMPLETE');
    for (const c of e.citations) { assert.equal(c.supporting_excerpt, null); assert.equal(c.excerpt_language, null); const suppliedStarts = {
      'EP001-05-H:IE-TRAVEL-CONFIRMATION-SUMMER-2026': '2026-07-13',
      'EP001-19-G:IE-TRAVEL-CONFIRMATION-2026-PDF': '2025-12-08',
      'EP001-19-G:IE-TRAVEL-CONFIRMATION-EXTENSION-2026': '2025-12-08',
      'EP001-19-H:IE-TRAVEL-CONFIRMATION-SUMMER-2026': '2026-07-13',
    }; assert.equal(c.effective_from, suppliedStarts[`${e.evidence_id}:${c.source_id}`] || null); }
  }
});
test('metadata state is independent of non-VERIFIED workflow states', () => {
  const e = read(manifest.evidence_record_references[0].path);
  for (const status of ['SOURCE_FOUND','NEEDS_REVIEW','UNRESOLVED']) { e.research_status = status; accepts('evidence-record', e); }
  const complete = completeEvidence(); complete.research_status = 'NEEDS_REVIEW'; accepts('evidence-record', complete);
  e.metadata_completeness = 'COMPLETE'; rejects('evidence-record', e);
});
test('changing research_status alone cannot promote actual imported evidence', () => {
  for (const ref of manifest.evidence_record_references) { const e = read(ref.path); e.research_status = 'VERIFIED'; rejects('evidence-record', e); }
});
test('retrieved provenance cannot be claimed without retrieval and inspection metadata', () => {
  const s = read(manifest.source_references[0].path); s.provenance.state = 'RETRIEVED_INSPECTED'; rejects('source', s);
  const complete = completeSource(); accepts('source', complete); complete.provenance.state = 'SUPPLIED_REFERENCE'; rejects('source', complete);
});
test('a fully documented synthetic VERIFIED fixture passes structural and repository gates', () => {
  const d = dataFixture(); accepts('source', d.sources[0]); accepts('evidence-record', d.evidence[0]); validRepository(d);
});
test('VERIFIED nonexistent source revisions fail repository validation', () => {
  const d = dataFixture(); d.evidence[0].citations[0].source_revision = '999.0.0'; rejectsRepository(d, /missing source revision/);
});
test('VERIFIED supplied-only and unverified sources fail repository validation', () => {
  const d = dataFixture(); d.sources[0].verified_at = null; rejectsRepository(d, /unacceptable source provenance/);
  const imported = read(manifest.source_references[0].path); imported.source_id = 'TEST-SOURCE'; imported.source_revision = '0.1.0';
  d.sources[0] = imported; rejectsRepository(d, /unacceptable source provenance/);
});
test('VERIFIED null excerpt, missing language, or unusable locator fails', () => {
  for (const mutate of [c => { c.supporting_excerpt = null; }, c => { c.excerpt_language = null; }, c => { Object.keys(c.locator).forEach(k => { c.locator[k] = null; }); }]) {
    const e = completeEvidence(); mutate(e.citations[0]); rejects('evidence-record', e);
  }
});
test('relied-on translations must be reviewed; unused draft translations do not decide interpretation', () => {
  const e = completeEvidence(); const c = e.citations[0]; c.translation = 'Synthetic translation'; c.translation_status = 'UNREVIEWED'; c.translation_relied_on = true;
  rejects('evidence-record', e); c.translation_status = 'REVIEWED'; accepts('evidence-record', e);
  c.translation_status = 'UNREVIEWED'; c.translation_relied_on = false; accepts('evidence-record', e);
});
test('unknown effective dates or versions require an explicit reviewed non-blocking disposition', () => {
  const d = dataFixture(); d.evidence[0].citations[0].date_version_review.status = 'PENDING'; rejects('evidence-record', d.evidence[0]);
  d.evidence[0].citations[0].date_version_review.status = 'KNOWN_APPLICABLE'; rejectsRepository(d, /unknown date\/version/);
  d.evidence[0].citations[0].date_version_review.status = 'UNKNOWN_NON_BLOCKING'; validRepository(d);
  for (const field of ['unknown_details','non_blocking_reason','basis','review_reference','reviewer_id','reviewed_at']) {
    const e = completeEvidence(); e.citations[0].date_version_review[field] = null; rejects('evidence-record', e);
  }
  d.evidence[0].citations[0].date_version_review.status = 'BLOCKING'; rejects('evidence-record', d.evidence[0]);
});
test('date review and all five review references must resolve to exact cited sources', () => {
  let d = dataFixture(); d.evidence[0].citations[0].date_version_review.review_reference = 'fabricated'; rejectsRepository(d, /date\/version review reference/);
  for (const name of Object.keys(d.evidence[0].review.checks)) {
    d = dataFixture(); d.evidence[0].review.checks[name].status = 'PENDING'; rejects('evidence-record', d.evidence[0]);
    d = dataFixture(); d.evidence[0].review.checks[name].references = ['nonexistent']; rejectsRepository(d, /exact cited source revision/);
  }
});
test('unresolved blocking conflicts, exceptions and dependencies reject VERIFIED promotion', () => {
  for (const kind of ['conflicts','exceptions','dependencies']) {
    const e = completeEvidence(); e.interpretation[kind] = [{ description: 'Synthetic unresolved item', evidence_reference: null, status: 'PENDING', resolution: null, blocking: true }];
    rejects('evidence-record', e); e.interpretation[kind][0].blocking = false; accepts('evidence-record', e);
  }
});
test('known applicability and reviewer identity remain required', () => {
  const e = completeEvidence(); e.applicability.purposes = { mode: 'UNDETERMINED', values: [] }; rejects('evidence-record', e);
  for (const field of ['reviewer_id','reviewed_at','verification_basis']) { const r = completeEvidence(); r.review[field] = null; rejects('evidence-record', r); }
});
test('manifest versions consistently separate original contract from slot-status extension', () => {
  accepts('pack-manifest', manifest);
  const legacy = structuredClone(manifest); legacy.schema_version = '1.0.0'; legacy.research_slot_references.forEach(s => { delete s.status; }); accepts('pack-manifest', legacy);
  legacy.research_slot_references[0].status = 'NEEDS_REVIEW'; rejects('pack-manifest', legacy);
  const extension = structuredClone(manifest); extension.schema_version = '1.1.0'; accepts('pack-manifest', extension);
  const future = structuredClone(manifest); future.schema_version = '9.0.0'; rejects('pack-manifest', future);
});
test('EP001-01 statuses are retained and all 20 research slots are populated', () => {
  assert.equal(manifest.schema_version, '2.0.0'); assert.equal(manifest.version, '0.11.0');
  for (const ref of manifest.evidence_record_references.filter(r => r.id.startsWith('EP001-01-'))) {
    const e = read(ref.path), old = read(ref.path.replace('0.2.0.json','0.1.0.json'));
    assert.equal(e.research_status, old.research_status); assert.equal(e.research_status, ref.id.endsWith('-I') ? 'UNRESOLVED' : 'NEEDS_REVIEW');
    assert.equal(e.requirement_name, old.requirement_name); assert.equal(e.interpretation.explicitly_establishes, old.interpretation.explicitly_establishes);
  }
  assert.equal(manifest.research_slot_references.length, 20);
  for (const slot of manifest.research_slot_references) assert.equal(slot.status, 'NEEDS_REVIEW');
});
test('lock detects edits, deletions, unregistered revisions and rewriting prior lock entries', () => {
  const bytes = Buffer.from('synthetic'), actual = { 'records/TEST/0.1.0.json': bytes };
  const lock = { format_version: '1.0.0', files: { 'records/TEST/0.1.0.json': sha256(bytes) } };
  assert.deepEqual(checkLock(lock, actual), []);
  assert.ok(checkLock(lock, { 'records/TEST/0.1.0.json': Buffer.from('changed') }).length);
  assert.ok(checkLock(lock, {}).length);
  assert.ok(checkLock(lock, { ...actual, 'records/TEST/0.2.0.json': bytes }).length);
  const rewritten = structuredClone(lock); rewritten.files['records/TEST/0.1.0.json'] = sha256(Buffer.from('changed'));
  assert.ok(checkLock(rewritten, { 'records/TEST/0.1.0.json': Buffer.from('changed') }, lock).some(s => /Previously locked/.test(s)));
});
test('repository validates every active and retained revision, manifest, cross-reference and lock', () => {
  const result = validateRepository(); assert.deepEqual(result.issues, []);
  assert.equal(result.source_revisions, 36); assert.equal(result.evidence_revisions, 180); assert.equal(result.active_sources, 22); assert.equal(result.active_evidence, 171);
});


test('EP001-02 A through K use incomplete supplied evidence with no invented provenance', () => {
  const refs = manifest.evidence_record_references.filter(r => r.id.startsWith('EP001-02-'));
  assert.deepEqual(refs.map(r => r.id), 'ABCDEFGHIJK'.split('').map(c => `EP001-02-${c}`));
  for (const ref of refs) {
    const e = read(ref.path); accepts('evidence-record', e);
    assert.equal(e.schema_version, '2.0.0'); assert.equal(e.research_status, 'NEEDS_REVIEW');
    assert.equal(e.metadata_completeness, 'INCOMPLETE'); assert.equal(e.review.reviewer_id, null); assert.equal(e.review.reviewed_at, null);
    assert.ok(Object.values(e.review.checks).every(c => c.status === 'PENDING' && c.references.length === 0));
    for (const c of e.citations) {
      assert.equal(c.supporting_excerpt, null); assert.equal(c.date_version_review.status, 'PENDING');
      assert.equal(c.effective_from, null); assert.equal(c.effective_to, null);
    }
  }
});
test('EP001-02 reuses the existing territorial source and registers only five new supplied URLs', () => {
  const reused = manifest.source_references.filter(r => r.id === 'FRANCE-VISAS-SCHENGEN');
  assert.equal(reused.length, 1); assert.equal(reused[0].revision, '0.2.0');
  const expected = {
    'EU-2009-810': 'https://eur-lex.europa.eu/eli/reg/2009/810/2024-06-11/eng',
    'EU-2016-399': 'https://eur-lex.europa.eu/eli/reg/2016/399',
    'FRANCE-VISAS-SHORT-STAY': 'https://www.france-visas.gouv.fr/en/visa-de-court-sejour',
    'FRANCE-VISAS-LONG-STAY': 'https://france-visas.gouv.fr/en/visa-de-long-sejour',
    'FRANCE-VISAS-FAQ': 'https://www.france-visas.gouv.fr/en/faq',
  };
  for (const [id, url] of Object.entries(expected)) {
    assert.ok(manifest.source_references.some(r => r.id === id));
    const source = read(`sources/${id}/0.1.0.json`); assert.equal(source.url, url); assert.equal(source.provenance.state, 'SUPPLIED_REFERENCE');
    assert.equal(source.retrieved_at, null); assert.equal(source.provenance.inspected_at, null);
  }
  const a = read('records/EP001-02-A/0.1.0.json'); assert.equal(a.citations[0].source_id, reused[0].id); assert.equal(a.citations[0].source_revision, reused[0].revision);
});
test('EP001-02 preserves routing distinctions, exact supplied locators and future input implications', () => {
  const get = l => read(`records/EP001-02-${l}/0.1.0.json`);
  assert.deepEqual(get('H').applicability.destination.countries.values, ['MC']);
  assert.match(get('H').interpretation.reviewer_notes, /competent_visa_authority = FR/);
  assert.equal(get('I').citations[0].locator.article, 'Article 5');
  assert.equal(get('J').citations[0].locator.article, 'Articles 5 and 6');
  assert.equal(get('C').citations[0].locator.article, 'Article 6');
  assert.ok(Object.values(get('K').citations[0].locator).every(v => v === null));
  assert.ok(get('C').interpretation.required_applicant_inputs.some(i => i.name === 'previous_schengen_stays.entry_date'));
  assert.match(get('K').interpretation.does_not_establish, /not identical supporting documents/);
  assert.match(get('E').interpretation.does_not_establish, /Do not sum all European travel/);
});


test('EP001-03 records A through L retain supplied-only metadata and cannot be promoted', () => {
  const refs = manifest.evidence_record_references.filter(r => r.id.startsWith('EP001-03-'));
  assert.deepEqual(refs.map(r => r.id), 'ABCDEFGHIJKL'.split('').map(l => `EP001-03-${l}`));
  for (const ref of refs) {
    const e = read(ref.path); accepts('evidence-record', e);
    assert.equal(e.research_status, 'NEEDS_REVIEW'); assert.equal(e.metadata_completeness, 'INCOMPLETE');
    assert.equal(e.review.reviewer_id, null); assert.equal(e.review.reviewed_at, null);
    assert.ok(Object.values(e.review.checks).every(c => c.status === 'PENDING' && c.references.length === 0));
    for (const c of e.citations) { assert.equal(c.supporting_excerpt, null); assert.equal(c.excerpt_language, null); assert.equal(c.date_version_review.status, 'PENDING'); }
    e.research_status = 'VERIFIED'; rejects('evidence-record', e);
  }
});
test('EP001-03 source revisions preserve URL distinctions and older citation pins', () => {
  const euOld = read('sources/EU-2009-810/0.1.0.json'); const euNew = read('sources/EU-2009-810/0.2.0.json');
  assert.equal(euOld.consolidation_date, '2024-06-11'); assert.equal(euNew.consolidation_date, '2024-06-28');
  assert.equal(euNew.url, 'https://eur-lex.europa.eu/eli/reg/2009/810/2024-06-28/eng');
  assert.equal(read('records/EP001-02-I/0.1.0.json').citations[0].source_revision, '0.1.0');
  assert.equal(read('records/EP001-03-A/0.1.0.json').citations[0].source_revision, '0.2.0');
  assert.equal(read('sources/FRANCE-VISAS-SHORT-STAY/0.2.0.json').url, 'https://www.france-visas.gouv.fr/en/short-stay-visa');
  assert.equal(read('sources/FRANCE-VISAS-IRELAND/0.3.0.json').url, 'https://france-visas.gouv.fr/en/irlande');
  for (const [id, rev] of [['EU-2009-810','0.2.0'],['FRANCE-VISAS-SHORT-STAY','0.2.0'],['FRANCE-VISAS-IRELAND','0.3.0']]) {
    const s = read(`sources/${id}/${rev}.json`); assert.equal(s.provenance.state, 'SUPPLIED_REFERENCE'); assert.equal(s.retrieved_at, null); assert.equal(s.provenance.inspected_at, null);
  }
  const j = read('records/EP001-03-J/0.1.0.json'); assert.equal(j.citations[0].source_id, 'FRANCE-VISAS-FAQ'); assert.equal(j.citations[0].source_revision, '0.1.0');
});
test('EP001-03 exceptional and operational branches remain separate from ordinary competence', () => {
  const get = l => read(`records/EP001-03-${l}/0.1.0.json`);
  assert.equal(get('G').interpretation.classification, 'DISCRETIONARY');
  assert.equal(get('G').applicability.residence.countries.mode, 'UNDETERMINED');
  assert.match(get('G').interpretation.does_not_establish, /Do not determine sufficiency/);
  assert.deepEqual(get('J').applicability.destination.countries.values, ['MC']);
  assert.match(get('D').interpretation.does_not_establish, /fallback, not the default/);
  assert.equal(get('K').citations[0].locator.article, 'Article 18');
  assert.equal(get('L').citations[0].locator.article, 'Article 8');
  assert.match(get('I').interpretation.reference_events[0].source_wording, /12 May 2026/);
  assert.equal(get('I').citations[0].effective_from, null);
  assert.ok(get('G').interpretation.required_applicant_inputs.some(i => i.name === 'reason_for_nonresident_application'));
});

test('EP001-04 supplied records preserve missing metadata and block VERIFIED promotion', () => {
  const refs = manifest.evidence_record_references.filter(r => r.id.startsWith('EP001-04-'));
  assert.deepEqual(refs.map(r => r.id), [...'ABCDEFGHIJK'].map(l => `EP001-04-${l}`));
  for (const ref of refs) {
    const e = read(ref.path); accepts('evidence-record', e);
    assert.equal(e.schema_version, '2.0.0'); assert.equal(e.metadata_completeness, 'INCOMPLETE');
    assert.equal(e.research_status, ref.id.endsWith('-J') ? 'UNRESOLVED' : 'NEEDS_REVIEW');
    assert.equal(e.review.reviewer_id, null); assert.equal(e.review.verification_basis, null);
    assert.ok(Object.values(e.review.checks).every(c => c.status === 'PENDING' && c.references.length === 0));
    for (const c of e.citations) {
      assert.equal(c.supporting_excerpt, null); assert.equal(c.excerpt_language, null);
      assert.equal(c.effective_from, null); assert.equal(c.date_version_review.status, 'PENDING');
    }
    e.research_status = 'VERIFIED'; rejects('evidence-record', e);
  }
});
test('EP001-04 reuses exact supplied references and does not inspect recognition dataset', () => {
  const get = l => read(`records/EP001-04-${l}/0.1.0.json`);
  assert.equal(get('A').citations[0].source_revision, '0.2.0');
  assert.equal(get('A').citations[0].locator.article, 'Article 12');
  assert.ok(get('F').citations.some(c => c.source_id === 'EU-2016-399' && c.source_revision === '0.1.0' && c.locator.article === 'Article 6'));
  assert.equal(get('K').citations[0].source_revision, '0.2.0');
  assert.equal(manifest.source_references.find(r => r.id === 'FRANCE-VISAS-IRELAND').revision, '0.3.0');
  for (const id of ['FRANCE-VISAS-APPLICATION-PROCESS','FRANCE-VISAS-ARRIVAL','EC-TRAVEL-RESIDENCE-DOCUMENTS','EC-TRAVEL-DOCUMENTS-PART-I']) {
    const s = read(`sources/${id}/0.1.0.json`); accepts('source', s);
    assert.equal(s.provenance.state, 'SUPPLIED_REFERENCE'); assert.equal(s.metadata_completeness, 'INCOMPLETE');
    assert.equal(s.retrieved_at, null); assert.equal(s.provenance.inspected_at, null); assert.equal(s.verified_at, null);
  }
  const lead = read('sources/EC-TRAVEL-DOCUMENTS-PART-I/0.1.0.json');
  assert.equal(lead.published_at, '2026-09-16'); assert.match(lead.reviewer_notes, /NOT been inspected/);
  assert.ok(get('G').interpretation.dependencies.some(d => d.blocking && d.status === 'PENDING' && /exact India/.test(d.description)));
  assert.ok(!get('G').interpretation.required_applicant_inputs.some(i => /recognition|recognised/.test(i.name)));
});
test('EP001-04 preserves exceptions, stage-specific evidence and unresolved wording', () => {
  const get = l => read(`records/EP001-04-${l}/0.1.0.json`);
  assert.match(get('B').interpretation.does_not_establish, /calendar months, not 90 days/);
  assert.ok(get('B').interpretation.exceptions.some(e => e.blocking && e.status === 'PENDING' && /justified-emergency/.test(e.description)));
  assert.match(get('C').interpretation.explicitly_establishes, /last intended departure/);
  assert.deepEqual(get('E').interpretation.reference_events, []);
  assert.ok(get('E').interpretation.dependencies.some(d => /comparison event/.test(d.description) && d.status === 'PENDING'));
  const f = get('F'); assert.equal(f.interpretation.classification, 'INFORMATIONAL_PROCEDURAL');
  for (const c of f.citations) assert.match(c.applicability_notes, c.source_id === 'EU-2009-810' ? /stage: application_admissibility/ : /stage: border_entry/);
  const j = get('J'); assert.equal(j.research_status, 'UNRESOLVED'); assert.equal(j.interpretation.classification, 'UNRESOLVED');
  assert.match(j.interpretation.explicitly_establishes, /last intended departure/);
  assert.match(j.interpretation.explicitly_establishes, /expiry date of the requested visa/);
  assert.ok(j.interpretation.conflicts.some(c => c.blocking && c.status === 'PENDING' && c.resolution === null));
  assert.match(get('H').interpretation.does_not_establish, /do not mark them FAIL/);
  assert.equal(get('I').interpretation.classification, 'INFORMATIONAL_PROCEDURAL');
  assert.match(get('K').interpretation.does_not_establish, /EP001-07/);
});

test('EP001-05 retains supplied provenance, unknown metadata and blocked promotion', () => {
  const refs = manifest.evidence_record_references.filter(r => r.id.startsWith('EP001-05-'));
  assert.deepEqual(refs.map(r => r.id), [...'ABCDEFGHIJ'].map(l => `EP001-05-${l}`));
  for (const ref of refs) {
    const e = read(ref.path); accepts('evidence-record', e);
    assert.equal(e.research_status, 'NEEDS_REVIEW'); assert.equal(e.metadata_completeness, 'INCOMPLETE');
    assert.equal(e.review.reviewer_id, null); assert.equal(e.review.verification_basis, null);
    assert.ok(Object.values(e.review.checks).every(c => c.status === 'PENDING'));
    for (const c of e.citations) {
      assert.equal(c.supporting_excerpt, null); assert.equal(c.excerpt_language, null);
      const s = read(`sources/${c.source_id}/${c.source_revision}.json`); accepts('source', s);
      assert.equal(s.provenance.state, 'SUPPLIED_REFERENCE'); assert.equal(s.retrieved_at, null); assert.equal(s.provenance.inspected_at, null);
    }
    e.research_status = 'VERIFIED'; rejects('evidence-record', e);
  }
  assert.equal(read('records/EP001-05-A/0.1.0.json').applicability.applicant_conditions.mode, 'UNDETERMINED');
});
test('EP001-05 preserves return-date calendar-month threshold and exceptional uncertainty', () => {
  const get = l => read(`records/EP001-05-${l}/0.1.0.json`);
  const c = get('C'); assert.equal(c.interpretation.reference_events[0].name, 'intended_return_to_ireland');
  assert.match(c.interpretation.reference_events[0].notes, /1 calendar month/);
  assert.match(c.interpretation.does_not_establish, /not 30 days/);
  assert.ok(c.interpretation.dependencies.some(d => d.evidence_reference.id === 'EP001-05-G' && d.status === 'PENDING'));
  assert.match(get('A').interpretation.does_not_establish, /Physical presence does not establish legal residence/);
  assert.match(get('F').interpretation.explicitly_establishes, /distinct facts/);
  assert.match(get('G').interpretation.does_not_establish, /do not automatically FAIL/);
  assert.equal(get('E').interpretation.application_stage, 'irish_reentry');
  assert.ok(get('I').interpretation.dependencies.some(d => d.evidence_reference.id === 'EP001-01-D' && d.evidence_reference.revision === '0.2.0'));
  assert.equal(get('B').citations[0].source_revision, '0.2.0');
  const family = read('sources/EU-2009-810/0.3.0.json');
  assert.equal(family.url, 'https://eur-lex.europa.eu/eli/reg/2009/810/'); assert.equal(family.consolidation_date, null);
  assert.equal(read('records/EP001-04-A/0.1.0.json').citations[0].source_revision, '0.2.0');
});
test('EP001-05 historical IRP notices cannot become a current general exception', () => {
  const h = read('records/EP001-05-H/0.1.0.json');
  assert.equal(h.interpretation.classification, 'INFORMATIONAL_PROCEDURAL'); assert.equal(h.candidate_rule_id, null);
  assert.equal(h.interpretation.application_stage, 'irish_reentry');
  const pdf = h.citations.find(c => c.source_id === 'IE-TRAVEL-CONFIRMATION-2026-PDF');
  assert.equal(pdf.source_revision, '0.1.0'); assert.equal(pdf.effective_to, '2026-02-28'); assert.equal(pdf.effective_from, null);
  const summer = h.citations.find(c => c.source_id === 'IE-TRAVEL-CONFIRMATION-SUMMER-2026');
  assert.equal(summer.effective_from, '2026-07-13'); assert.equal(summer.effective_to, '2026-08-31');
  assert.match(h.interpretation.does_not_establish, /Neither overrides C/);
  assert.match(h.interpretation.reviewer_notes, /renewal submitted before IRP expiry/);
  assert.match(h.interpretation.reviewer_notes, /Carry expired IRP, proof of renewal and Travel Confirmation Notice/);
  const announcement = read('sources/IE-TRAVEL-CONFIRMATION-EXTENSION-2026/0.1.0.json');
  assert.equal(announcement.published_at, '2026-01-30'); assert.equal(announcement.effective_from, null);
});

test('EP001-06 supplied records preserve unknown metadata and J remains unresolved', () => {
  const refs = manifest.evidence_record_references.filter(r => r.id.startsWith('EP001-06-'));
  assert.deepEqual(refs.map(r => r.id), [...'ABCDEFGHIJK'].map(l => `EP001-06-${l}`));
  for (const ref of refs) {
    const e = read(ref.path); accepts('evidence-record', e);
    assert.equal(e.schema_version, '2.0.0'); assert.equal(e.metadata_completeness, 'INCOMPLETE');
    assert.equal(e.research_status, ref.id.endsWith('-J') ? 'UNRESOLVED' : 'NEEDS_REVIEW');
    assert.equal(e.review.reviewer_id, null); assert.equal(e.review.verification_basis, null);
    assert.ok(Object.values(e.review.checks).every(c => c.status === 'PENDING' && c.references.length === 0));
    for (const c of e.citations) {
      assert.equal(c.supporting_excerpt, null); assert.equal(c.excerpt_language, null); assert.equal(c.effective_from, null);
      const s = read(`sources/${c.source_id}/${c.source_revision}.json`); accepts('source', s);
      assert.equal(s.provenance.state, 'SUPPLIED_REFERENCE'); assert.equal(s.retrieved_at, null); assert.equal(s.provenance.inspected_at, null);
    }
    e.research_status = 'VERIFIED'; rejects('evidence-record', e);
  }
});
test('EP001-06 preserves exact source references without repinning prior evidence', () => {
  const eu = read('sources/EU-2009-810/0.4.0.json');
  assert.equal(eu.consolidation_date, '2024-06-11');
  assert.equal(eu.url, 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:02009R0810-20240611');
  assert.equal(read('sources/FRANCE-VISAS-FAQ/0.2.0.json').url, 'https://france-visas.gouv.fr/en/faq');
  assert.equal(read('records/EP001-05-A/0.1.0.json').citations[0].source_revision, '0.3.0');
  assert.equal(read('records/EP001-03-J/0.1.0.json').citations[0].source_revision, '0.1.0');
  const ireland = read('records/EP001-06-D/0.1.0.json').citations[0];
  assert.equal(ireland.source_id, 'FRANCE-VISAS-IRELAND'); assert.equal(ireland.source_revision, '0.2.0');
  assert.equal(read('records/EP001-06-A/0.1.0.json').applicability.applicant_conditions.mode, 'UNDETERMINED');
});
test('EP001-06 keeps legal, recommended and operational timing units, triggers and exceptions separate', () => {
  const get = l => read(`records/EP001-06-${l}/0.1.0.json`).interpretation;
  assert.match(get('A').explicitly_establishes, /6 months/); assert.match(get('A').does_not_establish, /do not convert 6 months to 180 days/);
  assert.equal(get('A').reference_events[0].name, 'start_of_intended_visit');
  assert.ok(get('A').exceptions.some(x => /Seafarers/.test(x.description) && x.status === 'PENDING'));
  assert.match(get('B').explicitly_establishes, /15 calendar days/);
  assert.ok(get('B').exceptions.some(x => /urgency/.test(x.description) && x.blocking));
  assert.match(get('B').does_not_establish, /must not become unconditional FAIL/);
  assert.equal(get('D').classification, 'INFORMATIONAL_PROCEDURAL'); assert.match(get('D').explicitly_establishes, /20 working days/);
  assert.equal(get('D').reference_events[0].name, 'travel_departure');
  assert.match(get('E').explicitly_establishes, /about 10–15 working days/); assert.match(get('E').explicitly_establishes, /Delays may occur/);
  assert.equal(get('E').reference_events[0].name, 'complete_application_submitted_in_person_at_embassy');
  assert.equal(get('F').reference_events[0].name, 'lodging_of_application_admissible_under_article_19');
  assert.deepEqual(get('F').exceptions.map(x => x.evidence_reference.id), ['EP001-06-G','EP001-06-H']);
  assert.match(get('G').explicitly_establishes, /45 calendar days/); assert.match(get('G').does_not_establish, /Historical 30\/60-day/);
  assert.match(get('H').does_not_establish, /Do not automatically determine justified urgency/);
  assert.deepEqual(get('I').required_applicant_inputs.map(x => x.name), ['application.appointment_requested_date','application.appointment_date','application.lodging_date']);
  assert.equal(get('J').classification, 'UNRESOLVED'); assert.match(get('J').explicitly_establishes, /15 calendar days/); assert.match(get('J').explicitly_establishes, /two weeks/);
  assert.ok(get('J').conflicts.some(x => x.status === 'PENDING' && x.resolution === null && x.blocking));
  assert.equal(get('K').classification, 'INFORMATIONAL_PROCEDURAL');
});

test('EP001-07 through EP001-11 remain independent supplied batches without VERIFIED promotion', () => {
  const expected = {'07':'ABCDEFG','08':'ABCDEFG','09':'ABCDEF','10':'ABCDEFGH','11':'ABCDEF'};
  let count = 0;
  for (const [slot, letters] of Object.entries(expected)) {
    const refs = manifest.evidence_record_references.filter(r => r.id.startsWith(`EP001-${slot}-`));
    assert.deepEqual(refs.map(r => r.id), [...letters].map(l => `EP001-${slot}-${l}`));
    assert.equal(manifest.research_slot_references.find(s => s.slot_id === `EP001-${slot}`).status, 'NEEDS_REVIEW');
    for (const ref of refs) {
      const e = read(ref.path); accepts('evidence-record', e); count++;
      assert.equal(e.schema_version, '2.0.0'); assert.equal(e.research_status, 'NEEDS_REVIEW'); assert.equal(e.metadata_completeness, 'INCOMPLETE');
      assert.equal(e.review.reviewer_id, null); assert.equal(e.review.verification_basis, null);
      assert.ok(Object.values(e.review.checks).every(c => c.status === 'PENDING' && c.references.length === 0));
      for (const c of e.citations) {
        assert.equal(c.supporting_excerpt, null); assert.equal(c.excerpt_language, null); assert.equal(c.effective_from, null);
        assert.equal(c.date_version_review.status, 'PENDING');
      }
      e.research_status = 'VERIFIED'; rejects('evidence-record', e);
    }
  }
  assert.equal(count, 34);
  assert.equal(read('records/EP001-07-A/0.1.0.json').applicability.applicant_conditions.mode, 'UNDETERMINED');
});
test('supporting-documents batch reuses represented source families and adds only tourist reference', () => {
  const ids = new Set();
  for (const ref of manifest.evidence_record_references.filter(r => /^EP001-(07|08|09|10|11)-/.test(r.id))) {
    for (const c of read(ref.path).citations) {
      ids.add(`${c.source_id}@${c.source_revision}`);
      const s = read(`sources/${c.source_id}/${c.source_revision}.json`); accepts('source', s);
      assert.equal(s.provenance.state, 'SUPPLIED_REFERENCE'); assert.equal(s.retrieved_at, null); assert.equal(s.provenance.inspected_at, null);
    }
  }
  assert.deepEqual([...ids].sort(), ['EU-2009-810@0.4.0','FRANCE-VISAS-ARRIVAL@0.1.0','FRANCE-VISAS-FAQ@0.2.0','FRANCE-VISAS-TOURIST-STAY@0.1.0']);
  const t = read('sources/FRANCE-VISAS-TOURIST-STAY/0.1.0.json');
  assert.equal(t.url, 'https://france-visas.gouv.fr/en/web/france-visas/sejour-touristique-de-moins-de-3-mois');
  assert.equal(t.language, null); assert.equal(t.effective_from, null);
});
test('Annex II examples and accommodation/transport alternatives do not become universal mandates', () => {
  const get = k => read(`records/EP001-${k}/0.1.0.json`).interpretation;
  assert.match(get('07-E').explicitly_establishes, /non-exhaustive/);
  assert.match(get('07-E').does_not_establish, /not individually mandatory/);
  assert.match(get('07-B').explicitly_establishes, /OR sufficient means/);
  assert.match(get('07-D').does_not_establish, /automated ties score/);
  assert.match(get('07-G').does_not_establish, /not conclusive satisfaction/);
  assert.match(get('08-B').explicitly_establishes, /last 3 months, last 3 pay slips/);
  assert.match(get('08-B').does_not_establish, /not individually mandatory/);
  assert.match(get('09-B').does_not_establish, /do not restrict accommodation solely to hotels/);
  assert.match(get('11-B').does_not_establish, /Do not require an organised tour/);
  assert.match(get('11-C').does_not_establish, /not a mandatory purchase of a non-refundable ticket/);
  assert.match(get('11-D').explicitly_establishes, /return ticket OR sufficient means/);
  assert.equal(get('11-D').application_stage, 'border_entry');
});
test('financial references retain amounts, accommodation conditions and border-entry scope', () => {
  const get = l => read(`records/EP001-08-${l}/0.1.0.json`);
  for (const l of 'CDEF') {
    const d = get(l); assert.equal(d.interpretation.application_stage, 'border_entry');
    assert.equal(d.citations[0].source_id, 'FRANCE-VISAS-ARRIVAL');
    assert.equal(d.applicability.applicant_conditions.mode, 'SPECIFIED');
    assert.match(d.interpretation.does_not_establish, /not an automatic application-stage refusal threshold/);
  }
  assert.match(get('C').interpretation.explicitly_establishes, /EUR 65 per day/);
  assert.match(get('D').interpretation.explicitly_establishes, /EUR 120 per day/);
  assert.match(get('E').interpretation.explicitly_establishes, /EUR 65 per day for the hotel-covered period plus EUR 120 per day for the remaining period/);
  assert.ok(get('E').interpretation.required_applicant_inputs.some(i => i.name === 'accommodation.segments'));
  assert.match(get('F').interpretation.explicitly_establishes, /EUR 32.50 per day/);
  assert.ok(get('F').interpretation.dependencies.some(d => d.evidence_reference?.id === 'EP001-09-E'));
  assert.ok(get('F').interpretation.dependencies.some(d => /mere presence does not establish validation/.test(d.description) && d.blocking));
  assert.match(get('G').interpretation.does_not_establish, /automatic visa application FAIL/);
});
test('private-host originals and Article 15 insurance retain their conditions and stages', () => {
  const get = k => read(`records/EP001-${k}/0.1.0.json`);
  assert.deepEqual(get('09-C').applicability.applicant_conditions.values, ['hosted_by_private_individual_in_France']);
  assert.match(get('09-D').interpretation.explicitly_establishes, /town hall/);
  assert.equal(get('09-E').interpretation.application_stage, 'supporting_documentation / border_entry');
  assert.match(get('09-E').interpretation.explicitly_establishes, /original attestation/);
  assert.match(get('10-F').interpretation.explicitly_establishes, /amount 30000, currency EUR/);
  assert.match(get('10-F').interpretation.does_not_establish, /No exchange-rate equivalent/);
  assert.match(get('10-B').interpretation.explicitly_establishes, /repatriation for medical reasons/);
  assert.match(get('10-C').interpretation.explicitly_establishes, /urgent medical attention and\/or emergency hospital treatment and death/);
  assert.match(get('10-D').interpretation.explicitly_establishes, /throughout the territory of the Member States/);
  assert.match(get('10-E').interpretation.explicitly_establishes, /entire intended stay or transit/);
  assert.deepEqual(get('10-A').applicability.applicant_conditions.values, ['uniform_visa_for_one_or_two_entries']);
  assert.match(get('10-G').interpretation.explicitly_establishes, /first intended visit.*subsequent stays/);
  assert.match(get('10-H').interpretation.does_not_establish, /No insurer-country FAIL rule/);
});
test('batch dependencies resolve across slots and retain prior competence evidence without cycles', () => {
  const refs = manifest.evidence_record_references.filter(r => /^EP001-(07|08|09|10|11)-/.test(r.id));
  const graph = new Map(refs.map(r => [r.id, read(r.path).interpretation.dependencies.filter(d => d.evidence_reference).map(d => d.evidence_reference.id)]));
  assert.ok(graph.get('EP001-09-A').includes('EP001-07-B'));
  assert.ok(graph.get('EP001-08-A').includes('EP001-07-C'));
  assert.ok(graph.get('EP001-11-C').includes('EP001-07-D'));
  assert.ok(graph.get('EP001-11-F').includes('EP001-02-I'));
  assert.ok(graph.get('EP001-11-F').includes('EP001-03-D'));
  const visit = (id, ancestors = new Set()) => {
    assert.ok(!ancestors.has(id), `Dependency cycle at ${id}`);
    const next = new Set([...ancestors, id]);
    for (const child of graph.get(id) || []) if (graph.has(child)) visit(child, next);
  };
  for (const id of graph.keys()) visit(id);
});

test('EP001-12-T/12-P/13/14 keep separate records, purposes and pending verification', () => {
  const slots = {'12-T':'ABCDEF','12-P':'ABCDEFG','13':'ABCDEFGH','14':'ABCDEFGHIJ'};
  let count = 0;
  for (const [slot, letters] of Object.entries(slots)) {
    const refs = manifest.evidence_record_references.filter(r => r.id.startsWith(`EP001-${slot}-`));
    assert.deepEqual(refs.map(r => r.id), [...letters].map(l => `EP001-${slot}-${l}`));
    for (const ref of refs) {
      const e = read(ref.path); accepts('evidence-record', e); count++;
      assert.equal(e.metadata_completeness, 'INCOMPLETE'); assert.equal(e.research_status, 'NEEDS_REVIEW');
      assert.equal(e.review.reviewer_id, null); assert.equal(e.review.verification_basis, null);
      assert.ok(Object.values(e.review.checks).every(c => c.status === 'PENDING' && c.references.length === 0));
      if (slot === '12-T' || slot === '12-P') assert.deepEqual(e.applicability.purposes.values, [slot === '12-T' ? 'tourism' : 'private_visit']);
      for (const c of e.citations) {
        assert.equal(c.supporting_excerpt, null); assert.equal(c.excerpt_language, null); assert.equal(c.effective_from, null);
        const s = read(`sources/${c.source_id}/${c.source_revision}.json`); accepts('source', s);
        assert.equal(s.provenance.state, 'SUPPLIED_REFERENCE'); assert.equal(s.retrieved_at, null); assert.equal(s.provenance.inspected_at, null);
      }
      e.research_status = 'VERIFIED'; rejects('evidence-record', e);
    }
  }
  assert.equal(count, 31);
});
test('four-slot batch preserves exact new page paths and prior source-revision pins', () => {
  const expected = {
    'FRANCE-VISAS-TOURISM-PRIVATE-STAY/0.1.0':'https://france-visas.gouv.fr/en/web/france-visas/tourisme-et-sejour-prive',
    'FRANCE-VISAS-SHORT-STAY/0.3.0':'https://france-visas.gouv.fr/en/web/france-visas/visa-de-court-sejour',
    'FRANCE-VISAS-FAMILY-PURPOSE/0.1.0':'https://france-visas.gouv.fr/en/motif-familial',
    'FRANCE-VISAS-APPLICATION-PROCESS/0.2.0':'https://france-visas.gouv.fr/en/web/france-visas/la-demarche',
  };
  for (const [ref, url] of Object.entries(expected)) assert.equal(read(`sources/${ref}.json`).url, url);
  const prior = read('records/EP001-04-I/0.1.0.json');
  assert.equal(prior.citations[0].source_revision, '0.1.0');
  assert.equal(read('records/EP001-03-A/0.1.0.json').citations[1].source_revision, '0.2.0');
});
test('purpose specialisations link common evidence without inventing document checklists', () => {
  const get = k => read(`records/EP001-${k}/0.1.0.json`).interpretation;
  for (const k of ['12-T-C','12-P-D']) {
    const deps = get(k).dependencies.map(d => d.evidence_reference.id);
    for (const id of ['EP001-07-A','EP001-08-A','EP001-09-A','EP001-10-A','EP001-11-A']) assert.ok(deps.includes(id));
  }
  assert.match(get('12-T-B').does_not_establish, /No assessment of incidental remote work/);
  assert.match(get('12-T-F').does_not_establish, /must not silently default to tourism/);
  assert.match(get('12-P-B').explicitly_establishes, /without settling permanently/);
  assert.match(get('12-P-C').does_not_establish, /Do not route ordinary private visits/);
  assert.deepEqual(get('12-P-E').dependencies.map(d => d.evidence_reference.id), ['EP001-09-C','EP001-09-D','EP001-09-E']);
  assert.match(get('12-P-G').explicitly_establishes, /do not establish one complete universal private-visit checklist/);
});
test('age/physical branches preserve exact boundaries and Ireland child attendance', () => {
  const get = k => read(`records/EP001-${k}/0.1.0.json`);
  assert.deepEqual(get('13-B').applicability.applicant_conditions.values, ['age_under_12']);
  assert.match(get('13-B').interpretation.does_not_establish, /strictly below 12, not age <= 12/);
  assert.match(get('13-C').interpretation.explicitly_establishes, /child must still be present/);
  assert.match(get('13-D').interpretation.explicitly_establishes, /up-to-date recognisable ISO\/IEC-format photograph/);
  assert.deepEqual(get('14-C').applicability.applicant_conditions.values, ['first_application_and_age_over_12']);
  assert.ok(get('14-C').interpretation.dependencies.some(d => /Age exactly 12/.test(d.description) && d.status === 'PENDING' && d.blocking));
  assert.match(get('13-E').interpretation.does_not_establish, /Not an age exemption/);
  assert.match(get('14-G').interpretation.explicitly_establishes, /maximum possible number/);
  assert.match(get('14-H').interpretation.explicitly_establishes, /subsequent application/);
  assert.match(get('14-H').interpretation.does_not_establish, /No invented duration/);
  assert.ok(get('14-F').interpretation.dependencies.some(d => d.evidence_reference.id === 'EP001-13-B'));
});
test('biometric reuse keeps less-than-59-month references and local attendance conditional', () => {
  const get = k => read(`records/EP001-${k}/0.1.0.json`).interpretation;
  const d = get('14-D'); assert.match(d.explicitly_establishes, /less than 59 months/);
  assert.match(d.does_not_establish, /not five years or 60 months/);
  assert.deepEqual(d.reference_events.map(e => e.name), ['previous_biometric_schengen_visa_issue','previous_fingerprint_capture_before_current_application']);
  assert.match(d.reference_events[0].notes, /Exact reference event for ago requires source review/);
  assert.match(get('14-E').does_not_establish, /No automatic guarantee/);
  assert.match(get('14-J').does_not_establish, /Do not infer fingerprint exemption eliminates local attendance/);
  assert.ok(get('14-J').dependencies.some(d => /Neither source is silently treated as overriding/.test(d.description) && d.status === 'PENDING'));
  assert.ok(get('14-I').dependencies.some(d => d.evidence_reference.id === 'EP001-06-I'));
});
test('ordinary-adult intended scope is schema-supported without VERIFIED or complete coverage', () => {
  accepts('pack-manifest', manifest);
  assert.deepEqual(manifest.research_profile.applicant_conditions, {mode:'SPECIFIED',values:['ordinary_adult_applicant']});
  assert.notEqual(manifest.reviewer_status, 'APPROVED'); assert.notEqual(manifest.completeness_status, 'COMPLETE_FOR_DECLARED_SCOPE');
  for (const c of manifest.coverage_by_purpose) assert.match(c.notes, /minors and exceptional categories unsupported/i);
  const declaration = read('records/EP001-13-H/0.1.0.json');
  assert.equal(declaration.research_status, 'NEEDS_REVIEW'); assert.equal(declaration.candidate_rule_id, null);
  assert.match(declaration.interpretation.does_not_establish, /No numeric definition of adult supplied/);
  assert.ok(manifest.unresolved_questions.some(q => /Age exactly 12|age exactly 12/.test(q.question) && q.status === 'PENDING'));
});
test('all active and retained evidence dependency references have no cycles', () => {
  const graph = new Map();
  for (const id of fs.readdirSync(path.join(root, 'records'))) {
    for (const rev of fs.readdirSync(path.join(root, 'records', id))) {
      const e = read(`records/${id}/${rev}`);
      graph.set(`${e.evidence_id}@${e.revision}`, e.interpretation.dependencies.filter(d => d.evidence_reference).map(d => `${d.evidence_reference.id}@${d.evidence_reference.revision}`));
    }
  }
  const complete = new Set(), pending = new Set();
  const visit = id => {
    assert.ok(graph.has(id), `Missing dependency ${id}`);
    assert.ok(!pending.has(id), `Dependency cycle at ${id}`);
    if (complete.has(id)) return;
    pending.add(id); for (const child of graph.get(id)) visit(child);
    pending.delete(id); complete.add(id);
  };
  for (const id of graph.keys()) visit(id);
});

test('final audit keeps five independent slots and does not create independent rules or VERIFIED evidence', () => {
  const expected = {'15':'ABCDEFGH','16':'ABCDEFGH','17':'ABCDEFGHI','18':'ABCDEFG','19':'ABCDEFGHIJ'};
  let count = 0;
  for (const [slot, letters] of Object.entries(expected)) {
    const refs = manifest.evidence_record_references.filter(r => r.id.startsWith(`EP001-${slot}-`));
    assert.deepEqual(refs.map(r => r.id), [...letters].map(l => `EP001-${slot}-${l}`));
    for (const ref of refs) {
      const e = read(ref.path); accepts('evidence-record', e); count++;
      assert.equal(e.candidate_rule_id, null); assert.equal(e.research_status, 'NEEDS_REVIEW'); assert.equal(e.metadata_completeness, 'INCOMPLETE');
      assert.ok(e.interpretation.dependencies.some(d => d.evidence_reference));
      assert.equal(e.review.reviewer_id, null); assert.equal(e.review.verification_basis, null);
      assert.ok(Object.values(e.review.checks).every(c => c.status === 'PENDING' && c.references.length === 0));
      for (const c of e.citations) {
        assert.equal(c.supporting_excerpt, null); assert.equal(c.excerpt_language, null);
        const s = read(`sources/${c.source_id}/${c.source_revision}.json`); accepts('source', s);
        assert.equal(s.provenance.state, 'SUPPLIED_REFERENCE'); assert.equal(s.retrieved_at, null); assert.equal(s.provenance.inspected_at, null);
      }
      e.research_status = 'VERIFIED'; rejects('evidence-record', e);
    }
  }
  assert.equal(count, 42);
});
test('audit source identity and historical dates preserve all prior revision metadata', () => {
  const get = k => read(`records/EP001-${k}/0.1.0.json`);
  assert.equal(read('sources/FRANCE-VISAS-TOURISM-PRIVATE-STAY/0.2.0.json').url, 'https://www.france-visas.gouv.fr/en/tourisme-et-sejour-prive');
  assert.equal(get('12-T-B').citations[0].source_revision, '0.1.0');
  const nationality = get('18-A').citations[0];
  assert.equal(nationality.source_revision, '0.2.0'); assert.equal(nationality.locator.article, 'Article 3'); assert.equal(nationality.locator.section, 'Annex I');
  assert.equal(get('15-B').citations[0].source_revision, '0.1.0');
  for (const c of get('19-G').citations) { assert.equal(c.effective_from, '2025-12-08'); assert.equal(c.effective_to, '2026-02-28'); }
  assert.equal(read('sources/IE-TRAVEL-CONFIRMATION-2026-PDF/0.1.0.json').effective_from, null);
  assert.equal(get('05-H').citations[0].effective_from, null);
  const summer = get('19-H').citations[0]; assert.equal(summer.effective_from, '2026-07-13'); assert.equal(summer.effective_to, '2026-08-31');
  assert.match(get('19-G').interpretation.does_not_establish, /not a current September 2026/);
  assert.match(get('19-H').interpretation.does_not_establish, /Not current in September 2026/);
});
test('coverage audits retain ordinary scope, India baseline, stage boundaries and recorded gaps', () => {
  const get = k => read(`records/EP001-${k}/0.1.0.json`).interpretation;
  assert.match(get('18-A').explicitly_establishes, /India remains in Annex I/);
  assert.match(get('18-D').explicitly_establishes, /Irish residence alone does not remove/);
  assert.match(get('15-B').explicitly_establishes, /not automatically French overseas/);
  assert.match(get('15-C').explicitly_establishes, /routes outside intended V1/);
  assert.match(get('16-G').does_not_establish, /No exemption entitlement inferred/);
  assert.match(get('18-F').does_not_establish, /not proof no additional official requirements exist/);
  assert.ok(get('18-G').dependencies.some(d => d.evidence_reference?.id === 'EP001-04-G'));
  assert.match(get('17-D').explicitly_establishes, /1 calendar month after intended return to Ireland/);
  assert.match(get('17-D').does_not_establish, /Not 30 days/);
  assert.match(get('15-E').does_not_establish, /automatic visa-application refusal thresholds/);
  assert.ok(get('17-H').dependencies.some(d => /passport-return procedure is absent/.test(d.description) && d.status === 'PENDING'));
});
test('re-entry audits preserve valid IRP, renewal uncertainty and exceptional permission checks', () => {
  const get = k => read(`records/EP001-${k}/0.1.0.json`);
  for (const l of 'ABCDEFGHIJ') assert.equal(get(`19-${l}`).interpretation.application_stage, 'irish_reentry');
  assert.match(get('19-A').interpretation.explicitly_establishes, /valid, in-date IRP/);
  assert.match(get('19-C').interpretation.does_not_establish, /Do not automatically determine qualification/);
  assert.deepEqual(get('19-D').interpretation.required_applicant_inputs.map(i => i.name), ['residence.permission_valid_until','trip.intended_return_to_ireland_date']);
  assert.match(get('19-D').interpretation.does_not_establish, /not IRP-card expiry/);
  assert.match(get('19-E').interpretation.does_not_establish, /into French visa FAIL/);
  assert.match(get('19-F').interpretation.explicitly_establishes, /D entry visa after arriving abroad/);
  assert.match(get('19-F').interpretation.does_not_establish, /not proven satisfaction of the French one-month condition/);
  assert.match(get('19-J').interpretation.does_not_establish, /no UI, runtime result or re-entry guarantee/);
});
test('all known verification issues remain pending and readiness is not completion or promotion', () => {
  accepts('pack-manifest', manifest);
  assert.equal(manifest.completeness_status, 'READY_FOR_REVIEW'); assert.equal(manifest.reviewer_status, 'PENDING');
  for (const c of manifest.coverage_by_purpose) {
    assert.equal(c.status, 'READY_FOR_REVIEW'); assert.match(c.notes, /EVIDENCE VERIFICATION AND PROMOTION, pending and not started/);
    assert.match(c.notes, /Not VERIFIED, production ready/);
  }
  const work = manifest.unresolved_questions.filter(q => q.question.startsWith('Verification-pass work item'));
  assert.equal(work.length, 10); assert.ok(work.every(q => q.status === 'PENDING' && q.blocking && q.resolution === null));
  const text = work.map(q => q.question).join('\n');
  for (const phrase of ['EP001-01-I','EP001-04-J','EP001-06-J','Age exactly 12','Reuse versus local attendance','Pending Irish renewal','Border financial amounts','Document recognition','Provenance and review','Passport return operational gap']) assert.ok(text.includes(phrase));
});
test('complete active EP-001 audit counts retain three unresolved records and zero VERIFIED', () => {
  const records = manifest.evidence_record_references.map(r => read(r.path));
  assert.equal(manifest.source_references.length, 22); assert.equal(records.length, 171);
  assert.equal(records.filter(e => e.research_status === 'NEEDS_REVIEW').length, 168);
  assert.deepEqual(records.filter(e => e.research_status === 'UNRESOLVED').map(e => e.evidence_id), ['EP001-01-I','EP001-04-J','EP001-06-J']);
  assert.equal(records.filter(e => e.research_status === 'VERIFIED').length, 0);
  assert.equal(manifest.research_slot_references.length, 20);
  assert.equal(manifest.research_slot_references.filter(s => s.status === 'UNRESEARCHED').length, 0);
});
