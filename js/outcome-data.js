// Canonical ingestion is deliberately independent of the DOM and scoring rules.
const COUNTRY_ALIASES = new Map();
[
  ['India', 'Indian'], ['Pakistan', 'Pakistani'], ['Bangladesh', 'Bangladeshi'],
  ['Russia', 'Russian'], ['Sri Lanka', 'Sri Lankan'], ['Georgia', 'Georgian'],
  ['Ukraine', 'Ukrainian'], ['United Kingdom', 'UK', 'British'],
  ['United States', 'USA', 'US'], ['UAE', 'United Arab Emirates'],
  ['Philippines', 'Filipino'], ['Egypt', 'Egyptian'], ['Norway', 'Norwegian'],
  ['Serbia', 'Serbian'], ['Colombia', 'Colombian'], ['Thailand', 'Thai'],
  ['Chile', 'Chilean'], ['Mexico', 'Mexican'], ['Brazil', 'Brazilian'],
  ['Nigeria', 'Nigerian'], ['China', 'Chinese'], ['Guyana', 'Guyanese'],
  ['Poland', 'Polish'], ['Costa Rica', 'Costa Rican'], ['Malaysia', 'Malaysian'],
  ['Trinidad and Tobago', 'Trinidadian'], ['Uzbekistan', 'Uzbek'],
  ...['Ireland', 'France', 'Germany', 'Netherlands', 'Greece', 'Portugal', 'Italy',
    'Spain', 'Switzerland', 'Czechia', 'Hungary', 'Croatia', 'Belgium', 'Austria',
    'Denmark', 'Cyprus', 'Canada', 'Australia', 'Saudi Arabia', 'South Korea',
    'Qatar', 'Turkey', 'Singapore'].map(country => [country]),
].forEach(([canonical, ...aliases]) => [canonical, ...aliases].forEach(alias => COUNTRY_ALIASES.set(alias.toLowerCase(), canonical)));

function structuredValue(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return /^(|unknown|null|n\/a|not known)$/i.test(text) ? null : text;
}
function normalizeCountry(value) {
  const text = structuredValue(value);
  if (text === null) return null;
  return COUNTRY_ALIASES.get(text.toLowerCase()) || null;
}
function nonNegativeNumber(value, integer = false) {
  const text = structuredValue(value);
  if (text === null || !/^\d+(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && (!integer || Number.isInteger(number)) ? number : null;
}
function normalizeBoolean(value) {
  const text = structuredValue(value)?.toLowerCase();
  return ['yes', 'true'].includes(text) ? true : ['no', 'false'].includes(text) ? false : null;
}
function normalizeEnum(value, options) {
  const text = structuredValue(value);
  return text === null ? null : options.find(option => option.toLowerCase() === text.toLowerCase()) || null;
}
function normalizeOtherVisas(value) {
  if (Array.isArray(value)) value = value.length ? value.join('|') : 'None';
  const text = structuredValue(value);
  if (text === null) return null;
  if (text.toLowerCase() === 'none') return [];
  const aliases = { us: 'US', usa: 'US', 'united states': 'US', uk: 'UK', 'united kingdom': 'UK', uae: 'UAE', 'united arab emirates': 'UAE', schengen: 'Schengen', canada: 'Canada', australia: 'Australia' };
  const values = text.split('|').map(v => aliases[v.trim().toLowerCase()]);
  return values.every(Boolean) ? [...new Set(values)] : null;
}
function normalizeDate(value) {
  const text = structuredValue(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
}
// Extensible vocabulary: known spellings are standardized; future explicit
// source types are preserved. Only these evidenced sources receive defaults.
const SOURCE_TYPES = ['Forum', 'Blog', 'Official', 'Direct report', 'Other',
  'Government statistics', 'Government requirements', 'Community survey',
  'Forum/community post', 'User-submitted outcome', 'Third-party dataset'];
const SOURCE_DEFAULTS = new Map(['r/visarejections', 'r/schengenvisa', 'r/usvisas', 'r/ukvisa', 'visajourney'].map(source => [source, 'Forum']));
SOURCE_DEFAULTS.set('cardexpert.in blog', 'Blog');

function normalizeOutcome(values, provenance = null) {
  const issues = [];
  const pick = (canonical, legacy) => Object.hasOwn(values, canonical) ? values[canonical] : values[legacy];
  function field(name, value, convert) {
    const result = convert(value);
    if (result === null && structuredValue(value) !== null) issues.push({ rowNumber: provenance?.rowNumber ?? null, field: name, value, code: 'invalid_value', message: 'Unrecognized, ambiguous, or invalid value; retained in provenance and normalized to null.' });
    return result;
  }
  const source = values.source == null ? null : String(values.source).trim() || null;
  const explicitSourceType = structuredValue(values.source_type);
  const record = {
    passport_country: field('passport_country', pick('passport_country', 'nationality'), normalizeCountry),
    residence_country: field('residence_country', values.residence_country, normalizeCountry),
    destination_country: field('destination_country', values.destination_country, normalizeCountry),
    visa_type: field('visa_type', pick('visa_type', 'visa_purpose'), v => normalizeEnum(v, ['Tourist/Visit', 'Work', 'Student', 'Spouse/Family', 'Residence'])),
    application_result: field('application_result', pick('application_result', 'outcome'), v => normalizeEnum(v, ['Approved', 'Rejected', 'Pending'])),
    residence_permit_validity_remaining: field('residence_permit_validity_remaining', pick('residence_permit_validity_remaining', 'permit_months_remaining'), nonNegativeNumber),
    previous_international_travel: field('previous_international_travel', values.previous_international_travel, normalizeBoolean),
    previous_visa_refusal: field('previous_visa_refusal', pick('previous_visa_refusal', 'prior_rejection'), normalizeBoolean),
    countries_visited: field('countries_visited', values.countries_visited, v => nonNegativeNumber(v, true)),
    application_date: field('application_date', values.application_date, normalizeDate),
    source,
    source_type: explicitSourceType === null ? (Object.hasOwn(values, 'source_type') ? null : SOURCE_DEFAULTS.get(source?.toLowerCase()) || null) : normalizeEnum(explicitSourceType, SOURCE_TYPES) || explicitSourceType,
    residence_permit_type: structuredValue(pick('residence_permit_type', 'permit_type')),
    other_visas: field('other_visas', values.other_visas, normalizeOtherVisas),
    rejection_reason: values.rejection_reason == null ? null : String(values.rejection_reason).trim() || null,
    embassy_country: field('embassy_country', values.embassy_country, normalizeCountry),
    provenance: provenance || { rowNumber: null, raw: { ...values } },
  };
  return { record, issues };
}
function ingestOutcomeCSV(text) {
  const parsed = parseCSV(text);
  const issues = [...parsed.issues];
  // Missing observations are allowed; missing structural columns are not.
  for (const alternatives of [['passport_country', 'nationality'], ['destination_country'], ['visa_type', 'visa_purpose'], ['application_result', 'outcome']]) {
    if (!alternatives.some(name => parsed.headers.includes(name))) issues.push({ rowNumber: 1, field: alternatives[0], value: null, code: 'missing_header', message: 'Required schema column missing.' });
  }
  if (issues.some(issue => ['invalid_header', 'missing_header'].includes(issue.code))) return { records: [], issues };
  const records = parsed.records.map(({ values, provenance }) => {
    const normalized = normalizeOutcome(values, provenance);
    issues.push(...normalized.issues);
    return normalized.record;
  });
  return { records, issues };
}
// The UI keeps its existing field names; only the matching boundary adapts them.
function normalizeMatchingProfile(profile) {
  return normalizeOutcome({
    passport_country: profile.nationality, residence_country: profile.residence,
    residence_permit_type: profile.permitType, destination_country: profile.destination,
    residence_permit_validity_remaining: profile.monthsRemaining,
    other_visas: profile.otherVisas, countries_visited: profile.countriesVisited,
    previous_visa_refusal: profile.priorRejection,
  }).record;
}
