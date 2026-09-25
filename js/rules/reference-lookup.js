(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VisaCheckReferenceLookup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const copy = v => v == null ? null : JSON.parse(JSON.stringify(v));
  // Explicit versioned input, no fetching, alias conversion or legal knowledge.
  // MATCH establishes only a configured lookup, not authority or publication.
  function classify(data, normalizedKey) {
    const result = { status: 'UNKNOWN', reason: 'INVALID_REFERENCE_DATA', key: normalizedKey ?? null, value: null, reference_data_id: data?.reference_id ?? null, reference_data_version: data?.reference_version ?? null, source_version: copy(data?.source_version), effective_from: data?.effective_from ?? null, effective_to: data?.effective_to ?? null, source_refs: copy(data?.source_refs ?? []), entry_source_refs: [], coverage: copy(data?.coverage), publication: copy(data?.publication) };
    const finish = (status, reason) => copy({ ...result, status, reason });
    if (!object(data) || !text(data.reference_id) || !text(data.reference_version) || !Array.isArray(data.source_refs) || !object(data.publication) || !object(data.classifications) || !object(data.coverage) || !['PARTIAL', 'COMPLETE'].includes(data.coverage.type) || !Array.isArray(data.coverage.supported_keys) || !data.coverage.supported_keys.every(text) || !Array.isArray(data.allowed_classifications) || !data.allowed_classifications.length || !data.allowed_classifications.every(text) || !text(data.key_pattern) || !data.key_pattern.startsWith('^') || !data.key_pattern.endsWith('$')) return finish('UNKNOWN', 'INVALID_REFERENCE_DATA');
    let pattern;
    try { pattern = new RegExp(data.key_pattern); } catch { return finish('UNKNOWN', 'INVALID_REFERENCE_DATA'); }
    const keys = data.coverage.supported_keys;
    if (new Set(keys).size !== keys.length || keys.length !== Object.keys(data.classifications).length || keys.some(k => !pattern.test(k) || !Object.hasOwn(data.classifications, k) || !object(data.classifications[k]) || !data.allowed_classifications.includes(data.classifications[k].classification) || !Array.isArray(data.classifications[k].source_refs))) return finish('UNKNOWN', 'INVALID_REFERENCE_DATA');
    if (typeof normalizedKey !== 'string' || !pattern.test(normalizedKey)) return finish('UNKNOWN', 'INVALID_OR_MISSING_KEY');
    if (!keys.includes(normalizedKey)) return finish('UNSUPPORTED', 'UNSUPPORTED_REFERENCE_DATA');
    const entry = data.classifications[normalizedKey];
    result.value = entry.classification; result.entry_source_refs = copy(entry.source_refs);
    return finish('MATCH', 'REFERENCE_MATCH');
  }
  return { classify, VERSION: '1.0.0' };
});
