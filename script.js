/**
 * script.js — Shared logic for the Scholarship Form Research Study
 *
 * This file handles:
 *  - Participant session management (localStorage)
 *  - Tracking helpers (start/stop timer, field counts, step tracking)
 *  - Utility functions used across all pages
 *  - Netlify Forms submission (anonymous results only — no form field data)
 *
 * Participant records are stored in localStorage under "scholarshipStudyData".
 * On survey completion, anonymous results are also posted to Netlify Forms
 * so the researcher can see responses from all devices, not just their own.
 */

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────

/** localStorage key for all participant records */
const STORAGE_KEY = 'scholarshipStudyData';

/** Session key for the current participant's in-progress record */
const SESSION_KEY = 'scholarshipCurrentSession';

/** Minimum CGPA required for eligibility */
const ELIGIBILITY_CGPA = 3.0;


// ─────────────────────────────────────────────
//  STORAGE HELPERS
// ─────────────────────────────────────────────

/**
 * Load the full array of all past participant records from localStorage.
 * Returns an empty array if nothing has been saved yet.
 * @returns {Array} Array of participant record objects
 */
function loadAllRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Could not parse study data from localStorage.', e);
    return [];
  }
}

/**
 * Save (append or update) a single participant record to the records array.
 * If a record with the same sessionId already exists it is replaced;
 * otherwise the record is appended.
 * @param {Object} record - The participant session object to save
 */
function saveRecord(record) {
  const all = loadAllRecords();
  const idx = all.findIndex(r => r.sessionId === record.sessionId);
  if (idx >= 0) {
    all[idx] = record; // update existing
  } else {
    all.push(record);  // add new
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Clear all participant records from localStorage.
 * Called from the results page.
 */
function clearAllRecords() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Start a new participant session and save it to localStorage.
 * Called from consent.html after the tester agrees and chooses a form.
 * @param {string} formType - 'progressive' or 'conventional'
 * @returns {Object} The newly created session object
 */
function createSession(formType) {
  const session = {
    sessionId:       generateId(),
    formType:        formType,          // 'progressive' or 'conventional'
    startTime:       new Date().toISOString(),
    endTime:         null,
    totalSeconds:    null,
    completed:       false,
    lastStepReached: 1,                 // step number (1–3 for progressive, 1 for conventional)
    fieldsAsked:     0,                 // count of fields actually shown
    unneededFields:  0,                 // count of fields that were unnecessary
    trustScore:      null,              // average of the 4 survey answers
    surveyAnswers:   null,              // raw array [q1,q2,q3,q4]
    formData:        {},                // non-sensitive metadata (scholarship type, level, cgpa)
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * Load the current in-progress session from localStorage.
 * Returns null if there is no active session.
 * @returns {Object|null}
 */
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Could not load current session.', e);
    return null;
  }
}

/**
 * Persist updates to the current in-progress session.
 * @param {Object} session - The updated session object
 */
function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Mark the current session as complete and move it to the records array.
 * Should be called when the participant submits the form.
 * @param {Object} extraData - Any final fields to merge in before saving
 */
function finalizeSession(extraData = {}) {
  const session = loadSession();
  if (!session) return;

  // Stamp completion fields
  session.endTime      = new Date().toISOString();
  session.totalSeconds = Math.round(
    (new Date(session.endTime) - new Date(session.startTime)) / 1000
  );
  session.completed    = true;

  // Merge any extra data passed in
  Object.assign(session, extraData);

  // Persist to the all-records array, then remove the current session key
  saveRecord(session);
  localStorage.removeItem(SESSION_KEY);

  return session;
}

/**
 * Mark the current session as abandoned (not completed).
 * Saves it to the full records array so we can track drop-offs.
 * @param {number} lastStep - The last step the participant reached
 */
function abandonSession(lastStep) {
  const session = loadSession();
  if (!session) return;

  session.endTime         = new Date().toISOString();
  session.totalSeconds    = Math.round(
    (new Date(session.endTime) - new Date(session.startTime)) / 1000
  );
  session.completed       = false;
  session.lastStepReached = lastStep;

  saveRecord(session);
  localStorage.removeItem(SESSION_KEY);
}


// ─────────────────────────────────────────────
//  NETLIFY FORMS — ANONYMOUS RESULTS SUBMISSION
// ─────────────────────────────────────────────

/**
 * Submit anonymous results to Netlify Forms when the survey is completed.
 * Only sends: sessionId, formType, totalSeconds, completed, fieldsAsked,
 * unneededFields, trustScore, and individual survey answers.
 * Nothing typed into the scholarship form fields is ever sent.
 *
 * This uses the Netlify Forms hidden-form technique: a real <form> element
 * with data-netlify="true" must exist in the HTML of the page for Netlify
 * to detect it at deploy time. The fetch() call then posts to that form.
 *
 * If the fetch fails (e.g. running locally), it fails silently — localStorage
 * data is always the primary record.
 *
 * @param {Object} record - The finalised participant session record
 */
function submitToNetlify(record) {
  // Build a URL-encoded form body (required by Netlify Forms)
  const body = new URLSearchParams({
    'form-name':    'study-results',           // must match the name= on the HTML form
    sessionId:      record.sessionId   || '',
    formType:       record.formType    || '',
    totalSeconds:   record.totalSeconds != null ? record.totalSeconds : '',
    completed:      record.completed   ? 'true' : 'false',
    fieldsAsked:    record.fieldsAsked    != null ? record.fieldsAsked    : '',
    unneededFields: record.unneededFields != null ? record.unneededFields : '',
    trustScore:     record.trustScore     != null ? record.trustScore     : '',
    q1: record.surveyAnswers ? record.surveyAnswers[0] : '',
    q2: record.surveyAnswers ? record.surveyAnswers[1] : '',
    q3: record.surveyAnswers ? record.surveyAnswers[2] : '',
    q4: record.surveyAnswers ? record.surveyAnswers[3] : '',
  });

  // POST to the current page (Netlify intercepts form posts at build time)
  fetch('/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  }).catch(err => {
    // Fail silently — localStorage is the fallback
    console.warn('Netlify Forms submission failed (expected when running locally):', err.message);
  });
}


// ─────────────────────────────────────────────
//  VALIDATION HELPERS
// ─────────────────────────────────────────────

/**
 * Validate a single form field.
 * Adds/removes CSS classes and shows/hides the paired .field-error element.
 *
 * @param {HTMLElement} field - The input/select/textarea to validate
 * @param {Function}    ruleFn - A function(value) => string|null.
 *                               Return an error message string on failure,
 *                               or null/undefined on success.
 * @returns {boolean} true if valid
 */
function validateField(field, ruleFn) {
  const value = field.value ? field.value.trim() : '';
  const errorEl = field.parentElement.querySelector('.field-error');
  const msg = ruleFn(value);

  if (msg) {
    field.classList.add('is-invalid');
    if (errorEl) { errorEl.textContent = msg; errorEl.classList.add('visible'); }
    return false;
  } else {
    field.classList.remove('is-invalid');
    if (errorEl) { errorEl.classList.remove('visible'); }
    return true;
  }
}

/**
 * Validate a group of radio buttons (no single input element).
 * @param {string}      name     - The radio input's name attribute
 * @param {HTMLElement} container - The parent element containing the radios and .field-error
 * @returns {boolean} true if at least one radio is checked
 */
function validateRadioGroup(name, container) {
  const selected = container.querySelector(`input[name="${name}"]:checked`);
  const errorEl  = container.querySelector('.field-error');
  if (!selected) {
    if (errorEl) { errorEl.textContent = 'Please select an option.'; errorEl.classList.add('visible'); }
    return false;
  }
  if (errorEl) errorEl.classList.remove('visible');
  return true;
}

/**
 * Count words in a string.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

// Common validation rules (reusable across both forms)
const Rules = {
  required:     v => v ? null : 'This field is required.',
  email:        v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email address.',
  phone:        v => /^\+?[\d\s\-()]{7,15}$/.test(v) ? null : 'Enter a valid phone number.',
  cgpa:         v => {
    const n = parseFloat(v);
    return (!isNaN(n) && n >= 0 && n <= 5.0) ? null : 'Enter a CGPA between 0.00 and 5.00.';
  },
  level:        v => ['100','200','300','400','500'].includes(v) ? null : 'Select your level.',
  incomeRange:  v => v ? null : 'Please select a household income range.',
  reason:       v => {
    if (!v) return 'Please enter a reason.';
    if (countWords(v) > 150) return 'Your reason must be 150 words or fewer.';
    return null;
  },
  refereeName:  v => v ? null : 'Please enter your referee\'s name.',
  refereeEmail: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid referee email address.',
  bankAccount:  v => /^\d{10}$/.test(v) ? null : 'Enter a valid 10-digit bank account number.',
};


// ─────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────

/**
 * Update the word-count display element below a textarea.
 * @param {HTMLTextAreaElement} textarea
 * @param {HTMLElement}         counterEl
 * @param {number}              maxWords
 */
function updateWordCount(textarea, counterEl, maxWords) {
  const count = countWords(textarea.value);
  counterEl.textContent = `${count} / ${maxWords} words`;
  if (count > maxWords) {
    counterEl.classList.add('over-limit');
  } else {
    counterEl.classList.remove('over-limit');
  }
}

/**
 * Wire up radio option cards so clicking the label also updates the
 * .selected CSS class on the card for styling purposes.
 * @param {HTMLElement} container - The .radio-group element
 */
function wireRadioCards(container) {
  const options = container.querySelectorAll('.radio-option');
  options.forEach(opt => {
    const radio = opt.querySelector('input[type="radio"]');
    if (!radio) return;

    opt.addEventListener('click', () => {
      // De-select all in group
      options.forEach(o => o.classList.remove('selected'));
      // Select this one
      opt.classList.add('selected');
      radio.checked = true;
      // Dispatch change so other listeners fire
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Reflect initial state (e.g. after back-navigation)
    if (radio.checked) opt.classList.add('selected');
  });
}

/**
 * Set the progress bar width and update step dot states.
 * @param {number} current - Current step (1-based)
 * @param {number} total   - Total number of steps
 */
function setProgress(current, total) {
  const fill  = document.getElementById('progressFill');
  const label = document.getElementById('progressLabel');
  const dots  = document.querySelectorAll('.step-dot');

  const pct = Math.round((current / total) * 100);
  if (fill)  fill.style.width = pct + '%';
  if (label) label.textContent = `Step ${current} of ${total}`;

  dots.forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i + 1 < current)      dot.classList.add('done');
    else if (i + 1 === current) dot.classList.add('active');
  });
}

/**
 * Smoothly scroll to the top of the page (for multi-step navigation).
 */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ─────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────

/**
 * Generate a short unique ID for participant sessions.
 * Uses a timestamp + random suffix — not cryptographically secure,
 * but sufficient for a small research study.
 * @returns {string} e.g. "sess_1698322847_4f2a"
 */
function generateId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

/**
 * Format a number of seconds into a human-readable string.
 * @param {number} secs
 * @returns {string} e.g. "2m 34s"
 */
function formatDuration(secs) {
  if (secs == null || isNaN(secs)) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Safely compute the mean of an array of numbers.
 * Ignores null/undefined values.
 * @param {Array} arr
 * @returns {number|null} Mean value, or null if array is empty
 */
function mean(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Round a number to n decimal places.
 * @param {number} val
 * @param {number} dp
 * @returns {string}
 */
function round(val, dp = 2) {
  if (val == null) return '—';
  return val.toFixed(dp);
}
