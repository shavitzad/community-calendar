// Vercel Serverless Function: שליחת סיכום אירועי השבוע הקרוב במייל לכל הרשימה ב-Brevo.
//
// משתני סביבה (Vercel → Settings → Environment Variables):
//   BREVO_API_KEY       (חובה) מפתח ה-API של Brevo
//   BREVO_SENDER_EMAIL  (חובה) כתובת שולח שאומתה ב-Brevo (Senders & IP → Senders)
//   BREVO_SENDER_NAME   (אופציונלי) שם השולח. ברירת מחדל: ALL EVENTS מזכרת בתיה
//   BREVO_LIST_ID       (אופציונלי) מספר הרשימה. ברירת מחדל: 5
//   ADMIN_PASSWORD      (חובה) סיסמת המנהל; בלעדיה השרת מסרב לשלוח, כדי שאי אפשר יהיה להפעיל שליחה המונית ללא הרשאה

const BREVO = 'https://api.brevo.com/v3';
const TZ = 'Asia/Jerusalem';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
}
function addDays(key, n) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayLabel(key) {
  return new Date(key + 'T12:00:00Z').toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
  });
}

function buildHtml(events) {
  const AGE = { 'משפחות': '👨‍👩‍👧‍👦', 'נוער': '🧑‍🎤', 'מבוגרים': '☕' };
  const byDay = {};
  events.forEach((e) => { (byDay[e.date] ||= []).push(e); });

  const days = Object.keys(byDay).sort().map((k) => {
    const items = byDay[k].map((e) => {
      // חילוץ הקישור מתוך השדות האפשריים ב-JSON שלכם
      const targetUrl = e.link || e.url || e.registrationUrl || e.registration_link;
      
      // יצירת כפתור לחיץ מעוצב אם נמצא קישור תקין באירוע
      const linkButton = targetUrl ? `
        <div style="margin-top:10px;">
          <a href="${esc(targetUrl)}" target="_blank" 
             style="display:inline-block;background-color:#4f46e5;color:#ffffff;padding:8px 16px;text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold;">
             לחצו כאן לפרטים והרשמה ➔
          </a>
        </div>` : '';

      return `
      <div style="margin:0 0 14px;padding:12px 14px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
        <div style="font-size:16px;font-weight:700;color:#1e293b">${AGE[e.target_age] || '🎉'} ${esc(e.title)}</div>
        <div style="font-size:14px;color:#475569;margin-top:4px">
          🕒 ${esc(e.start_time)}${e.end_time ? '–' + esc(e.end_time) : ''}${e.location ? ' &nbsp;|&nbsp; 📍 ' + esc(e.location) : ''}
        </div>
        ${e.description ? `<div style="font-size:14px;color:#334155;margin-top:6px">${esc(e.description)}</div>` : ''}
        ${e.community ? `<div style="font-size:12px;color:#4f46e5;margin-top:6px">🏛️ ${esc(e.community)}</div>` : ''}
        ${linkButton}
      </div>`;
    }).join('');
    return `<h3 style="margin:22px 0 8px;font-size:17px;color:#4338ca">🗓️ ${esc(dayLabel(k))}</h3>${items}`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <h1 style="font-size:22px;color:#1e293b;margin:0 0 4px">📅 האירועים של השבוע הקרוב</h1>
    <div style="font-size:14px;color:#64748b">ALL EVENTS מזכרת בתיה</div>
    ${days}
    <p style="margin-top:24px;font-size:14px;color:#334155">נשמח לראותכם! 🎉</p>
  </div>
</body></html>`;
}

async function brevo(path, body) {
  const r = await fetch(BREVO + path, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // 1. אימות מנהל
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(500).json({ message: 'חסר ADMIN_PASSWORD ב-Environment Variables של Vercel (נדרש כדי שלא יהיה אפשר להפעיל שליחה המונית ללא הרשאה).' });
    }
    if (req.headers['x-admin-password'] !== adminPassword) {
      return res.status(401).json({ message: 'אין הרשאה: סיסמת מנהל שגויה.' });
    }

    // 2. בדיקת הגדרות
    const { BREVO_API_KEY, BREVO_SENDER_EMAIL } = process.env;
    if (!BREVO_API_KEY) {
      return res.status(500).json({ message: 'חסר BREVO_API_KEY ב-Environment Variables של Vercel.' });
    }
    if (!BREVO_SENDER_EMAIL) {
      return res.status(500).json({ message: 'חסר BREVO_SENDER_EMAIL (כתובת שולח מאומתת ב-Brevo) ב-Environment Variables.' });
    }
    const senderName = process.env.BREVO_SENDER_NAME || 'ALL EVENTS מזכרת בתיה';
    const listId = parseInt(process.env.BREVO_LIST_ID || '5', 10);

    // 3. האירועים מגיעים מהדפדפן של המנהל
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const raw = body && body.events;
    const all = Array.isArray(raw) ? raw : [];
    if (!all.length) {
      return res.status(400).json({ message: 'לא התקבלו אירועים מהדפדפן (events.json ריק או לא נטען).' });
    }

    // 4. אירועי 7 הימים הקרובים
    const start = todayKey();
    const end = addDays(start, 7);
    const events = all
      .filter((e) => e && e.date && e.title && e.date >= start && e.date < end)
      .sort((a, b) => (a.date + (a.start_time || '')).localeCompare(b.date + (b.start_time || '')));

    if (!events.length) {
      return res.status(400).json({ message: 'אין אירועים בשבוע הקרוב, לא נשלח מייל.' });
    }

    // 5. יצירת קמפיין ב-Brevo
    const created = await brevo('/emailCampaigns', {
      name: `סיכום שבועי ${start}`,
      subject: '📅 האירועים של השבוע הקרוב במזכרת בתיה',
      sender: { name: senderName, email: BREVO_SENDER_EMAIL },
      type: 'classic',
      htmlContent: buildHtml(events),
      recipients: { listIds: [listId] }
    });
    if (!created.ok) {
      console.error('Brevo create campaign failed:', created.status, created.data);
      return res.status(created.status).json({
        message: 'יצירת הקמפיין ב-Brevo נכשלה: ' + (created.data.message || created.status)
      });
    }

    // 6. שליחה מיידית
    const sent = await brevo(`/emailCampaigns/${created.data.id}/sendNow`);
    if (!sent.ok) {
      console.error('Brevo sendNow failed:', sent.status, sent.data);
      return res.status(sent.status).json({
        message: `הקמפיין נוצר (מספר ${created.data.id}) אך השליחה נכשלה: ` + (sent.data.message || sent.status)
      });
    }

    return res.status(200).json({ message: 'Success', campaignId: created.data.id, events: events.length });
  } catch (error) {
    console.error('send-email error:', error);
    return res.status(500).json({ message: error.message });
  }
};
