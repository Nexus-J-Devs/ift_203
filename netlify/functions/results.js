/** netlify/functions/results.js. */

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

/** Merge multiple anonymous lifecycle events into one participant record. */
function mergeSubmissions(submissions) {
  const bySession = new Map();
  submissions
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach(sub => {
      const d = sub.data || {};
      const id = d.sessionId || sub.id;
      const eventType = d.eventType || (String(d.completed) === 'true' ? 'completed' : 'legacy');
      const rec = bySession.get(id) || {
        sessionId: id, formType: d.formType || '', startTime: d.startTime || sub.created_at || null,
        endTime: null, totalSeconds: null, completed: false, status: 'in_progress',
        fieldsAsked: null, unneededFields: null, trustScore: null, surveyAnswers: null,
        lastStepReached: null,
      };

      // Preserve the original start timestamp across all later events.
      if (!rec.startTime) rec.startTime = d.startTime || sub.created_at || null;
      if (d.formType) rec.formType = d.formType;
      if (eventType === 'started') {
        rec.status = 'in_progress';
      } else if (eventType === 'completed' || eventType === 'survey' || eventType === 'legacy') {
        if (String(d.completed) === 'true' || eventType === 'completed' || eventType === 'survey') {
          rec.completed = true;
          rec.status = 'completed';
          rec.endTime = d.endTime || sub.created_at || rec.endTime;
        } else if (eventType === 'legacy') {
          // Older false records were explicitly submitted as non-completions.
          rec.status = 'abandoned';
          rec.endTime = sub.created_at || rec.endTime;
        }
      } else if (eventType === 'ineligible') {
        rec.status = 'ineligible';
        rec.endTime = d.endTime || sub.created_at || rec.endTime;
      }

      const seconds = num(d.totalSeconds);
      const fields = num(d.fieldsAsked);
      const unneeded = num(d.unneededFields);
      const trust = num(d.trustScore);
      const step = num(d.lastStepReached);
      if (seconds !== null) rec.totalSeconds = seconds;
      if (fields !== null) rec.fieldsAsked = fields;
      if (unneeded !== null) rec.unneededFields = unneeded;
      if (trust !== null) rec.trustScore = trust;
      if (step !== null) rec.lastStepReached = step;

      const answers = [d.q1, d.q2, d.q3, d.q4].map(num);
      if (answers.every(a => a !== null)) rec.surveyAnswers = answers;
      bySession.set(id, rec);
    });

  const now = Date.now();
  const abandonmentMs = 30 * 60 * 1000;
  return Array.from(bySession.values()).map(rec => {
    if (!rec.completed && rec.status !== 'ineligible') {
      const age = rec.startTime ? now - new Date(rec.startTime).getTime() : 0;
      rec.status = age >= abandonmentMs ? 'abandoned' : 'in_progress';
    }
    rec.abandoned = rec.status === 'abandoned';
    rec.inProgress = rec.status === 'in_progress';
    return rec;
  });
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

    // 3) Merge start/completion/survey events into one record per session.
    return respond(200, { records: mergeSubmissions(all) });
  } catch (err) {
    return respond(500, { error: 'Could not reach Netlify API: ' + err.message });
  }
};
