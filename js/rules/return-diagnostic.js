(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./applicant-facts.js') : root.VisaCheckApplicantFacts, common ? require('./engine.js') : root.VisaCheckRulesEngine, common ? require('./evaluators.js') : root.VisaCheckRuleEvaluators);
  if (common) module.exports = api;
  else root.VisaCheckReturnDiagnostic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (factsAPI, engine, evaluators) {
  'use strict';
  const copy = v => v == null ? null : JSON.parse(JSON.stringify(v));
  // Independent output; never mutates or aggregates application-rule results.
  // All route, status, action and classification vocabulary is configuration.
  function evaluateReturnDiagnostic(model, config) {
    const c = config || {};
    const result = { diagnostic_id: c.diagnostic_id ?? null, diagnostic_revision: c.diagnostic_revision ?? null, classification: c.results?.unknown ?? 'UNKNOWN', reason: 'INVALID_CONFIGURATION', action_code: null, relevant_facts: {}, source_refs: copy(c.source_refs ?? []), publication: copy(c.publication), final_entry_determination: false };
    const finish = reason => copy({ ...result, reason });
    if (!c.facts || !c.results || !['ready', 'action_required', 'unknown'].every(k => typeof c.results[k] === 'string') || !Array.isArray(c.source_refs) || !c.validity_parameters || typeof c.required_visa_status !== 'string' || typeof c.pending_renewal_status !== 'string' || typeof c.action_code !== 'string') return finish('INVALID_CONFIGURATION');
    const applicability = engine.evaluateApplicability(model, c.applicability);
    result.applicability = applicability; Object.assign(result.relevant_facts, applicability.relevant_facts);
    if (applicability.outcome !== 'MATCH') return finish('UNSUPPORTED_OR_UNRESOLVED_ROUTE');
    const gate = engine.evaluateReviewGate(model, c.review_gate);
    result.review_gate = gate; Object.assign(result.relevant_facts, gate.relevant_facts);
    if (gate.reason) return finish(gate.reason);
    const values = {};
    for (const key of ['visa_status', 'card_present', 'card_expiry', 'return_date', 'renewal_status']) {
      const fact = factsAPI.getFact(model, c.facts[key]);
      values[key] = fact; result.relevant_facts[c.facts[key]] = fact;
    }
    if (values.visa_status.state !== 'KNOWN') return finish('MISSING_ENTRY_VISA_REQUIREMENT_STATUS');
    if (values.visa_status.value !== c.required_visa_status) return finish('UNSUPPORTED_ENTRY_VISA_REQUIREMENT_STATUS');
    if (values.card_present.state !== 'KNOWN' || typeof values.card_present.value !== 'boolean') return finish('MISSING_CARD_PRESENCE');
    const validity = evaluators.evaluate('minimum_remaining_validity', { ...c.validity_parameters, expiry_date: values.card_expiry.state === 'KNOWN' ? values.card_expiry.value : null, reference_date: values.return_date.state === 'KNOWN' ? values.return_date.value : null });
    result.card_validity_evaluation = validity;
    if (validity.status === 'UNKNOWN') return finish('MISSING_OR_INVALID_RETURN_VALIDITY');
    if (validity.status === 'PASS' && values.card_present.value === true) { result.classification = c.results.ready; return finish('VALID_CARD_ON_RETURN'); }
    if (values.renewal_status.state === 'KNOWN' && values.renewal_status.value === c.pending_renewal_status) {
      result.classification = c.results.action_required; result.action_code = c.action_code;
      return finish('VALID_RETURN_DOCUMENT_REQUIRED');
    }
    return finish('RETURN_DOCUMENT_REQUIRES_REVIEW');
  }
  return { evaluateReturnDiagnostic };
});
