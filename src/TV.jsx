import { useEffect, useMemo, useState } from 'react';
import {
  db, authReady, ref, onValue,
  timeclockAuthReady, timeclockFs, collection, onSnapshot, query, where, Timestamp,
} from './firebase';

const TASKS_PATH = 'commandCenter/tasks';
const PUNCHES_PATH = 'punches';
const BRAND_RED = '#E8192C';

const FONT_LINK =
'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap';
const FD = "'Oswald', 'Arial Narrow', sans-serif";
const FB = "'Manrope', 'Segoe UI', Arial, sans-serif";
const FM = "'JetBrains Mono', 'Consolas', monospace";

const KEEP_AWAKE_SRC = 'data:video/mp4;base64,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';

const TEAM = [
{ id: 'robert', name: 'ROB', accent: '#fbbf24', accentSoft: 'rgba(251,191,36,0.2)' },
{ id: 'joe', name: 'JOE', accent: '#38bdf8', accentSoft: 'rgba(56,189,248,0.2)' },
{ id: 'bryan', name: 'BRYAN', accent: '#34d399', accentSoft: 'rgba(52,211,153,0.2)' },
];

const PRIORITIES = {
urgent: { label: 'URGENT', color: '#ef4444', bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.55)' },
high: { label: 'HIGH', color: '#f59e0b', bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.55)' },
medium: { label: 'MEDIUM', color: '#ffffff', bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.40)' },
low: { label: 'LOW', color: '#a0aec0', bg: 'rgba(161,161,170,0.10)', border: 'rgba(161,161,170,0.40)' },
};
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

const CREW = ['Luis', 'Azael', 'Oswaldo', 'Andres', 'Vicente', 'Gabriel', 'Geovanny', 'Bryan'];

const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const dateSortKey = (s) => (isISODate(s) ? s : '9999-12-31');

const getAssignees = (task) => {
const list = [task?.assignee, ...(Array.isArray(task?.extraAssignees) ? task.extraAssignees : [])];
return list.filter((id, i) => id && list.indexOf(id) === i);
};

const formatDueDate = (s) => {
if (!s) return '';
if (!isISODate(s)) return s;
const d = new Date(s + 'T00:00:00');
const today = new Date(); today.setHours(0, 0, 0, 0);
const diff = Math.round((d - today) / 86400000);
if (diff === 0) return 'TODAY';
if (diff === 1) return 'TOMORROW';
if (diff === -1) return 'YESTERDAY';
return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
};

const todayISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const msToISODate = (ms) => {
  if (!ms) return null;
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const tsToMs = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string') {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object') {
    if (typeof v.seconds === 'number') return v.seconds * 1000 + (v.nanoseconds || 0) / 1e6;
    if (typeof v._seconds === 'number') return v._seconds * 1000;
  }
  return null;
};

const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj && obj[k];
    if (v != null && v !== '') return v;
  }
  return undefined;
};

const formatElapsed = (sinceMs, nowMs) => {
  if (!sinceMs) return '';
  const diffMin = Math.max(0, Math.floor((nowMs - sinceMs) / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h <= 0) return m + 'm';
  return h + 'h ' + String(m).padStart(2, '0') + 'm';
};

// Days a task is overdue (0 = not overdue / no valid due date).
const daysOverdue = (task, today) => {
  if (!isISODate(task.dueDate) || task.dueDate >= today) return 0;
  const due = new Date(task.dueDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  return Math.max(1, Math.round((now - due) / 86400000));
};

// Days since creation for tasks with no due date (stale detection).
const daysOld = (task) => {
  if (isISODate(task.dueDate)) return 0;
  const created = tsToMs(pick(task, ['createdAt', 'created', 'timestamp']));
  if (!created) return 0;
  return Math.floor((Date.now() - created) / 86400000);
};

// Punch classification - mirrors Dashboard.jsx. workdayStatus is
// authoritative, action regex is the fallback. TEMP is checked first so
// 'Bryan Temp Out' never reads as a plain clock-out.
const classify = (e) => {
  const a = String(e.action || '').toUpperCase();
  if (/TEMP/.test(a)) return 'tempOut';
  const w = String(e.workdayStatus || '').toLowerCase();
  if (w === 'ended') return 'out';
  if (w === 'started' || /closed/.test(w)) return 'in'; // jobNClosed = between jobs
  if (!a) return null;
  if (/END JOB|START JOB/.test(a)) return 'in';
  if (/OUT|END/.test(a)) return 'out';
  if (/IN|START/.test(a)) return 'in';
  return null;
};

const crewStateByName = (punches, today) => {
  const latest = {};
  for (const e of punches || []) {
    const name = pick(e, ['name', 'employee', 'employeeName', 'userName', 'crew']);
    if (!name) continue;
    const ts = tsToMs(pick(e, ['timestamp', 'clockIn', 'clockInTime', 'startTime', 'startedAt']));
    if (!ts) continue;
    const rawDate = pick(e, ['date', 'dayDate']);
    const dateField = isISODate(rawDate) ? rawDate : msToISODate(ts);
    if (dateField !== today) continue;
    const key = name.toLowerCase();
    if (!latest[key] || ts > latest[key].ts) latest[key] = { e, ts };
  }
  const result = {};
  for (const key of Object.keys(latest)) {
    const { e, ts } = latest[key];
    let state = classify(e);
    if (state == null) {
      state = tsToMs(pick(e, ['clockOut', 'clockOutTime', 'endTime', 'endedAt'])) ? 'out' : 'in';
    }
    result[key] = { state, sinceMs: ts };
  }
  return result;
};

const scaleFor = (count) => {
if (count <= 5) return { tier:'L', title:'clamp(20px,2.4vw,64px)', customer:'clamp(15px,1.7vw,40px)', meta:'clamp(12px,1.2vw,26px)', cardPad:'clamp(14px,1.3vw,28px)', cardGap:'clamp(12px,1vw,22px)', colHeader:'clamp(32px,4vw,96px)' };
if (count <= 10) return { tier:'M', title:'clamp(17px,2vw,52px)', customer:'clamp(13px,1.4vw,34px)', meta:'clamp(11px,1vw,22px)', cardPad:'clamp(11px,1vw,22px)', cardGap:'clamp(9px,0.8vw,18px)', colHeader:'clamp(28px,3.4vw,80px)' };
if (count <= 15) return { tier:'S', title:'clamp(15px,1.7vw,42px)', customer:'clamp(11px,1.2vw,28px)', meta:'clamp(10px,0.9vw,20px)', cardPad:'clamp(9px,0.85vw,18px)', cardGap:'clamp(7px,0.6vw,14px)', colHeader:'clamp(25px,2.9vw,68px)' };
return { tier:'XS', title:'clamp(13px,1.4vw,34px)', customer:'clamp(10px,1vw,22px)', meta:'clamp(9px,0.8vw,18px)', cardPad:'clamp(7px,0.7vw,14px)', cardGap:'clamp(5px,0.45vw,10px)', colHeader:'clamp(22px,2.5vw,56px)' };
};

function LiveClock() {
const [now, setNow] = useState(new Date());
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 1080);
useEffect(() => {
const t = setInterval(() => setNow(new Date()), 1000);
return () => clearInterval(t);
}, []);
return (
<div style={{
fontFamily: FD, fontWeight: 700, color: '#ffffff',
fontSize: 'clamp(22px, 2.4vw, 56px)',
letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums',
lineHeight: 1,
}}>
{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
</div>
);
}

function CornerAccent({ pos }) {
const size = 'clamp(18px, 2vw, 40px)';
const thick = '2px';
const color = '#fbbf24';
const base = { position: 'absolute', pointerEvents: 'none' };
const horiz = { ...base, width: size, height: thick, background: color };
const vert = { ...base, width: thick, height: size, background: color };
if (pos === 'tl') return (<>
<div style={{ ...horiz, top: 8, left: 8 }} />
<div style={{ ...vert, top: 8, left: 8 }} />
</>);
if (pos === 'tr') return (<>
<div style={{ ...horiz, top: 8, right: 8 }} />
<div style={{ ...vert, top: 8, right: 8 }} />
</>);
if (pos === 'bl') return (<>
<div style={{ ...horiz, bottom: 8, left: 8 }} />
<div style={{ ...vert, bottom: 8, left: 8 }} />
</>);
return (<>
<div style={{ ...horiz, bottom: 8, right: 8 }} />
<div style={{ ...vert, bottom: 8, right: 8 }} />
</>);
}

function HeaderStat({ label, value, color, pulse }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: 'clamp(54px, 5vw, 120px)' }}>
      <span
        className={pulse && value > 0 ? 'tv-pulse' : undefined}
        style={{
          fontFamily: FD, fontWeight: 700, color: color,
          fontSize: 'clamp(24px, 2.6vw, 60px)', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span style={{
        fontFamily: FB, fontWeight: 700, color: '#a0aec0',
        fontSize: 'clamp(9px, 0.75vw, 16px)', letterSpacing: '0.24em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}

function TaskCard({ task, scale, today }) {
  const pri = PRIORITIES[task.priority] || PRIORITIES.medium;
  const overdueDays = daysOverdue(task, today);
  const staleDays = daysOld(task);
  const due = formatDueDate(task.dueDate);
  const barColor = overdueDays > 0 ? '#ef4444' : pri.color;
  const summary = (task.subTaskSummary || '').trim();
  const subCount = Array.isArray(task.subTasks) ? task.subTasks.length : 0;
  const summaryLine = summary || (subCount > 0 ? subCount + ' sub-task' + (subCount === 1 ? '' : 's') + ' pending' : '');
  return (
    <div style={{
      position: 'relative',
      background: 'rgba(24,24,27,0.85)',
      border: '1px solid rgba(63,63,70,0.7)',
      borderLeft: '4px solid ' + barColor,
      borderRadius: '6px',
      padding: scale.cardPad,
      display: 'flex', flexDirection: 'column',
      gap: 'calc(' + scale.cardGap + ' * 0.6)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{
            padding: '2px 10px', borderRadius: '3px',
            background: pri.bg, border: '1px solid ' + pri.border,
            color: pri.color, fontFamily: FD, fontWeight: 700,
            fontSize: scale.meta, letterSpacing: '0.18em', whiteSpace: 'nowrap',
          }}>
            {pri.label}
          </span>
          {overdueDays > 0 && (
            <span className="tv-pulse" style={{
              padding: '2px 10px', borderRadius: '3px',
              background: 'rgba(239,68,68,0.22)', border: '1px solid rgba(239,68,68,0.7)',
              color: '#f87171', fontFamily: FD, fontWeight: 700,
              fontSize: scale.meta, letterSpacing: '0.14em', whiteSpace: 'nowrap',
            }}>
              OVERDUE {overdueDays}D
            </span>
          )}
          {overdueDays === 0 && staleDays >= 7 && (
            <span style={{
              padding: '2px 10px', borderRadius: '3px',
              background: 'rgba(245,158,11,0.16)', border: '1px solid rgba(245,158,11,0.5)',
              color: '#fbbf24', fontFamily: FD, fontWeight: 700,
              fontSize: scale.meta, letterSpacing: '0.14em', whiteSpace: 'nowrap',
            }}>
              {staleDays}D OLD
            </span>
          )}
        </div>
        {due && (
          <span style={{
            fontFamily: FM, fontWeight: 700,
            color: overdueDays > 0 ? '#f87171' : (due === 'TODAY' ? '#fcd34d' : '#a0aec0'),
            fontSize: scale.meta, letterSpacing: '0.06em',
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}>
            {due}
          </span>
        )}
      </div>
      <div style={{
        fontFamily: FB, fontWeight: 700, color: '#ffffff',
        fontSize: scale.title, lineHeight: 1.2,
        wordBreak: 'break-word',
      }}>
        {task.title}
      </div>
      {task.customer && (
        <div style={{ fontFamily: FB, fontWeight: 600, color: '#fbbf24', fontSize: scale.customer, letterSpacing: '0.02em', lineHeight: 1.25, wordBreak: 'break-word' }}>
          {task.customer}
        </div>
      )}
      {summaryLine && (
        <div style={{
          fontFamily: FB, fontStyle: 'italic', fontWeight: 500, color: '#a0aec0',
          fontSize: scale.customer, lineHeight: 1.3, wordBreak: 'break-word',
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {'\u21B3 '}{summaryLine}
        </div>
      )}
    </div>
  );
}

function PersonColumn({ person, tasks, scale, today, pageSize }) {
  const PAGE_SIZE = pageSize || 10;
  const PAGE_MS = 60000;
  const FADE_MS = 400;

  const pages = useMemo(() => {
    if (tasks.length <= PAGE_SIZE) return [tasks];
    const out = [];
    for (let i = 0; i < tasks.length; i += PAGE_SIZE) { out.push(tasks.slice(i, i + PAGE_SIZE)); }
    return out;
  }, [tasks, PAGE_SIZE]);

  const [pageIdx, setPageIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (pageIdx >= pages.length) { setPageIdx(0); setVisible(true); }
  }, [pages.length, pageIdx]);

  useEffect(() => {
    if (pages.length <= 1) { setVisible(true); return; }
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setPageIdx((prev) => (prev + 1) % pages.length); setVisible(true); }, FADE_MS);
    }, PAGE_MS);
    return () => clearInterval(interval);
  }, [pages.length]);

  const currentTasks = pages[pageIdx] || [];
  const overdueCount = useMemo(() => tasks.filter((t) => daysOverdue(t, today) > 0).length, [tasks, today]);

  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(9,9,11,0.55)',
      border: '1px solid ' + person.accentSoft,
      borderTop: '3px solid ' + person.accent,
      borderRadius: '8px',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      <div style={{
        flexShrink: 0,
        padding: 'clamp(10px, 1vw, 22px) clamp(14px, 1.2vw, 28px)',
        borderBottom: '1px solid ' + person.accentSoft,
        background: 'linear-gradient(to bottom, rgba(24,24,27,0.95), rgba(9,9,11,0.95))',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div style={{ fontFamily: FD, fontWeight: 700, color: person.accent, fontSize: scale.colHeader, letterSpacing: '0.08em', lineHeight: 1 }}>
          {person.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(8px, 0.8vw, 18px)' }}>
          {overdueCount > 0 && (
            <span style={{ fontFamily: FD, fontWeight: 700, color: '#f87171', fontSize: 'calc(' + scale.colHeader + ' * 0.7)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {overdueCount}
              <span style={{ fontFamily: FB, fontWeight: 700, color: '#f87171', fontSize: scale.meta, letterSpacing: '0.16em', marginLeft: '4px' }}>LATE</span>
            </span>
          )}
          <span style={{ fontFamily: FD, fontWeight: 700, color: '#ffffff', fontSize: 'calc(' + scale.colHeader + ' * 0.7)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {tasks.length}
          </span>
          <span style={{ fontFamily: FB, fontWeight: 600, color: '#a0aec0', fontSize: scale.meta, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            {tasks.length === 1 ? 'TASK' : 'TASKS'}
          </span>
        </div>
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: 'clamp(8px, 0.8vw, 18px)',
        display: 'flex', flexDirection: 'column',
        gap: scale.cardGap,
        justifyContent: 'flex-start',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}>
        {tasks.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontFamily: FD, fontWeight: 600, fontSize: scale.title, letterSpacing: '0.18em', textAlign: 'center' }}>
            ALL CLEAR
          </div>
        ) : (
          currentTasks.map((t) => <TaskCard key={t.id} task={t} scale={scale} today={today} />)
        )}
      </div>
    </div>
  );
}
function CrewTicker({ crewState, nowMs }) {
  return (
    <div style={{
      position: 'relative', flexShrink: 0,
      padding: 'clamp(8px, 0.8vw, 16px) clamp(20px, 2vw, 44px)',
      borderTop: '2px solid ' + BRAND_RED,
      background: 'rgba(9,11,16,0.95)',
      display: 'flex', alignItems: 'center', gap: 'clamp(8px, 0.9vw, 20px)',
      overflow: 'hidden',
    }}>
      <span style={{
        fontFamily: FD, fontWeight: 700, color: '#ffffff',
        fontSize: 'clamp(12px, 1.1vw, 24px)', letterSpacing: '0.18em',
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        CREW
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 0.7vw, 16px)', flex: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
        {CREW.map((member) => {
          const s = crewState[member.toLowerCase()];
          const isIn = s && s.state === 'in';
          const isTemp = s && s.state === 'tempOut';
          const dotColor = isIn ? '#34d399' : isTemp ? '#fbbf24' : 'rgba(120,128,140,0.7)';
          const textColor = isIn ? '#ffffff' : isTemp ? '#fbbf24' : '#a0aec0';
          const detail = isIn
            ? formatElapsed(s.sinceMs, nowMs)
            : isTemp
              ? 'AWAY ' + formatElapsed(s.sinceMs, nowMs)
              : 'OUT';
          return (
            <div key={member} style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: 'clamp(3px, 0.35vw, 8px) clamp(8px, 0.85vw, 18px)',
              borderRadius: '999px',
              background: isIn ? 'rgba(52,211,153,0.10)' : isTemp ? 'rgba(251,191,36,0.10)' : 'rgba(255,255,255,0.04)',
              border: '1px solid ' + (isIn ? 'rgba(52,211,153,0.4)' : isTemp ? 'rgba(251,191,36,0.4)' : 'rgba(63,63,70,0.6)'),
              whiteSpace: 'nowrap',
            }}>
              <span style={{
                width: 'clamp(6px, 0.55vw, 12px)', height: 'clamp(6px, 0.55vw, 12px)',
                borderRadius: '50%', background: dotColor,
                boxShadow: (isIn || isTemp) ? '0 0 8px ' + dotColor : 'none',
                flexShrink: 0,
              }} />
              <span style={{ fontFamily: FD, fontWeight: 700, color: textColor, fontSize: 'clamp(11px, 1vw, 22px)', letterSpacing: '0.08em' }}>
                {member.toUpperCase()}
              </span>
              <span style={{ fontFamily: FM, fontWeight: 700, color: isIn ? '#34d399' : textColor, fontSize: 'clamp(10px, 0.85vw, 18px)', fontVariantNumeric: 'tabular-nums', opacity: isIn || isTemp ? 1 : 0.7 }}>
                {detail}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TV() {
  const [allTasks, setAllTasks] = useState([]);
  const [punches, setPunches] = useState([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const link = document.createElement('link');
    link.href = FONT_LINK; link.rel = 'stylesheet';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.textContent = 'html, body, #root { margin: 0; padding: 0; height: 100%; background: #0a0a0f; overflow: hidden; } *, *::before, *::after { box-sizing: border-box; } ::-webkit-scrollbar { display: none; } @keyframes tvPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } } .tv-pulse { animation: tvPulse 1.8s ease-in-out infinite; }';
    document.head.appendChild(style);
    return () => {
      try { document.head.removeChild(link); } catch (e) {}
      try { document.head.removeChild(style); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Cards-per-page adapts to viewport height - the LG webOS browser renders
  // a shorter viewport than the Pi at 1080p, so fixed 10/page clips there.
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // commandCenter/tasks - icon-work-orders RTDB
  useEffect(() => {
    let cancelled = false; let unsub = () => {};
    authReady.then(() => {
      if (cancelled) return;
      const tasksRef = ref(db, TASKS_PATH);
      unsub = onValue(tasksRef, (snap) => {
        if (cancelled) return;
        const data = snap.val() || {};
        setAllTasks(Object.entries(data).map(([id, t]) => ({ id, ...t })));
      }, (err) => { console.error('[TV] tasks read failed:', err); });
    }).catch((err) => console.error('[TV] auth failed:', err));
    return () => { cancelled = true; unsub(); };
  }, []);

  // punches - icon-timeclock-8f75a Firestore (live crew ticker)
  useEffect(() => {
    let cancelled = false; let unsub = () => {};
    timeclockAuthReady.then(() => {
      if (cancelled) return;
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const q = query(
        collection(timeclockFs, PUNCHES_PATH),
        where('timestamp', '>=', Timestamp.fromDate(dayStart)),
      );
      unsub = onSnapshot(
        q,
        (snap) => { if (!cancelled) setPunches(snap.docs.map((d) => d.data())); },
        (err) => console.error('[TV] punches read failed:', err),
      );
    }).catch((err) => console.error('[TV] timeclock auth failed:', err));
    return () => { cancelled = true; unsub(); };
  }, []);

  // Wake Lock - keeps Chrome/Pi awake; webOS ignores it (the video below
  // handles webOS).
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (e) { console.error('[TV] Wake lock failed:', e); }
    };
    requestWakeLock();
    const handleVisibility = () => { if (document.visibilityState === 'visible') { requestWakeLock(); } };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  // Keep-awake video - LG webOS suppresses its screensaver while media is
  // playing. The element loops a real 2s silent clip; retry play() in case
  // the browser pauses it.
  useEffect(() => {
    const tryPlay = () => {
      document.querySelectorAll('video').forEach((v) => { if (v.paused) v.play().catch(() => {}); });
    };
    tryPlay();
    const interval = setInterval(tryPlay, 10000);
    return () => clearInterval(interval);
  }, []);

  const today = todayISO();
  const openTasks = useMemo(() => allTasks.filter((t) => (t.status || 'open') !== 'done'), [allTasks]);

  const tasksByPerson = useMemo(() => {
    const sortFn = (a, b) => {
      const odiff = daysOverdue(b, today) - daysOverdue(a, today);
      if (odiff !== 0) return odiff;
      const pdiff = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (pdiff !== 0) return pdiff;
      return dateSortKey(a.dueDate).localeCompare(dateSortKey(b.dueDate));
    };
    return TEAM.reduce((acc, p) => {
      acc[p.id] = openTasks.filter((t) => getAssignees(t).includes(p.id)).slice().sort(sortFn);
      return acc;
    }, {});
  }, [openTasks, today]);

  const totalOpen = openTasks.length;
  const overdueTotal = useMemo(() => openTasks.filter((t) => daysOverdue(t, today) > 0).length, [openTasks, today]);
  const urgentTotal = useMemo(() => openTasks.filter((t) => t.priority === 'urgent').length, [openTasks]);
  const doneToday = useMemo(() => allTasks.filter((t) => (t.status || 'open') === 'done' && t.completedAt && msToISODate(tsToMs(t.completedAt)) === today).length, [allTasks, today]);
  const scale = useMemo(() => scaleFor(totalOpen), [totalOpen]);
  const crewState = useMemo(() => crewStateByName(punches, today), [punches, today]);
  const pageSize = vh >= 980 ? 10 : vh >= 800 ? 8 : vh >= 640 ? 6 : 5;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(145deg, #0a0a0f, #0a0a0f, #1a1f2e)',
      color: '#ffffff', fontFamily: FB,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <video style={{ position: 'fixed', opacity: 0, width: '1px', height: '1px', top: 0, left: 0, pointerEvents: 'none' }} autoPlay loop muted playsInline src={KEEP_AWAKE_SRC} />
      <CornerAccent pos="tl" /><CornerAccent pos="tr" /><CornerAccent pos="bl" /><CornerAccent pos="br" />
      <header style={{
        position: 'relative', flexShrink: 0,
        padding: 'clamp(12px, 1.2vw, 28px) clamp(28px, 2.5vw, 56px)',
        borderBottom: '3px solid ' + BRAND_RED,
        background: 'linear-gradient(to bottom, rgba(24,24,27,0.85), rgba(9,11,16,0.85))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'clamp(16px, 1.6vw, 36px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 1.4vw, 28px)', minWidth: 0 }}>
          <div style={{ width: 'clamp(40px, 3.4vw, 80px)', height: 'clamp(40px, 3.4vw, 80px)', background: BRAND_RED, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#ffffff', fontFamily: FD, fontWeight: 700, fontSize: 'clamp(20px, 1.8vw, 44px)' }}>I</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontWeight: 700, color: '#ffffff', fontSize: 'clamp(17px, 1.8vw, 44px)', letterSpacing: '0.06em', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ICON REMODELING GROUP
            </div>
            <div style={{ fontFamily: FB, fontWeight: 700, color: 'rgba(232,25,44,0.95)', fontSize: 'clamp(9px, 0.85vw, 18px)', letterSpacing: '0.32em', textTransform: 'uppercase', textShadow: '0 0 12px rgba(232,25,44,0.4)' }}>
              ICON OFFICE BOARD
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 1.6vw, 40px)', flexShrink: 0 }}>
          <HeaderStat label="Overdue" value={overdueTotal} color="#ef4444" pulse />
          <HeaderStat label="Urgent" value={urgentTotal} color="#f59e0b" />
          <HeaderStat label="Open" value={totalOpen} color="#ffffff" />
          <HeaderStat label="Done Today" value={doneToday} color="#34d399" />
          <div style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(63,63,70,0.7)' }} />
          <LiveClock />
        </div>
      </header>
      <main style={{
        position: 'relative', flex: 1, minHeight: 0,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 'clamp(10px, 1vw, 22px)',
        padding: 'clamp(12px, 1.1vw, 24px) clamp(20px, 2vw, 44px)',
        overflow: 'hidden',
      }}>
        {TEAM.map((p) => (
          <PersonColumn key={p.id} person={p} tasks={tasksByPerson[p.id] || []} scale={scale} today={today} pageSize={pageSize} />
        ))}
      </main>
      <CrewTicker crewState={crewState} nowMs={now.getTime()} />
      <footer style={{
        position: 'relative', flexShrink: 0,
        padding: 'clamp(6px, 0.6vw, 14px) clamp(28px, 2.5vw, 56px)',
        background: 'rgba(9,11,16,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: FB, color: '#a0aec0',
        fontSize: 'clamp(10px, 0.85vw, 18px)',
        letterSpacing: '0.16em', textTransform: 'uppercase',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.8)' }} />
          LIVE · {totalOpen} OPEN
        </div>
        <div style={{ color: '#fbbf24', fontFamily: FD, fontWeight: 700, letterSpacing: '0.22em' }}>
          {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
        </div>
        <div style={{ fontFamily: FM }}>ICON-OPS · TV</div>
      </footer>
    </div>
  );
}
