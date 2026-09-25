# V1 form simplification audit

This is a form/adapter refactor. Existing rules, integration configuration,
evaluators, source/evidence records and community scoring are unchanged.

## Metrics

Counts include conditionally eligible input questions with sections expanded;
collapsed section headings and action buttons are not questions.

| Metric | Count |
|---|---:|
| Previous field definitions | 79 |
| Previous initially visible / representative tourism path | 74 |
| New field definitions | 70 |
| New initially visible | 39 |
| Representative tourism path | 55 |
| Conditional questions | 31 |
| Maximum simultaneously eligible fixed questions | 67 |
| Maximum with one previous-stay row | 70 |

Each further stay adds three inputs, so the repeated-history editor has no finite
maximum. Maxima respect mutually exclusive controls; they are not a sum of every
possible branch. The representative path has insurance, hotel evidence, legal
Irish residence and an IRP; no sponsor, prior stays or prior biometrics; online
application not yet completed/submitted; optional origin/community details skipped.
Sixteen old controls were removed/replaced; origin additionally moved out of the
normal flow. Seven former fact questions are now adapter derivations (listed below),
with further fan-out from grouped document and return-funds answers.

## Safety decisions

- Country of origin is genuinely consumed by IRP-rule applicability. It cannot
  be inferred from nationality. Normal completion does not require it. An optional
  follow-up preserves the ability to evaluate the existing rule with supplied facts;
  leaving it unanswered produces UNKNOWN, not a manufactured country or exemption.
- The plain special-circumstances question explicitly mentions family settlement,
  EU-family/free movement/Stamp 4 EUFAM, seafarers and other special categories.
  Only No plus a known adult age supplies ordinary-adult conditions.
- “No pending renewal” does not establish NOT_STARTED, COMPLETED or NOT_APPLICABLE;
  the renewal enum stays UNKNOWN. Permission status stays null.
- A return ticket/confirmation does not prove separately assessed return funds.
  The funds alternative is asked only when primary evidence is absent. If it is
  not asked, its facts stay null; sponsorship retains its existing alternative
  behavior. No readiness equivalence has been invented.
- Emergency and hospital coverage remain separate because the existing rule uses
  OR: a combined “and” question would lose information.
- A grouped originals/copies question has explicit options for every combination.
  This avoids interpreting a vague No as absence of both.
- Actual and intended lodging dates are mutually conditional and never substituted.
  The planned path can evaluate earliest lodging; the submitted path can evaluate
  actual-date checks. The unused reference remains unknown. Historical rule tests
  still assert the original thresholds; only UI-dependent fixtures were updated.
- Qualifying-photo count explicitly includes the applicant’s qualification claim.
- `isVisible` is shared by controller and adapter. Hidden descendants cannot become
  active through stale parent answers. The DOM clears hidden controls and stay rows;
  the adapter independently ignores stale data supplied directly to it.

## Complete inventory of the former visible controls

| Former field | Classification | Treatment |
|---|---|---|
| `nationality` | KEEP | Retained with plain wording where needed. |
| `residence` | KEEP | Retained with plain wording where needed. |
| `legal` | KEEP | Retained with plain wording where needed. |
| `age` | KEEP | Retained with plain wording where needed. |
| `origin` | REMOVE_FROM_UI / CONDITIONAL | Removed from normal completion; explicit optional follow-up under Irish Residence. Otherwise null; nationality is never substituted. |
| `ordinary` | DERIVE | Negative special-circumstances answer plus supplied adult age; no ordinary default. |
| `document` | KEEP | Retained with plain wording where needed. |
| `issuer` | DERIVE | Indian ordinary-passport selection only. No issuer inference for other routes. |
| `issue` | KEEP | Retained with plain wording where needed. |
| `expiry` | KEEP | Retained with plain wording where needed. |
| `pages` | KEEP | Retained with plain wording where needed. |
| `destination` | KEEP | Retained with plain wording where needed. |
| `territory` | DERIVE | Explicit Metropolitan France destination. |
| `regime` | DERIVE | Existing supported France configuration only. |
| `visa_type` | DERIVE | Supported France short-visit option plus a supported purpose. |
| `purpose` | KEEP | Retained with plain wording where needed. |
| `single_trip` | MERGE | Replaced by other-Schengen-countries question; No permits existing narrow route constraint. |
| `entry` | KEEP | Retained with plain wording where needed. |
| `exit` | KEEP | Retained with plain wording where needed. |
| `return` | KEEP | Retained with plain wording where needed. |
| `activity` | KEEP | Retained with plain wording where needed. |
| `settlement` | DERIVE | Only explicit No to the question whose help includes family settlement. Yes to special circumstances does not assert settlement. |
| `history` | KEEP | Retained with plain wording where needed. |
| `history_complete` | CONDITIONAL | Shown only when {"all": [["history", "yes"], ["$has_stays", true]]}. Hidden values ignored and cleared. |
| `permission` | INTERNAL_ONLY | No longer asked; permission status remains null, not inferred from an IRP or renewal. No current evaluator consumes this field. |
| `permit_type` | DERIVE | Explicit physical IRP card present; special-family declaration remains separate. |
| `irp` | CONDITIONAL | Shown only when ["legal", "yes"]. Hidden values ignored and cleared. |
| `irp_expiry` | CONDITIONAL | Shown only when ["irp", "yes"]. Hidden values ignored and cleared. |
| `renewal` | CONDITIONAL | Shown only when ["legal", "yes"]. Hidden values ignored and cleared. |
| `insurance` | KEEP | Retained with plain wording where needed. |
| `amount` | CONDITIONAL | Shown only when ["insurance", "yes"]. Hidden values ignored and cleared. |
| `currency` | CONDITIONAL | Shown only when ["insurance", "yes"]. Hidden values ignored and cleared. |
| `insurance_from` | CONDITIONAL | Shown only when ["insurance", "yes"]. Hidden values ignored and cleared. |
| `insurance_to` | CONDITIONAL | Shown only when ["insurance", "yes"]. Hidden values ignored and cleared. |
| `territorial` | CONDITIONAL | Shown only when ["insurance", "yes"]. Hidden values ignored and cleared. |
| `repatriation` | CONDITIONAL | Shown only when ["insurance", "yes"]. Hidden values ignored and cleared. |
| `emergency` | CONDITIONAL | Shown only when ["insurance", "yes"]. Hidden values ignored and cleared. |
| `hospital` | CONDITIONAL | Shown only when ["insurance", "yes"]. Hidden values ignored and cleared. |
| `accommodation` | KEEP | Retained with plain wording where needed. |
| `accommodation_evidence` | CONDITIONAL | Shown only when ["accommodation", ["HOTEL", "OTHER"]]. Hidden values ignored and cleared. |
| `accommodation_means` | CONDITIONAL | Shown only when {"any": [["accommodation_evidence", "no"], ["attestation", "no"]]}. Hidden values ignored and cleared. |
| `accommodation_from` | CONDITIONAL | Shown only when {"any": [["accommodation_evidence", "yes"], ["attestation", "yes"]]}. Hidden values ignored and cleared. |
| `accommodation_to` | CONDITIONAL | Shown only when {"any": [["accommodation_evidence", "yes"], ["attestation", "yes"]]}. Hidden values ignored and cleared. |
| `attestation` | CONDITIONAL | Shown only when ["accommodation", "PRIVATE_HOST"]. Hidden values ignored and cleared. |
| `attestation_original` | CONDITIONAL | Shown only when ["attestation", "yes"]. Hidden values ignored and cleared. |
| `finance` | KEEP | Retained with plain wording where needed. |
| `sponsor` | CONDITIONAL | Shown only when ["sponsored", "yes"]. Hidden values ignored and cleared. |
| `return_funds` | MERGE | Shared return-money answer, revealed only when travel evidence is absent. |
| `return_evidence` | KEEP | Retained with plain wording where needed. |
| `reservation` | INTERNAL_ONLY | No independent question. General travel evidence Yes leaves reservation type unknown; an explicit lack of travel confirmation establishes absence. |
| `funds_ticket` | MERGE | Same return-money answer feeds the separate transport-funds fact. |
| `itinerary` | KEEP | Retained with plain wording where needed. |
| `purpose_evidence` | KEEP | Retained with plain wording where needed. |
| `intention` | KEEP | Retained with plain wording where needed. |
| `previous_bio` | KEEP | Retained with plain wording where needed. |
| `bio_date` | CONDITIONAL | Shown only when ["previous_bio", "yes"]. Hidden values ignored and cleared. |
| `reuse` | CONDITIONAL | Shown only when ["previous_bio", "yes"]. Hidden values ignored and cleared. |
| `physical` | KEEP | Retained with plain wording where needed. |
| `exemption` | KEEP | Retained with plain wording where needed. |
| `completed` | KEEP | Retained with plain wording where needed. |
| `validated` | CONDITIONAL | Shown only when ["completed", "yes"]. Hidden values ignored and cleared. |
| `appointment` | KEEP | Retained with plain wording where needed. |
| `file_asserted` | MERGE | Grouped answer about all requested originals/copies; no inference from purpose evidence. |
| `submitted` | KEEP | Retained with plain wording where needed. |
| `envelope` | KEEP | Retained with plain wording where needed. |
| `intended_lodging` | CONDITIONAL | Shown only when ["submitted", "no"]. Hidden values ignored and cleared. |
| `actual_lodging` | CONDITIONAL | Shown only when ["submitted", "yes"]. Hidden values ignored and cleared. |
| `form_document` | CONDITIONAL | Shown only when ["completed", "yes"]. Hidden values ignored and cleared. |
| `receipt` | KEEP | Retained with plain wording where needed. |
| `original` | KEEP | Retained with plain wording where needed. |
| `copy` | KEEP | Retained with plain wording where needed. |
| `photos_qualify` | MERGE | Count explicitly concerns recent qualifying ICAO photos. Unknown count leaves confirmation unknown. |
| `support_originals` | MERGE | Grouped choice distinguishes both, originals only, copies only and neither. |
| `support_copies` | MERGE | Same grouped choice; a vague No is never interpreted as both absent. |
| `photos` | KEEP | Retained with plain wording where needed. |
| `languages` | KEEP | Retained with plain wording where needed. |
| `visited` | CONDITIONAL | Shown only when ["community_details", "yes"]. Hidden values ignored and cleared. |
| `refusal` | CONDITIONAL | Shown only when ["community_details", "yes"]. Hidden values ignored and cleared. |
| `other_visas` | CONDITIONAL | Shown only when ["community_details", "yes"]. Hidden values ignored and cleared. |

## Remaining UX limitations

There are still many useful questions for a fully prepared application. Ten
collapsible sections and conditional disclosure avoid showing all details at once.
Unknown optional origin and the unasked lodging reference can still leave checks
unresolved; no existing legal ambiguity is resolved by this refactor. Community
comparison details are optional and never used as official facts.
