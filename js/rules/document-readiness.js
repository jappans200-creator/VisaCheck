(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./applicant-facts.js') : root.VisaCheckApplicantFacts, common ? require('./engine.js') : root.VisaCheckRulesEngine, common ? require('./evaluators.js') : root.VisaCheckRuleEvaluators);
  if (common) module.exports = api;
  else root.VisaCheckDocumentReadiness = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (factsAPI, engine, evaluators) {
  'use strict';
  const copy = v => v == null ? null : JSON.parse(JSON.stringify(v));
  // Presence and authority acceptance are deliberately different outputs. This
  // API never returns legal PASS/FAIL and never calculates approval probability.
  function evaluateReadiness(model, definition) {
    const d = definition || {};
    const result = { evidence_id: d.evidence_id ?? null, revision: d.revision ?? null, status: 'UNKNOWN', reason: 'INVALID_CONFIGURATION', relevant_facts: {}, source_refs: copy(d.source_refs ?? []), applicability: null, diagnostics: [], assessment: 'ASSESSMENT_REQUIRED', substantive_acceptance: 'NOT_DETERMINED', publication: copy(d.publication), notes: copy(d.notes ?? []) };
    const finish = (status, reason) => copy({ ...result, status, reason });
    if (typeof d.evidence_id !== 'string' || (!d.presence_condition && (!Array.isArray(d.presence_alternatives) || !d.presence_alternatives.length || !d.presence_alternatives.every(p => typeof p === 'string' && p))) || !Array.isArray(d.source_refs)) return finish('UNKNOWN', 'INVALID_CONFIGURATION');
    const applicability = engine.evaluateApplicability(model, d.applicability);
    result.applicability = applicability; Object.assign(result.relevant_facts, applicability.relevant_facts);
    if (applicability.outcome !== 'MATCH') return finish(applicability.outcome === 'NO_MATCH' ? 'NOT_APPLICABLE' : 'UNKNOWN', 'APPLICABILITY_UNRESOLVED_OR_EXCLUDED');
    if (d.review_gate) {
      const gate = engine.evaluateReviewGate(model, d.review_gate);
      result.review_gate = gate; Object.assign(result.relevant_facts, gate.relevant_facts);
      if (gate.reason) return finish('UNKNOWN', gate.reason);
    }
    const read = path => { const fact = factsAPI.getFact(model, path); result.relevant_facts[path] = fact; return fact; };
    const alternatives = (d.presence_alternatives || []).map(read);
    let present = alternatives.some(f => f.state === 'KNOWN' && f.value === true);
    let absent = alternatives.length > 0 && alternatives.every(f => f.state === 'KNOWN' && f.value === false);
    result.matched_alternatives = (d.presence_alternatives || []).filter((p, i) => alternatives[i].state === 'KNOWN' && alternatives[i].value === true);
    if (d.presence_condition) {
      const condition = engine.evaluateApplicability(model, d.presence_condition);
      Object.assign(result.relevant_facts, condition.relevant_facts);
      present = condition.outcome === 'MATCH'; absent = condition.outcome === 'NO_MATCH';
    }
    if (d.minimum_count) {
      const count = read(d.minimum_count.fact);
      if (!Number.isSafeInteger(d.minimum_count.minimum) || d.minimum_count.minimum < 0) return finish('UNKNOWN', 'INVALID_COUNT_CONFIGURATION');
      if (count.state !== 'KNOWN' || !Number.isSafeInteger(count.value) || count.value < 0) { present = false; if (!absent) result.diagnostics.push({ code: 'UNKNOWN_DOCUMENT_COUNT' }); }
      else if (count.value < d.minimum_count.minimum) { present = false; absent = true; }
    }
    if (d.coverage) {
      const p = {};
      for (const key of ['start_date', 'end_date', 'required_start_date', 'required_end_date']) {
        const value = read(d.coverage[key]); p[key] = value.state === 'KNOWN' ? value.value : null;
      }
      const evidence = read(d.coverage.evidence_present_fact);
      const coverage = evidence.state === 'KNOWN' && evidence.value === true ? evaluators.evaluate('date_interval_coverage', p) : { status: 'UNKNOWN', code: 'NO_CONFIRMED_DATED_EVIDENCE' };
      result.diagnostics.push({ code: 'EVIDENCE_DATE_COVERAGE', coverage: coverage.coverage ?? 'UNKNOWN', reason: coverage.code, parameters: p });
    }
    for (const annotation of d.annotations || []) {
      const match = engine.evaluateApplicability(model, annotation.condition);
      Object.assign(result.relevant_facts, match.relevant_facts);
      if (match.outcome === 'MATCH') result.diagnostics.push({ code: annotation.code });
    }
    // Optional contextual evidence is retained, never used as an adequacy score.
    for (const path of d.context_facts || []) read(path);
    return finish(present ? 'PRESENT' : absent ? 'MISSING' : 'UNKNOWN', present ? 'EVIDENCE_REPORTED_PRESENT' : absent ? 'EVIDENCE_REPORTED_ABSENT' : 'EVIDENCE_PRESENCE_UNRESOLVED');
  }
  return { evaluateReadiness };
});
