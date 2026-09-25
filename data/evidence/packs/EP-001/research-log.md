# EP-001 research log

## Infrastructure baseline

- State: NOT_STARTED
- Reviewer: PENDING
- Assessment date: unknown (null in manifest)
- Research started: unknown/not started (null in manifest)
- Last research update: unknown/not started (null in manifest)
- Sources retrieved: none
- Source records: none
- Evidence records: none
- Official assistant runs: none
- Requirements verified: none

Only schemas, an empty manifest, the research checklist and this log have been
created. No previous discovery URL has been registered or treated as verified.
See the manifest change history for the infrastructure creation timestamp.

## Future log entry format

After source research is authorised, record: timestamp, researcher, slot ID,
research question, action, source ID/revision if registered, exact assistant
inputs if applicable, result, access/capture limitations, conflicts, and next
review action. Failed searches and inaccessible sources belong here too.
Do not record credentials, application identifiers or unnecessary personal data.

The baseline above describes the original infrastructure state. See the subsequent
encoding entry below; original external research dates remain unknown.


## EP001-01 supplied-review encoding — 2026-09-23T21:40:34Z

- Action: encode the user-supplied external review only; no source browsing.
- Input: attached `Pasted text.txt`, SHA-256 `315bc7c28dcb92a9e32b638d0d8451eaff0dd3732778ee6a30c78734980af761`.
- External reviewer identity and retrieval/review dates: not supplied.
- Registered: five source revisions and nine evidence revisions, all 0.1.0.
- Exact source/evidence IDs and paths: manifest version 0.2.0.
- EP001-01 status: NEEDS_REVIEW; A–H NEEDS_REVIEW, I UNRESOLVED.
- Sources are attributed to official authorities by the supplied review, but their
  verification metadata is incomplete; official_status remains UNCONFIRMED.
- No source page was fetched, no official excerpt was supplied, and no search
  result snippet was used. Paraphrases are labelled in interpretations, not
  presented as quotations. Exact locators are populated only where supplied.
- Source 1 consolidation date is transcribed from its supplied URL identifier;
  it is not an effective date or completed version verification.
- Missing metadata: source language, retrieval/verification dates, most version
  details, effective dates, reference copies, some locators, exact excerpts,
  exception conditions and reviewer identity. No exact reference event supplied.
- Scope decision recorded: distinguish ordinary document, potential free-movement
  branch, other exceptional cases and usable authorisation from nationality
  baseline. Tourism/private visit share only the supplied baseline finding, not
  assumed supporting-document requirements.
- No independent exception/conflict analysis was performed. All five evidence
  verification checks remain PENDING. No proposition was promoted to VERIFIED.
- Schema 1.1.0 permits unknown metadata for pending imported records; 1.0.0
  constraints and VERIFIED citation gates remain enforced. Manifest slot entries
  now support explicit status without changing existing required fields.
- All other slots, including EP001-02 and the separate purpose slots, remain
  UNRESEARCHED. No runtime rules, application changes or further research.
- Next review need: supply the missing evidence/provenance before verification;
  no next research slot has been started.


## Evidence infrastructure correction — 2026-09-23T21:48:46Z

Schema-only migration to 2.0.0: sources are explicitly SUPPLIED_REFERENCE, all
metadata remains INCOMPLETE, and new immutable 0.2.0 revisions preserve original
0.1.0 files. Manifest 0.3.0 pins the new revisions. All missing dates, quotations,
locators and reviewer fields stay missing. All five review checks stay PENDING.
No evidence status changed: A–H NEEDS_REVIEW; I UNRESOLVED. Other slots remain
UNRESEARCHED. No source retrieval, new research, runtime rules or promotion.
Original schema 1.0.0 is restored as a versioned contract; the previously
unversioned manifest status extension is defined explicitly in 1.1.0.


## EP001-02 supplied-research recording — 2026-09-23T22:07:02Z

- Input: supplied `Pasted text.txt`, SHA-256 `9de0b02d531d2d81f66cc16aa0daa77a2f05ecb6298b1df7c80c2958e709c6ae`.
- No browsing, source retrieval, inspection, quotations or reviewer identity
  manufactured. Recording timestamp is not an external research/review date.
- Reused FRANCE-VISAS-SCHENGEN@0.2.0 unchanged (SUPPLIED_REFERENCE).
- Registered five new source revisions: EU-2009-810, EU-2016-399,
  FRANCE-VISAS-SHORT-STAY, FRANCE-VISAS-LONG-STAY, FRANCE-VISAS-FAQ, each 0.1.0.
- Sources remain SUPPLIED_REFERENCE / INCOMPLETE / UNCONFIRMED. Visa Code
  consolidation date is transcribed from the supplied URL, not independently
  established as current or effective.
- Recorded EP001-02-A through K, each 0.1.0, NEEDS_REVIEW / INCOMPLETE.
  Exact Articles are stored only where supplied; all official excerpts remain
  null. Reference-event wording is explicitly labelled as supplied paraphrase.
- Missing promotion evidence: inspected provenance, exact excerpts/languages,
  some locators, reviewed dates/versions, reviewer identity and exception review.
- Separate concepts recorded: regime resolution, rolling stay-limit calculation,
  competent-state determination, and consular territorial jurisdiction.
- Future facts recorded: destination/territory, proposed dates, purpose,
  itinerary countries/dates/purpose, exact prior stay dates, residence/status,
  intended first external entry and existing authorisation where relevant.
- Overseas-France, long-stay and Monaco are scope/routing findings only, not
  newly supported V1 routes. Monaco remains MC; competent authority FR is separate.
- EP001-01 records, source revisions and statuses remain unchanged. All remaining
  slots (EP001-03 onward, including separate purpose slots) stay UNRESEARCHED.
- Lock additions only: hashes for the 16 new immutable files. No previous lock
  entry changed. No schema, validation implementation or application changes.
- Stopped after EP001-02; no EP001-03 research or runtime implementation.


## EP001-03 supplied-research recording — 2026-09-23T22:15:08Z

- Input: supplied Pasted text.txt, SHA-256 `65135c501f530944a992b9dafb871b2f487ca52b3e394b58a596ef28872ec9aa`.
- No browsing, retrieval, inspection or new visa research. All statements are
  supplied paraphrases; quotations, reviewer details and absent locators stay null.
- Reused FRANCE-VISAS-FAQ@0.1.0 unchanged.
- New revision EU-2009-810@0.2.0 preserves supplied 2024-06-28 consolidation URL;
  0.1.0 still records 2024-06-11. Same legal-source ID, no assumed equivalence,
  no claim of current applicability. Previous evidence stays pinned to 0.1.0.
- New FRANCE-VISAS-SHORT-STAY@0.2.0 preserves /en/short-stay-visa separately from
  /en/visa-de-court-sejour. New FRANCE-VISAS-IRELAND@0.3.0 preserves the supplied
  non-www URL separately from the existing www URL. No redirect/content checks
  performed and no duplicate source IDs introduced.
- Manifest selects the new revisions; all earlier revisions remain registered
  and immutable, and all prior citations continue to resolve to their old pins.
- Twelve propositions EP001-03-A through L recorded as NEEDS_REVIEW / INCOMPLETE.
  Source provenance is SUPPLIED_REFERENCE. All five review checks stay PENDING.
- Missing promotion evidence: inspected sources, excerpts/languages, some exact
  locators, date/version review, identity/basis and exception analysis.
- Preserved: purpose versus duration; first entry only as fallback; nationality
  versus legal residence; discretionary non-resident lodging; representation;
  intake versus decision authority; Monaco as MC, not FR.
- Supplied platform-change date 2026-05-12 is retained only as an operational
  observation in I, not as the effective date of the architectural finding.
- Future facts: residence country/status; itinerary countries/territories,
  arrival/departure dates and purposes; first external entry; legal-presence
  country, applying outside residence and justification. Main destination is
  a potential derived fact; unknown competence must not be guessed.
- All original lock entries retained; added hashes only for 15 new revisions.
- EP001-01 and EP001-02 records/statuses unchanged; EP001-04 onward UNRESEARCHED.
- No schema, application, scoring, CSV or runtime changes. Stopped after EP001-03.

## EP001-04 supplied-research recording — 2026-09-23T22:24:31Z

- Supplied attachment SHA-256: `061a67f139912881357c4f6850deb37ef1ab16c00facd1a51b9c2cf5415a46df`.
- No independent research, browsing, retrieval or inspection.
- Reused EU-2009-810@0.2.0, EU-2016-399@0.1.0 and
  FRANCE-VISAS-IRELAND@0.2.0 (exact supplied www URL). Manifest's existing
  Ireland active pointer remains 0.3.0; new citations resolve to retained 0.2.0.
- Four new SUPPLIED_REFERENCE / INCOMPLETE sources: application process,
  arrival, recognition overview and Part I dataset lead. Publication date
  2026-09-16 is supplied only; no exact recognition matrix entry established.
- A-I and K NEEDS_REVIEW; J UNRESOLVED. No VERIFIED promotion.
- Preserved calendar months, emergency discretion, last intended departure,
  unknown ten-year comparison event, application versus border-entry stages,
  unknown recognition, document-category scope and non-deterministic condition.
- J preserves departure versus requested-visa-expiry wording without resolving it.
- Future facts: document type/issuer/issue/expiry/blank pages/condition; trip
  entry/exit; multiple visits/last exit. Recognition is future reference data,
  not self-certification. K notes potential EP001-07 overlap without runtime rules.
- Added 15 lock entries only; prior revisions, schemas and statuses unchanged.
- EP001-05 onward remains UNRESEARCHED. No application/scoring/community edits.

## EP001-05 supplied recording — 2026-09-24T21:45:43Z

- Original and supplement attachment SHA-256: `d0615f52fd720441db61cfdf214ec24510ca25bbb5105e28720f1fd731d33664`; `93ce3b91e49c943704f7b4aba47fb87baae192116a8ed4c09dda1c0a3ad2e526`.
- Missing historical-notice URL supplied; blocker resolved without schema change.
- Reused FRANCE-VISAS-IRELAND@0.2.0 exact www reference; active Ireland pointer
  unchanged. EU-2009-810@0.3.0 preserves legal-family URL with no consolidation
  inferred; previous citations remain pinned. Five new Irish references, all
  SUPPLIED_REFERENCE / INCOMPLETE; no browsing, retrieval or inspection.
- A-J NEEDS_REVIEW; no excerpts/reviewer invented. C: 1 calendar month after
  intended return to Ireland, not 30 days. Pending renewal does not establish
  satisfaction or automatic failure. Permission and physical card remain distinct.
- H cites PDF and announcement ending 2026-02-28 and separate summer context
  2026-07-13 through 2026-08-31; historical only, never current PASS or override of C.
  January/February renewal-before-expiry and carrying-document conditions retained.
- EU-family branch links prior EP001-01; jurisdiction links prior EP001-03.
- Future facts include permission/card dates and possession, renewal status,
  residence category, trip departure/return and EU-family condition; no model built.
- Manifest 0.7.0; applicant_conditions unchanged UNDETERMINED. Prior slots unchanged;
  EP001-06 onward UNRESEARCHED. Added 16 immutable revision hashes only.
- No schema/runtime/UI/scoring/community edits, commit or push. Stop after EP001-05.

## EP001-06 supplied recording — 2026-09-24T21:51:57Z

- Attachment SHA-256: `d7cf3647fab9f246771fffdb8275b690d76cd175e7d5c7e5ad8662a4a2af62b0`.
- No browsing, independent research, retrieval or inspection.
- Reused FRANCE-VISAS-IRELAND@0.2.0. New EU-2009-810@0.4.0 preserves
  supplied PDF reference with June 11 consolidation; ELI June 11/June 28 and
  legal-family revisions remain immutable. No content equivalence inferred.
- New FRANCE-VISAS-FAQ@0.2.0 preserves non-www supplied URL; previous www
  reference retained. Manifest selects new revisions; old evidence pins unchanged.
- A-I and K NEEDS_REVIEW, J UNRESOLVED; all incomplete, no VERIFIED promotion.
- Six calendar months is not 180 days; fifteen calendar days retains urgency.
  Seafarer longer-window exception recorded outside ordinary coverage without
  inventing a duration. FAQ two-weeks discrepancy remains unresolved.
- Ireland recommendation (20 working days), operational estimate (about 10–15
  working days with delays), legal decision period (normal 15 calendar days,
  possible extension up to 45) remain separate. No historical 3-month/30/60-day
  structure encoded as current. Urgent decisions without delay not quantified.
- Future facts: trip start/departure, appointment request/date, lodging and
  admissibility status. Admissibility date only if supported by later research;
  not a replacement for the admissible-application lodging trigger.
- Manifest 0.8.0; applicant_conditions UNDETERMINED unchanged. Thirteen new
  immutable hashes; prior revisions/statuses unchanged, EP001-07 onward UNRESEARCHED.
- No schema/runtime/UI/scoring/community edits, commit or push. Stop after EP001-06.

## EP001-07 through EP001-11 supplied batch — 2026-09-24T21:59:15Z

- Attachment SHA-256: `44b8489e998986be0f2e410c553e71124813b6ae8a18baf65f5f260be62be5ec`.
- Five independent slots; 34 records, all NEEDS_REVIEW / INCOMPLETE.
- Reused EU-2009-810@0.4.0: batch explicitly names the already represented
  current consolidated source family. Reused FAQ@0.2.0 exact non-www URL and
  FRANCE-VISAS-ARRIVAL@0.1.0 for the named arrival-guidance family. No new
  equivalence/version claim. Added FRANCE-VISAS-TOURIST-STAY@0.1.0 only.
- All supplied references; no browsing/retrieval/inspection or invented excerpts,
  locators, reviewers or dates. No VERIFIED promotion.
- EP001-07 (7 records): Article 14 alternatives and Annex II NON-EXHAUSTIVE examples retained. Visa assistant defines applicable list; document presence is not substantive acceptance.
- EP001-08 (7 records): EUR 65/day hotel-covered, EUR 120/day no hotel, partial coverage 65/day plus 120/day by period; EUR 32.50/day validated private host. BORDER ENTRY only; not automatic application refusal.
- EP001-09 (6 records): Accommodation OR sufficient accommodation means retained. Private-host attestation d'accueil, host town hall, original at application and presentation at entry preserved.
- EP001-10 (8 records): EUR 30000; territory of Member States, entire intended stay/transit, medical repatriation, urgent medical and/or emergency hospital treatment and death. Multiple-entry first-visit scope and purchase exceptions retained.
- EP001-11 (6 records): Non-exhaustive travel-plan and return-reservation evidence; no organised-tour or non-refundable purchase mandate. Border return ticket OR means to buy one; prior competence dependencies retained.
- Cross-slot references preserve general/specialised links without runtime duplication.
  Private-host finance links accommodation; itinerary links EP001-02/03.
- Future finance, accommodation segments, insurance and transport facts recorded as
  implications only. Sponsorship details do not establish mandatory evidence or
  acceptance. Multiple-entry branch does not erase insurance for subsequent stays.
- Manifest 0.9.0 is one version increment for this controlled batch. Five slots
  updated independently; applicant_conditions remains UNDETERMINED.
- Added 35 lock hashes only. EP001-01 through EP001-06 and all previous revisions
  unchanged; EP001-12-T onward UNRESEARCHED. No schema/runtime/UI/scoring/community
  changes; CSV row 62 untouched. No commit/push. Stop after EP001-11.

## EP001-12-T / EP001-12-P / EP001-13 / EP001-14 supplied batch — 2026-09-24T22:07:06Z

- Attachment SHA-256: `08ebb83d95b7abd65c6ab9223506678c5f93713944c293f0a63ed35e489ec570`.
- Four independent slots; 31 records, all NEEDS_REVIEW / INCOMPLETE.
- Reused tourist-stay@0.1.0, FAQ@0.2.0, Ireland@0.2.0 and Visa Code@0.4.0.
- New tourism/private-stay and family-purpose source IDs. New short-stay@0.3.0
  and application-process@0.2.0 preserve supplied /en/web/france-visas paths;
  no redirect/content equivalence inferred. Prior evidence source pins unchanged.
- All sources SUPPLIED_REFERENCE; no browsing, inspection or invented metadata.
- EP001-12-T: Tourism purpose only; common evidence linked, no professional-activity authorisation or universal tourism checklist inferred. Unknown/mixed purpose is not default tourism.
- EP001-12-P: Private/family visit without settlement distinct from settlement/special-family routes. Attestation d'accueil links EP001-09; no universal private-visit checklist.
- EP001-13: Strict under-12 fingerprint exemption only; Ireland child attendance, parent/authority presentation and current photograph retained. Physical/temporary impossibility separate. Ordinary-adult intended scope only; minors and exceptional cases unsupported. Age exactly 12 is a pending review question.
- EP001-14: Photograph and 10 fingerprints subject to exceptions. Less than 59 months retained; previous visa issue and capture dates distinct, reuse not guaranteed. Ireland attendance separate from fingerprint exemption; partial/temporary collection branches retained.
- Age exactly 12 remains a pending boundary review question, not a resolved
  general-process rule. Scoped under-12 and over-12 propositions stay NEEDS_REVIEW.
- General possible personal-appearance exemption and Ireland attendance require
  review; no assumed override or automatic exemption. Temporary impossibility has
  no invented duration or diagnosis. Less than 59 months is not five years/60 months.
- Manifest condition mode SPECIFIED, values [ordinary_adult_applicant]: permitted
  nonempty-string scope representation, explicitly a user-supplied intended product
  boundary, not VERIFIED research/coverage. No numerical adulthood definition.
- Future age, purpose/settlement/professional intent, biometric dates/conditions,
  attendance and representative facts recorded only; no facts code or runtime rules.
- Manifest 0.10.0: one batch increment; four slots separately tracked. Added 35
  immutable revision hashes. EP001-01 through EP001-11 unchanged; EP001-15 onward
  UNRESEARCHED. No schemas/UI/scoring/community changes; CSV row 62 untouched.
- No commit/push. Stop after EP001-14.

## Final EP001-15 through EP001-19 supplied audit batch — 2026-09-24T22:16:05Z

- Attachment SHA-256: `2b08463a4ee4d97c9fc4f6e0726c179c0101108325dcf93d4008fa9dc1905e9e`.
- Five independent slots; 42 NEEDS_REVIEW / INCOMPLETE audit records with null
  candidate_rule_id to avoid duplicate independent runtime rules. Classifications
  retain deterministic-candidate findings where supplied, without rule creation.
- Reused exact compatible prior sources; only new reference is tourism/private-stay
  @0.2.0 preserving supplied www/en URL distinct from previous non-www/web path.
- No browsing, retrieval, inspection or VERIFIED promotion. Existing source pins
  remain valid; all previous immutable revisions untouched.
- Historical December 8, 2025 start is newly supplied by this audit and recorded
  in 19-G citation/period notes; prior source and EP001-05-H unknown start unchanged.
  No announcement publication date was substituted for an effective period.
- EP001-15: Narrow Metropolitan France/short-stay/tourism-private scope structurally ready for verification; not legally complete. Border financial figures and local instructions retain their scope.
- EP001-16: Common legal material linked; Schengen/France/Ireland layers distinct, Annex II non-exhaustive. Not all Schengen cases supported.
- EP001-17: Legal residence, permission and physical IRP distinct. One calendar month after intended Irish return; local estimates distinct from legal timing. Passport-return detail and operational staleness require review.
- EP001-18: Supplied India Annex-I ordinary-passport baseline retained subject to exceptions. No separate Indian-specific document regime invented; exact recognition matrix result still unestablished.
- EP001-19: Valid IRP, pending renewal, emergency permission and historical measures separately linked. Historical periods 2025-12-08–2026-02-28 and 2026-07-13–2026-08-31 do not create September 2026 exceptions. Irish re-entry separate from France assessment.
- Repository inspection found no detailed prior passport-return procedure despite
  the supplied broad inventory wording. Gap explicitly retained in 17-H and worklist.
- Manifest 0.11.0: single batch increment, READY_FOR_REVIEW for pack and purposes.
  Reviewer remains PENDING; ordinary_adult_applicant scope unchanged. All 20 slots
  populated, not legally complete, VERIFIED, production ready or guaranteed complete.
- Preserved prior 3 UNRESOLVED records and all earlier statuses. Added 43 immutable
  hashes only. No schema/runtime/UI/scoring/community edits; row 62 untouched.

Pending phase: EVIDENCE VERIFICATION AND PROMOTION (not started).

1. Retrieve exact current official sources.
2. Inspect source content.
3. Record genuine retrieval metadata.
4. Capture exact locators.
5. Add bounded supporting excerpts where permitted.
6. Confirm versions and effective dates.
7. Resolve or preserve conflicts.
8. Review applicability.
9. Review exceptions and dependencies.
10. Complete reviewer identity/time/basis.
11. Promote only evidence satisfying existing VERIFIED gates.
12. Leave unresolved/discretionary evidence unverified as appropriate.

No verification or runtime implementation performed. No commit/push. Stop after EP001-19.
