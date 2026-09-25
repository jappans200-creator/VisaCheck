# Visa outcome data contract

The original `visa_outcomes.csv` remains unchanged. The browser loads it through
`parseCSV` → `ingestOutcomeCSV` → the matching engine. No backend or dependency
installation is required. Run the complete test suite from the repository root:

```sh
node --test
```

## Canonical records

Every observation is nullable. Empty/whitespace structured values and explicit
`Unknown`, `null`, `N/A`, and `not known` markers become JavaScript `null`.
Free-text rejection reasons and source descriptions preserve their text, including
words such as "Unknown". Explicit zero, `No`/false, and `None` are not missing.

| Field | Type / meaning | Legacy CSV column |
| --- | --- | --- |
| passport_country | Canonical country name or null | nationality |
| residence_country | Country at application time or null | residence_country |
| destination_country | Destination or null | destination_country |
| visa_type | Tourist/Visit, Work, Student, Spouse/Family, Residence, or null | visa_purpose |
| application_result | Approved, Rejected, Pending, or null | outcome |
| residence_permit_validity_remaining | Finite non-negative number of months at application time, or null | permit_months_remaining |
| previous_international_travel | Explicit boolean or null | Not present |
| previous_visa_refusal | Explicit boolean or null; Yes → true, No → false | prior_rejection |
| countries_visited | Non-negative integer count before application, or null | countries_visited |
| application_date | Real calendar date, YYYY-MM-DD, or null | Not present |
| source | Original attribution or null; not necessarily a URL | source |
| source_type | Extensible string or null | Not present |
| residence_permit_type | Residence permit description or null; explicit None retained | permit_type |
| other_visas | Array of visa labels, or null; explicit None → [] | other_visas |
| rejection_reason | Original free text or null | rejection_reason |
| embassy_country | Country or null; never filled from destination during ingestion | embassy_country |

`visa_type` describes the application category, not the residence permit or a
specific visa subclass. Country names use a conservative explicit alias registry
in `js/outcome-data.js` (including India/Indian, UK/United Kingdom, USA/United
States). Unrecognized or ambiguous countries are flagged and left null; add
verified aliases to the registry when expanding coverage. UAE remains the
canonical UI-compatible label. Other-visa labels keep US, UK, UAE, Schengen,
Canada, and Australia to match existing checkbox values. Unknown labels are
flagged rather than guessed.

Canonical column names take precedence when both canonical and legacy names
exist, even when the canonical value is null. Each record carries `provenance`
with its physical starting CSV line number and original untrimmed cell values.
No facts are inferred from a visa held, missing dates, residence, or travel count.

Negative validity values are invalid and become null with a diagnostic; they do
not encode expired status. The existing UI's `monthsRemaining()` date-difference
helper remains signed solely to preserve its existing expired-permit warning.
The matching-profile adapter never passes that negative value into the canonical
validity field. No canonical permit-status field has been introduced.

## Extensible source types

Recognized spellings are normalized case-insensitively:

- Forum, Blog, Official, Direct report, Other
- Government statistics, Government requirements, Community survey
- Forum/community post, User-submitted outcome, Third-party dataset

New explicit source-type strings are preserved; this is not a closed enum.
When the column is absent, only documented source mappings supply a broad type:
`r/visarejections`, `r/SchengenVisa`, `r/USVisas`, `r/ukvisa`, and `VisaJourney`
map to Forum; `cardexpert.in blog` maps to Blog. Other sources remain null.
An explicitly supplied missing source type stays null. Existing forum attribution
is not upgraded to a specific post, survey, or verified individual outcome.

## Validation and matching

`parseCSV` returns `{ records, issues, headers }`. It handles BOM, CRLF, quoted
commas, escaped quotes and multiline fields. Blank lines are ignored. Malformed
quoting or incorrect cell counts exclude the affected record. An unterminated
quoted field consumes the remaining input as one malformed record, since further
row boundaries cannot safely be reconstructed. Invalid/duplicate/empty headers
reject the file.

`ingestOutcomeCSV` returns `{ records, issues }`. It requires structural columns
for passport country, destination, visa type and result (canonical or legacy),
but allows missing observations in any row. Invalid field values produce nulls
and diagnostics without excluding the entire otherwise usable row. Diagnostics
contain `rowNumber`, `field`, original `value`, `code`, and `message`. Missing
observations are allowed, not validation errors; the tests also print missingness
counts for the repository dataset. Issues are logged by the browser loader.

Matching weights, buckets, sample selection thresholds, and colour tiers are
unchanged. Points require two known observations. Unknowns never match each
other, missing numbers never enter zero buckets, and missing categorical values
never default to No. Only explicitly Tourist/Visit records with Approved or
Rejected results enter current sample selection and embassy comparisons.
Approval denominators exclude Pending and null results. Destination fallback for
embassy grouping is presentation/calculation logic and does not alter the record.
The profile adapter accepts existing UI names to preserve rendering and sharing.

## Baseline audit

The 105-record CSV yields 105 canonical records and one field diagnostic:
physical line 62 has `Brazilian (naturalized Portuguese/EU)` as nationality. Its
passport country is ambiguous, so it becomes null while the original is retained.
There are no malformed rows or invalid numeric observations in the current file.

Null counts after normalization:

| Field | Null count |
| --- | ---: |
| passport_country | 14 |
| residence_country | 35 |
| residence_permit_type | 11 |
| residence_permit_validity_remaining | 105 |
| previous_international_travel | 105 |
| countries_visited | 88 |
| application_date | 105 |
| rejection_reason | 38 |
| embassy_country | 71 |

All other canonical observation fields have zero nulls. The original source
assertions (including explicit No/None values) are preserved, not independently
verified. The standalone wizard uses separate embedded data and is unaffected.
