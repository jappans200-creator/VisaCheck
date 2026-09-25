(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(common ? require('./applicant-facts.js') : root.VisaCheckApplicantFacts, common ? require('./evaluators.js') : root.VisaCheckRuleEvaluators);
  if (common) module.exports = api;
  else root.VisaCheckRulesEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (factsAPI, evaluators) {
  'use strict';
  const { getFact, validDate } = factsAPI;
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const scalar = v => typeof v === 'boolean' || text(v) || (typeof v === 'number' && Number.isFinite(v));
  const clone = v => v == null ? null : JSON.parse(JSON.stringify(v));

  // Applicability DSL: {always:true}, {all:[...]}, {any:[...]}, {not:...},
  // or {fact:'trip.purpose', op:'eq'|'in'|'contains', value:...}.
  // No implicit country groups, specificity priority, or closed-world defaults.
  function evaluateApplicability(model, expression) {
    const relevant_facts = {};
    function run(node) {
      const diagnostic = (code, path = null) => ({ outcome: 'UNKNOWN', diagnostics: [{ code, dimension: path }] });
      if (!object(node)) return diagnostic('INVALID_APPLICABILITY');
      const keys = Object.keys(node);
      if (keys.length === 1 && node.always === true) return { outcome: 'MATCH', diagnostics: [] };
      for (const operator of ['all', 'any']) {
        if (keys.length === 1 && Object.hasOwn(node, operator)) {
          if (!Array.isArray(node[operator]) || !node[operator].length) return diagnostic('INVALID_APPLICABILITY');
          const children = node[operator].map(run);
          const outcomes = children.map(c => c.outcome);
          const outcome = operator === 'all'
            ? outcomes.includes('NO_MATCH') ? 'NO_MATCH' : outcomes.includes('UNKNOWN') ? 'UNKNOWN' : 'MATCH'
            : outcomes.includes('MATCH') ? 'MATCH' : outcomes.includes('UNKNOWN') ? 'UNKNOWN' : 'NO_MATCH';
          return { outcome, diagnostics: children.flatMap(c => c.diagnostics) };
        }
      }
      if (keys.length === 1 && Object.hasOwn(node, 'not')) {
        const child = run(node.not);
        return { outcome: child.outcome === 'UNKNOWN' ? 'UNKNOWN' : child.outcome === 'MATCH' ? 'NO_MATCH' : 'MATCH', diagnostics: child.outcome === 'MATCH' ? [{ code: 'EXCLUDED_BY_APPLICABILITY', dimension: node.not.fact || null }] : child.outcome === 'UNKNOWN' ? child.diagnostics : [] };
      }
      if (keys.length !== 3 || !keys.every(k => ['fact', 'op', 'value'].includes(k)) || !text(node.fact) || !['eq', 'in', 'contains', 'subset'].includes(node.op)) return diagnostic('INVALID_APPLICABILITY');
      if (['in', 'subset'].includes(node.op) ? !Array.isArray(node.value) || !node.value.every(scalar) || (node.op === 'in' && !node.value.length) : !scalar(node.value)) return diagnostic('INVALID_APPLICABILITY', node.fact);
      const actual = getFact(model, node.fact);
      relevant_facts[node.fact] = actual;
      if (actual.state !== 'KNOWN') return diagnostic(`${actual.state}_APPLICABILITY_FACT`, node.fact);
      if (['contains', 'subset'].includes(node.op) ? !Array.isArray(actual.value) || !actual.value.every(scalar) : !scalar(actual.value)) return diagnostic('INVALID_APPLICABILITY_FACT', node.fact);
      const matches = node.op === 'eq' ? actual.value === node.value : node.op === 'in' ? node.value.includes(actual.value) : node.op === 'subset' ? actual.value.every(v => node.value.includes(v)) : actual.value.includes(node.value);
      return { outcome: matches ? 'MATCH' : 'NO_MATCH', diagnostics: matches ? [] : [{ code: 'DIMENSION_MISMATCH', dimension: node.fact, actual: actual.value, expected: node.value }] };
    }
    return { ...run(expression), relevant_facts };
  }
  // Top-level evaluator parameters are literals or explicit {fact:'path'}
  // bindings. No expression evaluation, callbacks, implicit units or JS eval.
  function bind(model, parameters) {
    const relevant_facts = {}, resolved = {};
    let invalid = !object(parameters);
    for (const [key, value] of Object.entries(object(parameters) ? parameters : {})) {
      if (object(value)) {
        if (Object.keys(value).length !== 1 || !text(value.fact)) { invalid = true; resolved[key] = null; continue; }
        const fact = getFact(model, value.fact);
        relevant_facts[value.fact] = fact;
        resolved[key] = fact.value;
        if (fact.state !== 'KNOWN') invalid = true;
      } else resolved[key] = value;
    }
    return { parameters: resolved, relevant_facts, invalid };
  }
  // Synthetic/untrusted definitions are accepted for engineering tests. This API
  // does not certify evidence or authorize production publication. A future
  // reviewed rule release must perform that separate provenance gate.
  function evaluateRule(model, rule, context = {}) {
    const r = object(rule) ? rule : {};
    const result = {
      rule_id: r.rule_id ?? null, rule_revision: r.rule_revision ?? null,
      requirement: clone(r.requirement), status: 'UNKNOWN', code: 'INVALID_RULE',
      relevant_facts: {}, evaluated_parameters: null, source_refs: clone(r.source_refs ?? []),
      evaluator: { identifier: r.evaluator ?? null, version: evaluators.VERSION },
      applicability: null, warning_evaluation: null, exception_evaluations: [],
      publication: clone(r.publication),
      effective_from: r.effective_from ?? null, effective_to: r.effective_to ?? null,
      assessment_date: context?.assessment_date ?? null,
    };
    const finish = (status, code) => clone({ ...result, status, code });
    if (!text(r.rule_id) || !text(r.rule_revision) || !text(r.requirement) || !text(r.evaluator) || !object(r.parameters) || !Array.isArray(r.source_refs)) return finish('UNKNOWN', 'INVALID_RULE');
    const applicability = evaluateApplicability(model, r.applicability);
    result.applicability = applicability;
    Object.assign(result.relevant_facts, applicability.relevant_facts);
    if (applicability.outcome === 'NO_MATCH') return finish('NOT_APPLICABLE', 'APPLICABILITY_EXCLUDED');
    if (applicability.outcome !== 'MATCH') return finish('UNKNOWN', 'UNRESOLVED_APPLICABILITY');
    if (Object.hasOwn(r, 'review_gate')) {
      const gate = evaluateReviewGate(model, r.review_gate);
      result.review_gate = gate; Object.assign(result.relevant_facts, gate.relevant_facts);
      if (gate.reason) return finish('UNKNOWN', gate.reason);
    }
    // Relationships remain explicit and unresolved in Phase 1, never overrides.
    if (Object.hasOwn(r, 'relationships') && (!Array.isArray(r.relationships) || r.relationships.length)) return finish('UNKNOWN', 'UNSUPPORTED_RELATIONSHIPS');
    if (['supplements', 'replaces', 'exempts'].some(k => Object.hasOwn(r, k))) return finish('UNKNOWN', 'UNSUPPORTED_RELATIONSHIPS');
    // Absent bounds mean no temporal filter configured. An explicitly null bound
    // is unresolved, not an inferred open-ended effective period.
    const bounds = ['effective_from', 'effective_to'].filter(k => Object.hasOwn(r, k));
    if (bounds.length) {
      if (!validDate(context?.assessment_date) || bounds.some(k => !validDate(r[k]))) return finish('UNKNOWN', 'UNRESOLVED_EFFECTIVE_DATES');
      if (bounds.length === 2 && r.effective_from > r.effective_to) return finish('UNKNOWN', 'CONFLICTING_EFFECTIVE_DATES');
      if ((r.effective_from && context.assessment_date < r.effective_from) || (r.effective_to && context.assessment_date > r.effective_to)) return finish('NOT_APPLICABLE', 'OUTSIDE_EFFECTIVE_WINDOW');
    }
    let evaluation;
    if (r.evaluator === 'condition_match') {
      if (Object.keys(r.parameters).length !== 1 || !Object.hasOwn(r.parameters, 'condition')) return finish('UNKNOWN', 'INVALID_CONFIGURATION');
      const match = evaluateApplicability(model, r.parameters.condition);
      Object.assign(result.relevant_facts, match.relevant_facts);
      result.evaluated_parameters = clone(r.parameters);
      evaluation = { status: match.outcome === 'MATCH' ? 'PASS' : match.outcome === 'NO_MATCH' ? 'FAIL' : 'UNKNOWN', code: 'CONFIGURED_CONDITION_MATCH', condition_evaluation: match };
    } else {
      const bound = bind(model, r.parameters);
      Object.assign(result.relevant_facts, bound.relevant_facts);
      result.evaluated_parameters = bound.parameters;
      if (bound.invalid) return finish('UNKNOWN', 'INVALID_OR_MISSING_FACT');
      evaluation = evaluators.evaluate(r.evaluator, bound.parameters);
    }
    result.evaluation = evaluation;
    // Discretionary exceptions never decide entitlement. The ordinary result is
    // retained in evaluation. Rules explicitly select which ordinary statuses
    // are affected; uncertainty can change FAIL but cannot undermine PASS.
    if (Object.hasOwn(r, 'exception_conditions')) {
      if (!Array.isArray(r.exception_conditions)) return finish('UNKNOWN', 'INVALID_EXCEPTION_CONFIGURATION');
      let triggeredCode = null, unresolved = false;
      for (const exception of r.exception_conditions) {
        if (!object(exception) || exception.behavior !== 'REQUIRES_REVIEW' || !text(exception.reason_code) || !Array.isArray(exception.when_statuses) || !exception.when_statuses.length || !exception.when_statuses.every(s => ['PASS', 'FAIL'].includes(s)) || !object(exception.condition) || Object.keys(exception).some(k => !['condition', 'behavior', 'reason_code', 'when_statuses'].includes(k))) return finish('UNKNOWN', 'INVALID_EXCEPTION_CONFIGURATION');
        const match = evaluateApplicability(model, exception.condition);
        Object.assign(result.relevant_facts, match.relevant_facts);
        const considered = exception.when_statuses.includes(evaluation.status);
        result.exception_evaluations.push({ condition: clone(exception.condition), behavior: exception.behavior, reason_code: exception.reason_code, when_statuses: clone(exception.when_statuses), considered, ...match });
        if (match.diagnostics.some(d => d.code === 'INVALID_APPLICABILITY')) return finish('UNKNOWN', 'INVALID_EXCEPTION_CONFIGURATION');
        if (!considered) continue;
        if (match.outcome === 'MATCH' && triggeredCode === null) triggeredCode = exception.reason_code;
        if (match.outcome === 'UNKNOWN' && evaluation.status === 'FAIL') unresolved = true;
      }
      if (triggeredCode !== null) return finish('UNKNOWN', triggeredCode);
      if (unresolved) return finish('UNKNOWN', 'EXCEPTION_APPLICABILITY_UNKNOWN');
    }
    if (evaluation.status !== 'PASS' || !Object.hasOwn(r, 'warning_condition')) return finish(evaluation.status, evaluation.code);
    const warning = r.warning_condition;
    if (!object(warning) || !text(warning.evaluator) || !object(warning.parameters)) return finish('UNKNOWN', 'INVALID_WARNING_CONFIGURATION');
    const warningBound = bind(model, warning.parameters);
    const warningResult = warningBound.invalid ? { status: 'UNKNOWN', code: 'INVALID_OR_MISSING_FACT' } : evaluators.evaluate(warning.evaluator, warningBound.parameters);
    result.warning_evaluation = { ...warningResult, evaluator: { identifier: warning.evaluator, version: evaluators.VERSION }, evaluated_parameters: warningBound.parameters, source_refs: clone(warning.source_refs ?? r.source_refs) };
    Object.assign(result.relevant_facts, warningBound.relevant_facts);
    return warningResult.status === 'PASS' ? finish('WARNING', 'EXPLICIT_WARNING_CONDITION') : warningResult.status === 'UNKNOWN' ? finish('UNKNOWN', 'UNRESOLVED_WARNING_CONDITION') : finish('PASS', evaluation.code);
  }
  function evaluateRules(model, rules, context = {}) {
    if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
    const counts = new Map();
    for (const rule of rules) if (text(rule?.rule_id)) counts.set(rule.rule_id, (counts.get(rule.rule_id) || 0) + 1);
    return rules.map(rule => {
      const result = evaluateRule(model, rule, context);
      if (counts.get(rule?.rule_id) > 1) { result.status = 'UNKNOWN'; result.code = 'AMBIGUOUS_RULE_REVISIONS'; }
      return result;
    });
  }
  // A required ordinary-context gate is distinct from discretionary exceptions:
  // unresolved ordinary context blocks even a passing numerical test. Optional
  // affirmative triggers can flag special facts without inferring their absence.
  function evaluateReviewGate(model, gate) {
    if (!object(gate) || !text(gate.reason_code) || !Array.isArray(gate.affirmative_triggers)) return { reason: 'INVALID_REVIEW_GATE', relevant_facts: {} };
    const ordinary = evaluateApplicability(model, gate.ordinary_condition);
    const relevant_facts = { ...ordinary.relevant_facts };
    const triggers = gate.affirmative_triggers.map(c => evaluateApplicability(model, c));
    for (const trigger of triggers) Object.assign(relevant_facts, trigger.relevant_facts);
    const malformed = [ordinary, ...triggers].some(c => c.diagnostics.some(d => d.code === 'INVALID_APPLICABILITY'));
    return { reason: malformed ? 'INVALID_REVIEW_GATE' : ordinary.outcome !== 'MATCH' || triggers.some(c => c.outcome === 'MATCH') ? gate.reason_code : null, ordinary, triggers, relevant_facts };
  }
  return { evaluateApplicability, evaluateReviewGate, evaluateRule, evaluateRules };
});
