# Official evidence research infrastructure

This directory contains offline research evidence and validation tools. It is not
loaded by the application and contains no executable visa eligibility rules.
EP001-01 currently contains only supplied external-review findings. No source
has been retrieved or independently inspected during encoding or migration.

## Three separate guarantees

1. **Schema validity:** fields have the required structure, types and conditional
   review assertions. This does not establish that an assertion is true.
2. **Repository integrity:** exact references resolve; source states and promotion
   prerequisites are acceptable; revision hashes and paths agree. This does not
   establish that a quotation supports a legal interpretation.
3. **Human/source verification:** a reviewer actually inspects official material,
   checks scope, interpretation, applicable versions/dates and exceptions, and
   records the basis. Neither schema nor repository validation proves legal truth.

Revision/workflow integrity is a repository guarantee, not a JSON Schema feature.

## Layout and schema versions

- `schemas/{source,evidence-record,pack-manifest}.schema.json`: Draft 7 dispatchers.
- `schemas/1.0.0/`: exact original contracts, retained unchanged.
- `schemas/1.1.0/`: explicitly versioned intermediate contracts.
- `schemas/2.0.0/`: corrected contracts for new work.
- `sources/<source-id>/<source-revision>.json`: immutable source revisions.
- `records/<evidence-id>/<revision>.json`: immutable proposition revisions.
- `packs/EP-001/`: active manifest, checklist and append-only research log entries.
- `revision-lock.json`: hashes of every source/evidence revision and versioned schema.
- `validation/`: dependency-free offline structural/repository checks.

A record's `schema_version` selects its contract. Its `revision` or
`source_revision` is a separate version. The manifest's `version` identifies a
pack update, not its schema. All source/evidence references pin exact revisions.
Reference paths are relative to this directory; checklist anchors are relative
to the pack. No unresolved "latest" source references are permitted.

Previously valid 1.0.0 records remain structurally valid under their original
contract. Missing retrieval timestamps and incomplete formal citations do not
become valid merely by relabelling a record 1.0.0. Original manifests reject
research-slot `status`; the status extension is explicitly defined in 1.1.0.
Corrected manifests use 2.0.0 and require a status for every slot reference.
The formerly mislabelled active manifest has been migrated; the historical log
records the error rather than pretending it was valid under the original schema.

Retained 1.1.0 records remain valid. New work uses 2.0.0. Legacy schema validity
is not permission to bypass new repository promotion requirements: VERIFIED
repository evidence must use 2.0.0 and cite acceptable 2.0.0 source provenance.
There is no automatic promotion or runtime consumer of these research files.

## Source provenance versus completeness versus review

In schema 2.0.0, `provenance.state` is explicit:

- `SUPPLIED_REFERENCE`: a URL/source identification supplied by a researcher or
  reviewer. `retrieved_at`, `verified_at`, inspection identity/time/method/basis
  must remain null, and `metadata_completeness` is INCOMPLETE.
- `RETRIEVED_INSPECTED`: requires a real retrieval timestamp, retrieval method,
  inspection identity, inspection timestamp and inspection basis. This alone
  does not confirm official authority or permit VERIFIED evidence.

`metadata_completeness` is independent of `research_status`:

- INCOMPLETE preserves unknowns as null, including excerpts and locator parts.
- COMPLETE means the mandatory metadata bundle is present. For evidence it
  includes usable, excerpted citations. It does not mean reviewed or correct.

NEEDS_REVIEW does not grant null permissions: metadata fields are nullable in
the base 2.0.0 structure, while COMPLETE asserts additional requirements.
VERIFIED requires COMPLETE plus promotion checks. A complete record may still
be NEEDS_REVIEW. Unknown effective dates may coexist with COMPLETE when their
review disposition has been documented; completeness does not mean omniscience.

Applicability uses UNDETERMINED, UNRESTRICTED or SPECIFIED. Unknowns are not
unrestricted scope. Empty exceptions/conflicts mean none recorded, not proof
that none exist. Country codes are identifiers, not verified country membership.
Source types, regimes, visa types, purposes and stages remain extensible.

## VERIFIED promotion

Structural checks require:

- COMPLETE citation metadata; at least one supporting citation; exact source ID
  and revision; a nonempty excerpt/language and usable locator for every citation.
- Known applicability, explicit interpretation and limitations.
- Reviewer identity, reviewed_at, verification basis, and all five named review
  checks CONFIRMED with notes and references.
- No unresolved **blocking** exception, dependency or conflict. Non-blocking
  pending items remain visible and require honest reviewer classification.
- A reviewed date/version disposition for every citation.
- Reviewed translations whenever `translation_relied_on` is true.

Repository promotion additionally requires:

- Every citation resolves to an actual registered source revision.
- Every cited source uses 2.0.0, RETRIEVED_INSPECTED, COMPLETE, confirmed official
  status and a verification timestamp. Relevant chronology is checked.
- Review-check reference strings identify exact cited source revisions, using
  `source_id@source_revision`; date/version review references identify that
  citation's exact source. These are evidence anchors, not proof of human review.
- Linked evidence references and paths resolve. A blocking evidence dependency
  for VERIFIED promotion must itself be VERIFIED.

Source captures are optional. If captured, preserve capture method, timestamp,
SHA-256 and limitations; exclude credentials, session tokens and personal data.
A source's retrieval timestamp is never the date an external summary was encoded.

## Translations and date/version uncertainty

`translation_relied_on` explicitly records whether interpretation depends on a
translation. If true, VERIFIED requires a nonempty REVIEWED translation. An
unused draft translation may remain UNREVIEWED. Reviewers must not falsely mark
a relied-on translation unused to evade the gate.

Each citation has `date_version_review`:

- PENDING: not reviewed.
- KNOWN_APPLICABLE: applicable date/version basis reviewed.
- UNKNOWN_NON_BLOCKING: unknown/not-stated details, why they do not block this
  proposition, basis, exact source reference, reviewer identity and review time.
- BLOCKING: prevents VERIFIED promotion.

If citation effective start is unknown, or the source has neither a version nor
a consolidation date, repository promotion requires UNKNOWN_NON_BLOCKING. Known
calendar dates must not be invented. A reviewer must determine whether an unknown
is actually non-blocking; validators only check the documented disposition.
All records retain separate retrieval, verification, consolidation and effective
dates. Calendar dates use YYYY-MM-DD; timestamps require a timezone.

## Revision immutability and workflow

Never edit a registered source/evidence revision or a versioned schema in place.
Create a new revision, retain the old file, add its hash to `revision-lock.json`,
and update active manifest references. Review the new record, manifest and lock
in the same change. Do not auto-regenerate the lock as a way to fix a failing test.
Schema dispatchers, active manifests and logs are mutable workflow documents;
versioned schemas and source/evidence files are locked artifacts.

Validation detects changed/deleted revisions, unregistered additions and ID/path
mismatches. When a committed lock exists, it also compares against HEAD and
rejects removal or alteration of previously committed lock entries. The initial
uncommitted lock is a baseline requiring human review. Hashes are not signatures:
an actor who can alter records, lock and trusted history can evade these checks.
This lightweight guard prevents accidental rewrites; it is not tamper-proof
storage and cannot enforce future human review by itself.

## Current EP001-01 migration

All five sources and nine propositions gained new 0.2.0 revisions using schema
2.0.0. Original 0.1.0 revisions were preserved byte-for-byte. Manifest schema
2.0.0 / pack version 0.3.0 pins the new revisions. All sources are supplied-only;
all metadata remains INCOMPLETE; all evidence review checks remain PENDING.
A–H remain NEEDS_REVIEW and I remains UNRESOLVED. All 19 other slots, including
EP001-02, remain UNRESEARCHED. Migration timestamps describe encoding only.

## Validation commands and limits

```sh
node data/evidence/validation/repository.cjs
node --test tests/evidence-schema.test.cjs
node --test
```

The repository command validates every active and retained source/evidence
revision, the manifest, cross-record references, checklist statuses and lock.
The schema helper is a small validator for the exact Draft 7 keyword subset used
here. Unknown keywords/references fail closed; formats are asserted. It is not
a full general-purpose JSON Schema implementation. Standard Draft 7 tools can
also validate the schemas, with relative references and format assertions enabled.

Only official sources may establish requirements. Community/statistical data,
VisaChanceChecker, forums, blogs, agencies and unofficial sites remain separate.
Schema and repository success never establish authority, authenticity or legal
correctness. Excerpts must be short and attributable; the character cap is not
permission to exceed source quotation limits. No visa research is authorised by
running these offline validation tools.
