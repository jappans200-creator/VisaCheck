# V1 integration preview

`check.html` is the canonical checker. Serve the repository as a static website
(e.g. `python3 -m http.server 8765`) and open `/check.html`.
`report.html` remains the community outcome submission page, not the checker report.
`visacheck-v1.html` is an explicitly marked historical prototype; it is preserved,
not maintained as a second V1 implementation. Landing-page links use `check.html`.

## Flow

- `js/v1-form-fields.js`: labels, field types and exact form vocabulary.
- `js/rules/v1-form-adapter.js`: unknown-preserving conversion into the existing
  applicant-facts envelope. No legal thresholds or inferred ordinary status.
- `data/official-requirements/integration/v1-preview.json`: explicit pinned asset
  paths, narrow coverage identity, preview constraints and supplied Irish mapping.
- `js/rules/v1-integration.js`: narrow preview selection and composition of existing
  evaluators, classifier, readiness, procedure and return diagnostic.
- `js/v1-report.js`: readable presentation, source links and optional technical details.
- `js/checker.js`: DOM, local asset loading and unchanged community matcher calls.

The existing generic resolver requires reviewed coverage configuration. This
preview does not claim that review has happened. Its small coverage selector is
restricted to this integration, without changing the resolver or constructing a
new general jurisdiction system. SUPPORTED means implemented preview coverage,
not verified legal completeness or applicant eligibility.

## Explicit constraints

Age is supplied for the application date. Ordinary-adult facts require an explicit
negative special-circumstances answer and a known adult age. Country of origin is
an optional follow-up, never inferred from nationality. The destination option
identifies a short visit to Metropolitan France; the user separately answers whether
other Schengen countries will be visited. Only then is France
competence supplied as an internal preview constraint and the exit date used as
the relevant Schengen departure date. Multi-country competence is not calculated.
France-specific checks are withheld for an unestablished single-country trip.

Actual and intended lodging dates remain distinct. Existing passport-age and
biometric reuse evaluators require the actual date; planned dates are not silently
substituted. Before lodging, those checks can remain UNKNOWN.

Irish entry-visa status uses the supplied Batch 2A Indian ordinary-passport
mapping, not the Schengen baseline table. Private visits remain PARTIAL; tourism
insurance applicability is not extended. Other profile identities are unsupported.

All legal rule definitions and earlier evaluator modules are unchanged. All source
and evidence records remain untouched (168 NEEDS_REVIEW, 3 UNRESOLVED, 0 VERIFIED).
Current operational details retain verification-pending labels. Source URLs are
read from pinned local records, without research or invented links.

There is no overall visa decision or weighted score. Attention ordering is a
priority list only. Community matching uses existing functions and suppression
thresholds; dataset failure does not block official preview results. No applicant
facts are stored or sent to an application backend. Only the existing local check
counter is incremented.

## Validation

Run the complete Node suite:

```
node --test tests/rules/*.test.cjs tests/data-layer.test.cjs tests/evidence-schema.test.cjs
```

The optional `tests/v1-browser-smoke.cjs` uses built-in Node fetch/WebSocket, a
local static server on port 8765 and headless Chrome on debugging port 9222.
Use a temporary Chrome profile. It tests rendering, conditional fields, submission,
source links, community data, partial/unsupported routes, reset, refresh and mobile
width. No browser dependency was added.

Before real publication: complete evidence verification and refreshes, settle the
private-visit insurance scope and unresolved age/latest-lodging questions, review
route constraints and jurisdiction mapping, and review the remaining legacy
landing-page marketing claims. None of this integration promotes evidence.

See [the form audit](V1-FORM-AUDIT.md) for the field inventory, derivations,
conditional visibility, question counts and preserved unknowns.
