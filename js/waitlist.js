// Handles the waitlist signup form on the landing page.
//
// To actually RECEIVE these signups by email, sign up for a free Formspree
// account (formspree.io), create a form, and paste your form's endpoint URL
// below. Until you do that, submissions are only shown as a success message
// in the browser and are not saved anywhere.
const FORMSPREE_ENDPOINT = "https://formspree.io/f/mrpbepog";

const waitlistForm = document.getElementById("waitlist-form");
const successEl = document.getElementById("wl-success");
const errorEl = document.getElementById("wl-error");

waitlistForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  successEl.style.display = "none";
  errorEl.style.display = "none";

  const data = {
    email: document.getElementById("wl-email").value.trim(),
  };

  if (!FORMSPREE_ENDPOINT) {
    console.warn("Waitlist signup captured locally only — FORMSPREE_ENDPOINT is not set:", data);
    successEl.style.display = "block";
    waitlistForm.reset();
    return;
  }

  try {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      successEl.style.display = "block";
      waitlistForm.reset();
    } else {
      errorEl.style.display = "block";
    }
  } catch (err) {
    errorEl.style.display = "block";
  }
});
