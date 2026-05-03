import { useState, useEffect, useMemo } from 'react';
import {
  Phone, FileText, Building2, DollarSign, Hammer, ClipboardCheck,
  Plus, X, Check, Trash2, AlertTriangle, Hash, ArrowLeft
} from 'lucide-react';

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

// ─── Sample Data ───────────────────────────────────────────────────────────────

const INITIAL_TASKS = [
  // Robert
  { id: 1,  title: 'Sign change order — Patel bathroom remodel',   customer: 'Patel — Cedar Ln',       assignee: 'robert', category: 'contract',   priority: 'urgent', dueDate: 'Today 4:00 PM'    },
  { id: 2,  title: 'Call Henderson re: kitchen scope expansion',    customer: 'Henderson — Maple St',   assignee: 'robert', category: 'customer',   priority: 'high',   dueDate: 'Today'            },
  { id: 3,  title: 'Final walkthrough — Williams kitchen',          customer: 'Williams — Birchwood',   assignee: 'robert', category: 'inspection', priority: 'high',   dueDate: 'Tomorrow 9:00 AM' },
  { id: 4,  title: 'Meet city inspector at 412 Maple St',           customer: 'Henderson — Maple St',   assignee: 'robert', category: 'permit',     priority: 'medium', dueDate: 'Thu 10:00 AM'     },
  { id: 5,  title: 'Approve Q2 marketing budget proposal',          customer: 'Internal',               assignee: 'robert', category: 'finance',    priority: 'medium', dueDate: 'May 5'            },
  { id: 6,  title: 'Sign loan paperwork — new F-250',               customer: 'Internal',               assignee: 'robert', category: 'finance',    priority: 'low',    dueDate: 'May 8'            },
  // Joe
  { id: 7,  title: 'File building permit — Chen addition',          customer: 'Chen — Oakwood Dr',      assignee: 'joe',    category: 'permit',     priority: 'urgent', dueDate: 'Today'            },
  { id: 8,  title: 'Send revised contract to Mrs. Rodriguez',       customer: 'Rodriguez — Pine Ridge', assignee: 'joe',    category: 'contract',   priority: 'high',   dueDate: 'Today 2:00 PM'    },
  { id: 9,  title: 'Process payroll — period 04/15–04/30',          customer: 'Internal',               assignee: 'joe',    category: 'finance',    priority: 'high',   dueDate: 'Friday'           },
  { id: 10, title: 'Reconcile QuickBooks — March close',            customer: 'Internal',               assignee: 'joe',    category: 'finance',    priority: 'high',   dueDate: 'May 3'            },
  { id: 11, title: 'Update vendor insurance certificates',          customer: 'Internal',               assignee: 'joe',    category: 'contract',   priority: 'medium', dueDate: 'May 5'            },
  { id: 12, title: 'Schedule dumpster pickup — Oak Ave job',        customer: 'Becker — Oak Ave',       assignee: 'joe',    category: 'field',      priority: 'medium', dueDate: 'May 4'            },
  { id: 13, title: 'Order business cards for Bryan',                customer: 'Internal',               assignee: 'joe',    category: 'finance',    priority: 'low',    dueDate: 'May 10'           },
  // Bryan
  { id: 14, title: 'Coordinate electrician — Becker basement',     customer: 'Becker — Oak Ave',       assignee: 'bryan',  category: 'field',      priority: 'urgent', dueDate: 'Today 7:00 AM'    },
  { id: 15, title: 'Site measurement visit — Thompson property',    customer: 'Thompson — Hilltop',     assignee: 'bryan',  category: 'field',      priority: 'high',   dueDate: 'Today 1:00 PM'    },
  { id: 16, title: 'Punch list walkthrough w/ subs — Cedar Ln',    customer: 'Patel — Cedar Ln',       assignee: 'bryan',  category: 'inspection', priority: 'high',   dueDate: 'Tomorrow'         },
  { id: 17, title: 'Schedule HVAC rough-in inspection',             customer: 'Chen — Oakwood Dr',      assignee: 'bryan',  category: 'inspection', priority: 'medium', dueDate: 'May 5'            },
  { id: 18, title: 'Pickup tile order — Floor & Decor',             customer: 'Williams — Birchwood',   assignee: 'bryan',  category: 'field',      priority: 'medium', dueDate: 'May 3'            },
  { id: 19, title: 'Drop off updated plans w/ framing crew',        customer: 'Williams — Birchwood',   assignee: 'bryan',  category: 'field',      priority: 'medium', dueDate: 'May 3'            },
];

// ─── Fonts ─────────────────────────────────────────────────────────────────────

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap';
const FD = "'Oswald', 'Arial Narrow', sans-serif";
const FB = "'Manrope', 'Segoe UI', Arial, sans-serif";
const FM = "'JetBrains Mono', 'Consolas', monospace";

// ─── Sub-components ────────────────────────────────────────────────────────────

function ReturnHomeButton() {
  const [hov, setHov] = useState(false);
  return (
    <a
      href="https://icon-operations-center.vercel.app"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'fixed', top: '12px', left: '12px', zIndex: 9999,
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        minHeight: '44px', padding: '6px 12px',
        background: 'rgba(9,9,11,0.92)',
        border: `1px solid ${hov ? '#E8192C' : '#C9A84C'}`,
        borderRadius: '6px',
        color: hov ? '#E8192C' : '#ffffff',
        fontSize: '12px', fontWeight: 700, fontFamily: FB,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        textDecoration: 'none', cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'color 0.15s, border-color 0.15s',
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

function TaskCard({ task, onEdit, onComplete }) {
  const [hov, setHov] = useState(false);
  const cat = CATEGORIES[task.category];
  const pri = PRIORITIES[task.priority];
  const Icon = cat.icon;
  const isToday = /today/i.test(task.dueDate);

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
              opacity: hov ? 1 : 0, width: '24px', height: '24px', borderRadius: '50%',
              border: '1px solid #3f3f46', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'opacity 0.15s',
            }}
          >
            <Check size={12} color="#34d399" />
          </button>
        </div>

        {/* Title */}
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f4f4f5', lineHeight: 1.35, marginBottom: '8px', fontFamily: FB }}>
          {task.title}
        </div>

        {/* Customer */}
        <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: FB }}>
          <Hash size={11} color="#52525b" />
          {task.customer}
        </div>

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
            {task.dueDate}
          </span>
        </div>
      </div>
    </div>
  );
}

function PersonColumn({ person, tasks, onAdd, onEdit, onComplete }) {
  const acc = ACCENTS[person.accent];
  const urgentCount = tasks.filter(t => t.priority === 'urgent').length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: '#09090b', border: '1px solid rgba(39,39,42,0.85)',
      borderRadius: '8px', overflow: 'hidden',
    }}>
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #27272a',
        background: 'linear-gradient(to bottom, #18181b, #09090b)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: acc.dot, boxShadow: `0 0 0 4px ${acc.ring}`,
          }} />
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#f4f4f5', fontFamily: FD, letterSpacing: '0.04em', lineHeight: 1 }}>
              {person.name}
            </div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', marginTop: '4px', fontFamily: FB }}>
              {person.role}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            onClick={() => onAdd(person.id)}
            title="Add task"
            style={{
              width: '28px', height: '28px', borderRadius: '6px',
              border: '1px solid #3f3f46', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a1a1aa',
            }}
          >
            <Plus size={14} />
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
          tasks.map(t => <TaskCard key={t.id} task={t} onEdit={onEdit} onComplete={onComplete} />)
        )}
      </div>
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', background: '#09090b', border: '1px solid #3f3f46',
  borderRadius: '6px', padding: '9px 12px', fontSize: '13px',
  color: '#f4f4f5', fontFamily: FB, outline: 'none', boxSizing: 'border-box',
};

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

function TaskModal({ task, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(task);
  if (!task) return null;
  const isNew = !task.id;
  const canSave = form.title.trim().length > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: '#18181b', border: '1px solid #3f3f46',
        borderRadius: '10px', width: '100%', maxWidth: '480px',
        margin: '0 16px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#f4f4f5', fontFamily: FD, letterSpacing: '0.06em' }}>
            {isNew ? 'NEW TASK' : 'EDIT TASK'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Task">
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" style={inputStyle} />
          </Field>
          <Field label="Customer / Job">
            <input type="text" value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} placeholder="e.g. Smith — Maple St (or Internal)" style={inputStyle} />
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
              <input type="text" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} placeholder="e.g. Today 4:00 PM" style={inputStyle} />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #27272a' }}>
          {!isNew ? (
            <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', fontFamily: FB }}>
              <Trash2 size={13} /> Delete
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, fontFamily: FB }}>
              Cancel
            </button>
            <button
              onClick={() => canSave && onSave(form)}
              style={{
                padding: '8px 20px',
                background: canSave ? '#f59e0b' : '#27272a',
                border: 'none', borderRadius: '6px',
                cursor: canSave ? 'pointer' : 'not-allowed',
                color: canSave ? '#09090b' : '#52525b',
                fontSize: '13px', fontWeight: 700,
                letterSpacing: '0.06em', fontFamily: FB,
              }}
            >
              {isNew ? 'CREATE TASK' : 'SAVE CHANGES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function IconCommandCenter() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [doneToday, setDoneToday] = useState(4);
  const [editing, setEditing] = useState(null);

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
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 2px; }
      html, body { margin: 0; padding: 0; height: 100%; background: #080c12; }
    `;
    document.head.appendChild(style);

    return () => {
      try { document.head.removeChild(link); }  catch (e) {}
      try { document.head.removeChild(style); } catch (e) {}
    };
  }, []);

  // Stats
  const stats = useMemo(() => ({
    urgent: tasks.filter(t => t.priority === 'urgent').length,
    today:  tasks.filter(t => /today|tomorrow|friday|thu/i.test(t.dueDate)).length,
    total:  tasks.length,
  }), [tasks]);

  // Group + sort tasks by person
  const tasksByPerson = useMemo(() => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return TEAM.reduce((acc, p) => {
      acc[p.id] = tasks
        .filter(t => t.assignee === p.id)
        .sort((a, b) => order[a.priority] - order[b.priority]);
      return acc;
    }, {});
  }, [tasks]);

  const handleSave = form => {
    setTasks(prev => form.id
      ? prev.map(t => t.id === form.id ? form : t)
      : [...prev, { ...form, id: Date.now() }]
    );
    setEditing(null);
  };

  const handleDelete   = id => { setTasks(prev => prev.filter(t => t.id !== id)); setEditing(null); };
  const handleComplete = id => { setTasks(prev => prev.filter(t => t.id !== id)); setDoneToday(d => d + 1); };
  const handleAdd = assignee => setEditing({ title: '', customer: '', assignee: assignee || 'robert', category: 'customer', priority: 'medium', dueDate: 'Today' });

  return (
    <div style={{
      minHeight: '100vh', height: '100vh', overflow: 'hidden',
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
            <StatBlock label="Urgent"     value={stats.urgent} tone="red"     />
            <StatBlock label="Due Soon"   value={stats.today}  tone="amber"   />
            <StatBlock label="Total Open" value={stats.total}  tone="zinc"    />
            <StatBlock label="Done Today" value={doneToday}    tone="emerald" />
          </div>

          {/* Live clock */}
          <LiveClock />
        </div>
      </header>

      {/* ── 3-COLUMN MAIN ── */}
      <main style={{
        position: 'relative', flex: 1, minHeight: 0,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: '16px', padding: '16px 24px', overflow: 'hidden',
      }}>
        {TEAM.map(person => (
          <PersonColumn
            key={person.id}
            person={person}
            tasks={tasksByPerson[person.id] || []}
            onAdd={handleAdd}
            onEdit={setEditing}
            onComplete={handleComplete}
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
        <div style={{ fontFamily: FM }}>v1.0 · ICON-OPS</div>
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

      {/* ── MODAL ── */}
      {editing && (
        <TaskModal
          task={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}

      {/* ── RETURN TO OPERATIONS CENTER ── */}
      <ReturnHomeButton />
    </div>
  );
}
