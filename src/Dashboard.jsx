import { useEffect, useMemo, useState } from 'react';
import { Clock, Briefcase, ListChecks, UserCheck } from 'lucide-react';
import {
  db, authReady, ref, onValue,
  timeclockDb, timeclockAuthReady,
} from './firebase';

const FB = "'Manrope', 'Segoe UI', Arial, sans-serif";
const FD = "'Oswald', 'Arial Narrow', sans-serif";
const FM = "'JetBrains Mono', 'Consolas', monospace";

const CREW = ['Luis', 'Azael', 'Oswaldo', 'Andres', 'Vicente', 'Gabriel', 'Geovanny', 'Bryan'];

const TASKS_PATH = 'commandCenter/tasks';
const TIMECLOCK_PATH = 'timeclock/entries';
const ORDERS_PATH = 'orders';

const ACCENTS = {
  amber:   { dot: '#fbbf24', text: '#fcd34d' },
  sky:     { dot: '#38bdf8', text: '#7dd3fc' },
  emerald: { dot: '#34d399', text: '#6ee7b7' },
};

const TEAM_LOOKUP = {
  robert: { name: 'ROBERT', accent: 'amber'   },
  joe:    { name: 'JOE',    accent: 'sky'     },
  bryan:  { name: 'BRYAN',  accent: 'emerald' },
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Coerce a stored timestamp (ms-epoch, sec-epoch, ISO string, or Firestore
// {seconds,nanoseconds}) into ms-since-epoch. Returns null if we can't parse.
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

const msToISODate = (ms) => {
  if (!ms) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Live-running elapsed: "2h 14m" or "47m"
const formatElapsed = (sinceMs, nowMs) => {
  if (!sinceMs) return '';
  const diffMin = Math.max(0, Math.floor((nowMs - sinceMs) / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const formatDueDate = (s) => {
  if (!s) return '';
  if (!isISODate(s)) return s;
  const d = new Date(s + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const getTaskAssignees = (task) => {
  const list = [task?.assignee, ...(Array.isArray(task?.extraAssignees) ? task.extraAssignees : [])];
  return list.filter((id, i) => id && list.indexOf(id) === i);
};

// Pick the first non-empty field on an object, by candidate keys.
const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj && obj[k];
    if (v != null && v !== '') return v;
  }
  return undefined;
};

function SectionLabel({ label, accent, Icon, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '0 4px 10px',
    }}>
      {Icon && <Icon size={14} color={accent} strokeWidth={2.5} />}
      <span style={{
        fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.22em',
        color: '#e4e4e7', fontWeight: 700, fontFamily: FB,
      }}>
        {label}
      </span>
      {typeof count === 'number' && (
        <span style={{
          fontFamily: FM, fontSize: '11px', fontWeight: 700,
          color: accent, padding: '1px 8px', borderRadius: '999px',
          background: 'rgba(251,191,36,0.10)',
          border: `1px solid ${accent}55`,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {count}
        </span>
      )}
      <div style={{ flex: 1, height: '1px', background: 'rgba(63,63,70,0.5)' }} />
    </div>
  );
}

function Card({ children, accent }) {
  return (
    <div style={{
      background: 'rgba(24,24,27,0.85)',
      border: '1px solid rgba(63,63,70,0.7)',
      borderLeft: accent ? `4px solid ${accent}` : '1px solid rgba(63,63,70,0.7)',
      borderRadius: '6px',
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: '6px',
    }}>
      {children}
    </div>
  );
}

function Panel({ children }) {
  return (
    <div style={{
      background: 'rgba(9,9,11,0.55)',
      border: '1px solid rgba(63,63,70,0.6)',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex', flexDirection: 'column',
      minHeight: 0,
    }}>
      {children}
    </div>
  );
}

function CrewStatus({ entries, now, isMobile }) {
  // entries is whatever lives at timeclock/entries — could be a single
  // map keyed by id, or nested by employee. We flatten to a list of
  // entry objects with normalized fields, then filter to "today, open".
  const flat = useMemo(() => {
    if (!entries) return [];
    const list = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      // Treat as an entry if it looks like one (has clock-in or action/timestamp)
      const looksEntry =
        node.clockIn != null || node.clockInTime != null || node.startTime != null ||
        node.timestamp != null || node.action != null;
      if (looksEntry) { list.push(node); return; }
      // Otherwise descend
      for (const k of Object.keys(node)) walk(node[k]);
    };
    walk(entries);
    return list;
  }, [entries]);

  const today = todayISO();

  const currentByName = useMemo(() => {
    const result = {};
    for (const e of flat) {
      const name = pick(e, ['name', 'employee', 'employeeName', 'userName', 'crew']);
      if (!name) continue;
      const clockInMs = tsToMs(pick(e, ['clockIn', 'clockInTime', 'startTime', 'timestamp', 'startedAt']));
      const clockOutMs = tsToMs(pick(e, ['clockOut', 'clockOutTime', 'endTime', 'endedAt']));
      const dateField = pick(e, ['date', 'dayDate']) || msToISODate(clockInMs);
      if (dateField !== today) continue;
      if (clockOutMs) continue; // already clocked out
      const job = pick(e, ['job', 'jobName', 'jobAddress', 'jobTitle', 'address', 'location', 'site', 'orderName']);
      // Keep the latest clock-in per crew member (in case of duplicate punches)
      const prior = result[name.toLowerCase()];
      if (!prior || (clockInMs || 0) > (prior.clockInMs || 0)) {
        result[name.toLowerCase()] = { name, job, clockInMs };
      }
    }
    return result;
  }, [flat, today]);

  return (
    <Panel>
      <SectionLabel label="Crew Status" accent="#34d399" Icon={UserCheck} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '10px',
      }}>
        {CREW.map((member) => {
          const status = currentByName[member.toLowerCase()];
          const isIn = !!status;
          return (
            <Card key={member} accent={isIn ? '#34d399' : 'rgba(63,63,70,0.6)'}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{
                  fontFamily: FD, fontWeight: 700, color: '#f4f4f5',
                  fontSize: '15px', letterSpacing: '0.06em',
                }}>
                  {member.toUpperCase()}
                </span>
                {isIn ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '2px 8px', borderRadius: '999px',
                    background: 'rgba(52,211,153,0.12)',
                    border: '1px solid rgba(52,211,153,0.45)',
                    color: '#34d399', fontFamily: FB, fontWeight: 700,
                    fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase',
                  }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.8)',
                    }} />
                    On the clock
                  </span>
                ) : (
                  <span style={{
                    fontFamily: FB, fontSize: '10px', color: '#71717a',
                    letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600,
                  }}>
                    Not clocked in
                  </span>
                )}
              </div>
              {isIn && (
                <>
                  <div style={{
                    fontFamily: FB, color: '#e4e4e7', fontSize: '13px',
                    fontWeight: 600, wordBreak: 'break-word',
                  }}>
                    {status.job || <span style={{ color: '#71717a', fontWeight: 500, fontStyle: 'italic' }}>No job specified</span>}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: '#a1a1aa', fontFamily: FM, fontSize: '11px',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    <Clock size={11} strokeWidth={2.4} />
                    {formatElapsed(status.clockInMs, now)} on the clock
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>
    </Panel>
  );
}

function ActiveJobsToday({ orders, isMobile }) {
  const today = todayISO();
  const todays = useMemo(() => {
    if (!orders || typeof orders !== 'object') return [];
    return Object.entries(orders)
      .map(([id, o]) => ({ id, ...(o || {}) }))
      .filter((o) => {
        const date = o.date || o.scheduledDate || o.jobDate;
        return date === today;
      });
  }, [orders, today]);

  return (
    <Panel>
      <SectionLabel
        label="Active Jobs Today"
        accent="#fbbf24"
        Icon={Briefcase}
        count={todays.length}
      />
      {todays.length === 0 ? (
        <div style={{
          padding: '20px 4px', textAlign: 'center',
          color: '#71717a', fontFamily: FB, fontSize: '13px',
        }}>
          No work orders scheduled for today.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '10px',
        }}>
          {todays.map((o) => {
            const crew = pick(o, ['crew', 'crewName', 'team', 'teamName']);
            const address = pick(o, ['address', 'jobAddress', 'siteAddress', 'location']);
            const customer = pick(o, ['customerName', 'customer', 'clientName', 'client']);
            const membersRaw = pick(o, ['assignedMembers', 'members', 'assignees', 'crewMembers']);
            const members = Array.isArray(membersRaw)
              ? membersRaw
              : (membersRaw && typeof membersRaw === 'object'
                  ? Object.values(membersRaw)
                  : (typeof membersRaw === 'string' ? membersRaw.split(',').map((s) => s.trim()).filter(Boolean) : []));
            return (
              <Card key={o.id} accent="#fbbf24">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{
                    fontFamily: FD, fontWeight: 700, color: '#fcd34d',
                    fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    {crew || 'Crew'}
                  </span>
                  {customer && (
                    <span style={{
                      fontFamily: FB, color: '#a1a1aa', fontSize: '11px',
                      fontWeight: 600, letterSpacing: '0.02em',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: '50%',
                    }}>
                      {customer}
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: FB, color: '#f4f4f5', fontSize: '14px',
                  fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word',
                }}>
                  {address || <span style={{ color: '#71717a', fontStyle: 'italic' }}>No address</span>}
                </div>
                {members.length > 0 && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '4px 6px',
                    marginTop: '2px',
                  }}>
                    {members.map((m, i) => (
                      <span key={`${m}-${i}`} style={{
                        padding: '2px 8px', borderRadius: '4px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(63,63,70,0.7)',
                        color: '#d4d4d8', fontFamily: FB,
                        fontSize: '10px', fontWeight: 600,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                      }}>
                        {String(m)}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function OfficeBoardSnapshot({ allTasks, isMobile }) {
  const today = todayISO();
  const due = useMemo(() => {
    return (allTasks || [])
      .filter((t) => (t.status || 'open') !== 'done')
      .filter((t) => isISODate(t.dueDate) && t.dueDate <= today)
      .slice()
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }, [allTasks, today]);

  return (
    <Panel>
      <SectionLabel
        label="Office Board Snapshot"
        accent="#38bdf8"
        Icon={ListChecks}
        count={due.length}
      />
      {due.length === 0 ? (
        <div style={{
          padding: '20px 4px', textAlign: 'center',
          color: '#71717a', fontFamily: FB, fontSize: '13px',
          letterSpacing: '0.04em',
        }}>
          All clear for today.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '10px',
        }}>
          {due.map((t) => {
            const overdue = t.dueDate < today;
            const dueLabel = formatDueDate(t.dueDate);
            // Render every assignee chip
            const assignees = getTaskAssignees(t);
            return (
              <Card key={t.id} accent={overdue ? '#ef4444' : '#38bdf8'}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{
                    fontFamily: FM, fontWeight: 700,
                    fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: overdue ? '#f87171' : '#7dd3fc',
                  }}>
                    {overdue ? 'Overdue' : 'Due Today'}
                  </span>
                  <span style={{
                    fontFamily: FM, fontWeight: 700, color: '#a1a1aa',
                    fontSize: '11px', letterSpacing: '0.06em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {dueLabel}
                  </span>
                </div>
                <div style={{
                  fontFamily: FB, fontWeight: 700, color: '#f4f4f5',
                  fontSize: '14px', lineHeight: 1.3, wordBreak: 'break-word',
                }}>
                  {t.title || '(Untitled task)'}
                </div>
                {t.customer && (
                  <div style={{
                    fontFamily: FB, fontWeight: 600, color: '#fbbf24',
                    fontSize: '12px', letterSpacing: '0.02em',
                    wordBreak: 'break-word',
                  }}>
                    {t.customer}
                  </div>
                )}
                {assignees.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', marginTop: '2px' }}>
                    {assignees.map((id) => {
                      const p = TEAM_LOOKUP[id];
                      if (!p) return null;
                      const acc = ACCENTS[p.accent];
                      return (
                        <span key={id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '2px 8px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.04)',
                          border: `1px solid ${acc.dot}55`,
                          color: acc.text, fontFamily: FB,
                          fontSize: '10px', fontWeight: 700,
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: acc.dot }} />
                          {p.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function CustomerPortalPlaceholder() {
  return (
    <Panel>
      <SectionLabel label="Customer Portal" accent="#a1a1aa" />
      <div style={{
        padding: '24px 4px', textAlign: 'center',
        color: '#52525b', fontFamily: FB, fontSize: '13px',
        fontStyle: 'italic', letterSpacing: '0.04em',
      }}>
        Customer Portal — coming soon
      </div>
    </Panel>
  );
}

export default function Dashboard({ allTasks, isMobile }) {
  const [entries, setEntries] = useState(null);
  const [orders, setOrders] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Live-running timer for clock-in elapsed times — every minute.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // timeclock/entries — icon-timeclock-8f75a RTDB
  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    timeclockAuthReady.then(() => {
      if (cancelled) return;
      const r = ref(timeclockDb, TIMECLOCK_PATH);
      unsub = onValue(
        r,
        (snap) => { if (!cancelled) setEntries(snap.val() || {}); },
        (err) => console.error('[dashboard] timeclock entries read failed:', err),
      );
    }).catch((err) => console.error('[dashboard] timeclock auth failed:', err));
    return () => { cancelled = true; unsub(); };
  }, []);

  // orders/ — icon-timeclock-8f75a RTDB (per spec)
  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    timeclockAuthReady.then(() => {
      if (cancelled) return;
      const r = ref(timeclockDb, ORDERS_PATH);
      unsub = onValue(
        r,
        (snap) => { if (!cancelled) setOrders(snap.val() || {}); },
        (err) => console.error('[dashboard] orders read failed:', err),
      );
    }).catch((err) => console.error('[dashboard] orders auth failed:', err));
    return () => { cancelled = true; unsub(); };
  }, []);

  // If the parent isn't already subscribed to commandCenter/tasks (defensive),
  // wire one ourselves. In practice App.js passes allTasks down, so this stays
  // dormant unless allTasks is undefined.
  const [fallbackTasks, setFallbackTasks] = useState(null);
  useEffect(() => {
    if (allTasks) return;
    let cancelled = false;
    let unsub = () => {};
    authReady.then(() => {
      if (cancelled) return;
      const r = ref(db, TASKS_PATH);
      unsub = onValue(r, (snap) => {
        if (cancelled) return;
        const data = snap.val() || {};
        setFallbackTasks(Object.entries(data).map(([id, t]) => ({ id, ...t })));
      });
    }).catch((err) => console.error('[dashboard] tasks auth failed:', err));
    return () => { cancelled = true; unsub(); };
  }, [allTasks]);

  const tasks = allTasks || fallbackTasks || [];

  return (
    <div style={{
      padding: isMobile ? '12px' : '16px 24px',
      display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px',
      minHeight: 0,
      ...(isMobile ? { overflow: 'visible' } : { overflowY: 'auto' }),
    }}>
      <CrewStatus entries={entries} now={now} isMobile={isMobile} />
      <ActiveJobsToday orders={orders} isMobile={isMobile} />
      <OfficeBoardSnapshot allTasks={tasks} isMobile={isMobile} />
      <CustomerPortalPlaceholder />
    </div>
  );
}
