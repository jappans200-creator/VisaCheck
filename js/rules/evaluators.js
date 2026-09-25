(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./applicant-facts.js') : root.VisaCheckApplicantFacts);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VisaCheckRuleEvaluators = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (factsAPI) {
  'use strict';
  const { validDate } = factsAPI;
  const VERSION = '1.0.0';
  const unknown = code => ({ status: 'UNKNOWN', code });
  const result = ok => ({ status: ok ? 'PASS' : 'FAIL', code: ok ? 'CONDITION_SATISFIED' : 'CONDITION_VIOLATED' });
  const number = v => typeof v === 'number' && Number.isFinite(v);
  const scalar = v => typeof v === 'boolean' || (typeof v === 'string' && v.trim().length > 0) || number(v);

  // Date-only UTC arithmetic. DAYS and CALENDAR_DAYS are whole date increments,
  // never elapsed-hour calculations. WORKING_DAYS needs a future explicit calendar.
  // Month/year overflow is UNKNOWN unless the rule explicitly chooses CLAMP.
  function addPeriod(date, amount, unit, calendar_policy = 'REJECT') {
    if (!validDate(date) || !Number.isSafeInteger(amount)) return { code: 'INVALID_DATE_OR_AMOUNT', value: null };
    if (!['DAYS', 'CALENDAR_DAYS', 'CALENDAR_MONTHS', 'YEARS'].includes(unit)) return { code: 'UNSUPPORTED_UNIT', value: null };
    if (!['REJECT', 'CLAMP'].includes(calendar_policy)) return { code: 'UNSUPPORTED_CALENDAR_POLICY', value: null };
    const value = new Date(`${date}T00:00:00Z`);
    if (unit === 'DAYS' || unit === 'CALENDAR_DAYS') value.setUTCDate(value.getUTCDate() + amount);
    else {
      const day = value.getUTCDate();
      value.setUTCDate(1);
      if (unit === 'YEARS') value.setUTCFullYear(value.getUTCFullYear() + amount);
      else value.setUTCMonth(value.getUTCMonth() + amount);
      const last = new Date(value.getTime());
      last.setUTCMonth(last.getUTCMonth() + 1, 0);
      if (day > last.getUTCDate() && calendar_policy === 'REJECT') return { code: 'CALENDAR_OVERFLOW', value: null };
      value.setUTCDate(Math.min(day, last.getUTCDate()));
    }
    if (!Number.isFinite(value.getTime()) || value.getUTCFullYear() < 1 || value.getUTCFullYear() > 9999) return { code: 'DATE_OUT_OF_RANGE', value: null };
    return { value: value.toISOString().slice(0, 10), code: null };
  }
  function validity(p, age) {
    const documentDate = age ? p.issue_date : p.expiry_date;
    if (!validDate(documentDate) || !validDate(p.reference_date) || !Number.isSafeInteger(p.amount) || p.amount < 0) return unknown('INVALID_OR_MISSING_INPUT');
    if (age && documentDate > p.reference_date) return unknown('CONFLICTING_DATES');
    const boundary = addPeriod(age ? documentDate : p.reference_date, p.amount, p.unit, p.calendar_policy);
    if (boundary.value === null) return unknown(boundary.code);
    return { ...result(age ? p.reference_date <= boundary.value : documentDate >= boundary.value), boundary: boundary.value };
  }
  // Inclusive date intervals, merged before counting. No visa or geography
  // vocabulary belongs here. The caller classifies each authorization.
  function rollingPresenceWindow(p) {
    if (p.window_unit !== 'CALENDAR_DAYS' || p.direction !== 'LOOKBACK_INCLUSIVE' || p.entry_day_counts !== true || p.exit_day_counts !== true) return unknown('UNSUPPORTED_WINDOW_CONFIGURATION');
    if (!Number.isSafeInteger(p.maximum_days) || p.maximum_days < 0 || !Number.isSafeInteger(p.window_amount) || p.window_amount < 1 || !Array.isArray(p.excluded_authorization_types) || !p.excluded_authorization_types.every(v => typeof v === 'string' && v.trim() && v !== 'UNKNOWN')) return unknown('INVALID_WINDOW_CONFIGURATION');
    if (!validDate(p.proposed_entry_date) || !validDate(p.proposed_exit_date)) return unknown('INVALID_OR_MISSING_PROPOSED_DATE');
    if (p.proposed_exit_date < p.proposed_entry_date) return unknown('CONFLICTING_PROPOSED_DATES');
    if (!['NONE', 'COMPLETE', 'INCOMPLETE', 'UNKNOWN'].includes(p.history_status)) return unknown('INVALID_OR_MISSING_HISTORY_STATUS');
    if (p.history_status === 'UNKNOWN' || p.history_status === 'INCOMPLETE') return unknown('UNRESOLVED_HISTORY');
    const history = p.history_status === 'NONE' && p.history == null ? [] : p.history;
    if (!Array.isArray(history)) return unknown('INVALID_OR_MISSING_HISTORY');
    if (p.history_status === 'NONE' && history.length) return unknown('CONFLICTING_HISTORY');
    const day = value => Date.parse(`${value}T00:00:00Z`) / 86400000;
    const iso = value => new Date(value * 86400000).toISOString().slice(0, 10);
    const start = day(p.proposed_entry_date), end = day(p.proposed_exit_date);
    const firstWindowStart = start - p.window_amount + 1;
    if (firstWindowStart < day('0001-01-01')) return unknown('WINDOW_DATE_OUT_OF_RANGE');
    const known = [[start, end]], uncertain = [];
    for (let i = 0; i < history.length; i++) {
      const stay = history[i];
      if (!stay || !validDate(stay.entry_date) || !validDate(stay.exit_date) || stay.exit_date < stay.entry_date) return { ...unknown('INVALID_HISTORY_INTERVAL'), interval_index: i };
      const a = Math.max(day(stay.entry_date), firstWindowStart), b = Math.min(day(stay.exit_date), end);
      if (a > b) continue; // Validated, and cannot intersect any evaluated window.
      const type = stay.authorization_type;
      if (type == null || type === 'UNKNOWN' || typeof type !== 'string' || !type.trim()) uncertain.push([a, b]);
      else if (!p.excluded_authorization_types.includes(type)) known.push([a, b]);
    }
    function counter(intervals) {
      const merged = [];
      for (const [a, b] of intervals.slice().sort((x, y) => x[0] - y[0])) {
        const last = merged[merged.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
        else merged.push([a, b]);
      }
      const prefix = [0];
      for (const [a, b] of merged) prefix.push(prefix[prefix.length - 1] + b - a + 1);
      function through(d) {
        let lo = 0, hi = merged.length;
        while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (merged[mid][0] <= d) lo = mid + 1; else hi = mid; }
        if (!lo) return 0;
        const [a, b] = merged[lo - 1];
        return prefix[lo - 1] + Math.min(d, b) - a + 1;
      }
      return (a, b) => through(b) - through(a - 1);
    }
    const countKnown = counter(known), countPossible = counter([...known, ...uncertain]);
    let maxObserved = 0, maxPossible = 0, firstUncertain = null;
    for (let d = start; d <= end; d++) {
      const from = d - p.window_amount + 1;
      const actual = countKnown(from, d), possible = countPossible(from, d);
      maxObserved = Math.max(maxObserved, actual); maxPossible = Math.max(maxPossible, possible);
      const diagnostics = { maximum_observed_days: maxObserved, maximum_possible_days: maxPossible, evaluated_proposed_days: d - start + 1, maximum_days: p.maximum_days };
      if (actual > p.maximum_days) {
        // If uncertain authorization could cause an earlier breach, the exact
        // first violation date is unresolved. Never manufacture that diagnostic.
        if (firstUncertain !== null || possible !== actual) return { ...unknown('UNRESOLVED_AUTHORIZATION'), ...diagnostics, first_possible_violation_date: iso(firstUncertain ?? d) };
        return { status: 'FAIL', code: 'PRESENCE_LIMIT_EXCEEDED', ...diagnostics, first_violation_date: iso(d), days_in_window: actual, window_start: iso(from), window_end: iso(d) };
      }
      if (possible > p.maximum_days && firstUncertain === null) firstUncertain = d;
    }
    const diagnostics = { maximum_observed_days: maxObserved, maximum_possible_days: maxPossible, evaluated_proposed_days: end - start + 1, maximum_days: p.maximum_days };
    if (firstUncertain !== null) return { ...unknown('UNRESOLVED_AUTHORIZATION'), ...diagnostics, first_possible_violation_date: iso(firstUncertain) };
    return { status: 'PASS', code: 'PRESENCE_WITHIN_LIMIT', ...diagnostics };
  }
  const evaluators = {
    relative_date_boundary(p) {
      if (!validDate(p.actual_date) || !validDate(p.reference_date)) return unknown('INVALID_OR_MISSING_DATE');
      if (!['LT', 'GTE'].includes(p.comparison)) return unknown('UNSUPPORTED_COMPARISON');
      const boundary = addPeriod(p.reference_date, p.amount, p.unit, p.calendar_policy);
      if (boundary.value === null) return unknown(boundary.code);
      return { ...result(p.comparison === 'LT' ? p.actual_date < boundary.value : p.actual_date >= boundary.value), boundary: boundary.value };
    },
    minimum_value_in_unit(p) {
      if (typeof p.actual_unit !== 'string' || !p.actual_unit.trim() || typeof p.required_unit !== 'string' || !p.required_unit.trim()) return unknown('MISSING_OR_INVALID_UNIT');
      if (p.actual_unit !== p.required_unit) return unknown('UNSUPPORTED_UNIT_COMPARISON');
      return number(p.actual) && number(p.minimum) ? result(p.actual >= p.minimum) : unknown('INVALID_OR_MISSING_INPUT');
    },
    date_interval_coverage(p) {
      if (![p.start_date, p.end_date, p.required_start_date, p.required_end_date].every(validDate)) return unknown('INVALID_OR_MISSING_DATE');
      if (p.start_date > p.end_date || p.required_start_date > p.required_end_date) return unknown('CONFLICTING_DATES');
      const complete = p.start_date <= p.required_start_date && p.end_date >= p.required_end_date;
      const overlap = p.start_date <= p.required_end_date && p.end_date >= p.required_start_date;
      return { ...result(complete), coverage: complete ? 'COMPLETE' : overlap ? 'PARTIAL' : 'NONE' };
    },
    rolling_presence_window: rollingPresenceWindow,
    required_presence(p) {
      if (p.actual == null) return unknown('MISSING_INPUT');
      if (typeof p.actual === 'boolean') return result(p.actual);
      if (number(p.actual)) return result(true);
      if (typeof p.actual === 'string') return p.actual.trim() ? result(true) : unknown('INVALID_INPUT');
      // Structured evidence is not proof of presence. Bind an explicit presence
      // boolean (or a concrete document identifier), not an arbitrary object.
      return unknown('INVALID_INPUT');
    },
    minimum_remaining_validity: p => validity(p, false),
    maximum_document_age: p => validity(p, true),
    minimum_numeric_value: p => number(p.actual) && number(p.minimum) ? result(p.actual >= p.minimum) : unknown('INVALID_OR_MISSING_INPUT'),
    maximum_numeric_value: p => number(p.actual) && number(p.maximum) ? result(p.actual <= p.maximum) : unknown('INVALID_OR_MISSING_INPUT'),
    allowed_value(p) {
      if (!scalar(p.actual) || !Array.isArray(p.allowed) || !p.allowed.length || !p.allowed.every(scalar)) return unknown('INVALID_OR_MISSING_INPUT');
      return result(p.allowed.includes(p.actual));
    },
    boolean_requirement: p => typeof p.actual === 'boolean' && typeof p.expected === 'boolean' ? result(p.actual === p.expected) : unknown('INVALID_OR_MISSING_INPUT'),
    date_window(p) {
      if (!validDate(p.actual_date) || !validDate(p.start_date) || !validDate(p.end_date)) return unknown('INVALID_OR_MISSING_INPUT');
      if (p.start_date > p.end_date) return unknown('CONFLICTING_DATES');
      if ((p.include_start !== undefined && typeof p.include_start !== 'boolean') || (p.include_end !== undefined && typeof p.include_end !== 'boolean')) return unknown('INVALID_CONFIGURATION');
      return result((p.include_start === false ? p.actual_date > p.start_date : p.actual_date >= p.start_date) && (p.include_end === false ? p.actual_date < p.end_date : p.actual_date <= p.end_date));
    },
  };
  const parameterKeys = {
    relative_date_boundary: ['actual_date', 'reference_date', 'amount', 'unit', 'calendar_policy', 'comparison'],
    minimum_value_in_unit: ['actual', 'minimum', 'actual_unit', 'required_unit'],
    date_interval_coverage: ['start_date', 'end_date', 'required_start_date', 'required_end_date'],
    rolling_presence_window: ['history', 'history_status', 'proposed_entry_date', 'proposed_exit_date', 'maximum_days', 'window_amount', 'window_unit', 'direction', 'entry_day_counts', 'exit_day_counts', 'excluded_authorization_types'],
    required_presence: ['actual'],
    minimum_remaining_validity: ['expiry_date', 'reference_date', 'amount', 'unit', 'calendar_policy'],
    maximum_document_age: ['issue_date', 'reference_date', 'amount', 'unit', 'calendar_policy'],
    minimum_numeric_value: ['actual', 'minimum'],
    maximum_numeric_value: ['actual', 'maximum'],
    allowed_value: ['actual', 'allowed'],
    boolean_requirement: ['actual', 'expected'],
    date_window: ['actual_date', 'start_date', 'end_date', 'include_start', 'include_end'],
  };
  function evaluate(evaluator, parameters) {
    if (typeof evaluator !== 'string' || !Object.hasOwn(evaluators, evaluator)) return unknown('UNSUPPORTED_EVALUATOR');
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return unknown('INVALID_CONFIGURATION');
    if (Object.keys(parameters).some(key => !parameterKeys[evaluator].includes(key))) return unknown('UNSUPPORTED_PARAMETER');
    return evaluators[evaluator](parameters);
  }
  return { evaluate, addPeriod, VERSION };
});
