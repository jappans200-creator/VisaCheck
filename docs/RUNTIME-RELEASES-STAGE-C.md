# Runtime releases — Stage C

This is local development orchestration, not a legal publication system. The sole
real release is `VISACHECK_FRANCE_V1@0.1.0`, `DEVELOPMENT_PREVIEW`, with
`release_ready: false` and evidence still `NEEDS_REVIEW`.

## Configuration and flow

The existing `integration/v1-preview.json` still supplies the fixed form adapter's
scope. Its `runtime_releases` registry contains exact release ID/version/path pins.
The old `assets` map remains compatibility documentation; the browser and test
fixtures now load from release references. A test enforces equivalence of both maps
for this initial migration. No directory scan, latest-version selection, network
rule service or inheritance exists.

1. Load and validate the pinned release registry.
2. The unchanged questionnaire feeds the Stage A/B canonical facts through the
   existing fixed form adapter.
3. `runtime-release.resolve` classifies the route against release applicability.
   Nationality is read from `identity.nationality`, independently of passport issuer.
4. One unambiguous match selects a release. Missing material route facts produce
   PARTIAL/unresolved with no selected assets. A known mismatch is UNSUPPORTED.
   Multiple matching or potentially matching releases produce PARTIAL/ambiguous
   with no selected assets; there is no priority or fallback.
5. Explicit group conditions determine the exact evaluation set. Unknown group
   conditions produce PARTIAL and diagnostics. They do not silently become complete.
6. `loadAssets` retrieves those exact paths and validates IDs/revisions and roles.
   Missing files or incorrect pins are configuration errors, never applicant FAIL.
7. The integration dispatches by asset role to existing modules. Legal rules use
   the duplicate-aware `evaluateRules` collection API. Result provenance is retained.
8. Only selected assets contribute optional source display copies. Source-copy
   failures retain the existing display fallback; pinned provenance is not removed
   from results. A fresh selection/assets/source map is built for each submission.

The registry can contain another reviewed configuration without country branches
in the resolver or integration. The extensibility test uses an in-memory TEST ONLY
release for synthetic destination `ZZ`; it asserts no foreign visa requirements.
Spain, alternate residences and other nationalities remain unsupported.

## Release contract 1.0.0

* Identity: `schema_version`, `release_id`, exact `version`.
* Publication: explicit preview state, false release readiness and pending evidence.
  Stage C rejects production/verified claims; a publication gate is future work.
* `applicability`: the maximum declared route scope.
* `exclude_when`: affirmative exclusions; unknown exclusion facts are not invented.
* `coverage`: `APPLICABILITY_BOUND`, `complete_when`, explanatory notes. A complete
  condition can only narrow selected applicability, never extend it.
* `evaluation_context`: nullable `assessment_date`.
* `groups`: explicit IDs, `when` predicates and asset references. Each reference has
  a key, role, ID, revision and exact local path. Groups reuse existing files;
  they neither inherit nor override one another.
* `report`: readiness attention IDs and informational assessment IDs needed to
  preserve the existing report. No statistical/community configuration lives here.

Expressions reuse the existing applicability operators `always`, `all`, `any`,
`not`, `eq`, `in`, `contains`, `subset`. Runtime-only `gte` supports a configured
numeric route boundary, such as the existing adult-preview age constraint. It does
not change the rule engine DSL or evaluator arithmetic.

The strict release/group/reference structures reject unsupported composition
properties. Validation also rejects duplicate release ID/version pairs, duplicate
asset identities even across conflicting revisions, path duplication, unsafe paths,
wrong identity/revision, duplicate singleton roles and unpaired baseline/reference
assets. `runtime-release.test.cjs` validates existence and pins of all 22 references,
including conditionally inactive groups. Runtime loading validates the selected set.

## Existing coverage and compatibility

Supported runtime coverage remains the ordinary adult IN nationality/ordinary IN
passport, IE residence, Metropolitan FR, Schengen short-stay tourism preview.
Private visit is explicitly included only as existing partial coverage; it is not
a second fully supported route. Local groups additionally require the existing
`context.single_trip` assertion from the adapter. This is scope context, not a
new inferred itinerary or legal competence algorithm.

The legacy `route_input.nationality` is never used to supply canonical nationality.
Its explicit `OTHER` form-choice sentinel remains an exclusion, configured in data.
The integration retains `irish_return` solely as a report compatibility key; no
country-code or country-specific asset-ID branches remain in orchestration.

The form, passport/dark styling, report renderer, score stamp, community sampling,
weights, CSV, rule revisions and evidence are unchanged. The only `check.html`
change in Stage C is the new runtime module's script tag.

## Dates, evidence and honest uncertainty

The selected current legal rules contain no configured effective-date bounds.
Their passport, application and return reference dates still come from explicit
applicant facts. `evaluation_context.assessment_date` defaults to null, never today;
callers may supply a valid explicit ISO date, which reaches `evaluateRules` and is
retained in results alongside the release version. A future temporally bounded rule
remains UNKNOWN without that date, as tested with a synthetic rule.

The current nationality reference has unresolved null effective bounds. Its existing
classifier preserves that metadata but does not perform temporal validity checking.
Stage C does not change that legal behavior or claim the reference is valid as of
the assessment date. Readiness/procedure/diagnostic modules likewise retain their
existing semantics; context does not manufacture application or return dates.

Normal-form IRP post-return validity remains UNKNOWN. Explicit generic return facts
and independently supplied required origin retain +6-month PASS and +10-day FAIL.

## Validation

The 330-test Stage A/B baseline passed before migration. Five pre-migration semantic
report hashes protect legal, readiness, procedure, biometrics, return, baseline,
attention and source metadata outputs across normal/private/missing/failing/history
fixtures. They exclude route diagnostic wording and additive release audit metadata,
not legal outcomes. Other tests cover invalid configurations, ambiguity, missing
facts, unsupported routes, no stale asset leakage and synthetic extensibility.

Run the full existing suite plus release tests with:

```sh
node --test tests/rules/*.test.cjs tests/data-layer.test.cjs tests/evidence-schema.test.cjs
```

Browser smoke additionally checks the selected release, 22 assets, visible report,
honest IRP UNKNOWN, community 78 fixture and no source links after switching to an
unsupported destination. No Stage D questions or combined assessment were added.
