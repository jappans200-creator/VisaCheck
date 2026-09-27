# V1 short questionnaire

The questionnaire is an initial assessment, not a replacement application form.
Existing rules, thresholds, evidence and community scoring are unchanged.

## Exact normal-path questions

This example is an ordinary Indian adult, resident in Ireland with a declared
valid IRP, Metropolitan France tourism, hotel evidence, no previous Schengen stays
or fingerprints, no sponsorship, return travel evidence available, and optional
community details skipped. Yes/No/Unsure controls have no selected real-observation
default. All figures count conditionally visible inputs with sections expanded.

1. Passport nationality
2. Residence country
3. Age on application date
4. Do any special circumstances below apply to your application?
5. Document type
6. Issue date
7. Expiry date
8. Blank pages
9. Destination country
10. Purpose
11. Intended Schengen entry
12. Intended Schengen exit
13. Do you have a valid Irish Residence Permit (IRP)?
14. IRP expiry date
15. Have you spent any time in the Schengen Area during the 180 days before this planned trip?
16. Accommodation type
17. Do you have accommodation evidence or a reservation?
18. Do you have Schengen travel insurance that covers your full trip?
19. Do you have financial evidence available?
20. Will someone else sponsor or pay for your trip?
21. Do you have evidence of your return or onward travel?
22. Do you have a travel itinerary?
23. Do you have documents showing the purpose of your trip?
24. Do you have information or documents supporting your intention to leave?
25. Add optional details for the separate community comparison?
26. Have you previously provided fingerprints for a Schengen visa?

## Counts

- Previous questionnaire: 70 definitions; 39 initial; 55 representative-path questions.
- Current: 35 definitions, of which 12 are conditional.
- Blank initial form: 23 questions; 24 once Ireland is selected.
- Example normal path above: 26 questions.
- Maximum simultaneously eligible fixed inputs for the ordinary route: 34.
- One previous-stay row adds 3 inputs, making 37 at maximum expansion.
- Each additional stay adds 3 more; repeated history has no finite maximum.

Conditional alternatives include IRP expiry, hotel/other evidence versus private
host attestation, alternative accommodation means, sponsor evidence, return funds,
previous stays and completeness confirmation, prior collection date, and optional
community profile fields. The history completeness question requires a stay row.

## Removed, merged and moved

35 previous controls were removed; the following old IDs no longer exist:

- `return`: Return to Ireland
- `activity`: Will you do any paid or professional work during this trip?
- `other_schengen`: Will you visit any other Schengen countries on this trip?
- `legal`: Are you currently legally resident in Ireland?
- `renewal`: Is an IRP renewal currently pending?
- `origin_details`: Add optional details for the IRP post-return validity check?
- `origin`: Country of origin for this optional check
- `attestation_original`: Is the original attestation available?
- `accommodation_from`: Accommodation coverage starts
- `accommodation_to`: Accommodation coverage ends
- `amount`: Actual policy coverage amount
- `currency`: Coverage currency
- `insurance_from`: Policy valid from
- `insurance_to`: Policy valid to
- `territorial`: Covers Schengen territory
- `repatriation`: Medical repatriation
- `emergency`: Emergency medical coverage
- `hospital`: Hospital treatment
- `reuse`: Has reuse of those biometrics been confirmed for this application?
- `physical`: Have you declared a physical reason you cannot provide fingerprints?
- `exemption`: Have you declared another fingerprint exemption?
- `completed`: Have you completed your France-Visas online application?
- `validated`: Has the application been validated or finalized?
- `form_document`: Do you have the completed application form ready for submission?
- `receipt`: Do you have your application receipt?
- `original`: Is your original passport available?
- `copy`: Do you have a copy of your passport?
- `photos`: How many recent, qualifying ICAO-format identity photos do you have?
- `supporting_prepared`: Which requested supporting documents have you prepared?
- `appointment`: Have you booked your appointment?
- `submitted`: Have you already submitted or lodged this visa application?
- `intended_lodging`: Planned application / lodging date
- `actual_lodging`: Date the application was lodged
- `envelope`: Return envelope ready (current process — verification pending)
- `languages`: Document languages, separated by commas (e.g. English, French)

- Residence questions merge into one valid-IRP declaration, scoped to Ireland.
- Detailed insurance questions merge into a full-trip declaration, not detailed
  legal conclusions. Coverage amount/currency are also left to policy review.
- Originals, copies, forms, receipt, photographs, appointment, submission, translation
  and return-envelope procedure become results/checklist guidance, not outstanding
  tasks inferred from absent answers. Counts and policy thresholds are read from
  existing configuration metadata.
- Work and other-Schengen questions become explicit narrow preview assumptions.
- Accommodation dates, origin and return-to-Ireland details are no longer requested.
- Rare biometric exceptions and reuse confirmation remain internal capabilities.

## Exact derivations and limits

For IN nationality + ordinary passport + IE residence + known adult age + explicit
No to special circumstances + Metropolitan France tourism, the adapter sets
professional activity false and France competence as product-scope assumptions.
The report displays both assumptions. It does not create a destinations list or
claim the applicant expressly confirmed a single-country itinerary. The resolver
can still receive an unresolved/multi-country scope through a future integration.
No other nationality, residence, document, special category or purpose inherits
these tourism assumptions.

Within the supported ordinary India/Ireland profile, valid IRP Yes supplies card
presence, IRP permit type and legal residence. No/unsure leave legal status and
physical card presence unknown: an expired card may still exist, and lawful
residence may have another basis. Hidden expiry is cleared and ignored.

Insurance Yes establishes a reported policy and a positive high-level declaration
only. No means no confirmed suitable full-trip policy, not necessarily no policy
at all. Detailed benefit, territorial, monetary and date facts stay unavailable.
The readiness declaration is displayed separately from deterministic results.

## Intentionally unavailable facts

Country of origin, Irish return date, renewal, both lodging dates, preparation
booleans, qualifying-photo count, translation languages, accommodation dates,
insurance amount/currency/dates/benefits, fingerprint exceptions and confirmed reuse
remain unknown (null or absent nested fields, both treated as missing by getFact).
Some existing rules therefore correctly return UNKNOWN: passport age at lodging,
IRP post-return validity, earliest lodging, detailed insurance and biometric reuse.
Irish return stays UNKNOWN internally and is omitted from the main report UI.
These do not suppress the report or produce a combined eligibility verdict.

## Validation

The full 280-test suite includes 231 unchanged earlier tests and 49 updated form/
integration tests for the revised product contract. Underlying legal assertions
remain unchanged. Browser smoke tests cover normal and partial-answer reports,
conditional fields, stale values, checklist guidance, community loading, reset/
refresh and 390px width. No dependency was added.
