(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VisaCheckApplicantFacts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Isolated from community normalization. Tokens retain their supplied case and
  // vocabulary; a future form adapter must supply the vocabulary used by rules.
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const missing = value => value == null || (typeof value === 'string' && /^(\s*|unknown|null|n\/a|not known)$/i.test(value.trim()));
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  const shape = {
    identity: { age: 'integer', date_of_birth: 'date', applicant_conditions: 'strings', country_of_origin: 'country_code' },
    passport: { issuing_country: 'text', document_type: 'text', issue_date: 'date', expiry_date: 'date', blank_pages: 'integer', document_condition: 'text' },
    residence: { country: 'text', legal_status: 'text', permit_type: 'text', permit_expiry_date: 'date', irish_permission_status: 'text', irish_residence_card_present: 'boolean', irish_residence_card_expiry_date: 'date', irish_irp_renewal_status: 'renewal_status' },
    // Supplied by an adapter: departure from the Member States for one visit,
    // or LAST such departure for several visits. Never inferred from geography
    // or intended_exit_date; an unresolved adapter determination must be null.
    trip: { destination_country: 'text', destination_territory: 'text', visa_regime: 'text', visa_type: 'text', purpose: 'text', intended_entry_date: 'date', intended_exit_date: 'date', relevant_schengen_departure_date: 'date', destinations: 'destinations', intended_first_external_entry: 'text', stay_history_status: 'history_status', schengen_stay_history: 'stay_intervals' },
    // Actual application-stage reference is separate from an intended date.
    application: { intended_lodging_date: 'date', lodging_date: 'date', competent_state: 'country_code', france_visas_form_completed: 'boolean', france_visas_form_validated: 'boolean', appointment_booked: 'boolean', file_complete_asserted: 'boolean', submission_completed: 'boolean', return_envelope_ready: 'boolean' },
    travel: { irish_entry_visa_requirement_status: 'entry_requirement', physical_presence_country: 'text' },
    supporting_evidence: { accommodation: 'evidence', financial_means: 'evidence', travel_medical_insurance: 'evidence', itinerary: 'evidence', return_or_onward_evidence: 'evidence', purpose: 'evidence', intention_to_leave: 'evidence', application_file: 'evidence' },
    biometrics: { previous_biometrics_date: 'date', fingerprint_condition: 'text', previous_schengen_biometrics_present: 'boolean', reuse_confirmed: 'boolean', fingerprint_exemption_status: 'text', physical_impossibility_status: 'text' },
  };
  shape.trip.intended_return_to_ireland_date = 'date';
  shape.trip.professional_activity_planned = 'boolean';
  shape.trip.family_settlement_planned = 'boolean';
  shape.trip.purpose = 'purpose';
  // Validate only these defined nested fields; retain other supplied evidence
  // details without interpreting them. Existing boolean evidence remains valid.
  const evidenceFields = {
    travel_medical_insurance: { present: 'boolean', coverage_amount: 'nonnegative_number', currency: 'text', valid_from: 'date', valid_to: 'date', territorial_scope: 'text', medical_repatriation_covered: 'boolean', emergency_medical_covered: 'boolean', hospital_treatment_covered: 'boolean' },
    accommodation: { type: 'accommodation_type', evidence_present: 'boolean', coverage_start: 'date', coverage_end: 'date', private_host_certificate_present: 'boolean', private_host_attestation_original_present: 'boolean', private_host_attestation_validated: 'boolean', means_to_cover_evidence_present: 'boolean' },
    application_file: { form_present: 'boolean', receipt_present: 'boolean', passport_original_present: 'boolean', passport_copy_present: 'boolean', identity_photo_count: 'integer', identity_photos_qualifying_confirmed: 'boolean', supporting_originals_present: 'boolean', supporting_copies_present: 'boolean', document_languages: 'strings' },
    financial_means: { evidence_present: 'boolean', available_amount: 'nonnegative_number', currency: 'text', return_funds_evidence_present: 'boolean', sponsorship_present: 'boolean' },
    return_or_onward_evidence: { return_or_onward_evidence_present: 'boolean', reservation_present: 'boolean', funds_to_acquire_return_present: 'boolean', itinerary_present: 'boolean' },
    purpose: { evidence_present: 'boolean' },
    intention_to_leave: { evidence_present: 'boolean' },
  };
  // Returns an envelope. Keep issues with facts: conflicting values must not be
  // made usable merely because each value, considered separately, is well formed.
  function normalizeApplicantFacts(input = {}) {
    const issues = [];
    const invalid = (path, code = 'INVALID_FACT') => { issues.push({ path, code }); return null; };
    function json(value, path) {
      if (missing(value)) return null;
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
      if (Array.isArray(value)) return value.map((v, i) => json(v, `${path}.${i}`));
      if (object(value) && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, json(v, `${path}.${key}`)]));
      }
      return invalid(path);
    }
    function field(value, type, path) {
      if (type === 'accommodation_type') {
        if (typeof value === 'string' && ['HOTEL', 'PRIVATE_HOST', 'OTHER', 'UNKNOWN'].includes(value.trim())) return value.trim();
        return missing(value) ? null : invalid(path);
      }
      if (type === 'renewal_status' || type === 'entry_requirement') {
        const options = type === 'renewal_status' ? ['NOT_APPLICABLE', 'NOT_STARTED', 'PENDING', 'COMPLETED', 'UNKNOWN'] : ['VISA_REQUIRED', 'VISA_EXEMPT', 'UNKNOWN'];
        if (typeof value === 'string' && options.includes(value.trim())) return value.trim();
        return missing(value) ? null : invalid(path);
      }
      if (type === 'history_status' || type === 'authorization') {
        const options = type === 'history_status' ? ['NONE', 'COMPLETE', 'INCOMPLETE', 'UNKNOWN'] : ['SHORT_STAY', 'RESIDENCE_PERMIT', 'LONG_STAY_VISA', 'UNKNOWN'];
        if (typeof value === 'string' && options.includes(value.trim())) return value.trim();
        return missing(value) ? null : invalid(path);
      }
      if (missing(value)) return null;
      if (type === 'country_code') return typeof value === 'string' && /^[A-Z]{2}$/.test(value.trim()) ? value.trim() : invalid(path);
      // Accept Batch 3 labels while preserving existing lower-case rule tokens.
      if (type === 'purpose') return typeof value === 'string' ? ({ TOURISM: 'tourism', PRIVATE_VISIT: 'private_visit' }[value.trim()] || value.trim()) : invalid(path);
      if (type === 'boolean') return typeof value === 'boolean' ? value : invalid(path);
      if (type === 'nonnegative_number') return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : invalid(path);
      if (type === 'text') return typeof value === 'string' ? value.trim() : invalid(path);
      if (type === 'date') return typeof value === 'string' && validDate(value.trim()) ? value.trim() : invalid(path);
      if (type === 'integer') return Number.isSafeInteger(value) && value >= 0 ? value : invalid(path);
      if (type === 'strings') return Array.isArray(value) && value.every(v => typeof v === 'string' && !missing(v)) ? [...new Set(value.map(v => v.trim()))] : invalid(path);
      if (type === 'evidence') {
        if (typeof value !== 'boolean' && !object(value)) return invalid(path);
        const normalized = json(value, path);
        if (object(normalized)) for (const [key, kind] of Object.entries(evidenceFields[path.split('.').pop()] || {})) {
          if (Object.hasOwn(value, key)) normalized[key] = field(value[key], kind, `${path}.${key}`);
        }
        return normalized;
      }
      if (type === 'stay_intervals') {
        if (!Array.isArray(value)) return invalid(path);
        return value.map((v, i) => {
          const interval = group(v, { entry_date: 'date', exit_date: 'date', authorization_type: 'authorization' }, `${path}.${i}`);
          if (interval.entry_date && interval.exit_date && interval.exit_date < interval.entry_date) invalid(`${path}.${i}`, 'CONFLICTING_FACTS');
          return interval;
        });
      }
      if (type === 'destinations') {
        if (!Array.isArray(value)) return invalid(path);
        return value.map((v, i) => group(v, { country: 'text', duration_days: 'integer', purpose: 'text' }, `${path}.${i}`));
      }
      return invalid(path);
    }
    function group(value, spec, path) {
      if (!missing(value) && !object(value)) invalid(path);
      const source = object(value) ? value : {};
      return Object.fromEntries(Object.entries(spec).map(([key, type]) => [key, field(Object.hasOwn(source, key) ? source[key] : null, type, `${path}.${key}`)]));
    }
    if (!object(input)) { invalid(''); input = {}; }
    const facts = Object.fromEntries(Object.entries(shape).map(([key, spec]) => [key, group(input[key], spec, key)]));
    // An explicit NONE assertion supplies the observation; an empty array alone
    // never supplies that assertion. No detailed intervals are required for NONE.
    if (facts.trip.stay_history_status === 'NONE' && facts.trip.schengen_stay_history === null && !issues.some(i => i.path.startsWith('trip.schengen_stay_history'))) facts.trip.schengen_stay_history = [];
    if (facts.trip.stay_history_status === 'NONE' && facts.trip.schengen_stay_history?.length) invalid('trip.schengen_stay_history', 'CONFLICTING_FACTS');
    for (const [start, end] of [['passport.issue_date', 'passport.expiry_date'], ['trip.intended_entry_date', 'trip.intended_exit_date'], ['trip.intended_entry_date', 'trip.relevant_schengen_departure_date']]) {
      const read = path => path.split('.').reduce((v, key) => v[key], facts);
      if (read(start) && read(end) && read(start) > read(end)) { invalid(start, 'CONFLICTING_FACTS'); invalid(end, 'CONFLICTING_FACTS'); }
    }
    return { facts, issues };
  }
  function getFact(model, path) {
    if (!object(model) || !object(model.facts) || !Array.isArray(model.issues) || typeof path !== 'string' || !/^[a-zA-Z_][\w]*(?:\.(?:[a-zA-Z_]\w*|\d+))*$/.test(path)) return { state: 'INVALID', value: null };
    if (path.split('.').some(k => ['__proto__', 'prototype', 'constructor'].includes(k))) return { state: 'INVALID', value: null };
    if (model.issues.some(i => !i || typeof i.path !== 'string' || i.path === '' || i.path === path || path.startsWith(`${i.path}.`) || i.path.startsWith(`${path}.`))) return { state: 'INVALID', value: null };
    let value = model.facts;
    for (const key of path.split('.')) {
      if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return { state: 'MISSING', value: null };
      value = value[key];
    }
    return missing(value) ? { state: 'MISSING', value: null } : { state: 'KNOWN', value };
  }
  return { normalizeApplicantFacts, getFact, validDate };
});
