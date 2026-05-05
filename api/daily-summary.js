// Vercel serverless function: posts a daily task completion summary to
// Microsoft Teams. Triggered by the cron in vercel.json at 21:00 UTC daily.
//
// Reads commandCenter/tasks from the icon-work-orders RTDB using the same
// anonymous-auth pattern as the web app (rules require auth != null), then
// filters tasks completed today in Eastern time and posts a MessageCard.

// Public web API key — same value lives in src/firebase.js. Not a secret;
// access is gated by RTDB security rules + anonymous sign-in.
const FIREBASE_API_KEY = "AIzaSyDwSR8OG2WOJAXn45DPI5jy0dmZhkRylEY";

const PEOPLE = [
  { id: "robert", name: "Rob" },
  { id: "joe", name: "Joe" },
  { id: "bryan", name: "Bryan" },
];

const easternDate = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const easternDisplayDate = (d) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);

async function getIdToken() {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  if (!resp.ok) {
    throw new Error(`Firebase anon auth failed: ${resp.status} ${await resp.text()}`);
  }
  const { idToken } = await resp.json();
  return idToken;
}

async function readTasks(databaseURL, idToken) {
  const base = databaseURL.replace(/\/$/, "");
  const resp = await fetch(
    `${base}/commandCenter/tasks.json?auth=${encodeURIComponent(idToken)}`
  );
  if (!resp.ok) {
    throw new Error(`RTDB read failed: ${resp.status} ${await resp.text()}`);
  }
  const data = (await resp.json()) || {};
  return Object.values(data);
}

function buildCard(grouped, displayDate) {
  const sections = PEOPLE.map((p) => {
    const items = grouped[p.id] || [];
    const text =
      items.length === 0
        ? "_No tasks completed today_"
        : items
            .map(
              (t) =>
                `- **${t.title || "(untitled)"}** — ${t.customer || "—"}`
            )
            .join("\n\n");
    return {
      activityTitle: `**${p.name}** (${items.length})`,
      text,
    };
  });

  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: "Icon Daily Task Summary",
    themeColor: "0EA5E9",
    title: `📋 Icon Daily Task Summary — ${displayDate}`,
    sections: [
      ...sections,
      { text: "_Sent automatically at 4PM by Icon Command Center_" },
    ],
  };
}

export default async function handler(req, res) {
  try {
    const databaseURL = process.env.FIREBASE_DATABASE_URL;
    const webhookURL = process.env.TEAMS_WEBHOOK_URL;

    if (!databaseURL || !webhookURL) {
      return res
        .status(500)
        .json({ ok: false, error: "Missing FIREBASE_DATABASE_URL or TEAMS_WEBHOOK_URL" });
    }

    const idToken = await getIdToken();
    const tasks = await readTasks(databaseURL, idToken);

    const now = new Date();
    const today = easternDate(now);

    const completedToday = tasks.filter((t) => {
      if (!t || t.status !== "done" || !t.completedAt) return false;
      const completed = new Date(t.completedAt);
      if (Number.isNaN(completed.getTime())) return false;
      return easternDate(completed) === today;
    });

    const grouped = {};
    for (const t of completedToday) {
      const key = t.assignee || "unassigned";
      (grouped[key] = grouped[key] || []).push(t);
    }

    const card = buildCard(grouped, easternDisplayDate(now));

    const teamsResp = await fetch(webhookURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

    if (!teamsResp.ok) {
      throw new Error(
        `Teams webhook failed: ${teamsResp.status} ${await teamsResp.text()}`
      );
    }

    return res.status(200).json({
      ok: true,
      date: today,
      totalCompleted: completedToday.length,
      perPerson: Object.fromEntries(
        PEOPLE.map((p) => [p.id, (grouped[p.id] || []).length])
      ),
    });
  } catch (err) {
    console.error("[daily-summary]", err);
    return res.status(500).json({ ok: false, error: String(err && err.message || err) });
  }
}
