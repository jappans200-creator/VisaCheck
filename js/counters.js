// Animates the two "social proof" counters on the landing page.
//
// HONESTY NOTE: this site has no backend yet, so there is no real way to
// count checks across every visitor on the internet. What we CAN honestly
// show is how many times the checker has been completed on THIS device
// (stored in localStorage). That number starts at 0 for every new visitor —
// which is the truthful answer, not an inflated one. Once VisaCheck has a
// real database (the GitHub/Netlify automation sets this up), swap this for
// a real shared count and remove the "on this device" framing.
const CHECK_COUNT_KEY = "visacheck_check_count";
const FEE_ESTIMATE = 90; // euros, matches the founder's own Cyprus story
const SAVED_FRACTION = 0.3; // assumed share of checks that avoid a real rejection

function getLocalCheckCount() {
  return Number(localStorage.getItem(CHECK_COUNT_KEY) || "0");
}

function animateCountUp(el, target, formatter) {
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);
    el.textContent = formatter(value);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const checksEl = document.getElementById("counter-checks");
const savingsEl = document.getElementById("counter-savings");

if (checksEl && savingsEl) {
  const checks = getLocalCheckCount();
  const savings = Math.round(checks * FEE_ESTIMATE * SAVED_FRACTION);

  animateCountUp(checksEl, checks, (v) => v.toLocaleString());
  animateCountUp(savingsEl, savings, (v) => "€" + v.toLocaleString());
}
