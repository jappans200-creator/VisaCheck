(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./applicant-facts.js') : root.VisaCheckApplicantFacts, common ? require('./engine.js') : root.VisaCheckRulesEngine, common ? require('./evaluators.js') : root.VisaCheckRuleEvaluators);
  if (common) module.exports = api;
  else root.VisaCheckApplicationProcedure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (factsAPI, engine, evaluators) {
  'use strict';
  const copy = v => v == null ? null : JSON.parse(JSON.stringify(v));
  function session(model, config) {
    const result = { configuration_id: config.configuration_id, revision: config.revision, status: 'UNKNOWN', reason: 'MISSING_OR_UNRESOLVED_FACTS', relevant_facts: {}, source_refs: copy(config.source_refs), publication: copy(config.publication) };
    const read = path => { const f = factsAPI.getFact(model, path); result.relevant_facts[path] = f; return f.state === 'KNOWN' ? f.value : null; };
    const scope = engine.evaluateApplicability(model, config.applicability);
    result.applicability = scope; Object.assign(result.relevant_facts, scope.relevant_facts);
    return { result, read, applicable: scope.outcome === 'MATCH', finish: () => copy(result) };
  }
  function evaluatePurposeRoute(model, config) {
    const s = session(model, config), r = s.result;
    r.checklist_completeness = 'NON_EXHAUSTIVE'; r.exact_document_list = 'VISA_ASSISTANT_DEPENDENT';
    if (!s.applicable) return s.finish();
    const purpose = s.read(config.facts.purpose), activity = s.read(config.facts.professional_activity), settlement = s.read(config.facts.family_settlement);
    const conditions = s.read(config.facts.conditions);
    if (!Array.isArray(conditions) || settlement === null || purpose === null) return s.finish();
    if (settlement === true || conditions.some(v => !config.ordinary_conditions.includes(v)) || !Object.hasOwn(config.routes, purpose)) { r.reason = 'SPECIAL_OR_DIFFERENT_ROUTE_REQUIRED'; return s.finish(); }
    const route = config.routes[purpose]; r.purpose = route.purpose_label;
    if (route.no_professional_activity) {
      if (activity === null) return s.finish();
      if (activity !== false) { r.reason = 'SPECIAL_OR_DIFFERENT_ROUTE_REQUIRED'; return s.finish(); }
    }
    if (route.duration_parameters) {
      const check = evaluators.evaluate('relative_date_boundary', { ...route.duration_parameters, actual_date: s.read(config.facts.exit), reference_date: s.read(config.facts.entry) });
      r.duration_scope = check;
      if (check.status !== 'PASS') { r.reason = check.status === 'FAIL' ? 'SPECIAL_OR_DIFFERENT_ROUTE_REQUIRED' : 'UNRESOLVED_ROUTE_DURATION'; return s.finish(); }
    }
    r.status = 'SUPPORTED'; r.reason = 'PURPOSE_ROUTE_SUPPORTED'; r.readiness_references = copy(route.readiness_references); r.rule_references = copy(route.rule_references); r.coverage_gaps = copy(route.coverage_gaps);
    return s.finish();
  }
  function evaluateBiometrics(model, config) {
    const s = session(model, config), r = s.result;
    r.fingerprinting = 'UNKNOWN'; r.personal_attendance = 'UNRESOLVED'; r.reuse_potential = null; r.reuse_confirmed = null;
    r.identifiers = copy(config.identifiers);
    if (!s.applicable) return s.finish();
    const age = s.read(config.facts.age), physical = s.read(config.facts.physical_impossibility), exemption = s.read(config.facts.exemption);
    if (physical === config.declared_status || exemption === config.declared_status) { r.status = 'ACTION_REQUIRED'; r.reason = 'SPECIAL_BIOMETRIC_HANDLING_REQUIRED'; return s.finish(); }
    if (!Number.isSafeInteger(age) || age < 0) return s.finish();
    if (age < config.fingerprint_exempt_below_age) { r.status = 'READY'; r.reason = 'AGE_FINGERPRINT_EXEMPTION_ONLY'; r.fingerprinting = 'EXEMPT'; return s.finish(); }
    if (age === config.unresolved_age_boundary) { r.reason = 'AGE_BOUNDARY_REQUIRES_REVIEW'; return s.finish(); }
    if (physical !== config.not_declared_status || (exemption !== null && exemption !== config.not_declared_status)) return s.finish();
    const previous = s.read(config.facts.previous_present), confirmed = s.read(config.facts.reuse_confirmed);
    r.reuse_confirmed = typeof confirmed === 'boolean' ? confirmed : null;
    if (previous === false) {
      if (confirmed === true) { r.reason = 'CONFLICTING_REUSE_FACTS'; return s.finish(); }
      r.status = 'ACTION_REQUIRED'; r.reason = 'NEW_COLLECTION_REQUIRED'; r.fingerprinting = 'COLLECTION_REQUIRED'; r.personal_attendance = 'GENERALLY_REQUIRED_FOR_INITIAL_COLLECTION'; r.reuse_potential = false; return s.finish();
    }
    if (previous !== true) return s.finish();
    const collected = s.read(config.facts.collection_date), lodged = s.read(config.facts.lodging_date);
    if (collected && lodged && collected > lodged) { r.reason = 'CONFLICTING_COLLECTION_DATE'; return s.finish(); }
    const check = evaluators.evaluate('relative_date_boundary', { ...config.reuse_parameters, reference_date: collected, actual_date: lodged });
    r.reuse_window = check;
    if (check.status === 'UNKNOWN') return s.finish();
    r.reuse_potential = check.status === 'PASS';
    if (!r.reuse_potential && confirmed === true) { r.reason = 'CONFLICTING_REUSE_FACTS'; return s.finish(); }
    r.status = r.reuse_potential && confirmed === true ? 'READY' : 'ACTION_REQUIRED';
    r.reason = r.reuse_potential ? confirmed === true ? 'REUSE_REPORTED_CONFIRMED' : 'POTENTIAL_REUSE_REQUIRES_CONFIRMATION' : 'NEW_COLLECTION_REQUIRED';
    r.fingerprinting = r.reuse_potential ? 'REUSE_SUBJECT_TO_PROCEDURE' : 'COLLECTION_REQUIRED';
    return s.finish();
  }
  function evaluateSubmissionProcedure(model, config) {
    const s = session(model, config), r = s.result;
    r.items = []; r.operational_information = copy(config.operational_information); r.decision_authority = config.decision_authority; r.intake_provider = copy(config.intake_provider); r.live_availability = 'NOT_QUERIED';
    if (!s.applicable) return s.finish();
    for (const item of config.items) {
      const value = s.read(item.fact);
      r.items.push({ procedure_id: item.procedure_id, status: value === true ? 'READY' : value === false ? 'ACTION_REQUIRED' : 'UNKNOWN', reason: value === true ? item.ready_code : value === false ? item.action_code : 'UNKNOWN_PROCEDURE_FACT', operational_only: true });
    }
    const languages = s.read(config.translation.fact);
    r.translation_diagnostic = Array.isArray(languages) && languages.length ? languages.some(v => !config.translation.accepted_languages.includes(v)) ? 'TRANSLATION_MAY_BE_REQUIRED' : 'NO_LANGUAGE_TRIGGER_IDENTIFIED' : 'UNKNOWN';
    // No aggregate procedure score or visa eligibility result.
    r.status = 'REPORTED'; r.reason = 'SEPARATE_PROCEDURE_STATES';
    return s.finish();
  }
  return { evaluatePurposeRoute, evaluateBiometrics, evaluateSubmissionProcedure };
});
