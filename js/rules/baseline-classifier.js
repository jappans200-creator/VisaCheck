(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./applicant-facts.js') : root.VisaCheckApplicantFacts, common ? require('./engine.js') : root.VisaCheckRulesEngine, common ? require('./reference-lookup.js') : root.VisaCheckReferenceLookup);
  if (common) module.exports = api;
  else root.VisaCheckBaselineClassifier = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (factsAPI, engine, lookupAPI) {
  'use strict';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const copy = v => v == null ? null : JSON.parse(JSON.stringify(v));
  // Separate classification API: a required baseline is not an applicant FAIL,
  // and a configured exempt baseline is not an eligibility PASS. All routing
  // vocabulary and permitted classifications are supplied by the draft rule.
  function classifyBaseline(model, rule, referenceData) {
    const r = object(rule) ? rule : {};
    const result = { rule_id: r.rule_id ?? null, rule_revision: r.rule_revision ?? null, classification: 'UNKNOWN', reason: 'INVALID_RULE', normalized_country_code: null, reference_data_id: r.reference_data?.reference_id ?? null, reference_data_version: r.reference_data?.reference_version ?? null, coverage: copy(referenceData?.coverage), source_refs: copy(r.source_refs ?? []), reference_source_refs: copy(referenceData?.source_refs ?? []), special_condition_diagnostics: [], relevant_facts: {}, publication: copy(r.publication), reference_publication: copy(referenceData?.publication), final_determination: false, release_ready: false, evaluator: { identifier: 'reference_classification', version: lookupAPI.VERSION } };
    const finish = reason => copy({ ...result, reason });
    if (!text(r.rule_id) || !text(r.rule_revision) || r.evaluator !== 'reference_classification' || !text(r.key_fact) || !object(r.reference_data) || !text(r.reference_data.reference_id) || !text(r.reference_data.reference_version) || !Array.isArray(r.source_refs) || !Array.isArray(r.allowed_classifications) || !r.allowed_classifications.length || !r.allowed_classifications.every(text)) return finish('INVALID_RULE');
    const key = factsAPI.getFact(model, r.key_fact);
    result.relevant_facts[r.key_fact] = key;
    result.normalized_country_code = key.state === 'KNOWN' && typeof key.value === 'string' ? key.value : null;
    const applicability = engine.evaluateApplicability(model, r.applicability);
    result.applicability = applicability; Object.assign(result.relevant_facts, applicability.relevant_facts);
    if (applicability.outcome !== 'MATCH') return finish(applicability.outcome === 'NO_MATCH' ? 'NOT_APPLICABLE' : 'UNRESOLVED_APPLICABILITY');
    const routes = r.special_routing;
    if (!object(routes) || !text(routes.document_fact) || !text(routes.conditions_fact) || !Array.isArray(routes.ordinary_document_values) || !routes.ordinary_document_values.length || !routes.ordinary_document_values.every(text) || !Array.isArray(routes.ordinary_condition_values) || !routes.ordinary_condition_values.every(text) || !Array.isArray(routes.review_condition_values) || !routes.review_condition_values.every(text) || routes.review_condition_values.some(v => routes.ordinary_condition_values.includes(v))) return finish('INVALID_SPECIAL_ROUTING');
    const doc = factsAPI.getFact(model, routes.document_fact), conditions = factsAPI.getFact(model, routes.conditions_fact);
    result.relevant_facts[routes.document_fact] = doc; result.relevant_facts[routes.conditions_fact] = conditions;
    if (doc.state !== 'KNOWN' || typeof doc.value !== 'string') return finish('UNKNOWN_DOCUMENT_TYPE');
    if (!routes.ordinary_document_values.includes(doc.value)) {
      result.special_condition_diagnostics.push({ fact: routes.document_fact, value: doc.value, reason: 'NON_ORDINARY_DOCUMENT' });
      return finish('SPECIAL_ROUTE_REQUIRES_REVIEW');
    }
    if (conditions.state !== 'KNOWN' || !Array.isArray(conditions.value) || !conditions.value.every(text)) return finish('UNKNOWN_APPLICANT_CONDITIONS');
    for (const value of conditions.value) if (!routes.ordinary_condition_values.includes(value)) result.special_condition_diagnostics.push({ fact: routes.conditions_fact, value, recognized: routes.review_condition_values.includes(value) });
    if (result.special_condition_diagnostics.length) return finish(result.special_condition_diagnostics.some(d => d.recognized) ? 'SPECIAL_ROUTE_REQUIRES_REVIEW' : 'UNRESOLVED_APPLICANT_CONDITIONS');
    if (referenceData?.reference_id !== r.reference_data.reference_id || referenceData?.reference_version !== r.reference_data.reference_version) return finish('REFERENCE_VERSION_MISMATCH');
    const lookup = lookupAPI.classify(referenceData, key.state === 'KNOWN' ? key.value : null);
    result.lookup = lookup;
    if (lookup.status !== 'MATCH') return finish(lookup.reason);
    if (!r.allowed_classifications.includes(lookup.value)) return finish('UNSUPPORTED_CLASSIFICATION');
    result.classification = lookup.value;
    return finish('BASELINE_CLASSIFIED');
  }
  return { classifyBaseline };
});
