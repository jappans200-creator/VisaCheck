// This file contains the "matching engine": the logic that compares the
// person filling in the form against every row in the CSV dataset and works
// out an approval percentage. Nothing here talks to a server — it all runs
// in the visitor's own browser once the CSV has been downloaded.

const SCHENGEN_COUNTRIES = [
  "Cyprus", "France", "Germany", "Netherlands", "Greece",
  "Portugal", "Italy", "Spain", "Switzerland", "Czechia",
  "Hungary", "Poland", "Croatia", "Belgium", "Austria",
  "Denmark", "Norway",
];

function isSchengen(country) {
  return SCHENGEN_COUNTRIES.includes(country);
}

// Turns "permit expiry date" into "how many months from today".
function monthsRemaining(expiryDateStr) {
  if (!normalizeDate(expiryDateStr)) return null;
  const expiry = new Date(expiryDateStr);
  const today = new Date();
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44;
  return (expiry - today) / msPerMonth;
}

function bucketMonths(months) {
  if (!Number.isFinite(months) || months < 0) return null;
  if (months < 6) return "under6";
  if (months < 9) return "6to9";
  if (months < 12) return "9to12";
  return "12plus";
}

function bucketVisited(count) {
  if (!Number.isInteger(count) || count < 0) return null;
  if (count <= 0) return "0";
  if (count <= 2) return "1-2";
  if (count <= 5) return "3-5";
  if (count <= 10) return "6-10";
  return "11plus";
}

// How similar is one CSV row to the person's profile? Higher = more similar.
// This is deliberately simple and readable rather than a "smart" ML model —
// it's just weighted point-matching on each field.
function knownEqual(a, b) {
  return a != null && b != null && String(a).toLowerCase() === String(b).toLowerCase();
}

function similarityScore(profile, row) {
  const p = normalizeMatchingProfile(profile);
  let score = 0;
  if (knownEqual(row.passport_country, p.passport_country)) score += 2;
  if (knownEqual(row.residence_country, p.residence_country)) score += 2;
  const rowPermit = row.residence_permit_type?.toLowerCase();
  const profilePermit = p.residence_permit_type?.toLowerCase();
  if (knownEqual(rowPermit, profilePermit)) score += 2;
  else if (rowPermit && profilePermit && profilePermit.split(" ").some(word => word.length > 3 && rowPermit.includes(word))) score += 1;
  if (knownEqual(bucketMonths(row.residence_permit_validity_remaining), bucketMonths(p.residence_permit_validity_remaining))) score += 2;
  if (row.other_visas !== null && p.other_visas !== null) {
    score += Math.min(row.other_visas.filter(v => p.other_visas.includes(v)).length, 3);
  }
  if (knownEqual(bucketVisited(row.countries_visited), bucketVisited(p.countries_visited))) score += 1;
  if (knownEqual(row.previous_visa_refusal, p.previous_visa_refusal)) score += 1;
  return score;
}

function hasDecidedOutcome(row) {
  return row.application_result === "Approved" || row.application_result === "Rejected";
}

// Picks a "similar enough" sample from all rows for the same destination.
// If there aren't many rows for that exact destination, it still returns
// what's available and flags the result as low-confidence.
// The dataset also contains work, student, and spouse/family visa cases —
// those follow very different rules than a tourist/visit application, so we
// only match against tourist cases here to avoid misleading comparisons.
// (Rows are kept in the CSV either way, in case a future version of the
// form asks for "purpose of visit" and can use them properly.)
function isTouristRow(row) {
  return row.visa_type === "Tourist/Visit";
}

function selectSample(rows, profile) {
  const sameDestination = rows.filter(
    (r) =>
      knownEqual(r.destination_country, normalizeCountry(profile.destination)) &&
      isTouristRow(r) && hasDecidedOutcome(r)
  );

  const scored = sameDestination
    .map((row) => ({ row, score: similarityScore(profile, row) }))
    .sort((a, b) => b.score - a.score);

  const relevant = scored.filter((s) => s.score > 0);
  const pool = relevant.length >= 12 ? relevant : scored;

  const sampleSize = Math.min(Math.max(pool.length, 0), Math.max(40, Math.ceil(pool.length * 0.6)));
  return pool.slice(0, sampleSize).map((s) => s.row);
}

function computeApproval(sample) {
  sample = sample.filter(hasDecidedOutcome);
  if (sample.length === 0) return { percent: null, sampleSize: 0 };
  const approved = sample.filter((r) => r.application_result === "Approved").length;
  return { percent: Math.round((approved / sample.length) * 100), sampleSize: sample.length };
}

function topRejectionReasons(sample, max = 3) {
  const counts = {};
  sample
    .filter((r) => r.application_result === "Rejected" && r.rejection_reason)
    .forEach((r) => {
      counts[r.rejection_reason] = (counts[r.rejection_reason] || 0) + 1;
    });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([reason, count]) => ({ reason, count }));
}

// For Schengen destinations: which country's consulate has the best approval
// rate for people with a similar profile, regardless of which one they
// originally picked.
function bestEmbassies(rows, profile, max = 3) {
  const schengenRows = rows.filter((r) => isSchengen(r.destination_country) && isTouristRow(r) && hasDecidedOutcome(r));

  const scored = schengenRows.map((row) => ({
    row,
    score: similarityScore(profile, row),
  }));

  const relevant = scored.filter((s) => s.score >= 3).map((s) => s.row);
  const pool = relevant.length >= 20 ? relevant : schengenRows;

  const byCountry = {};
  pool.forEach((row) => {
    const country = row.embassy_country || row.destination_country;
    if (!byCountry[country]) byCountry[country] = { approved: 0, total: 0 };
    byCountry[country].total += 1;
    if (row.application_result === "Approved") byCountry[country].approved += 1;
  });

  return Object.entries(byCountry)
    .filter(([, stats]) => stats.total >= 4)
    .map(([country, stats]) => ({
      country,
      rate: Math.round((stats.approved / stats.total) * 100),
      total: stats.total,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, max);
}

function approvalColor(percent) {
  if (percent >= 70) return "green";
  if (percent >= 40) return "amber";
  return "red";
}
