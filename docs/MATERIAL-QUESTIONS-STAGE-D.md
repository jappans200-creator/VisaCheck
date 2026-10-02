# Stage D: material follow-ups

The integration configuration pins MATERIAL_FOLLOWUPS@0.1.0 to
VISACHECK_FRANCE_V1@0.1.0 and FRANCE_V1_ASSESSMENT@0.2.0. This is presentation
metadata, not a legal rule or a change to assessment precedence.

The resolver selects only USER_INPUT dependencies of selected, material,
BLOCKING official results. Exact rule revisions and evaluated relevant facts
control selection. Applicability is evaluated first: origin is asked before
return information. Already answered controls remain editable while the
corresponding dependency is evaluated. Verification, timing, procedural and
informational unknowns do not add questions.

The new country selector uses reusable ISO country options and never copies
nationality. Explicit return-to-residence Yes sets the generic destination to
the current residence. The return date is entered explicitly; no trip-end
shortcut is implemented. Onward travel adds a country selector; a non-residence
return never becomes a residence return. Such a case can remain CHECK_REQUIRED.
An eventual residence return can be supplied explicitly after onward travel.

The existing compatibility bridge projects an explicitly identified return
into the existing immutable rule. No new country-specific canonical facts,
thresholds, rule revisions, or evidence changes were introduced.

Initial blank form: 23 eligible answer controls (sections may be collapsed).
Common completed form: 26 existing visible answer controls plus 3 follow-up
controls = 29. Initially no follow-ups appear; after evaluation only origin is
shown. Origin equal to residence makes this particular rule NOT_APPLICABLE and
requires no return question for it. Onward travel can use 4 follow-up controls.
These counts exclude submit/reset and stay-management buttons.

Route-scope changes clear follow-ups and invalidate the old report. Existing
conditional logic clears hidden residence-document fields. Changing Yes to No
clears the return date and destination; changing onward country clears its date.
Facts and answers remain in memory only. Selected immutable assets are cached
by their exact reference list for follow-up reevaluation; failed loads retry.

User-supplied current English and French France-Visas wording supports retaining
the origin condition. This implementation does not independently verify those
sources or promote historical evidence records. Repository evidence remains
pending review.

Validation: full node test suite plus tests/v1-material-questions-browser.cjs
(local site port 8766, headless Chrome debugging port 9222).
