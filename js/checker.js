// Wires up the "Check my odds" form: loads the CSV once, then on submit
// reads the form fields, runs the matching engine (match.js), and renders
// the Visa Verdict results into the page.

// To actually receive "download my checklist" emails and outcome reports
// from this page, create free Formspree forms (formspree.io) and paste
// their endpoints below — same pattern as js/waitlist.js and js/report.js.
const CHECKLIST_FORMSPREE_ENDPOINT = ""; // e.g. "https://formspree.io/f/abcdwxyz"
const OUTCOME_FORMSPREE_ENDPOINT = ""; // e.g. "https://formspree.io/f/abcdwxyz"

let datasetRows = [];

fetch("data/visa_outcomes.csv")
  .then((res) => res.text())
  .then((text) => {
    datasetRows = parseCSV(text);
  })
  .catch((err) => {
    console.error("Could not load visa dataset:", err);
  });

const form = document.getElementById("check-form");
let lastProfile = null;
let lastSampleSize = 0;

form.addEventListener("submit", (e) => {
  e.preventDefault();

  if (datasetRows.length === 0) {
    alert("The dataset is still loading — please try again in a second.");
    return;
  }

  const otherVisas = Array.from(
    document.querySelectorAll('input[name="other-visas"]:checked')
  ).map((el) => el.value);

  const priorRejectionEl = document.querySelector('input[name="prior-rejection"]:checked');

  const profile = {
    nationality: document.getElementById("nationality").value.trim(),
    residence: document.getElementById("residence").value.trim(),
    permitType: document.getElementById("permit-type").value.trim(),
    monthsRemaining: monthsRemaining(document.getElementById("permit-expiry").value),
    destination: document.getElementById("destination").value,
    otherVisas,
    countriesVisited: Number(document.getElementById("countries-visited").value) || 0,
    priorRejection: priorRejectionEl ? priorRejectionEl.value : "No",
  };

  renderResults(profile);

  // Honest, local-only tally used by the landing page counters (see
  // js/counters.js) until there's a real backend to count this globally.
  const CHECK_COUNT_KEY = "visacheck_check_count";
  const currentCount = Number(localStorage.getItem(CHECK_COUNT_KEY) || "0");
  localStorage.setItem(CHECK_COUNT_KEY, String(currentCount + 1));
});

// With very few matching cases (common while the dataset is still small), a
// percentage like "100%" or "0%" from 1-2 cases would look far more
// confident than it should. Below this, we don't show a percentage at all.
const MIN_CASES_FOR_PERCENT = 3;

// Some destinations currently have data pulled mostly from "what went
// wrong" advice forums, which skew far more negative than real-world
// approval rates. Until more balanced data comes in, we show the case
// reasons for these but suppress the headline percentage.
const UNRELIABLE_PERCENT_DESTINATIONS = ["United States"];

function renderResults(profile) {
  const permitWarningEl = document.getElementById("permit-validity-warning");
  const months = profile.monthsRemaining;

  if (months < 0) {
    permitWarningEl.style.display = "block";
    permitWarningEl.innerHTML =
      "⛔ <strong>Your permit has already expired.</strong> You cannot apply for a Schengen visa with an expired residence permit — any application will be rejected immediately.";
  } else if (months < 3) {
    permitWarningEl.style.display = "block";
    permitWarningEl.innerHTML =
      "⚠️ <strong>Less than 3 months remaining on your permit.</strong> Most Schengen consulates require at least 3 months' validity — and some (like Cyprus) require 6 months. This is one of the most common hidden rejection reasons. The odds below do not fully account for this.";
  } else {
    permitWarningEl.style.display = "none";
  }

  const sample = selectSample(datasetRows, profile);
  const { percent, sampleSize } = computeApproval(sample);
  const reasons = topRejectionReasons(sample);

  lastProfile = profile;
  lastSampleSize = sampleSize;

  const resultsEl = document.getElementById("results");
  const noDataCard = document.getElementById("no-data-card");
  const noDataTitle = document.getElementById("no-data-title");
  const noDataText = document.getElementById("no-data-text");
  const verdictCard = document.getElementById("verdict-card");
  const shareBtn = document.getElementById("share-btn");
  const nextStepsCard = document.getElementById("next-steps-card");
  const reasonsList = document.getElementById("reasons-list");
  const warningEl = document.getElementById("low-sample-warning");
  const embassyCard = document.getElementById("embassy-card");
  const embassyList = document.getElementById("embassy-list");
  const outcomeCard = document.getElementById("outcome-capture-card");
  const outcomeHeading = document.getElementById("outcome-heading");

  const isUnreliable = UNRELIABLE_PERCENT_DESTINATIONS.includes(profile.destination) && sampleSize > 0;
  const showVerdict = !isUnreliable && percent !== null && sampleSize >= MIN_CASES_FOR_PERCENT;

  if (showVerdict) {
    noDataCard.style.display = "none";
    verdictCard.style.display = "block";
    shareBtn.style.display = "block";
    nextStepsCard.style.display = "block";

    const colorTier = getOddsColorTier(percent);
    verdictCard.className = "verdict-card theme-" + colorTier;

    document.getElementById("verdict-profile").textContent =
      `${profile.nationality || "Applicant"} · ${profile.permitType || "No permit"} · ` +
      `${getFlagEmoji(profile.destination)} ${profile.destination}`;
    document.getElementById("verdict-pct").textContent = percent + "%";
    document.getElementById("verdict-message").textContent = getCountryMessage(profile.destination, percent);
    document.getElementById("verdict-sample").textContent =
      `Based on ${sampleSize} real application${sampleSize === 1 ? "" : "s"} from people with your profile`;

    renderNextSteps(colorTier, profile, reasons);

    shareBtn.onclick = () => handleShareClick(profile, percent, colorTier, sampleSize);
  } else {
    verdictCard.style.display = "none";
    shareBtn.style.display = "none";
    document.getElementById("share-status").style.display = "none";
    nextStepsCard.style.display = "none";
    noDataCard.style.display = "block";

    if (isUnreliable) {
      noDataTitle.textContent = "Odds not shown yet";
      noDataText.textContent =
        `Our ${sampleSize} case${sampleSize === 1 ? "" : "s"} for this destination come mostly from people ` +
        `describing a rejection — not a random sample — so a percentage here would be misleading. ` +
        `See the common reasons below instead.`;
    } else if (percent === null || sampleSize === 0) {
      noDataTitle.textContent = "No data yet";
      noDataText.textContent = "We don't have enough data for this destination yet. Check the reasons and consider reporting your own outcome once you apply.";
    } else {
      noDataTitle.textContent = "Too few cases";
      noDataText.textContent =
        `Only ${sampleSize} similar case${sampleSize === 1 ? "" : "s"} on record — too few to turn into a percentage yet.`;
    }
  }

  if (showVerdict && sampleSize < 8) {
    warningEl.style.display = "block";
    warningEl.textContent =
      "Small sample size for this exact profile — treat this estimate as rough, not precise.";
  } else {
    warningEl.style.display = "none";
  }

  reasonsList.innerHTML = "";
  if (reasons.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Not enough rejected cases in this sample to identify common reasons.";
    reasonsList.appendChild(li);
  } else {
    reasons.forEach(({ reason, count }) => {
      const li = document.createElement("li");
      li.textContent = `${reason} (${count} case${count === 1 ? "" : "s"})`;
      reasonsList.appendChild(li);
    });
  }

  if (isSchengen(profile.destination)) {
    const embassies = bestEmbassies(datasetRows, profile);
    if (embassies.length > 0) {
      embassyCard.style.display = "block";
      embassyList.innerHTML = "";
      embassies.forEach(({ country, rate, total }) => {
        const row = document.createElement("div");
        row.className = "embassy-row";
        row.innerHTML = `<span>${country}</span><span class="embassy-rate ${approvalColor(rate)}">${rate}% <span style="color:var(--text-faint); font-weight:400;">(${total} cases)</span></span>`;
        embassyList.appendChild(row);
      });
    } else {
      embassyCard.style.display = "none";
    }
  } else {
    embassyCard.style.display = "none";
  }

  // Outcome capture: always offered once someone has a result, regardless
  // of whether we had enough data for a percentage — a report is exactly
  // what fixes that for the next person.
  outcomeCard.style.display = "block";
  outcomeHeading.textContent =
    sampleSize > 0
      ? `${sampleSize} people with your exact profile have shared their outcome. Here is what we learned from them.`
      : `Be the first to share an outcome for a profile like yours.`;
  document.getElementById("outcome-buttons").style.display = "flex";
  document.getElementById("outcome-thanks").style.display = "none";

  resultsEl.style.display = "block";
  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function approvalColorFromTier(tier) {
  return tier === "green" ? "green" : tier === "deepred" ? "red" : tier;
}

function renderNextSteps(colorTier, profile, reasons) {
  const heading = document.getElementById("next-steps-heading");
  const body = document.getElementById("next-steps-body");
  const dest = profile.destination;
  const reasonItems = reasons.length
    ? reasons.map((r) => `<li>${r.reason}</li>`).join("")
    : "<li>Not enough rejected cases in this sample to break down yet.</li>";

  if (colorTier === "green") {
    heading.textContent = "Ready when you are";
    body.innerHTML = `
      <a class="next-step-link" href="#" target="_blank" rel="noopener">Ready to apply? Use iVisa — trusted by millions</a>
      <a class="next-step-link" href="#" target="_blank" rel="noopener">Find flights to ${dest}</a>
      <a class="next-step-link" href="#" target="_blank" rel="noopener">Get travel insurance before you go</a>
    `;
  } else if (colorTier === "amber") {
    heading.textContent = "Worth strengthening before you apply";
    body.innerHTML = `
      <details class="expandable">
        <summary>Here is what separates approvals from rejections at your odds level</summary>
        <div class="expandable-body">
          <p>Among similar cases, these came up most for the ones that got rejected:</p>
          <ul>${reasonItems}</ul>
        </div>
      </details>
      <a class="next-step-link" href="#" target="_blank" rel="noopener">Get your application professionally reviewed</a>
      <div class="checklist-capture">
        <label for="checklist-email" style="display:block; font-size:0.88rem; color:var(--text-dim); margin-bottom:6px;">Download your personalised document checklist</label>
        <div style="display:flex; gap:8px;">
          <input type="email" id="checklist-email" placeholder="you@example.com" style="flex:1;">
          <button id="checklist-btn" class="btn-primary" style="white-space:nowrap;">Get checklist</button>
        </div>
        <div id="checklist-status" style="display:none; margin-top:8px; font-size:0.85rem; color:var(--green);">Thanks — check your inbox shortly.</div>
      </div>
    `;
    wireChecklistCapture();
  } else if (colorTier === "orange") {
    heading.textContent = "Here's how to improve your odds";
    body.innerHTML = `
      <details class="expandable">
        <summary>Most people in your situation who got approved made these specific changes first</summary>
        <div class="expandable-body">
          <p>The most common reasons similar profiles were rejected:</p>
          <ul>${reasonItems}</ul>
        </div>
      </details>
      <a class="next-step-link" href="#" target="_blank" rel="noopener">Get professional help before applying</a>
      <a class="next-step-link" href="${isSchengen(dest) ? "#embassy-card" : "#"}">See if a different embassy gives you better odds</a>
    `;
  } else {
    heading.textContent = "Before you spend the application fee";
    body.innerHTML = `
      <details class="expandable" open>
        <summary>Before you spend €90 you need to understand why your odds are this low</summary>
        <div class="expandable-body">
          <p>The most common reasons similar profiles were rejected:</p>
          <ul>${reasonItems}</ul>
        </div>
      </details>
      <a class="next-step-link" href="#" target="_blank" rel="noopener">Get professional immigration advice</a>
      <a class="next-step-link" href="#" target="_blank" rel="noopener">Check alternative destinations with better odds for your profile</a>
    `;
  }
}

function wireChecklistCapture() {
  const btn = document.getElementById("checklist-btn");
  const emailInput = document.getElementById("checklist-email");
  const status = document.getElementById("checklist-status");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) return;
    if (!CHECKLIST_FORMSPREE_ENDPOINT) {
      console.warn("Checklist request captured locally only — CHECKLIST_FORMSPREE_ENDPOINT is not set:", email);
      status.style.display = "block";
      emailInput.value = "";
      return;
    }
    try {
      const res = await fetch(CHECKLIST_FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email, profile: lastProfile }),
      });
      if (res.ok) {
        status.style.display = "block";
        emailInput.value = "";
      }
    } catch (err) {
      // silent fail is fine here — non-critical secondary feature
    }
  });
}

async function handleShareClick(profile, percent, colorTier, sampleSize) {
  const shareStatus = document.getElementById("share-status");
  shareStatus.style.display = "block";
  shareStatus.textContent = "Generating your images...";

  const message = getCountryMessage(profile.destination, percent);
  const result = await shareVerdict({ profile, percent, colorTier, message, sampleSize });

  shareStatus.textContent = result.captionCopied
    ? "Downloaded both images and copied the caption — paste them into your story or chat."
    : `Downloaded both images. Caption to paste: "${result.caption}"`;
}

document.getElementById("outcome-approved-btn").addEventListener("click", () => captureOutcome("Approved"));
document.getElementById("outcome-rejected-btn").addEventListener("click", () => captureOutcome("Rejected"));

async function captureOutcome(outcome) {
  if (!lastProfile) return;

  if (OUTCOME_FORMSPREE_ENDPOINT) {
    try {
      await fetch(OUTCOME_FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ ...lastProfile, outcome }),
      });
    } catch (err) {
      // still show the thank-you message below — don't block the UX on this
    }
  } else {
    console.warn("Outcome captured locally only — OUTCOME_FORMSPREE_ENDPOINT is not set:", { ...lastProfile, outcome });
  }

  document.getElementById("outcome-buttons").style.display = "none";
  const thanks = document.getElementById("outcome-thanks");
  thanks.style.display = "block";
  thanks.textContent = `Thank you. Your outcome just added to the data behind ${lastSampleSize} similar profile${lastSampleSize === 1 ? "" : "s"} — help us build this further by adding full details on the `;
  const link = document.createElement("a");
  link.href = "report.html";
  link.textContent = "report page";
  thanks.appendChild(link);
  thanks.appendChild(document.createTextNode("."));
}
