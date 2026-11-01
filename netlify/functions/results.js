/**
 * netlify/functions/results.js
 *
 * Returns ALL survey results (from every participant, every device) so that
 * results.html can show them. It reads the "study-results" form submissions
 * from the Netlify API using a token kept on the server (never in the browser).
 *
 * Required environment variables (Netlify → Site configuration → Environment variables):
 *   FORMS_TOKEN    — a Netlify personal access token
 *   FORMS_SITE_ID  — this site's Site ID (Site configuration → General → Site ID)
 *
 * Only anonymous study fields are returned. Netlify also stores IP address and
 * user agent with each submission — those are deliberately NOT passed on.
 */

const API = 'https://api.netlify.com/api/v1';
const FORM_NAME = 'study-results';

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

const num = v => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

/** Convert one Netlify submission into the record shape results.html expects. */
function toRecord(sub) {
  const d = sub.data || {};
  const answers = [d.q1, d.q2, d.q3, d.q4].map(num);
  const hasSurvey = answers.every(a => a !== null);

  return {
    sessionId:       d.sessionId || sub.id,
    formType:        d.formType || '',
    startTime:       sub.created_at || null, // time the result was submitted
    totalSeconds:    num(d.totalSeconds),
    completed:       String(d.completed) === 'true',
    fieldsAsked:     num(d.fieldsAsked),
    unneededFields:  num(d.unneededFields),
    trustScore:      num(d.trustScore),
    surveyAnswers:   hasSurvey ? answers : null,
    lastStepReached: null,
  };
}

exports.handler = async () => {
  const token  = process.env.FORMS_TOKEN;
  const siteId = process.env.FORMS_SITE_ID || process.env.SITE_ID;

  if (!token || !siteId) {
    return respond(500, {
      error: 'Server not configured: set FORMS_TOKEN and FORMS_SITE_ID in Netlify environment variables.',
    });
  }

  const headers = { Authorization: `Bearer ${token}` };

  try {
    // 1) Find the form's id
    const formsRes = await fetch(`${API}/sites/${siteId}/forms`, { headers });
    if (!formsRes.ok) {
      return respond(502, { error: `Netlify API refused the forms request (${formsRes.status}). Check FORMS_TOKEN and FORMS_SITE_ID.` });
    }
    const forms = await formsRes.json();
    const form = forms.find(f => f.name === FORM_NAME);
    if (!form) {
      // Form not detected yet (no deploy with the form, or no submissions yet)
      return respond(200, { records: [], note: `Form "${FORM_NAME}" not found yet.` });
    }

    // 2) Read all submissions (100 per page)
    const all = [];
    for (let page = 1; page <= 50; page++) {
      const res = await fetch(`${API}/forms/${form.id}/submissions?per_page=100&page=${page}`, { headers });
      if (!res.ok) {
        return respond(502, { error: `Netlify API refused the submissions request (${res.status}).` });
      }
      const batch = await res.json();
      all.push(...batch);
      if (batch.length < 100) break;
    }

    // 3) Convert, drop duplicates by sessionId (keep newest), sort oldest → newest
    const bySession = new Map();
    all
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .forEach(sub => {
        const rec = toRecord(sub);
        bySession.set(rec.sessionId, rec); // later submissions overwrite earlier
      });

    return respond(200, { records: Array.from(bySession.values()) });
  } catch (err) {
    return respond(500, { error: 'Could not reach Netlify API: ' + err.message });
  }
};
