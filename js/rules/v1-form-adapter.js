(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./applicant-facts.js') : root.VisaCheckApplicantFacts);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VisaCheckV1Adapter = api;
})(globalThis, function (factsAPI) {
  'use strict';
  const blank = v => v == null || v === '' || v === 'unsure';
  const token = v => v === true ? 'yes' : v === false ? 'no' : typeof v === 'string' ? v.trim() : v;

  // Shared by the DOM and adapter. Hidden ancestor answers cannot reveal children.
  function isVisible(field, values, fields, visiting = new Set()) {
    if (!field.when) return true;
    if (visiting.has(field.id)) return false;
    const seen = new Set(visiting).add(field.id);
    function matches(condition) {
      if (condition.all) return condition.all.every(matches);
      if (condition.any) return condition.any.some(matches);
      const [id, expected] = condition;
      if (id === '$has_stays') return (Array.isArray(values.stays) && values.stays.length > 0) === expected;
      const controller = fields.find(f => f.id === id);
      if (!controller || !isVisible(controller, values, fields, seen)) return false;
      const value = token(values[id]);
      return Array.isArray(expected) ? expected.includes(value) : value === expected;
    }
    return matches(field.when);
  }

  function activeValues(values, fields) {
    const result = Object.fromEntries(fields.map(f => [f.id, isVisible(f, values, fields) ? values[f.id] ?? null : null]));
    result.stays = token(result.history) === 'yes' && Array.isArray(values.stays) ? values.stays : [];
    return result;
  }

  function adapt(values, fields, config) {
    const raw = {}, issues = [], active = activeValues(values, fields), answers = {};
    const set = (path, value) => {
      const parts = path.split('.');
      let target = raw;
      for (const key of parts.slice(0, -1)) target = target[key] || (target[key] = {});
      target[parts.at(-1)] = value;
    };
    for (const field of fields) {
      let value = token(active[field.id]);
      const invalid = code => { issues.push({ path: field.path || `form.${field.id}`, code }); return null; };
      if (blank(value)) value = null;
      else if (field.type === 'boolean') value = value === 'yes' ? true : value === 'no' ? false : invalid('INVALID_FORM_VALUE');
      else if (field.type === 'number') value = /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(value)) && Number.isFinite(Number(value)) ? Number(value) : invalid('INVALID_FORM_NUMBER');
      else if (field.type === 'date' && !factsAPI.validDate(value)) value = invalid('INVALID_FORM_DATE');
      else if (field.options && !field.options.some(o => o[0] === value)) value = invalid('INVALID_FORM_CHOICE');
      if (field.type === 'languages' && value !== null) value = String(value).split(',').map(v => v.trim()).filter(Boolean);
      answers[field.id] = value;
      if (field.path) set(field.path, value);
    }
    const t = raw.trip || (raw.trip = {}), a = raw.application || (raw.application = {});
    const id = raw.identity || (raw.identity = {}), passport = raw.passport || (raw.passport = {});
    const residence = raw.residence || (raw.residence = {}), evidence = raw.supporting_evidence || (raw.supporting_evidence = {});
    const supported = config.supported;
    passport.issuing_country = answers.nationality === supported.nationality && passport.document_type === supported.document ? supported.issuer : null;
    // Destination option explicitly identifies Metropolitan France and a short visit.
    // No corresponding derivation exists for other destinations or unknown purposes.
    const france = t.destination_country === supported.destination;
    t.destination_territory = france ? supported.territory : null;
    t.visa_regime = france ? supported.regime : null;
    t.visa_type = france && ['tourism', 'private_visit'].includes(t.purpose) ? supported.visa_type : null;
    const adult = Number.isSafeInteger(id.age) && id.age >= config.adult_minimum_age;
    id.applicant_conditions = answers.special === true ? ['special_route'] : answers.special === false && adult ? ['ordinary_adult_applicant'] : null;
    t.family_settlement_planned = answers.special === false ? false : null;
    const single = answers.other_schengen === false;
    a.competent_state = france && single ? supported.destination : null;
    t.relevant_schengen_departure_date = france && single ? t.intended_exit_date : null;
    residence.legal_status = answers.legal === true ? 'legal_resident' : answers.legal === false ? 'not_legal_resident' : null;
    residence.permit_type = answers.irp === true ? 'Irish IRP' : null;
    // 'Not pending' does not distinguish completed, not started or not applicable.
    residence.irish_irp_renewal_status = answers.renewal === true ? 'PENDING' : 'UNKNOWN';
    residence.irish_permission_status = null;
    raw.travel = { irish_entry_visa_requirement_status: passport.issuing_country === supported.issuer && passport.document_type === supported.document ? config.irish_entry_status : null };

    const accommodation = evidence.accommodation || (evidence.accommodation = {});
    if (accommodation.type === 'PRIVATE_HOST') {
      accommodation.evidence_present = answers.attestation;
      if (answers.attestation === false) accommodation.private_host_attestation_original_present = false;
    }
    const financial = evidence.financial_means || (evidence.financial_means = {});
    if (answers.sponsored === false) financial.sponsorship_present = false;
    financial.return_funds_evidence_present = answers.return_money;
    const travel = evidence.return_or_onward_evidence || (evidence.return_or_onward_evidence = {});
    // No travel confirmation includes no reservation; a positive answer does not
    // establish its type or prove that return funds are available.
    travel.reservation_present = answers.return_evidence === false ? false : null;
    travel.funds_to_acquire_return_present = answers.return_money;
    const file = evidence.application_file || (evidence.application_file = {});
    const prepared = { BOTH: [true, true], ORIGINALS: [true, false], COPIES: [false, true], NEITHER: [false, false] }[answers.supporting_prepared] || [null, null];
    [file.supporting_originals_present, file.supporting_copies_present] = prepared;
    a.file_complete_asserted = answers.supporting_prepared === null ? null : answers.supporting_prepared === 'BOTH';
    file.identity_photos_qualifying_confirmed = Number.isSafeInteger(answers.photos) && answers.photos >= 0 ? answers.photos > 0 : null;

    if (answers.history === false) {
      t.stay_history_status = 'NONE'; t.schengen_stay_history = [];
    } else if (answers.history === true) {
      t.schengen_stay_history = active.stays.map(s => ({ entry_date: s.entry_date || null, exit_date: s.exit_date || null, authorization_type: s.authorization_type || 'UNKNOWN' }));
      t.stay_history_status = answers.history_complete === true && t.schengen_stay_history.length > 0 && t.schengen_stay_history.every(s => factsAPI.validDate(s.entry_date) && factsAPI.validDate(s.exit_date) && s.exit_date >= s.entry_date && ['SHORT_STAY', 'RESIDENCE_PERMIT', 'LONG_STAY_VISA'].includes(s.authorization_type)) ? 'COMPLETE' : 'INCOMPLETE';
    } else {
      t.stay_history_status = 'UNKNOWN'; t.schengen_stay_history = null;
    }
    const model = factsAPI.normalizeApplicantFacts(raw);
    model.issues.push(...issues);
    return {
      model,
      route_input: { nationality: answers.nationality, single_trip: single ? true : answers.other_schengen === true ? false : null },
      assumptions: a.competent_state ? [config.competence_constraint] : [],
      active_values: active
    };
  }
  return { adapt, isVisible, activeValues };
});
