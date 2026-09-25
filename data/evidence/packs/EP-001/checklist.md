# Evidence Pack 001 research checklist

All 20 EP-001 research slots are **NEEDS_REVIEW** following encoding of supplied external research.
No slots remain UNRESEARCHED. Tourism and private visit remain separate
research purposes. No runtime rules or VERIFIED determinations have been created.

For each slot, complete this workflow after research is authorised:

1. State the exact question and applicable purpose/conditions.
2. Locate a potential official source (SOURCE_FOUND is not VERIFIED).
3. Establish authority and retrieve the applicable source revision.
4. Record its exact locator and short supporting excerpt.
5. Document what it establishes and does not establish.
6. Check dates, reference events, exceptions and dependencies.
7. Reconcile overlapping sources and record conflicts.
8. Classify the finding and identify required applicant inputs.
9. Submit the evidence for review with all five verification checks.
10. Record the review decision or unresolved limitation.

Coverage audits EP001-15 through EP001-18 reference substantive evidence rather
than duplicating it. Irish re-entry remains separate from French visa eligibility.

## EP001-01

- Category: Visa necessity and exemptions
- Status: NEEDS_REVIEW
- Source references: five exact 0.2.0 revisions listed in manifest.json
- Evidence references: EP001-01-A through EP001-01-I, each revision 0.2.0
- Reviewer: PENDING (external reviewer identity/date not supplied)
- Findings: supplied external-review propositions recorded; A–H NEEDS_REVIEW,
  I UNRESOLVED (architecture distinction without direct official citation).
- Missing: verbatim excerpts, some exact locators, retrieval/review dates,
  applicable-version/effective-date checks and complete exception analysis.
- V1 treatment: ordinary-passport baseline with separate special-branch screening
  and usable-authorisation question; findings only, no decision tree implemented.

## EP001-02

- Category: Regime, visa type and territorial scope
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.1.0, EU-2016-399@0.1.0,
  FRANCE-VISAS-SHORT-STAY@0.1.0, FRANCE-VISAS-LONG-STAY@0.1.0,
  FRANCE-VISAS-FAQ@0.1.0; reused FRANCE-VISAS-SCHENGEN@0.2.0.
- Evidence references: EP001-02-A through EP001-02-K, each revision 0.1.0
- Reviewer: PENDING (identity and review timestamps not supplied)
- Findings: supplied regime, stay-limit, territorial and competence propositions
  encoded only; all eleven NEEDS_REVIEW with INCOMPLETE metadata.
- Missing: inspected provenance, excerpts/languages, some exact locators,
  date/version review, reviewer identity, exception and conflict review.
- Scope: Monaco remains MC with competent authority FR in the research note;
  overseas-France and long-stay findings are coverage boundaries, not supported
  runtime routes. Tourism/private_visit remain separate purposes.
- Implementation: no calculator, resolver, runtime rules, or UI changes.

## EP001-03

- Category: Competent country and application jurisdiction
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.2.0, FRANCE-VISAS-SHORT-STAY@0.2.0,
  FRANCE-VISAS-IRELAND@0.3.0; reused FRANCE-VISAS-FAQ@0.1.0.
- Evidence references: EP001-03-A through L, each revision 0.1.0
- Reviewer: PENDING (no identity, inspection or completed review supplied)
- Findings: all twelve NEEDS_REVIEW / INCOMPLETE. Non-resident justification
  remains discretionary; provider/intake is not decision authority or competence.
- Missing: inspected provenance, verbatim excerpts/languages, some locators,
  version/effective-date review, reviewer identity and complete exception analysis.
- Operational observation: platform change effective 12 May 2026, supplied only;
  not a permanent legal competence rule or implemented booking instruction.
- Source handling: preserve June 28 versus June 11 consolidation and supplied
  France-Visas URL variants in separate revisions; do not assert equivalence.
- No resolver, runtime rules or later-slot research.

## EP001-04

- Category: Passport / travel-document requirements
- Status: NEEDS_REVIEW
- Source references: reused EU-2009-810@0.2.0, EU-2016-399@0.1.0,
  FRANCE-VISAS-IRELAND@0.2.0; new FRANCE-VISAS-APPLICATION-PROCESS,
  FRANCE-VISAS-ARRIVAL, EC-TRAVEL-RESIDENCE-DOCUMENTS,
  EC-TRAVEL-DOCUMENTS-PART-I (each 0.1.0).
- Evidence references: EP001-04-A through K, each 0.1.0.
- Reviewer: PENDING
- Findings: A-I and K NEEDS_REVIEW; J UNRESOLVED. All INCOMPLETE.
- Preserve intended departure versus requested-visa-expiry discrepancy for review.
- Three months means calendar months, not 90 days; emergency sufficiency not assessed.
- Ten-year comparison event unresolved; several-visit scope requires review.
- Application and border-entry citations remain distinguishable.
- Recognition dataset is a lead only: no India/ordinary/France matrix result supplied.
- Physical condition has no deterministic threshold; copies may overlap EP001-07.
- Missing: inspected provenance, excerpts/languages, exact guidance locators,
  version/date/exception review and named reviewer/basis. No VERIFIED promotion.

## EP001-05

- Category: Irish residence evidence and validity
- Status: NEEDS_REVIEW
- Source references: FRANCE-VISAS-IRELAND@0.2.0 reused; EU-2009-810@0.3.0
  preserves supplied family URL with unknown consolidation. Five new Irish sources
  (each 0.1.0): IE-TRAVEL-REENTRY, IE-REGISTRATION-RENEWAL,
  IE-TRAVEL-CONFIRMATION-2026-PDF, IE-TRAVEL-CONFIRMATION-EXTENSION-2026,
  IE-TRAVEL-CONFIRMATION-SUMMER-2026.
- Evidence references: EP001-05-A through J, each 0.1.0, all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: C preserves 1 calendar month after intended return to Ireland,
  not 30 days or a community-data threshold. Pending renewal remains uncertain.
- H is historical only: February arrangement ended 2026-02-28; separate summer
  measure ran 2026-07-13 through 2026-08-31. Neither creates a current exception.
- Preserve legal residence vs presence, permission vs physical IRP, French
  application vs Irish re-entry, and STAMP 4 EUFAM exceptional routing.
- Missing: inspected provenance, excerpts, locators, reviewer/basis and date/version,
  applicability and exception reviews. No VERIFIED promotion or runtime rules.

## EP001-06

- Category: Application timing
- Status: NEEDS_REVIEW
- Source references: FRANCE-VISAS-IRELAND@0.2.0 reused;
  EU-2009-810@0.4.0 (supplied June 11 PDF), FRANCE-VISAS-FAQ@0.2.0
  (supplied non-www URL). Prior reference revisions unchanged.
- Evidence references: EP001-06-A through K, each 0.1.0.
- Reviewer: PENDING
- Findings: A-I and K NEEDS_REVIEW; J UNRESOLVED. All INCOMPLETE.
- Article 9: 6 calendar months / normal 15 calendar days before intended visit;
  urgency retained without automatic qualification or unconditional failure.
- Ireland: 20 working days recommended lead time; about 10–15 working days
  operational processing estimate with delay caveats, not guaranteed issuance.
- Article 23: normal 15 calendar days from lodging of an admissible application;
  possible individual extension up to 45 calendar days; urgent cases without delay.
- J preserves fifteen calendar days versus FAQ two weeks for source/human review.
- Appointment request/date, actual lodging, admissibility, issuance and travel
  remain distinct. Historical 3-month and 30/60-day values are not current rules.
- Missing: inspected provenance, excerpts, guidance locators, reviewer/basis and
  completed version/date/exception/applicability review. No runtime implementation.

## EP001-07

- Category: General supporting documents
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, FRANCE-VISAS-TOURIST-STAY@0.1.0.
- Evidence references: EP001-07-A through G, each 0.1.0, all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Article 14 alternatives and Annex II NON-EXHAUSTIVE examples retained. Visa assistant defines applicable list; document presence is not substantive acceptance.
- Missing: inspected provenance, excerpts/languages, exact guidance locators,
  applicable version/date, applicability/exception/dependency review and reviewer/basis.
- No VERIFIED promotion, runtime rule, UI or statistical change.

## EP001-08

- Category: Financial means and evidence
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, FRANCE-VISAS-ARRIVAL@0.1.0, FRANCE-VISAS-FAQ@0.2.0, FRANCE-VISAS-TOURIST-STAY@0.1.0.
- Evidence references: EP001-08-A through G, each 0.1.0, all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: EUR 65/day hotel-covered, EUR 120/day no hotel, partial coverage 65/day plus 120/day by period; EUR 32.50/day validated private host. BORDER ENTRY only; not automatic application refusal.
- Missing: inspected provenance, excerpts/languages, exact guidance locators,
  applicable version/date, applicability/exception/dependency review and reviewer/basis.
- No VERIFIED promotion, runtime rule, UI or statistical change.

## EP001-09

- Category: Accommodation evidence
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, FRANCE-VISAS-ARRIVAL@0.1.0, FRANCE-VISAS-FAQ@0.2.0.
- Evidence references: EP001-09-A through F, each 0.1.0, all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Accommodation OR sufficient accommodation means retained. Private-host attestation d'accueil, host town hall, original at application and presentation at entry preserved.
- Missing: inspected provenance, excerpts/languages, exact guidance locators,
  applicable version/date, applicability/exception/dependency review and reviewer/basis.
- No VERIFIED promotion, runtime rule, UI or statistical change.

## EP001-10

- Category: Travel medical insurance
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, FRANCE-VISAS-ARRIVAL@0.1.0.
- Evidence references: EP001-10-A through H, each 0.1.0, all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: EUR 30000; territory of Member States, entire intended stay/transit, medical repatriation, urgent medical and/or emergency hospital treatment and death. Multiple-entry first-visit scope and purchase exceptions retained.
- Missing: inspected provenance, excerpts/languages, exact guidance locators,
  applicable version/date, applicability/exception/dependency review and reviewer/basis.
- No VERIFIED promotion, runtime rule, UI or statistical change.

## EP001-11

- Category: Transport and itinerary
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, FRANCE-VISAS-ARRIVAL@0.1.0.
- Evidence references: EP001-11-A through F, each 0.1.0, all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Non-exhaustive travel-plan and return-reservation evidence; no organised-tour or non-refundable purchase mandate. Border return ticket OR means to buy one; prior competence dependencies retained.
- Missing: inspected provenance, excerpts/languages, exact guidance locators,
  applicable version/date, applicability/exception/dependency review and reviewer/basis.
- No VERIFIED promotion, runtime rule, UI or statistical change.

## EP001-12-T

- Category: Tourism-specific requirements
- Status: NEEDS_REVIEW
- Source references: FRANCE-VISAS-SHORT-STAY@0.3.0, FRANCE-VISAS-TOURISM-PRIVATE-STAY@0.1.0, FRANCE-VISAS-TOURIST-STAY@0.1.0.
- Evidence references: EP001-12-T-A through F, each 0.1.0; all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Tourism purpose only; common evidence linked, no professional-activity authorisation or universal tourism checklist inferred. Unknown/mixed purpose is not default tourism.
- Missing: inspected provenance, excerpts/languages, exact page locators and
  completed version/date/applicability/exception review with reviewer/basis.
- No VERIFIED promotion, runtime code or added unsupported document requirements.

## EP001-12-P

- Category: Private-visit requirements
- Status: NEEDS_REVIEW
- Source references: FRANCE-VISAS-FAMILY-PURPOSE@0.1.0, FRANCE-VISAS-FAQ@0.2.0, FRANCE-VISAS-IRELAND@0.2.0, FRANCE-VISAS-SHORT-STAY@0.3.0, FRANCE-VISAS-TOURISM-PRIVATE-STAY@0.1.0.
- Evidence references: EP001-12-P-A through G, each 0.1.0; all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Private/family visit without settlement distinct from settlement/special-family routes. Attestation d'accueil links EP001-09; no universal private-visit checklist.
- Missing: inspected provenance, excerpts/languages, exact page locators and
  completed version/date/applicability/exception review with reviewer/basis.
- No VERIFIED promotion, runtime code or added unsupported document requirements.

## EP001-13

- Category: Age and applicant-condition branches
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, FRANCE-VISAS-APPLICATION-PROCESS@0.2.0, FRANCE-VISAS-IRELAND@0.2.0.
- Evidence references: EP001-13-A through H, each 0.1.0; all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Strict under-12 fingerprint exemption only; Ireland child attendance, parent/authority presentation and current photograph retained. Physical/temporary impossibility separate. Ordinary-adult intended scope only; minors and exceptional cases unsupported. Age exactly 12 is a pending review question.
- Missing: inspected provenance, excerpts/languages, exact page locators and
  completed version/date/applicability/exception review with reviewer/basis.
- No VERIFIED promotion, runtime code or added unsupported document requirements.

## EP001-14

- Category: Biometrics and procedure
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, FRANCE-VISAS-APPLICATION-PROCESS@0.2.0, FRANCE-VISAS-IRELAND@0.2.0.
- Evidence references: EP001-14-A through J, each 0.1.0; all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Photograph and 10 fingerprints subject to exceptions. Less than 59 months retained; previous visa issue and capture dates distinct, reuse not guaranteed. Ireland attendance separate from fingerprint exemption; partial/temporary collection branches retained.
- Missing: inspected provenance, excerpts/languages, exact page locators and
  completed version/date/applicability/exception review with reviewer/basis.
- No VERIFIED promotion, runtime code or added unsupported document requirements.

## EP001-15

- Category: France-specific coverage audit
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, FRANCE-VISAS-ARRIVAL@0.1.0, FRANCE-VISAS-FAQ@0.2.0, FRANCE-VISAS-IRELAND@0.2.0, FRANCE-VISAS-SHORT-STAY@0.1.0, FRANCE-VISAS-TOURISM-PRIVATE-STAY@0.2.0.
- Evidence references: EP001-15-A through H, each 0.1.0; all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Narrow Metropolitan France/short-stay/tourism-private scope structurally ready for verification; not legally complete. Border financial figures and local instructions retain their scope.
- Limits: audit links are not VERIFIED promotion or independent runtime rules.
- Missing: exact source inspection, excerpt/locator/version/date review,
  applicability/exception/dependency/conflict review and reviewer metadata.

## EP001-16

- Category: Schengen-wide coverage audit
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, EU-2018-1806@0.2.0, FRANCE-VISAS-IRELAND@0.2.0, FRANCE-VISAS-SHORT-STAY@0.1.0.
- Evidence references: EP001-16-A through H, each 0.1.0; all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Common legal material linked; Schengen/France/Ireland layers distinct, Annex II non-exhaustive. Not all Schengen cases supported.
- Limits: audit links are not VERIFIED promotion or independent runtime rules.
- Missing: exact source inspection, excerpt/locator/version/date review,
  applicability/exception/dependency/conflict review and reviewer metadata.

## EP001-17

- Category: Ireland/Dublin-specific coverage audit
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, FRANCE-VISAS-IRELAND@0.2.0, IE-TRAVEL-REENTRY@0.1.0.
- Evidence references: EP001-17-A through I, each 0.1.0; all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Legal residence, permission and physical IRP distinct. One calendar month after intended Irish return; local estimates distinct from legal timing. Passport-return detail and operational staleness require review.
- Limits: audit links are not VERIFIED promotion or independent runtime rules.
- Missing: exact source inspection, excerpt/locator/version/date review,
  applicability/exception/dependency/conflict review and reviewer metadata.

## EP001-18

- Category: India-passport-specific coverage audit
- Status: NEEDS_REVIEW
- Source references: EU-2009-810@0.4.0, EU-2018-1806@0.2.0, FRANCE-VISAS-IRELAND@0.2.0, FRANCE-VISAS-SHORT-STAY@0.1.0, FRANCE-VISAS-TOURISM-PRIVATE-STAY@0.2.0.
- Evidence references: EP001-18-A through G, each 0.1.0; all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Supplied India Annex-I ordinary-passport baseline retained subject to exceptions. No separate Indian-specific document regime invented; exact recognition matrix result still unestablished.
- Limits: audit links are not VERIFIED promotion or independent runtime rules.
- Missing: exact source inspection, excerpt/locator/version/date review,
  applicability/exception/dependency/conflict review and reviewer metadata.

## EP001-19

- Category: Irish re-entry audit
- Status: NEEDS_REVIEW
- Source references: FRANCE-VISAS-IRELAND@0.2.0, IE-REGISTRATION-RENEWAL@0.1.0, IE-TRAVEL-CONFIRMATION-2026-PDF@0.1.0, IE-TRAVEL-CONFIRMATION-EXTENSION-2026@0.1.0, IE-TRAVEL-CONFIRMATION-SUMMER-2026@0.1.0, IE-TRAVEL-REENTRY@0.1.0.
- Evidence references: EP001-19-A through J, each 0.1.0; all NEEDS_REVIEW / INCOMPLETE.
- Reviewer: PENDING
- Findings: Valid IRP, pending renewal, emergency permission and historical measures separately linked. Historical periods 2025-12-08–2026-02-28 and 2026-07-13–2026-08-31 do not create September 2026 exceptions. Irish re-entry separate from France assessment.
- Limits: audit links are not VERIFIED promotion or independent runtime rules.
- Missing: exact source inspection, excerpt/locator/version/date review,
  applicability/exception/dependency/conflict review and reviewer metadata.

## Pending next phase: EVIDENCE VERIFICATION AND PROMOTION

All 20 slots are populated, not VERIFIED or guaranteed complete. READY_FOR_REVIEW
means structural readiness for a dedicated pass, not production readiness.
Verification has NOT started. Runtime implementation remains out of scope.

Open work items:
- Existing authorisation handling: EP001-01-I remains UNRESOLVED; distinguish profile visa necessity from existing usable Schengen authorisation.
- Passport validity wording: EP001-04-J remains UNRESOLVED: intended/last departure versus requested-visa expiry.
- Application timing wording: EP001-06-J remains UNRESOLVED: Visa Code 15 calendar days versus FAQ two weeks.
- Age exactly 12: Review under-12 versus over-12 biometric wording and local interaction; do not infer the boundary answer.
- Reuse versus local attendance: General biometric reuse/appearance-exemption guidance versus Ireland attendance remains pending.
- Pending Irish renewal: Whether pending renewal satisfies French one-calendar-month-after-return IRP requirement remains unestablished.
- Border financial amounts: Exact application-stage role, if any, of published border-entry reference figures remains unestablished.
- Document recognition: Inspect exact India + ordinary passport + France recognition matrix entry; no result currently established.
- Provenance and review: Retrieve/inspect exact current official sources; bounded excerpts/locators, source versions/effective dates, applicability, exceptions/dependencies/conflicts and reviewer identity/time/basis remain incomplete.
- Passport return operational gap: Earlier records do not contain a detailed current passport-return procedure. Obtain official instructions and check staleness; do not infer coverage from a passing mention.
