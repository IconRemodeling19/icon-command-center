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
  if (count <= 5)  return { tier: 'L', title: 'clamp(18px, 2.2vw, 44px)', customer: 'clamp(13px, 1.5vw, 30px)', meta:  'clamp(11px, 1.1vw, 22px)', cardPad: 'clamp(12px, 1.1vw, 22px)', cardGap: 'clamp(10px, 0.9vw, 18px)', colHeader: 'clamp(28px, 3.6vw, 72px)' };
  if (count <= 10) return { tier: 'M', title: 'clamp(15px, 1.8vw, 36px)', customer: 'clamp(11px, 1.25vw, 26px)', meta: 'clamp(10px, 0.95vw, 20px)', cardPad: 'clamp(10px, 0.9vw, 18px)', cardGap: 'clamp(8px, 0.7vw, 14px)',  colHeader: 'clamp(24px, 3vw, 60px)' };
  if (count <= 15) return { tier: 'S', title: 'clamp(13px, 1.5vw, 30px)', customer: 'clamp(10px, 1.1vw, 22px)',  meta: 'clamp(9px, 0.85vw, 18px)',  cardPad: 'clamp(8px, 0.75vw, 14px)', cardGap: 'clamp(6px, 0.55vw, 12px)', colHeader: 'clamp(22px, 2.6vw, 52px)' };
  return                { tier: 'XS', title: 'clamp(11px, 1.2vw, 24px)', customer: 'clamp(9px, 0.95vw, 18px)', meta: 'clamp(8px, 0.75vw, 16px)',  cardPad: 'clamp(6px, 0.6vw, 12px)',  cardGap: 'clamp(4px, 0.4vw, 9px)',   colHeader: 'clamp(20px, 2.2vw, 44px)' };
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
  // Amber bracket — two thin bars meeting at the corner.
  const size = 'clamp(18px, 2vw, 40px)';
  const thick = '2px';
  const color = '#fbbf24';
  const base = { position: 'absolute', pointerEvents: 'none' };
  const horiz = { ...base, width: size, height: thick, background: color };
  const vert  = { ...base, width: thick, height: size, background: color };
  if (pos === 'tl') return (<>
    <div style={{ ...horiz, top: 8, left: 8 }} />
    <div style={{ ...vert,  top: 8, left: 8 }} />
  </>);
  if (pos === 'tr') return (<>
    <div style={{ ...horiz, top: 8, right: 8 }} />
    <div style={{ ...vert,  top: 8, right: 8 }} />
  </>);
  if (pos === 'bl') return (<>
    <div style={{ ...horiz, bottom: 8, left: 8 }} />
    <div style={{ ...vert,  bottom: 8, left: 8 }} />
  </>);
  return (<>
    <div style={{ ...horiz, bottom: 8, right: 8 }} />
    <div style={{ ...vert,  bottom: 8, right: 8 }} />
  </>);
}

function TaskCard({ task, scale }) {
  const pri = PRIORITIES[task.priority] || PRIORITIES.medium;
  const due = formatDueDate(task.dueDate);
  return (
    <div style={{
      position: 'relative',
      background: 'rgba(24,24,27,0.85)',
      border: '1px solid rgba(63,63,70,0.7)',
      borderLeft: `4px solid ${pri.color}`,
      borderRadius: '6px',
      padding: scale.cardPad,
      display: 'flex', flexDirection: 'column',
      gap: `calc(${scale.cardGap} * 0.6)`,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{
          padding: '2px 10px', borderRadius: '3px',
          background: pri.bg, border: `1px solid ${pri.border}`,
          color: pri.color, fontFamily: FD, fontWeight: 700,
          fontSize: scale.meta, letterSpacing: '0.18em', whiteSpace: 'nowrap',
        }}>
          {pri.label}
        </span>
        {due && (
          <span style={{
            fontFamily: FM, fontWeight: 700,
            color: due === 'TODAY' ? '#fcd34d' : '#a1a1aa',
            fontSize: scale.meta, letterSpacing: '0.06em',
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}>
            {due}
          </span>
        )}
      </div>
      <div style={{
        fontFamily: FB, fontWeight: 700, color: '#f4f4f5',
        fontSize: scale.title, lineHeight: 1.2,
        wordBreak: 'break-word',
      }}>
        {task.title}
      </div>
      {task.customer && (
        <div style={{
          fontFamily: FB, fontWeight: 600, color: '#fbbf24',
          fontSize: scale.customer, letterSpacing: '0.02em',
          lineHeight: 1.25, wordBreak: 'break-word',
        }}>
          {task.customer}
        </div>
      )}
      {(() => {
        const subCount = Array.isArray(task.subTasks) ? task.subTasks.length : 0;
        const summary = (task.subTaskSummary || '').trim();
        if (!summary && subCount === 0) return null;
        const text = summary
          ? `↳ ${summary}`
          : `↳ ${subCount} sub-task${subCount === 1 ? '' : 's'} pending`;
        return (
          <div style={{
            fontFamily: FB, fontStyle: 'italic', fontWeight: 500,
            color: '#a1a1aa',
            fontSize: scale.customer,
            lineHeight: 1.3, wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {text}
          </div>
        );
      })()}
    </div>
  );
}

function PersonColumn({ person, tasks, scale }) {
  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(9,9,11,0.55)',
      border: `1px solid ${person.accentSoft}`,
      borderTop: `3px solid ${person.accent}`,
      borderRadius: '8px',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* Column header */}
      <div style={{
        flexShrink: 0,
        padding: 'clamp(10px, 1vw, 22px) clamp(14px, 1.2vw, 28px)',
        borderBottom: `1px solid ${person.accentSoft}`,
        background: 'linear-gradient(to bottom, rgba(24,24,27,0.95), rgba(9,9,11,0.95))',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div style={{
          fontFamily: FD, fontWeight: 700, color: person.accent,
          fontSize: scale.colHeader, letterSpacing: '0.08em', lineHeight: 1,
        }}>
          {person.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{
            fontFamily: FD, fontWeight: 700, color: '#f4f4f5',
            fontSize: `calc(${scale.colHeader} * 0.7)`, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {tasks.length}
          </span>
          <span style={{
            fontFamily: FB, fontWeight: 600, color: '#71717a',
            fontSize: scale.meta, letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>
            {tasks.length === 1 ? 'TASK' : 'TASKS'}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: 'clamp(8px, 0.8vw, 18px)',
        display: 'flex', flexDirection: 'column',
        gap: scale.cardGap,
      }}>
        {tasks.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#52525b', fontFamily: FD, fontWeight: 600,
            fontSize: scale.title, letterSpacing: '0.18em', textAlign: 'center',
          }}>
            ALL CLEAR
          </div>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} scale={scale} />)
        )}
      </div>
    </div>
  );
}

export default function TV() {
  const [allTasks, setAllTasks] = useState([]);
  const [now, setNow] = useState(new Date());

  // Load fonts once
  useEffect(() => {
    const link = document.createElement('link');
    link.href = FONT_LINK;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.textContent = `
      html, body, #root { margin: 0; padding: 0; height: 100%; background: #090B10; overflow: hidden; }
      *, *::before, *::after { box-sizing: border-box; }
      ::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);
    return () => {
      try { document.head.removeChild(link);  } catch (e) { /* noop */ }
      try { document.head.removeChild(style); } catch (e) { /* noop */ }
    };
  }, []);

  // Date footer — refresh once a minute (clock has its own 1s ticker)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Subscribe to RTDB after anonymous auth
  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    authReady.then(() => {
      if (cancelled) return;
      const tasksRef = ref(db, TASKS_PATH);
      unsub = onValue(tasksRef, (snap) => {
        if (cancelled) return;
        const data = snap.val() || {};
        setAllTasks(Object.entries(data).map(([id, t]) => ({ id, ...t })));
      }, (err) => {
        console.error('[TV] tasks read failed:', err);
      });
    }).catch((err) => console.error('[TV] auth failed:', err));
    return () => { cancelled = true; unsub(); };
  }, []);

  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (e) {
        console.error('[TV] Wake lock failed:', e);
      }
    };
    requestWakeLock();
    // Re-acquire wake lock when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  const openTasks = useMemo(
    () => allTasks.filter((t) => (t.status || 'open') !== 'done'),
    [allTasks]
  );

  const tasksByPerson = useMemo(() => {
    const sortFn = (a, b) => {
      const pdiff = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (pdiff !== 0) return pdiff;
      return dateSortKey(a.dueDate).localeCompare(dateSortKey(b.dueDate));
    };
    return TEAM.reduce((acc, p) => {
      acc[p.id] = openTasks.filter((t) => t.assignee === p.id).slice().sort(sortFn);
      return acc;
    }, {});
  }, [openTasks]);

  const totalOpen = openTasks.length;
  const scale = useMemo(() => scaleFor(totalOpen), [totalOpen]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(145deg, #0d1218, #090B10, #141b22)',
      color: '#f4f4f5', fontFamily: FB,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Blueprint grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
        backgroundImage:
          'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Amber corner accents */}
      <CornerAccent pos="tl" />
      <CornerAccent pos="tr" />
      <CornerAccent pos="bl" />
      <CornerAccent pos="br" />

      {/* HEADER */}
      <header style={{
        position: 'relative', flexShrink: 0,
        padding: 'clamp(14px, 1.4vw, 32px) clamp(28px, 2.5vw, 56px)',
        borderBottom: '1px solid rgba(251,191,36,0.25)',
        background: 'linear-gradient(to bottom, rgba(24,24,27,0.85), rgba(9,11,16,0.85))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 1.4vw, 28px)', minWidth: 0 }}>
          <div style={{
            width: 'clamp(40px, 3.4vw, 80px)', height: 'clamp(40px, 3.4vw, 80px)',
            background: '#fbbf24',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{
              color: '#09090b', fontFamily: FD, fontWeight: 700,
              fontSize: 'clamp(20px, 1.8vw, 44px)',
            }}>I</span>
          </div>
          <div style={{
            fontFamily: FD, fontWeight: 700, color: '#f4f4f5',
            fontSize: 'clamp(18px, 2vw, 48px)',
            letterSpacing: '0.06em', lineHeight: 1.05,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            ICON REMODELING GROUP
            <span style={{ color: 'rgba(251,191,36,0.85)', margin: '0 0.4em' }}>—</span>
            OPERATIONS COMMAND CENTER
          </div>
        </div>
        <LiveClock />
      </header>

      {/* COLUMNS */}
      <main style={{
        position: 'relative', flex: 1, minHeight: 0,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 'clamp(10px, 1vw, 22px)',
        padding: 'clamp(12px, 1.1vw, 24px) clamp(20px, 2vw, 44px)',
        overflow: 'hidden',
      }}>
        {TEAM.map((p) => (
          <PersonColumn
            key={p.id}
            person={p}
            tasks={tasksByPerson[p.id] || []}
            scale={scale}
          />
        ))}
      </main>

      {/* FOOTER */}
      <footer style={{
        position: 'relative', flexShrink: 0,
        padding: 'clamp(8px, 0.8vw, 18px) clamp(28px, 2.5vw, 56px)',
        borderTop: '1px solid rgba(251,191,36,0.25)',
        background: 'rgba(9,11,16,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: FB, color: '#71717a',
        fontSize: 'clamp(11px, 0.95vw, 20px)',
        letterSpacing: '0.16em', textTransform: 'uppercase',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.8)',
          }} />
          LIVE · {totalOpen} OPEN
        </div>
        <div style={{
          color: '#fbbf24', fontFamily: FD, fontWeight: 700,
          letterSpacing: '0.22em',
        }}>
          {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
        </div>
        <div style={{ fontFamily: FM }}>ICON-OPS · TV</div>
      </footer>
    </div>
  );
}
