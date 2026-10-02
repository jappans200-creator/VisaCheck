# Canonical facts — additive Stages A/B

This remains a development preview. These changes describe applicant facts and
compatibility, not new country coverage or verified visa requirements. Existing
rule revisions, source mappings, thresholds and evaluation logic are unchanged.

## Facts

| Path | Meaning and validation |
| --- | --- |
| `identity.nationality` | Explicit nationality; uppercase two-letter country token or null. Independent of passport issuer, origin and residence. |
| `residence.document` | One selected physical residence document, or null; no multi-document framework. |
| `residence.document.issuing_country` | Explicit issuing country; uppercase two-letter token or null. |
| `residence.document.type` | Explicit nonempty document-type token or null; extensible vocabulary, no inferred legal effect. |
| `residence.document.present` | Explicit boolean or null. Presence does not prove legal residence. |
| `residence.document.expiry_date` | Valid ISO calendar date or null. Never substituted for permission expiry. |
| `trip.return_destination_country` | Explicit country of intended return after the relevant trip, or null. |
| `trip.intended_return_date` | Explicit date of that return, or null. Independent of departure and Schengen exit. |

The new country fields validate token syntax, not membership of a changing country
registry. Foreign architecture fixtures assert no foreign legal requirements.
Unknown markers normalize to null; malformed supplied values also produce issues.
Partial document objects retain null fields. Existing `residence.legal_status`,
`permit_expiry_date`, Irish permission and renewal fields retain their meanings.
No document field supplies a permission expiry, legal status or renewal status.

## Temporary compatibility boundary

`applicant-facts.js` isolates projections in `projectLegacyIrishFacts`, called after
normalization. Generic evaluators and immutable rule definitions remain untouched.

* Explicit return country `IE` and a known generic return date supply a missing
  `trip.intended_return_to_ireland_date`.
* Explicit document issuer `IE` and type `IRP` supply missing legacy Irish card
  presence/expiry bindings and the legacy type label `Irish IRP`. Missing issuer
  or type does not establish equivalence. Foreign documents never project.
* Legacy-only facts remain usable. There is no reverse projection into generic
  facts, and no inference from residence, passport, origin or Schengen exit.
* Conflicting linked dates or presence observations generate `CONFLICTING_FACTS`
  on both bindings. Neither observation overwrites the other. Malformed linked
  values generate `COMPATIBILITY_INVALID_FACT` rather than being rescued by an
  otherwise valid alias.
* A non-Irish selected return combined with a legacy Irish return is ambiguous
  in this single-return model: both are invalid for evaluation. Likewise, an
  explicitly foreign/non-IRP selected document combined with legacy Irish card
  facts is flagged. Conflicting legacy permit types are not overwritten.

Consumers must retain the `{facts, issues}` envelope and use `getFact`; invalid
bindings lead to UNKNOWN through existing evaluators. Do not edit normalized facts
and expect the bridge to rerun: supply updated raw facts to normalization, retaining
upstream validation issues. In particular, do not strip issues and renormalize
sanitized null values as if they were fresh valid observations.

## Current form and migration limits

The current adapter retains `route_input.nationality`, adds the known nationality
country token, and keeps the `OTHER` coverage choice out of canonical nationality.
It represents the existing affirmative IRP declaration as an IE/IRP document; the
bridge supplies legacy presence/type. The legacy expiry question binding remains
for compatibility; its value and validation issues are shared with the document.

The adapter's existing supported-route legal-residence and passport-issuer
derivations remain unchanged; these are not new generic normalizer inferences.
No questions or visibility conditions change. Return destination/date and country
of origin remain unknown in the normal form. An explicit return event alone does
not supply origin, which the existing IRP rule separately requires.

Nationality is not yet substituted into the route resolver/classifier. Release
orchestration, combined assessment, required-fact collection, dynamic questions
and additional country coverage remain outside this milestone.

## Regression protection

Before the migration, the 301-test baseline passed and five new Stage A contracts
passed against the original code. They pin the normal legal status set, passport
and explicit legacy return outcomes, questionnaire definitions and actual community
statistics (78%, nine records). Existing tests also protect 90/180, unsupported and
partial routes, rendering, conditions and source metadata.

Focused generic tests cover independent nationality, AE/CA synthetic documents,
missing/invalid facts, permission distinctions, legacy equivalence, conflicts,
explicit IRP return PASS/FAIL, exact-month boundaries and CLAMP arithmetic.
Browser smoke checks exercise the unchanged questionnaire and visible report.
