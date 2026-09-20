// Handles the "tell us what actually happened" outcome-report form.
//
// Like the waitlist form, this needs a free Formspree endpoint to actually
// deliver submissions to you. Create a SECOND Formspree form (separate from
// the waitlist one, so the two don't mix in your inbox) and paste its
// endpoint below. Formspree's dashboard also lets you export submissions
// straight to CSV, which is the easiest way to fold these into
// data/visa_outcomes.csv over time.
const REPORT_FORMSPREE_ENDPOINT = "https://formspree.io/f/mppwqpye";

const otherSelect = document.getElementById("r-destination");
const otherRow = document.getElementById("r-destination-other-row");
otherSelect.addEventListener("change", () => {
  otherRow.style.display = otherSelect.value === "__other__" ? "block" : "none";
});

const reportForm = document.getElementById("report-form");
const successEl = document.getElementById("report-success");
const errorEl = document.getElementById("report-error");

reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  successEl.style.display = "none";
  errorEl.style.display = "none";

  const otherVisas = Array.from(
    document.querySelectorAll('input[name="other-visas"]:checked')
  ).map((el) => el.value);

  const destination =
    otherSelect.value === "__other__"
      ? document.getElementById("r-destination-other").value.trim()
      : otherSelect.value;

  const data = {
    nationality: document.getElementById("r-nationality").value.trim(),
    residence: document.getElementById("r-residence").value.trim(),
    permitType: document.getElementById("r-permit-type").value.trim(),
    permitExpiry: document.getElementById("r-permit-expiry").value,
    destination,
    otherVisas: otherVisas.join("|") || "None",
    countriesVisited: document.getElementById("r-countries-visited").value,
    priorRejection: document.querySelector('input[name="prior-rejection"]:checked')?.value || "",
    outcome: document.querySelector('input[name="outcome"]:checked')?.value || "",
    reason: document.getElementById("r-reason").value.trim(),
    unsaidRule: document.getElementById("r-unsaid").value.trim(),
    email: document.getElementById("r-email").value.trim(),
  };

  if (!REPORT_FORMSPREE_ENDPOINT) {
    console.warn("Outcome report captured locally only — REPORT_FORMSPREE_ENDPOINT is not set:", data);
    successEl.style.display = "block";
    reportForm.reset();
    otherRow.style.display = "none";
    return;
  }

  try {
    const res = await fetch(REPORT_FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      successEl.style.display = "block";
      reportForm.reset();
      otherRow.style.display = "none";
    } else {
      errorEl.style.display = "block";
    }
  } catch (err) {
    errorEl.style.display = "block";
  }
});
