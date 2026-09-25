// Offline research-infrastructure validation. Never evaluates visa eligibility.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { errors, loadSchema } = require('./schema.cjs');
const root = path.resolve(__dirname, '..');
const key = (id, revision) => `${id}@${revision}`;
const recordKey = r => key(r.source_id || r.evidence_id, r.source_revision || r.revision);
const expectedPath = r => r.source_id ? `sources/${r.source_id}/${r.source_revision}.json` : `records/${r.evidence_id}/${r.revision}.json`;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function schemaSet(base = root) {
  return Object.fromEntries(['source', 'evidence-record', 'pack-manifest'].map(n => [n, loadSchema(path.join(base, 'schemas', `${n}.schema.json`))]));
}
function validateData({ sources, evidence, manifest }, schemas = schemaSet()) {
  const issues = [];
  const fail = message => issues.push(message);
  const sourceMap = new Map(), evidenceMap = new Map();
  for (const [kind, records, registry] of [['source', sources, sourceMap], ['evidence-record', evidence, evidenceMap]]) {
    for (const record of records) {
      issues.push(...errors(schemas[kind], record).map(e => `${recordKey(record)}: ${e}`));
      if (registry.has(recordKey(record))) fail(`Duplicate revision ${recordKey(record)}`);
      registry.set(recordKey(record), record);
    }
  }
  issues.push(...errors(schemas['pack-manifest'], manifest).map(e => `manifest: ${e}`));
  if (issues.length) return issues; // avoid processing structurally invalid records
  for (const [refs, map] of [[manifest.source_references, sourceMap], [manifest.evidence_record_references, evidenceMap]]) {
    const seen = new Set();
    for (const ref of refs) {
      const k = key(ref.id, ref.revision), record = map.get(k);
      if (!record) fail(`Manifest reference missing: ${k}`);
      else if (ref.path !== expectedPath(record)) fail(`Manifest path mismatch: ${k}`);
      if (seen.has(ref.id)) fail(`Multiple active revisions for ${ref.id}`);
      seen.add(ref.id);
    }
  }
  if (new Set(manifest.coverage_by_purpose.map(p => p.purpose)).size !== manifest.purposes.length || manifest.purposes.some(p => !manifest.coverage_by_purpose.some(c => c.purpose === p))) fail('Manifest purpose coverage mismatch');
  if (new Set(manifest.research_slot_references.map(s => s.slot_id)).size !== manifest.research_slot_references.length) fail('Duplicate research slots');
  for (const source of sources) {
    if (source.effective_from && source.effective_to && source.effective_from > source.effective_to) fail(`${recordKey(source)}: reversed effective dates`);
    if (source.schema_version === '2.0.0' && source.provenance.state === 'RETRIEVED_INSPECTED') {
      if (Date.parse(source.provenance.inspected_at) < Date.parse(source.retrieved_at)) fail(`${recordKey(source)}: inspection predates retrieval`);
      if (source.verified_at && Date.parse(source.verified_at) < Date.parse(source.provenance.inspected_at)) fail(`${recordKey(source)}: verification predates inspection`);
    }
  }
  for (const record of evidence) {
    const label = recordKey(record), verified = record.research_status === 'VERIFIED';
    if (verified && record.schema_version !== '2.0.0') fail(`${label}: legacy schema is valid but VERIFIED repository promotion requires 2.0.0 provenance`);
    const citationKeys = new Set(record.citations.map(c => key(c.source_id, c.source_revision)));
    for (const citation of record.citations) {
      const k = key(citation.source_id, citation.source_revision), source = sourceMap.get(k);
      if (!source) { fail(`${label}: missing source revision ${k}`); continue; }
      if (citation.effective_from && citation.effective_to && citation.effective_from > citation.effective_to) fail(`${label}: reversed citation effective dates`);
      if (!verified) continue;
      if (source.schema_version !== '2.0.0' || source.provenance?.state !== 'RETRIEVED_INSPECTED' || source.metadata_completeness !== 'COMPLETE' || source.official_status !== 'CONFIRMED' || !source.verified_at) fail(`${label}: unacceptable source provenance ${k}`);
      if (source.verified_at && Date.parse(source.verified_at) > Date.parse(record.review.reviewed_at)) fail(`${label}: evidence reviewed before source verification`);
      if (record.schema_version !== '2.0.0') continue;
      const disposition = citation.date_version_review;
      const unknown = !citation.effective_from || (!source.source_version && !source.consolidation_date);
      if (unknown && disposition.status !== 'UNKNOWN_NON_BLOCKING') fail(`${label}: unknown date/version requires reviewed non-blocking disposition`);
      if (disposition.review_reference !== k) fail(`${label}: date/version review reference must resolve to its exact cited source`);
      if (Date.parse(disposition.reviewed_at) > Date.parse(record.review.reviewed_at)) fail(`${label}: date review postdates evidence review`);
      if (citation.translation_relied_on && citation.translation_status !== 'REVIEWED') fail(`${label}: relied-on translation is unreviewed`);
    }
    for (const kind of ['exceptions', 'dependencies', 'conflicts']) {
      for (const item of record.interpretation[kind]) {
        const ref = item.evidence_reference;
        if (ref) {
          const target = evidenceMap.get(key(ref.id, ref.revision));
          if (!target) fail(`${label}: missing ${kind} reference ${ref.id}@${ref.revision}`);
          else {
            if (ref.path !== expectedPath(target)) fail(`${label}: ${kind} reference path mismatch`);
            if (verified && kind === 'dependencies' && item.blocking && target.research_status !== 'VERIFIED') fail(`${label}: blocking dependency is not VERIFIED`);
          }
        }
      }
    }
    if (verified) for (const [name, check] of Object.entries(record.review.checks)) {
      for (const ref of check.references) if (!sourceMap.has(ref) || !citationKeys.has(ref)) fail(`${label}: ${name} reference must identify an exact cited source revision: ${ref}`);
    }
  }
  return issues;
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
function checkLock(lock, actual, baseline = null) {
  const issues = [];
  if (lock.format_version !== '1.0.0' || !lock.files || typeof lock.files !== 'object') return ['Invalid revision lock'];
  for (const [name, bytes] of Object.entries(actual)) {
    if (lock.files[name] !== sha256(bytes)) issues.push(`Immutable revision missing from lock or modified: ${name}`);
  }
  for (const name of Object.keys(lock.files)) if (!Object.hasOwn(actual, name)) issues.push(`Locked revision deleted: ${name}`);
  if (baseline) for (const [name, hash] of Object.entries(baseline.files)) if (lock.files[name] !== hash) issues.push(`Previously locked revision removed/rewritten: ${name}`);
  return issues;
}
function validateRepository(base = root) {
  const load = p => JSON.parse(fs.readFileSync(p, 'utf8'));
  const sourceFiles = walk(path.join(base, 'sources')).filter(p => p.endsWith('.json'));
  const evidenceFiles = walk(path.join(base, 'records')).filter(p => p.endsWith('.json'));
  const data = { sources: sourceFiles.map(load), evidence: evidenceFiles.map(load), manifest: load(path.join(base, 'packs/EP-001/manifest.json')) };
  const issues = validateData(data, schemaSet(base));
  for (const [files, records] of [[sourceFiles, data.sources], [evidenceFiles, data.evidence]]) files.forEach((p, i) => {
    if (path.relative(base, p).split(path.sep).join('/') !== expectedPath(records[i])) issues.push(`Record filename/ID/revision mismatch: ${p}`);
  });
  const actual = Object.fromEntries([...sourceFiles, ...evidenceFiles, ...walk(path.join(base, 'schemas')).filter(p => /schemas[/\\]\d+\.\d+\.\d+[/\\]/.test(p))].map(p => [path.relative(base, p).split(path.sep).join('/'), fs.readFileSync(p)]));
  const lock = load(path.join(base, 'revision-lock.json'));
  let baseline = null;
  // Compare to committed lock if available. First uncommitted milestone has no
  // external trust anchor; coordinated edits to files+lock need human diff review.
  try { baseline = JSON.parse(execFileSync('git', ['show', 'HEAD:data/evidence/revision-lock.json'], { cwd: base, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] })); } catch {}
  issues.push(...checkLock(lock, actual, baseline));
  const checklist = fs.readFileSync(path.join(base, 'packs/EP-001/checklist.md'), 'utf8');
  for (const slot of data.manifest.research_slot_references) {
    if (slot.path !== `checklist.md#${slot.slot_id.toLowerCase()}`) issues.push(`Unexpected slot path: ${slot.slot_id}`);
    const section = checklist.split(`## ${slot.slot_id}\n`)[1]?.split('\n## ')[0];
    if (!section || !section.includes(`- Status: ${slot.status}`)) issues.push(`Checklist/manifest status mismatch: ${slot.slot_id}`);
  }
  return { issues, source_revisions: data.sources.length, evidence_revisions: data.evidence.length, active_sources: data.manifest.source_references.length, active_evidence: data.manifest.evidence_record_references.length };
}
module.exports = { validateData, validateRepository, schemaSet, checkLock, sha256 };
if (require.main === module) {
  try { const result = validateRepository(); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.issues.length ? 1 : 0; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
