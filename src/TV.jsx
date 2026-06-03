import { useEffect, useMemo, useState } from 'react';
import { db, authReady, ref, onValue } from './firebase';


const TASKS_PATH = 'commandCenter/tasks';


const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap';
const FD = "'Oswald', 'Arial Narrow', sans-serif";
const FB = "'Manrope', 'Segoe UI', Arial, sans-serif";
const FM = "'JetBrains Mono', 'Consolas', monospace";


const TEAM = [
  { id: 'robert', name: 'ROB',   accent: '#fbbf24', accentSoft: 'rgba(251,191,36,0.2)' },
  { id: 'joe',    name: 'JOE',   accent: '#38bdf8', accentSoft: 'rgba(56,189,248,0.2)' },
  { id: 'bryan',  name: 'BRYAN', accent: '#34d399', accentSoft: 'rgba(52,211,153,0.2)' },
];


const PRIORITIES = {
  urgent: { label: 'URGENT', color: '#ef4444', bg: 'rgba(239,68,68,0.18)',  border: 'rgba(239,68,68,0.55)' },
  high:   { label: 'HIGH',   color: '#f59e0b', bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.55)' },
  medium: { label: 'MEDIUM', color: '#ffffff', bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.40)' },
  low:    { label: 'LOW',    color: '#a1a1aa', bg: 'rgba(161,161,170,0.10)', border: 'rgba(161,161,170,0.40)' },
};
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };


const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const dateSortKey = (s) => (isISODate(s) ? s : '9999-12-31');


// Multi-assign: full assignee list = primary + extras. Mirrors App.js helper.
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


// Four scale tiers driven by total open task count across all three people.
// Each tier returns a set of CSS clamp() strings so every text element on
// the wall scales together — no scrollbars, no truncation logic needed.
const scaleFor = (count) => {
  if (count <= 5)  return { tier:'L',  title:'clamp(20px,2.4vw,64px)',  customer:'clamp(15px,1.7vw,40px)', meta:'clamp(12px,1.2vw,26px)', cardPad:'clamp(14px,1.3vw,28px)', cardGap:'clamp(12px,1vw,22px)',  colHeader:'clamp(32px,4vw,96px)'  };
  if (count <= 10) return { tier:'M',  title:'clamp(17px,2vw,52px)',    customer:'clamp(13px,1.4vw,34px)', meta:'clamp(11px,1vw,22px)',  cardPad:'clamp(11px,1vw,22px)',  cardGap:'clamp(9px,0.8vw,18px)', colHeader:'clamp(28px,3.4vw,80px)' };
  if (count <= 15) return { tier:'S',  title:'clamp(15px,1.7vw,42px)',  customer:'clamp(11px,1.2vw,28px)', meta:'clamp(10px,0.9vw,20px)', cardPad:'clamp(9px,0.85vw,18px)', cardGap:'clamp(7px,0.6vw,14px)', colHeader:'clamp(25px,2.9vw,68px)' };
  return               { tier:'XS', title:'clamp(13px,1.4vw,34px)',  customer:'clamp(10px,1vw,22px)',   meta:'clamp(9px,0.8vw,18px)',  cardPad:'clamp(7px,0.7vw,14px)', cardGap:'clamp(5px,0.45vw,10px)', colHeader:'clamp(22px,2.5vw,56px)' };
};


function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      fontFamily: FD, fontWeight: 700, color: '#f4f4f5',
      fontSize: 'clamp(22px, 2.4vw, 56px)',
      letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums',
      lineHeight: 1,
    }}>
      {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
    </div>
  );
}


function CornerAccent({ pos }) {
