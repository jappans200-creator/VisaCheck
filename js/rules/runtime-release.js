(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./engine.js') : root.VisaCheckRulesEngine, common ? require('./applicant-facts.js') : root.VisaCheckApplicantFacts, common ? require('./assessment.js') : root.VisaCheckAssessment);
  if (common) module.exports = api;
  else root.VisaCheckRuntimeRelease = api;
})(globalThis, function (engine, factsAPI, assessmentAPI) {
  'use strict';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const scalar = v => text(v) || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v);
  const fail = code => { throw new Error('Runtime release configuration: ' + code); };
  const check = (condition, code) => { if (!condition) fail(code); };
  const keys = (v, required) => object(v) && Object.keys(v).length === required.length && required.every(k => Object.hasOwn(v, k));
  const pathOK = p => typeof p === 'string' && /^data\/official-requirements\/[A-Za-z0-9_./-]+\.json$/.test(p) && !p.split('/').some(s => s === '..' || s === '.' || s === '');
  const factOK = p => typeof p === 'string' && /^[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)+$/.test(p) && !p.split('.').some(k => ['__proto__', 'prototype', 'constructor'].includes(k));
  const roles = {
    rule: ['rule_id', 'rule_revision'], baseline: ['rule_id', 'rule_revision'],
    reference: ['reference_id', 'reference_version'], readiness: ['configuration_id', 'revision'],
    purpose: ['configuration_id', 'revision'], biometrics: ['configuration_id', 'revision'],
    submission: ['configuration_id', 'revision'], return_diagnostic: ['diagnostic_id', 'diagnostic_revision'], assessment: ['configuration_id', 'revision']
  };
  function validateExpression(e) {
    if (keys(e, ['always']) && e.always === true) return;
    for (const op of ['all', 'any']) if (keys(e, [op])) {
      check(Array.isArray(e[op]) && e[op].length > 0, 'INVALID_APPLICABILITY');
      e[op].forEach(validateExpression); return;
    }
    if (keys(e, ['not'])) { validateExpression(e.not); return; }
    check(keys(e, ['fact', 'op', 'value']) && factOK(e.fact), 'INVALID_APPLICABILITY');
    check(['eq', 'in', 'contains', 'subset', 'gte'].includes(e.op), 'INVALID_APPLICABILITY');
    check(e.op === 'gte' ? typeof e.value === 'number' && Number.isFinite(e.value)
      : ['in', 'subset'].includes(e.op) ? Array.isArray(e.value) && e.value.length > 0 && e.value.every(scalar) : scalar(e.value), 'INVALID_APPLICABILITY');
  }
  // The rule DSL is reused; numeric route constraints are configuration-only.
  function match(model, e) {
    if (e.all || e.any) {
      const children = (e.all || e.any).map(child => match(model, child));
      const states = children.map(c => c.outcome);
      const outcome = e.all ? states.includes('NO_MATCH') ? 'NO_MATCH' : states.includes('UNKNOWN') ? 'UNKNOWN' : 'MATCH'
        : states.includes('MATCH') ? 'MATCH' : states.includes('UNKNOWN') ? 'UNKNOWN' : 'NO_MATCH';
      return { outcome, diagnostics: children.flatMap(c => c.diagnostics) };
    }
    if (e.not) { const r = match(model, e.not); return { ...r, outcome: r.outcome === 'UNKNOWN' ? 'UNKNOWN' : r.outcome === 'MATCH' ? 'NO_MATCH' : 'MATCH' }; }
    if (e.op === 'gte') {
      const f = factsAPI.getFact(model, e.fact);
      return { outcome: f.state !== 'KNOWN' || typeof f.value !== 'number' ? 'UNKNOWN' : f.value >= e.value ? 'MATCH' : 'NO_MATCH', diagnostics: f.state !== 'KNOWN' ? [{ code: f.state + '_ROUTE_FACT', dimension: e.fact }] : [] };
    }
    return engine.evaluateApplicability(model, e);
  }
  const refs = release => release.groups.flatMap(g => g.assets);
  function validateRelease(r) {
    check(keys(r, ['schema_version', 'release_id', 'version', 'publication', 'applicability', 'exclude_when', 'coverage', 'evaluation_context', 'groups', 'report']), 'INVALID_RELEASE_STRUCTURE');
    check(r.schema_version === '1.0.0' && text(r.release_id) && /^\d+\.\d+\.\d+$/.test(r.version), 'INVALID_RELEASE_VERSION');
    // Production publishing requires a separate reviewed gate, absent in Stage C.
    check(keys(r.publication, ['status', 'release_ready', 'evidence_review_status']) && r.publication.status === 'DEVELOPMENT_PREVIEW' && r.publication.release_ready === false && r.publication.evidence_review_status === 'NEEDS_REVIEW', 'UNSUPPORTED_PUBLICATION_STATE');
    validateExpression(r.applicability); validateExpression(r.exclude_when);
    check(keys(r.coverage, ['scope', 'complete_when', 'notes']) && r.coverage.scope === 'APPLICABILITY_BOUND' && text(r.coverage.notes), 'INVALID_COVERAGE');
    validateExpression(r.coverage.complete_when);
    check(keys(r.evaluation_context, ['assessment_date']) && (r.evaluation_context.assessment_date === null || factsAPI.validDate(r.evaluation_context.assessment_date)), 'INVALID_CONTEXT');
    check(keys(r.report, ['document_attention_ids', 'assessment_ids']) && Object.values(r.report).every(v => Array.isArray(v) && v.every(text)), 'INVALID_REPORT_CONFIGURATION');
    check(Array.isArray(r.groups) && r.groups.length > 0, 'INVALID_GROUPS');
    const groups = new Set(), assetKeys = new Set(), identities = new Set(), paths = new Set(), singletons = new Set();
    for (const g of r.groups) {
      check(keys(g, ['id', 'when', 'assets']) && text(g.id) && !groups.has(g.id) && Array.isArray(g.assets) && g.assets.length > 0, 'INVALID_GROUP');
      groups.add(g.id); validateExpression(g.when);
      for (const a of g.assets) {
        check(keys(a, ['key', 'role', 'id', 'revision', 'path']) && text(a.key) && Object.hasOwn(roles, a.role) && text(a.id) && text(a.revision) && pathOK(a.path) && a.path.endsWith('/' + a.revision + '.json'), 'INVALID_ASSET_REFERENCE');
        const identity = roles[a.role][0] + ':' + a.id;
        check(!assetKeys.has(a.key) && !identities.has(identity) && !paths.has(a.path), 'DUPLICATE_OR_CONFLICTING_ASSET');
        assetKeys.add(a.key); identities.add(identity); paths.add(a.path);
        if (!['rule', 'readiness'].includes(a.role)) { check(!singletons.has(a.role), 'DUPLICATE_ROLE'); singletons.add(a.role); }
      }
    }
    check(singletons.has('baseline') === singletons.has('reference'), 'BASELINE_REFERENCE_PAIR_REQUIRED');
    check(singletons.has('assessment'), 'MISSING_ASSESSMENT_CONFIGURATION');
    const assessmentGroup=r.groups.find(g=>g.assets.some(a=>a.role==='assessment'));
    check(keys(assessmentGroup.when,['always'])&&assessmentGroup.when.always===true,'ASSESSMENT_MUST_ALWAYS_BE_SELECTED');
    return r;
  }
  function validateRegistry(releases) {
    check(Array.isArray(releases), 'INVALID_REGISTRY');
    const seen = new Set();
    for (const r of releases) { validateRelease(r); const key = r.release_id + '@' + r.version; check(!seen.has(key), 'DUPLICATE_RELEASE'); seen.add(key); }
    return releases;
  }
  async function loadRegistry(pins, readJSON) {
    check(Array.isArray(pins) && pins.length > 0, 'INVALID_RELEASE_PINS');
    const releases = [];
    for (const pin of pins) {
      check(keys(pin, ['release_id', 'version', 'path']) && text(pin.release_id) && text(pin.version) && pathOK(pin.path) && pin.path.endsWith('/' + pin.version + '.json'), 'INVALID_RELEASE_PIN');
      let release;
      try { release = await readJSON(pin.path); } catch { fail('RELEASE_LOAD_FAILED:' + pin.path); }
      check(release?.release_id === pin.release_id && release?.version === pin.version, 'RELEASE_PIN_MISMATCH');
      releases.push(release);
    }
    return validateRegistry(releases);
  }
  function routeModel(adapted) {
    return { facts: { ...adapted.model.facts, context: { single_trip: adapted.route_input?.single_trip ?? null, nationality_selection: adapted.route_input?.nationality ?? null } }, issues: adapted.model.issues };
  }
  function resolve(adapted, releases) {
    validateRegistry(releases);
    const model = routeModel(adapted), candidates = [], unresolved = [], diagnostics = [];
    for (const release of releases) {
      const applicability = match(model, release.applicability), excluded = match(model, release.exclude_when);
      if (excluded.outcome === 'MATCH' || applicability.outcome === 'NO_MATCH') continue;
      if (applicability.outcome === 'UNKNOWN') { unresolved.push(release); diagnostics.push(...applicability.diagnostics); }
      else candidates.push(release);
    }
    const route = { status: 'UNSUPPORTED', reason: 'No configured coverage for this profile.', assumptions: adapted.assumptions || [], route_id: ['identity.nationality', 'passport.issuing_country', 'passport.document_type', 'residence.country', 'trip.destination_country', 'trip.destination_territory', 'trip.visa_regime', 'trip.visa_type', 'trip.purpose'].map(p => { const f = factsAPI.getFact(model, p); return f.state === 'KNOWN' ? f.value : 'unknown'; }).join(':'), diagnostics };
    if (candidates.length + unresolved.length > 1) return { route: { ...route, status: 'PARTIAL', reason: 'Ambiguous runtime release coverage.', diagnostics: [...diagnostics, { code: 'AMBIGUOUS_RELEASE' }] }, release: null, asset_refs: [] };
    if (!candidates.length) return { route: unresolved.length ? { ...route, status: 'PARTIAL', reason: 'Material route facts are missing or invalid; no release selected.', diagnostics: [...diagnostics, { code: 'UNRESOLVED_ROUTE' }] } : route, release: null, asset_refs: [] };
    const release = candidates[0];
    let complete = match(model, release.coverage.complete_when).outcome === 'MATCH';
    const asset_refs = [];
    for (const group of release.groups) {
      const applicability = match(model, group.when);
      if (applicability.outcome === 'MATCH') asset_refs.push(...group.assets);
      else if (applicability.outcome === 'UNKNOWN') {
        complete = false;
        diagnostics.push({ code: 'UNRESOLVED_ASSET_GROUP', group_id: group.id, details: applicability.diagnostics });
      }
    }
    return { route: { ...route, status: complete ? 'SUPPORTED' : 'PARTIAL', reason: complete ? 'Configured preview coverage.' : 'Configured partial preview; route facts or coverage remain incomplete.', release_id: release.release_id, release_version: release.version }, release, asset_refs };
  }
  function validateAssets(selection, assets) {
    const selectedRoles = new Set(selection.asset_refs.map(a => a.role));
    check(selectedRoles.has('baseline') === selectedRoles.has('reference'), 'BASELINE_REFERENCE_PAIR_REQUIRED');
    for (const ref of selection.asset_refs) {
      const asset = assets?.[ref.key];
      check(object(asset), 'MISSING_ASSET:' + ref.key);
      const [id, revision] = roles[ref.role];
      check(asset[id] === ref.id && asset[revision] === ref.revision, 'ASSET_PIN_MISMATCH:' + ref.key);
      check(!['supplements', 'replaces', 'exempts', 'inherits', 'overrides'].some(k => Object.hasOwn(asset, k)) && (!Object.hasOwn(asset, 'relationships') || Array.isArray(asset.relationships) && asset.relationships.length === 0), 'UNSUPPORTED_ASSET_RELATIONSHIPS');
      if (['rule', 'baseline'].includes(ref.role)) check((asset.evaluator === 'reference_classification') === (ref.role === 'baseline'), 'ASSET_ROLE_MISMATCH');
      if (ref.role === 'readiness') check(Array.isArray(asset.items), 'INVALID_READINESS_ASSET');
    }
    const base = selection.asset_refs.find(a => a.role === 'baseline'), reference = selection.asset_refs.find(a => a.role === 'reference');
    if (base) check(assets[base.key].reference_data?.reference_id === reference.id && assets[base.key].reference_data?.reference_version === reference.revision, 'BASELINE_REFERENCE_PIN_MISMATCH');
    const assessmentRef=selection.asset_refs.find(a=>a.role==='assessment');
    if(selection.release||assessmentRef){
      check(assessmentRef,'MISSING_ASSESSMENT_CONFIGURATION');
      const c=assets[assessmentRef.key];assessmentAPI.validateConfiguration(c,null,selection.release);
      const allRefs=selection.release?refs(selection.release):selection.asset_refs;
      for(const binding of c.results){
        const ref=allRefs.find(a=>a.key===binding.asset_key);
        check(ref&&(ref.role==='readiness'||ref.revision===binding.revision),'UNKNOWN_ASSESSMENT_RESULT:'+binding.result_id);
        const asset=assets[ref.key];
        const expectedKind=['rule','baseline'].includes(ref.role)?'official':ref.role==='readiness'?'readiness':'procedure';
        check(binding.result_kind===expectedKind&&ref.role!=='assessment'&&ref.role!=='reference','INVALID_ASSESSMENT_RESULT_KIND');
        if(asset){
          const ids=ref.role==='readiness'?asset.items.map(i=>i.evidence_id):ref.role==='submission'?asset.items.map(i=>i.procedure_id):[ref.id];
          check(ids.includes(binding.result_id),'UNKNOWN_ASSESSMENT_RESULT:'+binding.result_id);
          if(ref.role==='readiness')check(asset.items.find(i=>i.evidence_id===binding.result_id).revision===binding.revision,'ASSESSMENT_RESULT_REVISION_MISMATCH');
        }
      }
    }
    return assets;
  }
  async function loadAssets(selection, readJSON) {
    const assets = Object.fromEntries(await Promise.all(selection.asset_refs.map(async a => {
      try { return [a.key, await readJSON(a.path)]; } catch { fail('ASSET_LOAD_FAILED:' + a.key + ':' + a.path); }
    })));
    return validateAssets(selection, assets);
  }
  function evaluationContext(selection, supplied = {}) {
    check(object(supplied) && Object.keys(supplied).every(k => k === 'assessment_date'), 'INVALID_CONTEXT');
    const assessment_date = Object.hasOwn(supplied, 'assessment_date') ? supplied.assessment_date : selection.release?.evaluation_context.assessment_date ?? null;
    check(assessment_date === null || factsAPI.validDate(assessment_date), 'INVALID_CONTEXT');
    return { assessment_date, release_version: selection.release?.version ?? null };
  }
  return { validateRelease, validateRegistry, loadRegistry, resolve, validateAssets, loadAssets, evaluationContext, refs };
});
