// Vercel serverless function: posts a daily task completion summary to
// Microsoft Teams. Triggered by the cron in vercel.json at 20:00 UTC daily
// (4 PM Eastern during EDT).
//
// Uses the Firebase Admin SDK with a service account stored in the
// FIREBASE_SERVICE_ACCOUNT env var (entire JSON pasted as a single string).
// Admin auth bypasses RTDB security rules.

import admin from "firebase-admin";

const PEOPLE = [
  { id: "robert", name: "Rob" },
  { id: "joe", name: "Joe" },
  { id: "bryan", name: "Bryan" },
];

// Initialize once per warm container. Vercel reuses the process across
// invocations, so admin.apps.length guards against re-init errors.
function getDb() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT env var");
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  return admin.database();
}

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
    const webhookURL = process.env.TEAMS_WEBHOOK_URL;
    if (!webhookURL) {
      return res
        .status(500)
        .json({ ok: false, error: "Missing TEAMS_WEBHOOK_URL" });
    }

    const db = getDb();
    const snapshot = await db.ref("commandCenter/tasks").once("value");
    const tasksData = snapshot.val() || {};
    const tasks = Object.values(tasksData);

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
    return res
      .status(500)
      .json({ ok: false, error: String((err && err.message) || err) });
  }
}
