import { useState, useEffect, useMemo } from 'react';
import {
  Phone, FileText, Building2, DollarSign, Hammer, ClipboardCheck,
  Plus, X, Check, Trash2, AlertTriangle, Hash, ArrowLeft, MapPin
} from 'lucide-react';
import { db, authReady, ref, onValue, set, update, remove, push } from './firebase';

const TASKS_PATH = 'commandCenter/tasks';

// ─── Team & Config ─────────────────────────────────────────────────────────────

const TEAM = [
  { id: 'robert', name: 'ROBERT', role: 'OWNER',        accent: 'amber'   },
  { id: 'joe',    name: 'JOE',    role: 'OFFICE ADMIN',  accent: 'sky'     },
  { id: 'bryan',  name: 'BRYAN',  role: 'FIELD PM',      accent: 'emerald' },
];

const ACCENTS = {
  amber:   { dot: '#fbbf24', ring: 'rgba(251,191,36,0.25)',  text: '#fcd34d' },
  sky:     { dot: '#38bdf8', ring: 'rgba(56,189,248,0.25)',  text: '#7dd3fc' },
  emerald: { dot: '#34d399', ring: 'rgba(52,211,153,0.25)',  text: '#6ee7b7' },
};

const CATEGORIES = {
  customer:   { label: 'Customer',     icon: Phone,          color: '#93c5fd', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.28)'  },
  contract:   { label: 'Contracts',    icon: FileText,       color: '#c4b5fd', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.28)'  },
  permit:     { label: 'Permits',      icon: Building2,      color: '#fdba74', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.28)'  },
  finance:    { label: 'Finance',      icon: DollarSign,     color: '#86efac', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.28)'   },
  field:      { label: 'Field Ops',    icon: Hammer,         color: '#fde047', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.28)'   },
  inspection: { label: 'Inspections',  icon: ClipboardCheck, color: '#f9a8d4', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.28)'  },
};

const PRIORITIES = {
  urgent: { label: 'URGENT', bar: '#ef4444', text: '#f87171', pulse: true  },
  high:   { label: 'HIGH',   bar: '#f59e0b', text: '#fbbf24', pulse: false },
  medium: { label: 'MEDIUM', bar: '#0ea5e9', text: '#38bdf8', pulse: false },
  low:    { label: 'LOW',    bar: '#52525b', text: '#a1a1aa', pulse: false },
};
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

// ─── Date helpers ──────────────────────────────────────────────────────────────
// We standardise on ISO date strings (YYYY-MM-DD) for new/edited tasks. Legacy
// seed strings (e.g. "Today 4:00 PM", "May 5") are tolerated for display + sort
// until each task is first edited, after which they're stored as ISO.

const todayISO = () => new Date().toISOString().split('T')[0];
const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const formatDueDate = (s) => {
  if (!s) return '';
  if (!isISODate(s)) return s; // legacy free-text
  const d = new Date(s + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const isDueToday = (s) => {
  if (isISODate(s)) return s === todayISO();
  return /today/i.test(s || '');
};

const isDueWithinNextDay = (s) => {
  if (isISODate(s)) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().split('T')[0];
    return s === todayISO() || s === tomorrowISO;
  }
  return /today|tomorrow|friday|thu/i.test(s || '');
};

const dateSortKey = (s) => isISODate(s) ? s : '9999-12-31'; // legacy sinks to bottom

// ─── Fonts ─────────────────────────────────────────────────────────────────────

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap';
const FD = "'Oswald', 'Arial Narrow', sans-serif";
const FB = "'Manrope', 'Segoe UI', Arial, sans-serif";
const FM = "'JetBrains Mono', 'Consolas', monospace";

const newSubTaskId = () => `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Sub-components ────────────────────────────────────────────────────────────

function ReturnHomeButton() {
  const [hov, setHov] = useState(false);
  return (
    <a
      id="op-center-home-btn"
      href="https://icon-operations-center.vercel.app"
      aria-label="Return to Operations Center"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: '36px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        paddingLeft: '16px',
        background: 'rgba(10,12,18,0.95)',
        border: 'none',
        borderBottom: '1px solid #C9A84C',
        color: hov ? '#E8192C' : '#ffffff',
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: FB,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        textDecoration: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'color 0.15s',
      }}
    >
      <ArrowLeft size={14} strokeWidth={2.5} />
      <span>Operations Center</span>
    </a>
  );
}

function StatBlock({ label, value, tone }) {
  const colors = { red: '#f87171', amber: '#fbbf24', zinc: '#f4f4f5', emerald: '#34d399' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 20px', borderLeft: '1px solid #27272a' }}>
      <span style={{ fontSize: '2rem', fontWeight: 700, fontFamily: FD, color: colors[tone] || '#f4f4f5', fontVariantNumeric: 'tabular-nums' }}>
        {String(value).padStart(2, '0')}
      </span>
      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', marginTop: '2px', fontFamily: FB }}>
        {label}
      </span>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <span style={{ fontSize: '2rem', fontWeight: 700, color: '#f4f4f5', fontFamily: FD, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
      </span>
      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', marginTop: '6px', fontFamily: FB }}>
        {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </span>
    </div>
  );
}

function SubTaskRow({ subTask, onToggle }) {
  const done = !!subTask.completed;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onToggle(subTask.id); }}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 8px', borderRadius: '4px', cursor: 'pointer',
        background: done ? 'rgba(52,211,153,0.06)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      <span style={{
        flexShrink: 0,
        width: '16px', height: '16px', borderRadius: '3px',
        border: `1.5px solid ${done ? '#34d399' : '#52525b'}`,
        background: done ? '#34d399' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {done && <Check size={11} color="#09090b" strokeWidth={3} />}
      </span>
      <span style={{
        fontSize: '12px', color: done ? '#71717a' : '#d4d4d8',
        textDecoration: done ? 'line-through' : 'none',
        lineHeight: 1.4, fontFamily: FB, wordBreak: 'break-word',
      }}>
        {subTask.text}
      </span>
    </div>
  );
}

function TaskCard({ task, onEdit, onComplete, onToggleSubTask, onShowNotes }) {
  const [hov, setHov] = useState(false);
  const cat = CATEGORIES[task.category];
  const pri = PRIORITIES[task.priority];
  const Icon = cat.icon;
  const isToday = isDueToday(task.dueDate);
  const subTasks = task.subTasks || [];
  const doneCount = subTasks.filter(s => s.completed).length;
  const hasNotes = !!(task.completionNotes && task.completionNotes.trim());

  return (
    <div
      onClick={() => onEdit(task)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', borderRadius: '8px', cursor: 'pointer',
        overflow: 'hidden', marginBottom: '10px',
        background: hov ? '#1c1c1f' : 'rgba(24,24,27,0.75)',
        border: `1px solid ${hov ? '#3f3f46' : '#27272a'}`,
        transition: 'all 0.15s',
        transform: hov ? 'translateY(-1px)' : 'none',
        boxShadow: hov ? '0 4px 14px rgba(0,0,0,0.35)' : 'none',
      }}
    >
      {/* Priority bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
        background: pri.bar,
        animation: pri.pulse ? 'iconPulse 2s ease-in-out infinite' : 'none',
      }} />

      <div style={{ paddingLeft: '16px', paddingRight: '12px', paddingTop: '12px', paddingBottom: '12px' }}>
        {/* Row 1: priority label + complete button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: pri.text, fontFamily: FD }}>
              {pri.label}
            </span>
            {pri.pulse && <AlertTriangle size={11} color={pri.text} />}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onComplete(task.id); }}
            title="Mark complete"
            style={{
              opacity: hov ? 1 : 0, width: '44px', height: '44px', borderRadius: '50%',
              border: '1px solid #3f3f46', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'opacity 0.15s', flexShrink: 0,
            }}
          >
            <Check size={16} color="#34d399" />
          </button>
        </div>

        {/* Title */}
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f4f4f5', lineHeight: 1.35, marginBottom: '8px', fontFamily: FB }}>
          {task.title}
        </div>

        {/* Notes badge */}
        {hasNotes && (
          <div
            onClick={(e) => { e.stopPropagation(); onShowNotes(task); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '4px',
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.32)',
              color: '#fbbf24', fontSize: '11px', fontWeight: 600, fontFamily: FB,
              marginBottom: '8px', cursor: 'pointer',
            }}
            title="View notes"
          >
            📋 Notes shared on this task — please review
          </div>
        )}

        {/* Customer */}
        {task.customer && (
          <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: task.address ? '4px' : '10px', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: FB }}>
            <Hash size={11} color="#52525b" />
            {task.customer}
          </div>
        )}

        {/* Address */}
        {task.address && (
          <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '10px', display: 'flex', alignItems: 'flex-start', gap: '5px', fontFamily: FB }}>
            <MapPin size={11} color="#52525b" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-word' }}>{task.address}</span>
          </div>
        )}

        {/* Sub tasks */}
        {subTasks.length > 0 && (
          <div style={{
            marginBottom: '10px', padding: '8px',
            background: 'rgba(9,9,11,0.55)', border: '1px solid #27272a', borderRadius: '6px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, color: '#71717a',
                textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: FB,
              }}>
                Sub Tasks
              </span>
              <span style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: FM, fontVariantNumeric: 'tabular-nums' }}>
                {doneCount} of {subTasks.length} complete
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {subTasks.map(s => (
                <SubTaskRow key={s.id} subTask={s} onToggle={(id) => onToggleSubTask(task.id, id)} />
              ))}
            </div>
          </div>
        )}

        {/* Row 3: category + due date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 7px', borderRadius: '4px',
            background: cat.bg, border: `1px solid ${cat.border}`,
            fontSize: '11px', fontWeight: 600, color: cat.color,
            letterSpacing: '0.04em', fontFamily: FB,
          }}>
            <Icon size={10} /> {cat.label}
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 700, fontFamily: FM,
            color: isToday ? '#fcd34d' : '#71717a',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {formatDueDate(task.dueDate)}
          </span>
        </div>
      </div>
    </div>
  );
}

function PersonColumn({ person, tasks, doneCount, onAdd, onEdit, onComplete, onToggleSubTask, onShowNotes, onShowDone, onFocus }) {
  const acc = ACCENTS[person.accent];
  const urgentCount = tasks.filter(t => t.priority === 'urgent').length;

  return (
    <div className="cc-column" style={{
      display: 'flex', flexDirection: 'column',
      background: '#09090b', border: '1px solid rgba(39,39,42,0.85)',
      borderRadius: '8px', overflow: 'hidden',
    }}>
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #27272a',
        background: 'linear-gradient(to bottom, #18181b, #09090b)', flexShrink: 0,
        gap: '8px',
      }}>
        <div
          onClick={onFocus}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            cursor: onFocus ? 'pointer' : 'default',
            flex: 1, minWidth: 0,
          }}
        >
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: acc.dot, boxShadow: `0 0 0 4px ${acc.ring}`,
            flexShrink: 0,
          }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#f4f4f5', fontFamily: FD, letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {person.name}
            </div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', marginTop: '4px', fontFamily: FB, whiteSpace: 'nowrap' }}>
              {person.role}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f4f4f5', fontFamily: FD, fontVariantNumeric: 'tabular-nums' }}>
              {tasks.length}
            </span>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontFamily: FB }}>
              tasks
            </span>
          </div>
          {urgentCount > 0 && (
            <span style={{
              padding: '2px 8px', background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px',
              fontSize: '11px', fontWeight: 700, color: '#f87171',
              letterSpacing: '0.05em', fontFamily: FB,
            }}>
              {urgentCount} urgent
            </span>
          )}
          <button
            onClick={() => onShowDone(person.id)}
            title="View completed tasks today"
            style={{
              padding: '4px 9px', background: 'rgba(52,211,153,0.12)',
              border: '1px solid rgba(52,211,153,0.32)', borderRadius: '4px',
              fontSize: '11px', fontWeight: 700, color: '#34d399',
              letterSpacing: '0.05em', fontFamily: FB, cursor: 'pointer',
              minHeight: '28px',
            }}
          >
            ✓ {doneCount} done
          </button>
          <button
            onClick={() => onAdd(person.id)}
            title="Add task"
            style={{
              width: '44px', height: '44px', borderRadius: '6px',
              border: '1px solid #3f3f46', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a1a1aa', flexShrink: 0,
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Task list — scrollable for TV display */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#52525b', fontSize: '13px', padding: '32px 0', fontFamily: FB }}>
            No open tasks
          </div>
        ) : (
          tasks.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              onEdit={onEdit}
              onComplete={onComplete}
              onToggleSubTask={onToggleSubTask}
              onShowNotes={onShowNotes}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Modal styles ──────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', background: '#09090b', border: '1px solid #3f3f46',
  borderRadius: '6px', padding: '12px 14px', minHeight: '44px', fontSize: '16px',
  color: '#f4f4f5', fontFamily: FB, outline: 'none', boxSizing: 'border-box',
};
const upperInputStyle = { ...inputStyle, textTransform: 'uppercase' };

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', marginBottom: '6px', fontFamily: FB }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ModalShell({ title, accent = '#3f3f46', maxWidth = '480px', onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
      padding: '16px',
    }}>
      <div style={{
        background: '#18181b', border: `1px solid ${accent}`,
        borderRadius: '10px', width: '100%', maxWidth,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#f4f4f5', fontFamily: FD, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {title}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px', padding: '8px' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Task Modal ────────────────────────────────────────────────────────────────

function TaskModal({ task, onSave, onDelete, onClose }) {
  const initialDueDate = isISODate(task.dueDate) ? task.dueDate : todayISO();
  const [form, setForm] = useState({
    ...task,
    dueDate: initialDueDate,
    address: task.address || '',
    subTasks: task.subTasks || [],
    completionNotes: task.completionNotes || '',
  });
  const isNew = !task.id;
  const canSave = (form.title || '').trim().length > 0;

  const addSubTask = () => setForm(f => ({
    ...f,
    subTasks: [...f.subTasks, { id: newSubTaskId(), text: '', completed: false }],
  }));
  const updateSubTask = (id, text) => setForm(f => ({
    ...f,
    subTasks: f.subTasks.map(s => s.id === id ? { ...s, text } : s),
  }));
  const removeSubTask = (id) => setForm(f => ({
    ...f,
    subTasks: f.subTasks.filter(s => s.id !== id),
  }));

  const submit = () => {
    if (!canSave) return;
    const cleaned = {
      ...form,
      title: (form.title || '').toUpperCase(),
      customer: (form.customer || '').toUpperCase(),
      address: (form.address || '').toUpperCase(),
      completionNotes: (form.completionNotes || '').toUpperCase(),
      subTasks: (form.subTasks || [])
        .filter(s => (s.text || '').trim().length > 0)
        .map(s => ({ ...s, text: s.text.toUpperCase() })),
    };
    onSave(cleaned);
  };

  return (
    <ModalShell title={isNew ? 'New Task' : 'Edit Task'} onClose={onClose}>
      {/* Fields */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Task">
          <input
            type="text" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="WHAT NEEDS TO BE DONE?"
            spellCheck={true}
            style={upperInputStyle}
          />
        </Field>
        <Field label="Customer / Job">
          <input
            type="text" value={form.customer}
            onChange={e => setForm({ ...form, customer: e.target.value })}
            placeholder="E.G. SMITH — MAPLE ST (OR INTERNAL)"
            spellCheck={true}
            style={upperInputStyle}
          />
        </Field>
        <Field label="Address">
          <input
            type="text" value={form.address || ''}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="E.G. 412 MAPLE ST, PLEASANTVILLE NY"
            spellCheck={true}
            style={upperInputStyle}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Assigned To">
            <select value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} style={inputStyle}>
              {TEAM.map(p => <option key={p.id} value={p.id}>{p.name[0] + p.name.slice(1).toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inputStyle}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Category">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Due">
            <input
              type="date"
              value={form.dueDate || todayISO()}
              defaultValue={todayISO()}
              onChange={e => setForm({ ...form, dueDate: e.target.value })}
              style={inputStyle}
            />
          </Field>
        </div>

        {/* Notes for Task Completion */}
        <Field label="Notes for Task Completion">
          <textarea
            value={form.completionNotes || ''}
            onChange={e => setForm({ ...form, completionNotes: e.target.value })}
            placeholder="ADD ANY NOTES, INSTRUCTIONS, OR INFORMATION NEEDED TO COMPLETE THIS TASK..."
            spellCheck={true}
            rows={4}
            style={{
              ...upperInputStyle,
              minHeight: '110px',
              resize: 'vertical',
              fontFamily: FB,
              lineHeight: 1.4,
            }}
          />
        </Field>

        {/* Sub Tasks */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', fontFamily: FB }}>
              Sub Tasks
            </span>
            <span style={{ fontSize: '11px', color: '#52525b', fontFamily: FM }}>
              {form.subTasks.length} added
            </span>
          </div>
          {form.subTasks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              {form.subTasks.map((s, idx) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="text"
                    value={s.text}
                    onChange={e => updateSubTask(s.id, e.target.value)}
                    placeholder={`SUB TASK #${idx + 1}`}
                    spellCheck={true}
                    style={{ ...upperInputStyle, padding: '10px 12px', minHeight: '40px', fontSize: '14px' }}
                  />
                  <button
                    onClick={() => removeSubTask(s.id)}
                    title="Remove sub task"
                    style={{
                      flexShrink: 0, width: '40px', height: '40px',
                      background: 'transparent', border: '1px solid #3f3f46',
                      borderRadius: '6px', cursor: 'pointer', color: '#f87171',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={addSubTask}
            style={{
              width: '100%', padding: '10px 14px', minHeight: '40px',
              background: 'rgba(56,189,248,0.08)', border: '1px dashed rgba(56,189,248,0.4)',
              borderRadius: '6px', cursor: 'pointer',
              color: '#7dd3fc', fontSize: '13px', fontWeight: 600,
              fontFamily: FB, letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <Plus size={14} /> Add Sub Task
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #27272a', flexWrap: 'wrap', gap: '8px' }}>
        {!isNew ? (
          <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '8px 12px', fontFamily: FB }}>
            <Trash2 size={14} /> Delete
          </button>
        ) : <div />}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ padding: '12px 16px', minHeight: '44px', background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: '14px', fontWeight: 600, fontFamily: FB }}>
            Cancel
          </button>
          <button
            onClick={submit}
            style={{
              padding: '12px 20px', minHeight: '44px',
              background: canSave ? '#f59e0b' : '#27272a',
              border: 'none', borderRadius: '6px',
              cursor: canSave ? 'pointer' : 'not-allowed',
              color: canSave ? '#09090b' : '#52525b',
              fontSize: '14px', fontWeight: 700,
              letterSpacing: '0.06em', fontFamily: FB,
            }}
          >
            {isNew ? 'CREATE TASK' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Notes Modal ───────────────────────────────────────────────────────────────

function NotesModal({ task, onClose }) {
  return (
    <ModalShell title="Task Notes" accent="rgba(245,158,11,0.5)" maxWidth="520px" onClose={onClose}>
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#fbbf24', marginBottom: '6px', fontFamily: FB }}>
          Task
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', fontFamily: FB, marginBottom: '14px', lineHeight: 1.4 }}>
          {task.title}
        </div>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', marginBottom: '6px', fontFamily: FB }}>
          Notes
        </div>
        <div style={{
          fontSize: '13px', color: '#d4d4d8', fontFamily: FB,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6,
          background: '#09090b', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '6px', padding: '12px',
        }}>
          {task.completionNotes}
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Completed Tasks Modal ─────────────────────────────────────────────────────

function CompletedTasksModal({ person, completedToday, onClose }) {
  const todayLabel = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <ModalShell title={`${person.name}'s Completed Tasks — ${todayLabel}`} accent="rgba(52,211,153,0.4)" maxWidth="520px" onClose={onClose}>
      <div style={{ padding: '20px' }}>
        {completedToday.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#52525b', fontSize: '13px', padding: '24px 0', fontFamily: FB }}>
            No tasks completed today
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {completedToday.map(t => {
              const time = new Date(t.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
              return (
                <div key={`${t.id}-${t.completedAt}`} style={{
                  background: 'rgba(9,9,11,0.6)', border: '1px solid #27272a',
                  borderRadius: '6px', padding: '10px 12px',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5', fontFamily: FB, marginBottom: '4px', lineHeight: 1.3 }}>
                    {t.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#71717a', fontFamily: FB }}>
                    <span>{t.customer}</span>
                    <span style={{ fontFamily: FM, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
                      {time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function IconCommandCenter() {
  // Single source of truth — every task in commandCenter/tasks/{id}, with
  // status: 'open' | 'done'. Open tasks render in columns; done tasks are
  // surfaced through the per-person Done Today modal.
  const [allTasks, setAllTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingNotes, setViewingNotes] = useState(null);
  const [viewingDoneFor, setViewingDoneFor] = useState(null);
  const [flash, setFlash] = useState(null);
  const [focusedPerson, setFocusedPerson] = useState(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  // ── Firebase subscription ────────────────────────────────────────────────
  // Wait for anonymous auth, then keep allTasks live-synced from RTDB.
  // The cancelled flag protects against the auth promise resolving after
  // the component unmounts.
  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    authReady.then(() => {
      if (cancelled) return;
      const tasksRef = ref(db, TASKS_PATH);
      unsub = onValue(
        tasksRef,
        (snap) => {
          if (cancelled) return;
          const data = snap.val() || {};
          const list = Object.entries(data).map(([id, t]) => ({ id, ...t }));
          setAllTasks(list);
          setLoadError(false);
          setLoaded(true);
        },
        (err) => {
          if (cancelled) return;
          console.error('[command-center] tasks read FAILED:', err);
          setLoadError(true);
          setLoaded(true);
        }
      );
    }).catch((err) => {
      if (cancelled) return;
      console.error('[command-center] auth not ready:', err);
      setLoadError(true);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Load fonts + inject keyframe animations
  useEffect(() => {
    const link = document.createElement('link');
    link.href = FONT_LINK;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes iconPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      @keyframes iconDot   { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      @keyframes ccFlashIn {
        0%   { transform: translate(-50%, -8px); opacity: 0; }
        15%  { transform: translate(-50%, 0);    opacity: 1; }
        85%  { transform: translate(-50%, 0);    opacity: 1; }
        100% { transform: translate(-50%, -8px); opacity: 0; }
      }
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 2px; }
      html, body { margin: 0; padding: 0; height: 100%; background: #080c12; }

      /* Native date input — invert calendar icon for dark theme */
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }

      @media (max-width: 768px) {
        .cc-main {
          display: flex !important;
          flex-direction: row !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          gap: 12px !important;
          padding: 12px !important;
        }
        .cc-column {
          min-width: 85vw;
          flex: 0 0 85vw;
          scroll-snap-align: start;
        }
        .cc-main.cc-focused {
          flex-direction: column !important;
          overflow-x: hidden !important;
        }
        .cc-main.cc-focused .cc-column {
          min-width: 100% !important;
          flex: 1 1 auto !important;
          min-height: 0;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      try { document.head.removeChild(link); }  catch (e) {}
      try { document.head.removeChild(style); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isMobile) setFocusedPerson(null);
  }, [isMobile]);

  // ── Derived: open vs. done ───────────────────────────────────────────────
  // Tasks without an explicit status default to 'open' for backward compat
  // with anything written before this schema was finalised.
  const openTasks = useMemo(
    () => allTasks.filter(t => (t.status || 'open') === 'open'),
    [allTasks]
  );
  const doneTasks = useMemo(
    () => allTasks.filter(t => t.status === 'done'),
    [allTasks]
  );

  // Stats
  const stats = useMemo(() => ({
    urgent: openTasks.filter(t => t.priority === 'urgent').length,
    today:  openTasks.filter(t => isDueWithinNextDay(t.dueDate)).length,
    total:  openTasks.length,
  }), [openTasks]);

  const doneTodayTotal = useMemo(() => {
    const today = todayISO();
    return doneTasks.filter(t => (t.completedAt || '').split('T')[0] === today).length;
  }, [doneTasks]);

  // Group + sort open tasks by person — primary: priority rank, secondary: due date asc
  const tasksByPerson = useMemo(() => {
    return TEAM.reduce((acc, p) => {
      acc[p.id] = openTasks
        .filter(t => t.assignee === p.id)
        .slice()
        .sort((a, b) => {
          const pdiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          if (pdiff !== 0) return pdiff;
          return dateSortKey(a.dueDate).localeCompare(dateSortKey(b.dueDate));
        });
      return acc;
    }, {});
  }, [openTasks]);

  // Per-person completed-today list, ordered by completion time desc
  const completedTodayByPerson = useMemo(() => {
    const today = todayISO();
    return TEAM.reduce((acc, p) => {
      acc[p.id] = doneTasks
        .filter(t => t.assignee === p.id && (t.completedAt || '').split('T')[0] === today)
        .slice()
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
      return acc;
    }, {});
  }, [doneTasks]);

  const showFlash = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  };

  // ── Firebase write handlers ──────────────────────────────────────────────
  const handleSave = (form) => {
    if (form.id) {
      // Edit existing — update at the keyed path. id stays in the document
      // for client convenience but is also the key.
      const { id, ...rest } = form;
      update(ref(db, `${TASKS_PATH}/${id}`), rest)
        .catch((e) => console.error('[command-center] save failed:', e));
    } else {
      // New task — let RTDB generate the key, then write the full record.
      const newRef = push(ref(db, TASKS_PATH));
      const record = {
        ...form,
        id: newRef.key,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      set(newRef, record)
        .catch((e) => console.error('[command-center] create failed:', e));
    }
    setEditing(null);
  };

  const handleDelete = (id) => {
    remove(ref(db, `${TASKS_PATH}/${id}`))
      .catch((e) => console.error('[command-center] delete failed:', e));
    setEditing(null);
  };

  const handleComplete = (id) => {
    update(ref(db, `${TASKS_PATH}/${id}`), {
      status: 'done',
      completedAt: new Date().toISOString(),
    }).catch((e) => console.error('[command-center] complete failed:', e));
  };

  const handleToggleSubTask = (taskId, subTaskId) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task || !task.subTasks) return;
    const wasAllComplete = task.subTasks.length > 0 && task.subTasks.every(s => s.completed);
    const nextSubTasks = task.subTasks.map(s =>
      s.id === subTaskId ? { ...s, completed: !s.completed } : s
    );
    const isAllComplete = nextSubTasks.length > 0 && nextSubTasks.every(s => s.completed);

    const patch = { subTasks: nextSubTasks };
    if (!wasAllComplete && isAllComplete) {
      patch.status = 'done';
      patch.completedAt = new Date().toISOString();
      showFlash('✓ All sub tasks complete!');
    }
    update(ref(db, `${TASKS_PATH}/${taskId}`), patch)
      .catch((e) => console.error('[command-center] subtask toggle failed:', e));
  };

  const handleAdd = (assignee) => setEditing({
    title: '', customer: '', address: '',
    assignee: assignee || 'robert',
    category: 'customer', priority: 'medium',
    dueDate: todayISO(),
    subTasks: [], completionNotes: '',
  });

  // ── Loading / error gate ────────────────────────────────────────────────
  if (!loaded) {
    return (
      <>
        <ReturnHomeButton />
        <div style={{
          minHeight: 'calc(100vh - 36px)', height: 'calc(100vh - 36px)',
          background: 'linear-gradient(145deg, #0d1218, #080c12, #141b22)',
          color: '#a1a1aa', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: '12px',
          fontFamily: FB,
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            border: '3px solid #27272a', borderTopColor: '#fbbf24',
            animation: 'ccSpin 0.9s linear infinite',
          }} />
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a' }}>
            Connecting to Firebase…
          </div>
          <style>{`@keyframes ccSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <ReturnHomeButton />
        <div style={{
          minHeight: 'calc(100vh - 36px)', height: 'calc(100vh - 36px)',
          background: 'linear-gradient(145deg, #0d1218, #080c12, #141b22)',
          color: '#f4f4f5', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: '12px',
          fontFamily: FB, padding: '24px', textAlign: 'center',
        }}>
          <AlertTriangle size={32} color="#f87171" />
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#f4f4f5', fontFamily: FD, letterSpacing: '0.04em' }}>
            COULD NOT CONNECT TO DATABASE
          </div>
          <div style={{ fontSize: '13px', color: '#a1a1aa', maxWidth: '380px', lineHeight: 1.5 }}>
            Check your connection and reload the page. Tasks may be temporarily unavailable.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    <ReturnHomeButton />
    <div style={{
      minHeight: 'calc(100vh - 36px)', height: 'calc(100vh - 36px)', overflow: 'hidden',
      background: 'linear-gradient(145deg, #0d1218, #080c12, #141b22)',
      color: '#f4f4f5', display: 'flex', flexDirection: 'column',
      fontFamily: FB, position: 'relative',
    }}>
      {/* Blueprint grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.025,
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── HEADER ── */}
      <header style={{
        position: 'relative', borderBottom: '1px solid #27272a',
        background: 'linear-gradient(to bottom, #18181b, #09090b)', flexShrink: 0,
      }}>
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>

          {/* Brand mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', background: '#fbbf24', flexShrink: 0,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#09090b', fontWeight: 700, fontSize: '24px', fontFamily: FD }}>I</span>
            </div>
            <div>
              <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#f4f4f5', letterSpacing: '0.04em', fontFamily: FD, lineHeight: 1 }}>
                ICON REMODELING GROUP
              </div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(251,191,36,0.85)', marginTop: '5px', fontFamily: FB }}>
                Operations Command Center
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <StatBlock label="Urgent"     value={stats.urgent}   tone="red"     />
            <StatBlock label="Due Soon"   value={stats.today}    tone="amber"   />
            <StatBlock label="Total Open" value={stats.total}    tone="zinc"    />
            <StatBlock label="Done Today" value={doneTodayTotal} tone="emerald" />
          </div>

          {/* Live clock */}
          <LiveClock />
        </div>
      </header>

      {/* ── 3-COLUMN MAIN ── */}
      <main
        className={`cc-main ${focusedPerson && isMobile ? 'cc-focused' : ''}`}
        style={{
          position: 'relative', flex: 1, minHeight: 0,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '16px', padding: '16px 24px', overflow: 'hidden',
        }}
      >
        {focusedPerson && isMobile && (
          <button
            onClick={() => setFocusedPerson(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '12px 16px', minHeight: '44px', alignSelf: 'flex-start', flexShrink: 0,
              background: 'rgba(24,24,27,0.95)', border: '1px solid #3f3f46',
              borderRadius: '6px', color: '#f4f4f5', cursor: 'pointer',
              fontSize: '14px', fontWeight: 700, fontFamily: FB,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
          </button>
        )}
        {TEAM
          .filter(p => !(focusedPerson && isMobile) || focusedPerson === p.id)
          .map(person => (
            <PersonColumn
              key={person.id}
              person={person}
              tasks={tasksByPerson[person.id] || []}
              doneCount={(completedTodayByPerson[person.id] || []).length}
              onAdd={handleAdd}
              onEdit={setEditing}
              onComplete={handleComplete}
              onToggleSubTask={handleToggleSubTask}
              onShowNotes={setViewingNotes}
              onShowDone={setViewingDoneFor}
              onFocus={isMobile ? () => setFocusedPerson(person.id) : undefined}
            />
          ))}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{
        position: 'relative', borderTop: '1px solid #27272a',
        background: 'rgba(9,9,11,0.6)', padding: '9px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '12px', color: '#71717a', fontFamily: FB, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', animation: 'iconDot 2s ease-in-out infinite' }} />
          Live · Auto-syncs across all devices
        </div>
        <div>Tap any card to edit · Hover to complete · + to add</div>
        <div style={{ fontFamily: FM }}>v1.1 · ICON-OPS</div>
      </footer>

      {/* ── FLOATING ADD BUTTON (mobile) ── */}
      <button
        onClick={() => handleAdd()}
        title="New task"
        style={{
          position: 'fixed', bottom: '68px', right: '16px',
          width: '56px', height: '56px', borderRadius: '50%',
          background: '#fbbf24', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          zIndex: 40,
        }}
      >
        <Plus size={24} strokeWidth={3} color="#09090b" />
      </button>

      {/* ── FLASH ── */}
      {flash && (
        <div style={{
          position: 'fixed', top: '64px', left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 22px', borderRadius: '999px',
          background: 'linear-gradient(135deg, #34d399, #10b981)',
          color: '#052e1c', fontWeight: 800, fontSize: '14px',
          letterSpacing: '0.04em', fontFamily: FB,
          boxShadow: '0 12px 40px rgba(16,185,129,0.45)',
          zIndex: 80,
          animation: 'ccFlashIn 1.8s ease forwards',
        }}>
          {flash}
        </div>
      )}

      {/* ── MODALS ── */}
      {editing && (
        <TaskModal
          task={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}

      {viewingNotes && (
        <NotesModal
          task={viewingNotes}
          onClose={() => setViewingNotes(null)}
        />
      )}

      {viewingDoneFor && (
        <CompletedTasksModal
          person={TEAM.find(p => p.id === viewingDoneFor)}
          completedToday={completedTodayByPerson[viewingDoneFor] || []}
          onClose={() => setViewingDoneFor(null)}
        />
      )}

    </div>
    </>
  );
}
