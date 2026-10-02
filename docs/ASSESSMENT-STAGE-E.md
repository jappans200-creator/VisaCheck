# Generic combined assessment — Stage E

The primary VisaCheck status now comes from a deterministic, country-agnostic
assessment engine. The number remains historical/community-derived; there is no
combined probability model, legal penalty, readiness bonus or invented confidence.

`js/rules/assessment.js` consumes typed official/readiness/procedure result
identities, coverage, community statistics and a versioned assessment policy.
`assessment-adapter.js` maps the existing report into that interface. The renderer
calls this pure adapter on each render, including when community data finishes
loading. Neither the report nor community results are mutated.

## Configuration and release

`FRANCE_V1_ASSESSMENT@0.1.0` is pinned as the `assessment` asset in
`VISACHECK_FRANCE_V1@0.1.0`. This adds one policy asset to the original 22 runtime
assets. The release remains DEVELOPMENT_PREVIEW; evidence remains unverified.
The release version stays as explicitly requested during this uncommitted preview
milestone. No legal asset revisions or evidence records were changed.

Each binding supplies asset key, result kind/ID/revision, role, materiality,
expected presence, label and action text. The configuration is bound to an exact
release ID/version; expected presence means WHEN_ASSET_SELECTED. Thus inactive
local groups do not manufacture missing results, while partial route coverage
still prevents a clear overall assessment.

Release validation rejects a missing assessment pin, wrong identity/revision,
conditional assessment selection, unknown configured result identities and
duplicate/conflicting assignments. Selected result definitions are validated at
runtime; the repository release test loads all pins and validates conditional
definitions too. Parent asset revisions remain pinned by the release; readiness
item revisions are separately checked against their item definitions.

A missing policy supplied directly to the assessment API produces CHECK_REQUIRED
with MISSING_ASSESSMENT_CONFIGURATION and no profile band. A missing configured
file is a loading error. No latest-version fallback exists.

## Review of all 14 current legal rules

This is a product aggregation review of existing local semantics and pinned
evidence metadata, not a fresh source verification or evidence promotion. All
rules below are revision `0.1.0`, material, expected when their asset is selected,
and BLOCKING for the existing ordinary preview scope.

| Rule | Reason for classification and boundary |
| --- | --- |
| FRANCE_IE_APPLICATION_JURISDICTION | Tests supplied legal residence for the ordinary application jurisdiction; exceptional non-resident lodging remains outside this determination. |
| FRANCE_IE_IRP_DOCUMENT_PRESENCE | Tests the specifically required physical-card evidence on this route, not a general readiness recommendation or proof of permission. |
| FRANCE_IE_IRP_POST_RETURN_VALIDITY | Tests the configured post-return card-validity condition; explicit origin and return facts remain required. Renewal does not substitute for them. |
| SCHENGEN_TRAVEL_DOCUMENT_REMAINING_VALIDITY | Tests ordinary validity after the relevant departure. Existing emergency-review handling remains UNKNOWN, not an automatic failure. |
| SCHENGEN_TRAVEL_DOCUMENT_MAX_AGE | Tests the existing issue-date boundary against actual lodging; unknown lodging remains UNKNOWN. No boundary reinterpretation. |
| SCHENGEN_TRAVEL_DOCUMENT_BLANK_PAGES | Tests the configured minimum blank-page requirement. |
| SCHENGEN_SHORT_STAY_90_IN_180 | Tests the configured rolling presence limit, not just proposed trip length. |
| SCHENGEN_EARLIEST_LODGING | Tests the ordinary earliest-lodging legal boundary. It is not the operational recommended lead time and does not establish latest/timely lodging. |
| SCHENGEN_INSURANCE_PRESENCE | Tests possession of insurance within the existing ordinary-purpose scope. |
| SCHENGEN_INSURANCE_COVERAGE_AMOUNT | Tests the configured insured amount/currency only. |
| SCHENGEN_INSURANCE_DATE_COVERAGE | Tests the explicitly supplied stay/policy date interval only. |
| SCHENGEN_INSURANCE_TERRITORY | Tests the supplied territorial coverage assertion only. |
| SCHENGEN_INSURANCE_MEDICAL_REPATRIATION | Tests the configured medical-repatriation coverage requirement only. |
| SCHENGEN_INSURANCE_EMERGENCY_OR_HOSPITAL_COVERAGE | Tests the existing emergency/hospital coverage condition, without extending the legal wording or claiming complete policy acceptance. |

The evidence records inspected include the EP001-03 jurisdiction distinctions,
EP001-05 card/permission/return distinctions, EP001-04 passport requirements,
EP001-02 rolling stay framework, EP001-06-A earliest lodging and EP001-10 insurance
requirements. They retain their pending verification state. Existing review gates,
exceptions, provenance and applicability remain authoritative for each result.

## Other exact classifications

READINESS (material): `SCHENGEN_INSURANCE_EVIDENCE`,
`SCHENGEN_ACCOMMODATION_EVIDENCE`, `SCHENGEN_FINANCIAL_EVIDENCE`,
`SCHENGEN_RETURN_ONWARD_EVIDENCE`, `SCHENGEN_ITINERARY_EVIDENCE`,
`SCHENGEN_PURPOSE_EVIDENCE`, `FRANCE_PRIVATE_HOST_ORIGINAL_ATTESTATION`.

These seven categories count existing final readiness results once. Alternatives
inside a result do not create additional counts. The normal hotel fixture has
6 ready, 0 needing attention, 0 unknown and 1 not applicable. No percentage is made.

INFORMATIONAL (non-material): `SCHENGEN_RETURN_FUNDS_EVIDENCE`,
`SCHENGEN_INTENTION_INFORMATION`, `SCHENGEN_SHORT_STAY_VISA_REQUIREMENT_BASELINE`,
`FRANCE_SHORT_STAY_PURPOSES`. Return funds are contextual and overlap the existing
return/onward alternatives; they are not counted as another missing obligation.
This does not declare application-law equivalence for a border-reference example.
Intention evidence is not a deterministic credibility finding. A visa-required
baseline is not an unmet application condition. Purpose still affects route
coverage upstream, exactly as in Stage C.

PROCEDURAL (non-material): `APPLICATION_FORM`, `APPLICATION_RECEIPT`,
`PASSPORT_ORIGINAL`, `PASSPORT_COPY`, `IDENTITY_PHOTOS`, `SUPPORTING_DOCUMENT_SET`,
`ONLINE_FORM`, `ONLINE_VALIDATION`, `APPOINTMENT`, `FILE_ASSERTION`, `SUBMISSION`,
`PASSPORT_RETURN`, `SCHENGEN_BIOMETRICS_PROCEDURE`,
`IRELAND_RETURN_DOCUMENT_READINESS`. These remain preparation/attendance/re-entry
guidance, not additional French legal failures. They contribute separate counts
and actions; unasked procedure facts do not reduce assessment completeness.

No current result is assigned SPECIAL_REVIEW. The generic role is supported and
tested; existing material-rule review uncertainty already yields CHECK_REQUIRED.

## Aggregation, completeness and explanations

Official precedence is unsupported coverage, applicable blocking FAIL, material
blocking unknown/missing or unresolved coverage, configured warning/special-review
concern, then CLEAR_FOR_CONFIGURED_CHECKS. A NOT_APPLICABLE blocking result is
resolved only when applicability explicitly excludes it; an unavailable temporal
revision cannot silently establish CLEAR. Duplicate or unconfigured observed
results also prevent false CLEAR.

Primary precedence follows the official gate. Once official checks are clear,
readiness needing attention produces ATTENTION, and material readiness unknowns
prevent a profile band. Only permitted complete assessments use community bands:
above 75 STRONG_PROFILE; 50–75 NEEDS_ATTENTION; below 50 PROFILE_NEEDS_WORK.
Without a usable community score, clear official checks have the nonnumerical
CLEAR_FOR_CONFIGURED_CHECKS primary state. Unsupported routes never have a profile
conclusion or reuse this route's policy.

Completeness is INCOMPLETE for material official gaps, unresolved/partial coverage
or result-contract gaps; LIMITED for readiness unknowns or unavailable community
comparison; otherwise COMPLETE_FOR_CONFIGURED_SCOPE. An observed readiness problem
does not itself mean missing assessment information. Research status is recorded
separately in provenance and never treated as applicant incompleteness.

`profile.score_source` is COMMUNITY_MODEL. A usable score requires a finite 0–100
number and the configured minimum sample of three; no score is invented. Existing
community provenance/model metadata are retained where supplied and remain null
otherwise. Nine records do not establish calibrated confidence.

Explanations comprise deterministic summary text, exact contributing result
identities/labels, configured action text and a separate community caveat. The
renderer presents the primary assessment first, followed by official requirements,
historical comparison, readiness, completeness, actions and detailed checks/sources.

## Validation and intentional presentation changes

The normal simplified form remains CHECK_REQUIRED: it does not collect return
destination/date, origin, lodging dates or detailed insurance facts. Explicit
generic-return fixtures retain +6-month PASS and +10-day FAIL. STRONG_PROFILE is
tested with all other material facts explicitly supplied too; six-month validity
alone does not clear unrelated unknowns.

The unchanged community golden is 78 from nine records. Permit-validity community
matching does not meaningfully contribute because the existing records lack the
observation; temporal semantics need future correction. Neither issue is fixed here.

The primary community-only stamp assertions were intentionally replaced with
assessment-gating assertions. Stage C semantic hashes still compare identical
underlying results, excluding only additive assessment policy/audit fields. Browser
checks cover normal, explicit strong, IRP fail, passport fail, 90/180 fail,
unsupported and 390px mobile cases, plus existing questionnaire/focus/motion checks.

No dynamic questions, new country coverage, source research, evidence promotion,
legal thresholds, arithmetic, canonical facts or release-selection semantics were
changed. Dark site styling and white report paper remain; semantic stamp colors
now follow the assessment rather than the community score alone.
