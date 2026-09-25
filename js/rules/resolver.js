(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./engine.js') : root.VisaCheckRulesEngine);
  if (common) module.exports = api;
  else root.VisaCheckRuleResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (engine) {
  'use strict';
  const { evaluateApplicability } = engine;
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  // Configuration contract (engineering only, not a production legal schema):
  // {config_id, config_revision, review_status:'REVIEWED', bundles:[
  //   {bundle_id,bundle_revision,rule_refs:[{rule_id,rule_revision}]}], coverage:[
  //   {coverage_id,applicability,completeness:'COMPLETE'|'PARTIAL',bundle_ids:[]}]}.
  // COMPLETE asserts reviewed coverage, not that an applicant passes any rule.
  // No country lists, jurisdiction selection or route inference live here.
  function resolveRules(model, config) {
    const result = { coverage: 'UNSUPPORTED', config_ref: null, candidate_bundles: [], diagnostics: [] };
    const reject = code => ({ ...result, diagnostics: [{ code, dimension: null }] });
    if (!object(config) || !text(config.config_id) || !text(config.config_revision)) return reject('INVALID_CONFIGURATION');
    result.config_ref = { config_id: config.config_id, config_revision: config.config_revision };
    if (config.review_status !== 'REVIEWED') return reject('UNREVIEWED_CONFIGURATION');
    if ((Object.hasOwn(config, 'relationships') && (!Array.isArray(config.relationships) || config.relationships.length)) || ['supplements', 'replaces', 'exempts'].some(k => Object.hasOwn(config, k))) return reject('UNSUPPORTED_RELATIONSHIPS');
    if (!Array.isArray(config.bundles) || !Array.isArray(config.coverage)) return reject('INVALID_CONFIGURATION');
    const bundles = new Map();
    for (const bundle of config.bundles) {
      if (!object(bundle) || !text(bundle.bundle_id) || !text(bundle.bundle_revision) || bundles.has(bundle.bundle_id) || !Array.isArray(bundle.rule_refs) || !bundle.rule_refs.length || !bundle.rule_refs.every(r => object(r) && text(r.rule_id) && text(r.rule_revision))) return reject('INVALID_BUNDLE_CONFIGURATION');
      bundles.set(bundle.bundle_id, bundle);
    }
    const coverageIds = new Set();
    let possible = false, complete = false, unresolved = false;
    const candidates = new Map();
    for (const scope of config.coverage) {
      if (!object(scope) || !text(scope.coverage_id) || coverageIds.has(scope.coverage_id) || !['COMPLETE', 'PARTIAL'].includes(scope.completeness) || !Array.isArray(scope.bundle_ids) || !scope.bundle_ids.length || !scope.bundle_ids.every(text)) return reject('INVALID_COVERAGE_CONFIGURATION');
      coverageIds.add(scope.coverage_id);
      const match = evaluateApplicability(model, scope.applicability);
      result.diagnostics.push(...match.diagnostics.map(d => ({ ...d, coverage_id: scope.coverage_id })));
      if (match.outcome === 'NO_MATCH') continue;
      possible = true;
      if (match.outcome === 'UNKNOWN') unresolved = true;
      if (scope.completeness === 'PARTIAL') { unresolved = true; result.diagnostics.push({ code: 'INCOMPLETE_CONFIGURED_COVERAGE', dimension: null, coverage_id: scope.coverage_id }); }
      let available = true;
      for (const id of scope.bundle_ids) {
        const bundle = bundles.get(id);
        if (!bundle) { available = false; unresolved = true; result.diagnostics.push({ code: 'MISSING_BUNDLE', dimension: 'bundle_id', bundle_id: id }); continue; }
        const prior = candidates.get(id);
        candidates.set(id, { ...bundle, applicability: prior?.applicability === 'MATCH' ? 'MATCH' : match.outcome });
      }
      if (available && match.outcome === 'MATCH' && scope.completeness === 'COMPLETE') complete = true;
    }
    result.coverage = complete && !unresolved ? 'SUPPORTED' : possible ? 'PARTIAL' : 'UNSUPPORTED';
    result.candidate_bundles = [...candidates.values()];
    if (!possible) result.diagnostics.push({ code: 'NO_CONFIGURED_COVERAGE', dimension: null });
    // Explicit relationships are retained in bundles for later resolution; they
    // cannot be silently presented as a fully resolved release in this phase.
    if (result.candidate_bundles.some(b => (Object.hasOwn(b, 'relationships') && (!Array.isArray(b.relationships) || b.relationships.length)) || ['supplements', 'replaces', 'exempts'].some(k => Object.hasOwn(b, k)))) {
      result.coverage = 'PARTIAL';
      result.diagnostics.push({ code: 'UNSUPPORTED_RELATIONSHIPS', dimension: null });
    }
    return JSON.parse(JSON.stringify(result));
  }
  return { resolveRules };
});
