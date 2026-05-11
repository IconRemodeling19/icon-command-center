import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Phone, FileText, Building2, DollarSign, Hammer, ClipboardCheck,
  Plus, X, Check, Trash2, AlertTriangle, Hash, ArrowLeft, MapPin,
  ChevronLeft, ChevronRight, ChevronDown, Edit2, Paperclip, Upload, Calendar,
  ClipboardList, Users,
} from 'lucide-react';
import {
  db, authReady, ref, onValue, get, set, update, remove, push,
  storage, storageRef, uploadBytes, getDownloadURL, deleteObject,
} from './firebase';

const TASKS_PATH = 'commandCenter/tasks';
const ESTIMATES_PATH = 'estimates';
const ESTIMATES_STORAGE_BASE = 'commandCenter/estimates';
const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB per file

// Reuse the Maps Places key already deployed in icon-work-orders.
// We inject the script tag dynamically (no public/index.html change required).
const GOOGLE_API_KEY = 'AIzaSyDP9N998QacTADs3UaDYBohltD3rfflMmE';

const RESIDENTIAL_TYPES = [
  'Kitchen Remodel', 'Bathroom Remodel', 'Basement Remodel / Finish',
  'Interior Renovation', 'Exterior Renovation', 'Home Addition',
  'New Home Build', 'Whole House Renovation', 'Painting', 'Flooring',
  'Roofing', 'Siding', 'Windows & Doors', 'Deck / Porch / Patio',
  'Masonry / Concrete', 'Drywall / Plaster', 'Trim / Carpentry',
  'Structural Work', 'Garage Renovation / Addition', 'Laundry / Mudroom',
  'Outdoor Living', 'Water / Fire Damage Repair', 'Insurance Restoration',
  'Handyman / Small Repair', 'Punch List Work',
  'Pre-Sale / Move-In Improvements', 'Other / General Estimate',
];
const COMMERCIAL_TYPES = [
  'Tenant Build-Out', 'White Box / Vanilla Box', 'Office Renovation',
  'Retail Build-Out', 'Restaurant / Food Service Build-Out',
  'Medical / Dental Office Build-Out', 'Commercial Bathroom Renovation',
  'Commercial Kitchen Work', 'Flooring', 'Painting',
  'Drywall / Partitions', 'Doors / Hardware', 'Storefront / Exterior',
  'Ceiling / ACT Grid', 'Electrical Coordination', 'Plumbing Coordination',
  'HVAC Coordination', 'Fire / Life Safety Work', 'ADA Compliance Work',
  'Landlord Work', 'Tenant Work', 'Demolition',
  'Warehouse / Storage Area', 'Maintenance / Repair Work',
  'Punch List / Closeout Work', 'Permit / Code Correction Work',
  'Other / General Commercial Estimate',
];
const OTHER_RESIDENTIAL = 'Other / General Estimate';
const OTHER_COMMERCIAL  = 'Other / General Commercial Estimate';

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
  customer:      { label: 'Customer',           icon: Phone,          color: '#93c5fd', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.28)'  },
  contract:      { label: 'Contracts',          icon: FileText,       color: '#c4b5fd', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.28)'  },
  permit:        { label: 'Permits',            icon: Building2,      color: '#fdba74', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.28)'  },
  finance:       { label: 'Finance',            icon: DollarSign,     color: '#86efac', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.28)'   },
  field:         { label: 'Field Ops',          icon: Hammer,         color: '#fde047', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.28)'   },
  inspection:    { label: 'Inspections',        icon: ClipboardCheck, color: '#f9a8d4', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.28)'  },
  icon_internal: { label: 'ICON - INTERNAL',    icon: Hash,           color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.28)'  },
  internal:      { label: 'INTERNAL',           icon: AlertTriangle,  color: '#cbd5e1', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.28)' },
  followup:      { label: 'FOLLOW UP',          icon: Calendar,       color: '#67e8f9', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.28)'   },
  revision:      { label: 'REVISION REQUESTED', icon: Edit2,          color: '#fda4af', bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.28)'   },
  staff:         { label: 'EMPLOYEE / STAFF',   icon: Users,          color: '#5eead4', bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.28)'  },
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

// Multi-assign: a task's full assignee list is task.assignee plus extraAssignees.
// Legacy tasks without extraAssignees behave exactly as before.
const getAssignees = (task) => {
  const list = [task?.assignee, ...(Array.isArray(task?.extraAssignees) ? task.extraAssignees : [])];
  return list.filter((id, i) => id && list.indexOf(id) === i);
};

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
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORIES[task.category] || CATEGORIES.customer;
  const pri = PRIORITIES[task.priority] || PRIORITIES.medium;
  const Icon = cat.icon;
  const isToday = isDueToday(task.dueDate);
  const subTasks = task.subTasks || [];
  const doneCount = subTasks.filter(s => s.completed).length;
  const hasNotes = !!(task.completionNotes && task.completionNotes.trim());

  return (
    <div
      onClick={() => setExpanded(e => !e)}
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
        {/* Row 1: priority label + complete + edit + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: pri.text, fontFamily: FD }}>
              {pri.label}
            </span>
            {pri.pulse && <AlertTriangle size={11} color={pri.text} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); onComplete(task.id); }}
              title="Mark complete"
              style={{
                opacity: hov ? 1 : 0, width: '36px', height: '36px', borderRadius: '50%',
                border: '1px solid #3f3f46', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'opacity 0.15s', flexShrink: 0,
              }}
            >
              <Check size={14} color="#34d399" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onEdit(task); }}
              title="Edit task"
              style={{
                opacity: hov ? 1 : 0, width: '36px', height: '36px', borderRadius: '50%',
                border: '1px solid #3f3f46', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'opacity 0.15s', flexShrink: 0,
              }}
            >
              <Edit2 size={14} color="#a1a1aa" />
            </button>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '20px', height: '20px', color: '#71717a',
              transition: 'transform 0.18s ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
              <ChevronDown size={14} />
            </span>
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#f4f4f5', lineHeight: 1.35, marginBottom: '8px', fontFamily: FB }}>
          {task.title}
        </div>

        {/* Notes pill (always shown when notes exist) */}
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
            📋 Notes — please review
          </div>
        )}

        {/* Notes full text — expanded only */}
        {expanded && hasNotes && (
          <div style={{
            fontSize: '12px', color: '#d4d4d8', lineHeight: 1.5, fontFamily: FB,
            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)',
            borderRadius: '6px', padding: '8px 10px', marginBottom: '10px',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {task.completionNotes}
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

        {/* Sub-tasks: collapsed → summary; expanded → full checklist */}
        {subTasks.length > 0 && !expanded && (
          <div style={{
            marginBottom: '10px', padding: '8px',
            background: 'rgba(9,9,11,0.55)', border: '1px solid #27272a', borderRadius: '6px',
          }}>
            <div style={{
              fontSize: '10px', fontWeight: 700, color: '#71717a',
              textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: FB,
              marginBottom: '6px',
            }}>
              Sub-Task Summary
            </div>
            <div style={{
              fontSize: '12px', color: '#d4d4d8', lineHeight: 1.4, fontFamily: FB,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {task.subTaskSummary || `↳ ${subTasks.length} sub-task${subTasks.length === 1 ? '' : 's'}`}
            </div>
          </div>
        )}
        {subTasks.length > 0 && expanded && (
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

function PersonColumn({
  person, tasks, doneCount,
  onAdd, onQuickAdd, onEdit, onComplete, onToggleSubTask, onShowNotes, onShowDone, onFocus,
  headerToggleButton, bodyOverride, isMobile,
}) {
  const acc = ACCENTS[person.accent];
  const urgentCount = tasks.filter(t => t.priority === 'urgent').length;

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const quickInputRef = useRef(null);

  useEffect(() => {
    if (quickOpen && quickInputRef.current) quickInputRef.current.focus();
  }, [quickOpen]);

  const submitQuick = () => {
    const trimmed = quickText.trim();
    if (!trimmed) { setQuickOpen(false); setQuickText(''); return; }
    if (onQuickAdd) onQuickAdd(person.id, trimmed);
    setQuickText('');
    setQuickOpen(false);
  };
  const cancelQuick = () => { setQuickText(''); setQuickOpen(false); };

  return (
    <div className="cc-column" style={{
      display: 'flex', flexDirection: 'column',
      height: isMobile ? 'auto' : '100%', minHeight: 0,
      background: '#09090b', border: '1px solid rgba(39,39,42,0.85)',
      borderRadius: '8px', overflow: isMobile ? 'visible' : 'hidden',
    }}>
      {/* Quick Task row — always at the top, above the column header */}
      {quickOpen ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 10px', borderBottom: '1px solid #27272a',
          background: 'rgba(245,158,11,0.08)', flexShrink: 0,
        }}>
          <input
            ref={quickInputRef}
            type="text"
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submitQuick(); }
              else if (e.key === 'Escape') { e.preventDefault(); cancelQuick(); }
            }}
            placeholder="Add Quick Data Now, Add Detail ASAP!"
            spellCheck={true}
            style={{
              flex: 1, minWidth: 0, minHeight: '36px', padding: '8px 10px',
              background: '#09090b', border: '1px solid #fbbf24',
              borderRadius: '6px', color: '#f4f4f5',
              fontFamily: FB, fontSize: '13px', outline: 'none',
            }}
          />
          <button
            type="button" onClick={submitQuick} title="Save"
            style={{
              minWidth: '36px', minHeight: '36px',
              background: 'rgba(245,158,11,0.18)', border: '1px solid #fbbf24',
              borderRadius: '6px', color: '#fbbf24', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Check size={16} />
          </button>
          <button
            type="button" onClick={cancelQuick} title="Cancel"
            style={{
              minWidth: '36px', minHeight: '36px',
              background: 'transparent', border: '1px solid #3f3f46',
              borderRadius: '6px', color: '#a1a1aa', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          title="Quick add task"
          style={{
            width: '100%', minHeight: '36px',
            padding: '8px 12px',
            background: 'rgba(245,158,11,0.08)',
            border: 'none', borderBottom: '1px solid rgba(245,158,11,0.25)',
            color: '#fbbf24', fontFamily: FB, fontSize: '12px',
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          + Quick Task
        </button>
      )}

      {/* Column header */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '10px',
        padding: '12px 16px', borderBottom: '1px solid #27272a',
        background: 'linear-gradient(to bottom, #18181b, #09090b)', flexShrink: 0,
      }}>
        {/* Row 1: dot + name/role · task count · add button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#f4f4f5', fontFamily: FD, letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {person.name}
              </div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', marginTop: '4px', fontFamily: FB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {person.role}
              </div>
            </div>
          </div>
          {headerToggleButton}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f4f4f5', fontFamily: FD, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {tasks.length}
            </span>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#71717a', fontFamily: FB }}>
              tasks
            </span>
          </div>
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

        {/* Row 2: status badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
        </div>
      </div>

      {/* Body — task list by default, or a caller-supplied override (used for Rob's estimates view) */}
      {bodyOverride ? (
        bodyOverride
      ) : (
        <div style={{
          flex: 1, minHeight: 0,
          overflowY: isMobile ? 'visible' : 'auto',
          WebkitOverflowScrolling: 'touch', padding: '12px',
        }}>
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
      )}
    </div>
  );
}

// ─── Estimates: Google Places autocomplete ─────────────────────────────────────
// Loads the Maps JS once globally on mount. Pattern adapted from icon-work-orders.

let _mapsLoading = null;
function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.maps?.places) return Promise.resolve(true);
  if (_mapsLoading) return _mapsLoading;

  // Bootstrap then importLibrary('places') — bootstrap.onload fires before
  // the dynamically-injected places.js finishes loading, so we MUST wait on
  // importLibrary (returns a Promise) before treating the API as ready.
  const importPlaces = () => {
    if (!window.google?.maps?.importLibrary) return Promise.resolve(false);
    return window.google.maps.importLibrary('places')
      .then(() => true)
      .catch((e) => { console.error('[Maps] importLibrary("places") failed:', e); return false; });
  };

  _mapsLoading = new Promise((resolve) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    const onReady = () => importPlaces().then(resolve);
    if (existing) {
      if (window.google?.maps?.importLibrary) { onReady(); return; }
      existing.addEventListener('load', onReady);
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const sc = document.createElement('script');
    sc.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&loading=async`;
    sc.async = true;
    sc.defer = true;
    sc.onload = onReady;
    sc.onerror = () => resolve(false);
    document.head.appendChild(sc);
  }).then((ok) => {
    // Retry-on-failure: a `false` resolution (script error, importLibrary
    // failed, missing window.google) shouldn't poison the cache forever.
    // Clearing _mapsLoading here lets the next caller try again from scratch.
    if (!ok) _mapsLoading = null;
    return ok;
  });
  return _mapsLoading;
}

function AddressInput({ value, onChange, placeholder, style }) {
  const [loaded, setLoaded] = useState(false);
  const [token, setToken] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null); // viewport coords for the dropdown
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { loadGoogleMaps().then(setLoaded); }, []);
  useEffect(() => {
    if (loaded && window.google?.maps?.places) {
      try { setToken(new window.google.maps.places.AutocompleteSessionToken()); }
      catch (e) { console.error('[Maps]', e); }
    }
  }, [loaded]);

  // Click-outside handler closes the suggestion list.
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Tear down any pending debounce on unmount so we don't fire after the
  // modal closes.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Track the input's viewport rect while the dropdown is visible. The
  // dropdown is rendered with position:fixed so a modal's overflow:auto
  // body can't clip it. Capture-phase scroll listener catches scroll events
  // from any nested scroll container (e.g. ModalShell's body).
  useEffect(() => {
    if (!open || suggestions.length === 0) return;
    const update = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAnchor({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, suggestions.length]);

  const fetchSuggestions = useCallback((input) => {
    if (!loaded || !input || input.length < 3) { setSuggestions([]); return; }
    try {
      new window.google.maps.places.AutocompleteService().getPlacePredictions(
        { input, types: ['address'], componentRestrictions: { country: 'us' }, sessionToken: token },
        (preds, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && preds) {
            setSuggestions(preds.map((p) => ({ description: p.description })));
            setOpen(true);
          } else {
            setSuggestions([]);
          }
        }
      );
    } catch (e) { console.error('[Maps]', e); }
  }, [loaded, token]);

  const handleChange = (e) => {
    onChange(e);
    const v = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  };

  const select = (desc) => {
    onChange({ target: { value: desc } });
    setSuggestions([]); setOpen(false);
    if (loaded && window.google?.maps?.places) {
      try { setToken(new window.google.maps.places.AutocompleteSessionToken()); }
      catch (e) { console.error('[Maps]', e); }
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        spellCheck={true}
        style={style}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && anchor && (
        <div style={{
          position: 'fixed',
          top: anchor.top, left: anchor.left, width: anchor.width,
          zIndex: 70,
          background: '#0d0d10', border: '1px solid #3f3f46',
          borderRadius: '6px', maxHeight: '240px', overflowY: 'auto',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        }}>
          {suggestions.map((s, i) => (
            <button
              key={`${s.description}-${i}`}
              type="button"
              onClick={() => select(s.description)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 12px', background: 'transparent', border: 'none',
                borderBottom: i < suggestions.length - 1 ? '1px solid #1f1f23' : 'none',
                cursor: 'pointer', color: '#e4e4e7',
                fontFamily: FB, fontSize: '14px', textTransform: 'uppercase',
                letterSpacing: '0.02em',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,158,11,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <MapPin size={12} color="#71717a" />
              <span>{s.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Estimates: helpers ────────────────────────────────────────────────────────

const estimateBlank = (id) => ({
  id,
  customerName: '', address: '', estimateDate: todayISO(),
  hasDeadline: 'no', deadlineDate: '',
  referredBy: '', notes: '',
  blueprints: { blueprints: false, designPlans: false, other: false },
  workType: 'residential', workDetail: '', customWorkDetail: '',
  attachments: [], completed: false,
});

const deadlineTone = (estimate) => {
  if (estimate.hasDeadline !== 'yes' || !isISODate(estimate.deadlineDate)) return null;
  const d = new Date(estimate.deadlineDate + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86400000);
  return days <= 7 ? 'red' : 'amber';
};

const estimateBlueprintsLabel = (bp) => {
  if (!bp) return '';
  const parts = [];
  if (bp.blueprints) parts.push('Blueprints');
  if (bp.designPlans) parts.push('Design Plans');
  if (bp.other) parts.push('Other');
  return parts.join(' · ');
};

// ─── Estimates: card ───────────────────────────────────────────────────────────

function EstimateCard({ estimate, archived, onToggleComplete, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const tone = deadlineTone(estimate);
  const blueprintLine = estimateBlueprintsLabel(estimate.blueprints);
  const attachCount = (estimate.attachments || []).length;
  const dim = archived ? 0.55 : 1;
  const workLabel = estimate.workDetail === OTHER_RESIDENTIAL || estimate.workDetail === OTHER_COMMERCIAL
    ? (estimate.customWorkDetail || estimate.workDetail)
    : estimate.workDetail;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        opacity: dim,
        background: archived ? 'rgba(24,24,27,0.55)' : (hov ? '#1c1c1f' : 'rgba(24,24,27,0.85)'),
        border: `1px solid ${hov ? '#3f3f46' : '#27272a'}`,
        borderLeft: `3px solid ${archived ? '#3f3f46' : '#fbbf24'}`,
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '10px',
        transition: 'opacity 0.25s, background 0.15s, transform 0.25s',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}
    >
      {/* Top row: customer + actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '15px', fontWeight: 700, color: '#f4f4f5',
            fontFamily: FB, lineHeight: 1.25, wordBreak: 'break-word',
          }}>
            {estimate.customerName || '(NO NAME)'}
          </div>
          {estimate.revisionNotes && (
            <div style={{
              marginTop: '4px',
              fontSize: '12px', color: '#fcd34d', fontFamily: FB,
              lineHeight: 1.35, wordBreak: 'break-word',
            }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: '6px' }}>
                Revision:
              </span>
              {estimate.revisionNotes}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {!archived && (
            <button
              onClick={() => onToggleComplete(estimate)}
              title="Mark complete"
              style={{
                width: '36px', height: '36px', borderRadius: '6px',
                border: '1px solid #3f3f46', background: 'transparent',
                cursor: 'pointer', color: '#34d399',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Check size={16} />
            </button>
          )}
          <button
            onClick={() => onEdit(estimate)}
            title={archived ? 'Edit (or revise)' : 'Edit estimate'}
            style={{
              width: '36px', height: '36px', borderRadius: '6px',
              border: '1px solid #3f3f46', background: 'transparent',
              cursor: 'pointer', color: '#a1a1aa',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(estimate)}
            title="Delete estimate"
            style={{
              width: '36px', height: '36px', borderRadius: '6px',
              border: '1px solid #3f3f46', background: 'transparent',
              cursor: 'pointer', color: '#f87171',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {estimate.address && (
        <div style={{ fontSize: '12px', color: '#a1a1aa', display: 'flex', gap: '6px', alignItems: 'flex-start', fontFamily: FB }}>
          <MapPin size={11} color="#52525b" style={{ marginTop: '2px', flexShrink: 0 }} />
          <span style={{ wordBreak: 'break-word' }}>{estimate.address}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
        {estimate.estimateDate && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)',
            color: '#fcd34d', fontSize: '11px', fontWeight: 700, fontFamily: FB,
            letterSpacing: '0.04em',
          }}>
            <Calendar size={10} />
            {formatDueDate(estimate.estimateDate) || estimate.estimateDate}
          </span>
        )}
        {workLabel && (
          <span style={{
            padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.30)',
            color: '#a5b4fc', fontSize: '11px', fontWeight: 600, fontFamily: FB,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {(estimate.workType || '').toUpperCase()} · {workLabel.toUpperCase()}
          </span>
        )}
        {tone && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '4px',
            background: tone === 'red' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            border: `1px solid ${tone === 'red' ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.45)'}`,
            color: tone === 'red' ? '#f87171' : '#fbbf24',
            fontSize: '11px', fontWeight: 700, fontFamily: FB, letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            <AlertTriangle size={10} />
            DEADLINE {formatDueDate(estimate.deadlineDate) || estimate.deadlineDate}
          </span>
        )}
        {estimate.revisionNotes && (
          <span style={{
            padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.45)',
            color: '#fcd34d', fontSize: '11px', fontWeight: 700, fontFamily: FB,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Revision
          </span>
        )}
        {blueprintLine && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.30)',
            color: '#7dd3fc', fontSize: '11px', fontWeight: 600, fontFamily: FB,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <FileText size={10} />
            {blueprintLine}
          </span>
        )}
        {attachCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(161,161,170,0.10)', border: '1px solid rgba(161,161,170,0.30)',
            color: '#d4d4d8', fontSize: '11px', fontWeight: 600, fontFamily: FB,
            letterSpacing: '0.04em',
          }}>
            <Paperclip size={10} />
            {attachCount} {attachCount === 1 ? 'FILE' : 'FILES'}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Estimates: list view (renders inside Rob's column body) ───────────────────

function EstimatesView({ estimates, onAdd, onEdit, onEditArchived, onToggleComplete, onDelete }) {
  const active = useMemo(
    () => estimates.filter((e) => !e.completed)
      .slice()
      .sort((a, b) => dateSortKey(a.estimateDate).localeCompare(dateSortKey(b.estimateDate))),
    [estimates]
  );
  const archived = useMemo(
    () => estimates.filter((e) => !!e.completed)
      .slice()
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
    [estimates]
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px' }}>
      <button
        onClick={onAdd}
        style={{
          width: '100%', padding: '10px 14px', minHeight: '44px',
          marginBottom: '12px',
          background: 'rgba(245,158,11,0.10)', border: '1px dashed rgba(245,158,11,0.45)',
          borderRadius: '6px', cursor: 'pointer',
          color: '#fbbf24', fontFamily: FB, fontWeight: 700, fontSize: '13px',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}
      >
        <Plus size={14} /> New Estimate
      </button>

      <SectionLabel label={`Active Estimates (${active.length})`} accent="#fbbf24" />
      {active.length === 0 ? (
        <div style={{
          textAlign: 'center', color: '#52525b', fontSize: '12px',
          padding: '20px 0', fontFamily: FB, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          No active estimates
        </div>
      ) : (
        active.map((e) => (
          <EstimateCard
            key={e.id}
            estimate={e}
            archived={false}
            onToggleComplete={onToggleComplete}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}

      <div style={{ height: '1px', background: '#27272a', margin: '20px 0 14px' }} />
      <SectionLabel label={`Completed Estimates (${archived.length})`} accent="#52525b" />
      {archived.length === 0 ? (
        <div style={{
          textAlign: 'center', color: '#3f3f46', fontSize: '12px',
          padding: '12px 0', fontFamily: FB, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Archive empty
        </div>
      ) : (
        archived.map((e) => (
          <EstimateCard
            key={e.id}
            estimate={e}
            archived={true}
            onEdit={onEditArchived}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}

function SectionLabel({ label, accent }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      marginBottom: '10px',
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: accent }} />
      <span style={{
        fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.22em',
        color: '#a1a1aa', fontWeight: 700, fontFamily: FB,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'rgba(63,63,70,0.5)' }} />
    </div>
  );
}

// ─── Estimates: revision prompt (small modal) ──────────────────────────────────

function RevisionPromptModal({ estimate, onAnswer, onClose }) {
  return (
    <ModalShell title="Edit Archived Estimate" accent="rgba(245,158,11,0.5)" maxWidth="420px" onClose={onClose}>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ color: '#e4e4e7', fontSize: '14px', fontFamily: FB, lineHeight: 1.5 }}>
          Is this a revision to an estimate already sent to{' '}
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>
            {(estimate.customerName || 'this customer').toUpperCase()}
          </span>?
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onAnswer(false)}
            style={{
              flex: 1, minWidth: '120px', padding: '12px 16px', minHeight: '44px',
              background: 'transparent', border: '1px solid #3f3f46',
              borderRadius: '6px', cursor: 'pointer',
              color: '#d4d4d8', fontFamily: FB, fontWeight: 700, fontSize: '13px',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            No — Just Edit
          </button>
          <button
            onClick={() => onAnswer(true)}
            style={{
              flex: 1, minWidth: '120px', padding: '12px 16px', minHeight: '44px',
              background: '#f59e0b', border: 'none',
              borderRadius: '6px', cursor: 'pointer',
              color: '#09090b', fontFamily: FB, fontWeight: 700, fontSize: '13px',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            Yes — Revision
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Estimates: full add / edit modal ──────────────────────────────────────────

function EstimateModal({ estimate, isRevision, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(() => ({
    ...estimateBlank(estimate.id),
    ...estimate,
    blueprints: { blueprints: false, designPlans: false, other: false, ...(estimate.blueprints || {}) },
    attachments: estimate.attachments || [],
    revisionNotes: estimate.revisionNotes || '',
  }));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef(null);
  const isNew = !estimate.persisted; // persisted=true means it's an existing record being edited
  const canSave = (form.customerName || '').trim().length > 0;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setBlueprint = (k, v) => setForm((f) => ({
    ...f, blueprints: { ...f.blueprints, [k]: v },
  }));

  const typeList = form.workType === 'commercial' ? COMMERCIAL_TYPES : RESIDENTIAL_TYPES;
  const otherSentinel = form.workType === 'commercial' ? OTHER_COMMERCIAL : OTHER_RESIDENTIAL;
  const showCustomDetail = form.workDetail === otherSentinel;

  const onPickFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploadError('');
    setUploading(true);
    try {
      const newAttachments = [];
      for (const file of Array.from(files)) {
        if (file.size > ATTACHMENT_MAX_BYTES) {
          setUploadError(`"${file.name}" exceeds 20 MB.`);
          continue;
        }
        const safe = file.name.replace(/[^\w.-]+/g, '_');
        const path = `${ESTIMATES_STORAGE_BASE}/${form.id}/${Date.now()}_${safe}`;
        const r = storageRef(storage, path);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        newAttachments.push({ name: file.name, url, path });
      }
      if (newAttachments.length > 0) {
        setForm((f) => ({ ...f, attachments: [...(f.attachments || []), ...newAttachments] }));
      }
    } catch (e) {
      console.error('[estimates] upload failed:', e);
      setUploadError('Upload failed — check console for details.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAttachment = async (attachment) => {
    setForm((f) => ({ ...f, attachments: (f.attachments || []).filter((a) => a.url !== attachment.url) }));
    if (attachment.path) {
      try { await deleteObject(storageRef(storage, attachment.path)); }
      catch (e) { console.error('[estimates] storage delete failed:', e); }
    }
  };

  const submit = () => {
    if (!canSave) return;
    const upper = (s) => (s || '').toUpperCase();
    const cleaned = {
      ...form,
      customerName: upper(form.customerName),
      address: upper(form.address),
      referredBy: upper(form.referredBy),
      notes: upper(form.notes),
      customWorkDetail: upper(form.customWorkDetail),
      revisionNotes: upper(form.revisionNotes),
    };
    if (isRevision) {
      cleaned.completed = false;
      cleaned.completedAt = null;
    }
    if (cleaned.hasDeadline !== 'yes') cleaned.deadlineDate = '';
    onSave(cleaned);
  };

  const titlePrefix = isRevision ? 'Revise' : (isNew ? 'New' : 'Edit');

  return (
    <ModalShell title={`${titlePrefix} Estimate`} accent="rgba(245,158,11,0.55)" maxWidth="640px" onClose={onClose}>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {isRevision && (
          <Field label="Revision Details">
            <textarea
              value={form.revisionNotes}
              onChange={(e) => setField('revisionNotes', e.target.value)}
              placeholder="WHAT IS BEING REVISED? (E.G. UPDATED SCOPE, REVISED PRICING, NEW PHASE)"
              spellCheck={true} rows={3}
              style={{ ...upperInputStyle, minHeight: '90px', resize: 'vertical', fontFamily: FB, lineHeight: 1.4 }}
            />
          </Field>
        )}

        <Field label="Customer Name">
          <input
            type="text" value={form.customerName}
            onChange={(e) => setField('customerName', e.target.value)}
            placeholder="E.G. SMITH FAMILY"
            spellCheck={true}
            style={upperInputStyle}
          />
        </Field>

        <Field label="Address">
          <AddressInput
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="START TYPING THE ADDRESS..."
            style={upperInputStyle}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Date of Site Estimate">
            <input
              type="date"
              value={form.estimateDate || todayISO()}
              onChange={(e) => setField('estimateDate', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Deadline?">
            <select
              value={form.hasDeadline}
              onChange={(e) => setField('hasDeadline', e.target.value)}
              style={inputStyle}
            >
              <option value="no">NO</option>
              <option value="yes">YES</option>
            </select>
          </Field>
        </div>

        {form.hasDeadline === 'yes' && (
          <Field label="Deadline Date">
            <input
              type="date"
              value={form.deadlineDate || ''}
              onChange={(e) => setField('deadlineDate', e.target.value)}
              style={inputStyle}
            />
          </Field>
        )}

        <Field label="Referred By">
          <input
            type="text" value={form.referredBy}
            onChange={(e) => setField('referredBy', e.target.value)}
            placeholder="E.G. JOHN DOE / GOOGLE / PRIOR CUSTOMER"
            spellCheck={true}
            style={upperInputStyle}
          />
        </Field>

        <Field label="Important Estimate Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="ANYTHING THE TEAM SHOULD KNOW BEFORE THE WALK..."
            spellCheck={true} rows={3}
            style={{ ...upperInputStyle, minHeight: '90px', resize: 'vertical', fontFamily: FB, lineHeight: 1.4 }}
          />
        </Field>

        <div>
          <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', marginBottom: '8px', fontFamily: FB }}>
            Blueprints / Design Plans
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              { k: 'blueprints',  label: 'Blueprints' },
              { k: 'designPlans', label: 'Design Plans' },
              { k: 'other',       label: 'Other' },
            ].map(({ k, label }) => {
              const checked = !!form.blueprints[k];
              return (
                <button
                  key={k} type="button"
                  onClick={() => setBlueprint(k, !checked)}
                  style={{
                    flex: '1 1 30%', minHeight: '44px',
                    padding: '10px 12px', borderRadius: '6px', cursor: 'pointer',
                    background: checked ? 'rgba(56,189,248,0.15)' : 'transparent',
                    border: `1px solid ${checked ? '#38bdf8' : '#3f3f46'}`,
                    color: checked ? '#7dd3fc' : '#a1a1aa',
                    fontFamily: FB, fontSize: '13px', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  {checked && <Check size={13} />} {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Type of Work">
            <select
              value={form.workType}
              onChange={(e) => setField('workType', e.target.value)}
              style={inputStyle}
            >
              <option value="residential">RESIDENTIAL</option>
              <option value="commercial">COMMERCIAL</option>
            </select>
          </Field>
          <Field label="Detail">
            <select
              value={form.workDetail || ''}
              onChange={(e) => setField('workDetail', e.target.value)}
              style={inputStyle}
            >
              <option value="">— SELECT —</option>
              {typeList.map((t) => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>
          </Field>
        </div>

        {showCustomDetail && (
          <Field label="Describe">
            <input
              type="text" value={form.customWorkDetail || ''}
              onChange={(e) => setField('customWorkDetail', e.target.value)}
              placeholder="DESCRIBE THE SCOPE..."
              spellCheck={true}
              style={upperInputStyle}
            />
          </Field>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#71717a', fontFamily: FB }}>
              Attachments
            </span>
            <span style={{ fontSize: '11px', color: '#52525b', fontFamily: FM }}>
              {(form.attachments || []).length} file(s) · max 20 MB each
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => onPickFiles(e.target.files)}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileRef.current && fileRef.current.click()}
            disabled={uploading}
            style={{
              width: '100%', padding: '10px 14px', minHeight: '44px',
              background: uploading ? 'rgba(56,189,248,0.04)' : 'rgba(56,189,248,0.08)',
              border: '1px dashed rgba(56,189,248,0.4)',
              borderRadius: '6px', cursor: uploading ? 'progress' : 'pointer',
              color: '#7dd3fc', fontSize: '13px', fontWeight: 600,
              fontFamily: FB, letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <Upload size={14} /> {uploading ? 'UPLOADING...' : 'UPLOAD IMAGES OR PDFS'}
          </button>
          {uploadError && (
            <div style={{ marginTop: '6px', color: '#f87171', fontSize: '12px', fontFamily: FB }}>
              {uploadError}
            </div>
          )}
          {(form.attachments || []).length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {form.attachments.map((a) => (
                <div key={a.url} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', borderRadius: '6px',
                  background: 'rgba(9,9,11,0.7)', border: '1px solid #27272a',
                }}>
                  <Paperclip size={12} color="#71717a" />
                  <a
                    href={a.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      flex: 1, minWidth: 0,
                      color: '#e4e4e7', fontFamily: FB, fontSize: '13px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: 'none',
                    }}
                  >
                    {a.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a)}
                    title="Remove file"
                    style={{
                      width: '32px', height: '32px',
                      background: 'transparent', border: '1px solid #3f3f46',
                      borderRadius: '4px', cursor: 'pointer', color: '#f87171',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderTop: '1px solid #27272a',
        flexWrap: 'wrap', gap: '8px',
      }}>
        {!isNew ? (
          <button
            onClick={() => onDelete(estimate.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '8px 12px', fontFamily: FB }}
          >
            <Trash2 size={14} /> Delete
          </button>
        ) : <div />}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{ padding: '12px 16px', minHeight: '44px', background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: '14px', fontWeight: 600, fontFamily: FB }}
          >
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
            {isRevision ? 'SAVE REVISION' : (isNew ? 'CREATE ESTIMATE' : 'SAVE CHANGES')}
          </button>
        </div>
      </div>
    </ModalShell>
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
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px', padding: '8px' }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
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

  // Browser back / swipe-back gesture (mobile): intercept and close the modal
  // instead of letting the browser navigate away to the previous page (which
  // would land the user on the Operations Center and look like a logout).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stateMarker = { ccTaskModal: true };
    window.history.pushState(stateMarker, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // If we're being unmounted by anything OTHER than a back-nav (e.g. Save
      // or X), pop our pushed state so we don't leave a dummy entry behind.
      if (window.history.state && window.history.state.ccTaskModal) {
        window.history.back();
      }
    };
  }, [onClose]);

  // Multi-assign: track selected people as a list in TEAM order.
  const initialAssignees = (() => {
    const set = new Set();
    if (task.assignee) set.add(task.assignee);
    (Array.isArray(task.extraAssignees) ? task.extraAssignees : []).forEach((id) => set.add(id));
    const list = TEAM.filter((p) => set.has(p.id)).map((p) => p.id);
    return list.length > 0 ? list : ['robert'];
  })();
  const [selectedAssignees, setSelectedAssignees] = useState(initialAssignees);
  const allSelected = selectedAssignees.length === TEAM.length;
  const toggleAssignee = (id) => {
    setSelectedAssignees((prev) => {
      const has = prev.includes(id);
      if (has && prev.length === 1) return prev; // at least one must remain
      const nextSet = new Set(prev);
      if (has) nextSet.delete(id); else nextSet.add(id);
      return TEAM.filter((p) => nextSet.has(p.id)).map((p) => p.id);
    });
  };
  const selectAllAssignees = () => setSelectedAssignees(TEAM.map((p) => p.id));

  const isNew = !task.id;
  const canSave = (form.title || '').trim().length > 0;

  // Tie-to-active-job: only surfaced on the new-task flow. For edits we
  // preserve whatever taskType was saved without exposing the toggle.
  const [taskType, setTaskType] = useState(task.taskType || 'standalone');
  // null = not yet fetched, [] = fetched empty
  const [orders, setOrders] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(false);
  // '' = no selection yet, '__other__' = manual entry, otherwise an order id
  const [selectedOrderId, setSelectedOrderId] = useState('');

  // Fetch orders only when the new-task flow has Tie-to-Active-Job active and
  // we haven't loaded yet. One-shot read — we never write to /orders.
  useEffect(() => {
    if (!isNew || taskType !== 'active_job') return;
    // Don't gate on ordersLoading: setting it inside the effect would otherwise
    // trigger a cleanup-then-rerun cycle that cancels the in-flight fetch
    // before its .then can set state, leaving the UI stuck on "Loading jobs…".
    if (orders !== null || ordersError) return;
    let cancelled = false;
    setOrdersLoading(true);
    get(ref(db, 'orders'))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.val() || {};
        const list = Object.entries(data)
          .map(([id, o]) => ({ id, ...(o || {}) }))
          .filter((o) => (o.customerName || '').trim().length > 0)
          .sort((a, b) =>
            (a.customerName || '').localeCompare(b.customerName || '', undefined, { sensitivity: 'base' })
          );
        setOrders(list);
        setOrdersLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[command-center] orders read FAILED:', err);
        setOrdersError(true);
        setOrdersLoading(false);
      });
    return () => { cancelled = true; };
  }, [isNew, taskType, orders, ordersError]);

  const handleOrderSelect = (value) => {
    setSelectedOrderId(value);
    if (value === '__other__') {
      setForm((f) => ({ ...f, customer: '', address: '' }));
      return;
    }
    if (!value) return;
    const order = (orders || []).find((o) => o.id === value);
    if (!order) return;
    setForm((f) => ({
      ...f,
      customer: order.customerName || '',
      address: order.address || '',
    }));
  };

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

  const subTaskInputRefs = useRef([]);
  const focusLastSubTaskRef = useRef(false);

  useEffect(() => {
    if (focusLastSubTaskRef.current) {
      const last = subTaskInputRefs.current[form.subTasks.length - 1];
      last?.focus();
      focusLastSubTaskRef.current = false;
    }
  }, [form.subTasks.length]);

  const handleSubTaskKeyDown = (e) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      focusLastSubTaskRef.current = true;
      addSubTask();
    }
  };

  const submit = () => {
    if (!canSave) return;
    const primary = selectedAssignees[0];
    const extras = selectedAssignees.slice(1);
    // Only persist linkedOrderCustomer when an actual order was selected.
    // 'Other' or empty selection on the new-task flow leaves it unlinked.
    const linkedOrder = (isNew && taskType === 'active_job' && selectedOrderId && selectedOrderId !== '__other__')
      ? (orders || []).find((o) => o.id === selectedOrderId)
      : null;
    const cleaned = {
      ...form,
      title: (form.title || '').toUpperCase(),
      customer: (form.customer || '').toUpperCase(),
      address: (form.address || '').toUpperCase(),
      completionNotes: (form.completionNotes || '').toUpperCase(),
      assignee: primary,
      // null on the wire removes the field in RTDB so single-assignee tasks
      // stay shaped exactly like before (no extraAssignees property).
      extraAssignees: extras.length > 0 ? extras : null,
      taskType,
      linkedOrderCustomer: linkedOrder ? (linkedOrder.customerName || '').toUpperCase() : null,
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
        {isNew && (
          <Field label="Tie To">
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { value: 'active_job', label: 'TIE TO ACTIVE JOB' },
                { value: 'standalone', label: 'STANDALONE TASK' },
              ].map((opt) => {
                const active = taskType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTaskType(opt.value)}
                    style={{
                      flex: 1, minHeight: '44px', padding: '10px 12px',
                      background: active ? 'rgba(245,158,11,0.18)' : '#09090b',
                      border: `1px solid ${active ? '#fbbf24' : '#3f3f46'}`,
                      borderRadius: '6px', cursor: 'pointer',
                      color: active ? '#fbbf24' : '#a1a1aa',
                      fontFamily: FD, fontSize: '13px', fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
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
          {isNew && taskType === 'active_job' && !ordersError && selectedOrderId !== '__other__' ? (
            ordersLoading || orders === null ? (
              <div style={{ ...inputStyle, color: '#71717a', display: 'flex', alignItems: 'center' }}>
                Loading jobs…
              </div>
            ) : (
              <select
                value={selectedOrderId}
                onChange={(e) => handleOrderSelect(e.target.value)}
                style={inputStyle}
              >
                <option value="">SELECT A JOB…</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.customerName}</option>
                ))}
                <option value="__other__">OTHER</option>
              </select>
            )
          ) : (
            <input
              type="text" value={form.customer}
              onChange={e => setForm({ ...form, customer: e.target.value })}
              placeholder={
                isNew && (taskType === 'standalone' || selectedOrderId === '__other__' || ordersError)
                  ? 'MANUALLY ENTER CUSTOMER NAME'
                  : 'E.G. SMITH — MAPLE ST (OR INTERNAL)'
              }
              spellCheck={true}
              style={upperInputStyle}
            />
          )}
        </Field>
        <Field label="Address">
          <AddressInput
            value={form.address || ''}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="START TYPING AN ADDRESS..."
            style={upperInputStyle}
          />
        </Field>
        <Field label="Assigned To">
          <div className="cc-assignee-grid" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {TEAM.map((p) => {
              const active = selectedAssignees.includes(p.id);
              const onlyOne = active && selectedAssignees.length === 1;
              const label = p.id === 'robert' ? 'ROB' : p.name;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleAssignee(p.id)}
                  title={onlyOne ? 'At least one person must be assigned' : ''}
                  style={{
                    flex: 1, minWidth: '64px', minHeight: '44px', padding: '10px 12px',
                    background: active ? 'rgba(245,158,11,0.18)' : '#09090b',
                    border: `1px solid ${active ? '#fbbf24' : '#3f3f46'}`,
                    borderRadius: '6px',
                    cursor: onlyOne ? 'not-allowed' : 'pointer',
                    color: active ? '#fbbf24' : '#a1a1aa',
                    fontFamily: FD, fontSize: '14px', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                  }}
                >
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={selectAllAssignees}
              title="Assign to all"
              style={{
                flex: 1, minWidth: '64px', minHeight: '44px', padding: '10px 12px',
                background: allSelected ? 'rgba(245,158,11,0.18)' : '#09090b',
                border: `1px solid ${allSelected ? '#fbbf24' : '#3f3f46'}`,
                borderRadius: '6px', cursor: 'pointer',
                color: allSelected ? '#fbbf24' : '#a1a1aa',
                fontFamily: FD, fontSize: '14px', fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                transition: 'background 0.12s, border-color 0.12s, color 0.12s',
              }}
            >
              ALL
            </button>
          </div>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Priority">
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inputStyle}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Due By">
          <input
            type="date"
            value={form.dueDate || todayISO()}
            defaultValue={todayISO()}
            onChange={e => setForm({ ...form, dueDate: e.target.value })}
            style={inputStyle}
          />
        </Field>

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
                    ref={el => { subTaskInputRefs.current[idx] = el; }}
                    type="text"
                    value={s.text}
                    onChange={e => updateSubTask(s.id, e.target.value)}
                    onKeyDown={handleSubTaskKeyDown}
                    placeholder={`SUB TASK #${idx + 1}`}
                    spellCheck={true}
                    style={{ ...upperInputStyle, padding: '10px 12px', minHeight: '44px', fontSize: '16px' }}
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderTop: '1px solid #27272a',
        flexWrap: 'wrap', gap: '8px',
        position: 'sticky', bottom: 0,
        background: '#18181b', flexShrink: 0, zIndex: 2,
      }}>
        {!isNew ? (
          <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '8px 12px', fontFamily: FB }}>
            <Trash2 size={14} /> Delete
          </button>
        ) : <div />}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            style={{ padding: '12px 16px', minHeight: '44px', background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: '14px', fontWeight: 600, fontFamily: FB }}
          >
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

// ─── AI sub-task summary ───────────────────────────────────────────────────────
// Fingerprint the *text* of sub-tasks (ignoring completion state). We only call
// the proxy when this changes — toggling a checkbox shouldn't trigger a regen.

const subTaskTextFingerprint = (subTasks) =>
  (subTasks || [])
    .map((s) => (s.text || '').trim())
    .filter(Boolean)
    .join('|');

async function regenerateSubTaskSummary(taskId, subTasks) {
  try {
    const lines = (subTasks || [])
      .map((s) => (s.text || '').trim())
      .filter(Boolean)
      .map((t) => `- ${t}`)
      .join('\n');
    if (!lines) {
      // All sub-tasks removed → clear any prior summary so stale text doesn't persist.
      await update(ref(db, `${TASKS_PATH}/${taskId}`), { subTaskSummary: null });
      return;
    }
    const res = await fetch('/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'You are a concise construction project assistant. Summarize the following sub-tasks in 1-2 plain sentences.',
        messages: [{ role: 'user', content: lines }],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const text = (data?.content?.find?.((b) => b.type === 'text')?.text || '').trim();
    if (!text) return;
    await update(ref(db, `${TASKS_PATH}/${taskId}`), { subTaskSummary: text });
  } catch (e) {
    // Spec: fail silently — log only, never surface.
    console.error('[command-center] subtask summary failed:', e);
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function IconCommandCenter() {
  // Single source of truth — every task in commandCenter/tasks/{id}, with
  // status: 'open' | 'done'. Open tasks render in columns; done tasks are
  // surfaced through the per-person Done Today modal.
  const [allTasks, setAllTasks] = useState([]);
  const [allEstimates, setAllEstimates] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(null);
  const [estimateEditing, setEstimateEditing] = useState(null); // { ...estimate, persisted, isRevision }
  const [revisionPrompt, setRevisionPrompt] = useState(null);   // archived estimate awaiting yes/no
  const [robEstimatesView, setRobEstimatesView] = useState(false);
  const [viewingNotes, setViewingNotes] = useState(null);
  const [viewingDoneFor, setViewingDoneFor] = useState(null);
  const [flash, setFlash] = useState(null);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  const [isRobAuth] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('isRobAuth') === 'true'
  );

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    setTouchStart({ x: t.clientX, y: t.clientY });
  };
  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    setTouchStart(null);
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    setMobileIndex(i =>
      dx < 0 ? Math.min(i + 1, TEAM.length - 1) : Math.max(i - 1, 0)
    );
  };

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

  // Estimates live-sync — independent listener, same auth-then-subscribe pattern.
  // Failures here don't gate the main app loaded state (tasks listener owns that).
  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    authReady.then(() => {
      if (cancelled) return;
      const r = ref(db, ESTIMATES_PATH);
      unsub = onValue(r, (snap) => {
        if (cancelled) return;
        const data = snap.val() || {};
        setAllEstimates(Object.entries(data).map(([id, e]) => ({ id, ...e })));
      }, (err) => {
        console.error('[command-center] estimates read FAILED:', err);
      });
    }).catch((err) => console.error('[command-center] estimates auth not ready:', err));
    return () => { cancelled = true; unsub(); };
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

      /* Mobile form fields — enforce 16px font-size minimum so iOS doesn't zoom on focus,
         and stack the Assigned To toggle buttons into a 2-column grid. */
      @media (max-width: 768px) {
        input, select, textarea {
          font-size: 16px !important;
        }
        .cc-assignee-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 8px !important;
        }
      }

      /* Mobile layout fixes — split header (brand 50% / stats 2x2 50%), clock below, readable footer */
      @media (max-width: 480px) {
        .cc-header-row {
          flex-wrap: wrap !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
          padding: 10px 14px !important;
        }
        /* Left half — brand mark */
        .cc-header-row > div:first-child {
          flex: 0 1 calc(50% - 6px) !important;
          min-width: 0 !important;
          gap: 10px !important;
        }
        .cc-header-row > div:first-child > div:first-child {
          width: 36px !important;
          height: 36px !important;
        }
        .cc-header-row > div:first-child > div:first-child > span {
          font-size: 18px !important;
        }
        .cc-header-row > div:first-child > div:last-child > div:first-child {
          font-size: 0.95rem !important;
          line-height: 1.15 !important;
        }
        .cc-header-row > div:first-child > div:last-child > div:last-child {
          font-size: 9px !important;
          letter-spacing: 0.2em !important;
          margin-top: 3px !important;
        }
        /* Right half — stats as 2x2 grid */
        .cc-stats {
          display: grid !important;
          grid-template-columns: auto auto !important;
          gap: 4px 0 !important;
          flex: 0 1 calc(50% - 6px) !important;
          justify-content: end !important;
          align-items: center !important;
        }
        .cc-stats > div {
          padding: 2px 8px !important;
          border-left: none !important;
        }
        .cc-stats > div > span:first-child {
          font-size: 1.2rem !important;
        }
        .cc-stats > div > span:last-child {
          font-size: 9px !important;
          letter-spacing: 0.15em !important;
          margin-top: 1px !important;
        }
        /* LiveClock — full-width row below the split */
        .cc-header-row > div:last-child {
          flex: 1 1 100% !important;
        }
        /* Footer (unchanged from prior fix) */
        .cc-footer {
          flex-direction: column !important;
          gap: 3px !important;
          padding: 8px 14px !important;
          font-size: 11px !important;
          text-align: center !important;
        }
        .cc-footer > div {
          justify-content: center !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      try { document.head.removeChild(link); }  catch (e) { console.error('[App] failed to remove font link', e); }
      try { document.head.removeChild(style); } catch (e) { console.error('[App] failed to remove style element', e); }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
        .filter(t => getAssignees(t).includes(p.id))
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
        .filter(t => getAssignees(t).includes(p.id) && (t.completedAt || '').split('T')[0] === today)
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
      const { id, ...rest } = form;
      // Compare sub-task text content vs the prior persisted record. Only call
      // the AI proxy when the text actually changed (additions/removals/edits).
      const prior = allTasks.find((t) => t.id === id);
      const priorFP = subTaskTextFingerprint(prior?.subTasks);
      const nextFP  = subTaskTextFingerprint(rest.subTasks);
      update(ref(db, `${TASKS_PATH}/${id}`), rest)
        .then(() => {
          if (priorFP !== nextFP) regenerateSubTaskSummary(id, rest.subTasks);
        })
        .catch((e) => console.error('[command-center] save failed:', e));
    } else {
      const newRef = push(ref(db, TASKS_PATH));
      const record = {
        ...form,
        id: newRef.key,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      const nextFP = subTaskTextFingerprint(record.subTasks);
      set(newRef, record)
        .then(() => {
          if (nextFP) regenerateSubTaskSummary(newRef.key, record.subTasks);
        })
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

  // Quick add: write directly to RTDB without opening the modal. Fields not
  // captured here stay empty/unset on the wire — the user can fill them in
  // later via the normal edit flow.
  const handleQuickAdd = (assignee, title) => {
    const trimmed = (title || '').trim();
    if (!trimmed) return;
    const newRef = push(ref(db, TASKS_PATH));
    const record = {
      id: newRef.key,
      title: trimmed.toUpperCase(),
      customer: '',
      address: '',
      assignee: assignee || 'robert',
      category: 'customer',
      priority: 'medium',
      status: 'open',
      dueDate: '',
      subTasks: [],
      completionNotes: '',
      createdAt: new Date().toISOString(),
    };
    set(newRef, record)
      .catch((e) => console.error('[command-center] quick add failed:', e));
  };

  const batchGenerateAISummaries = useCallback(async () => {
    const targets = allTasks.filter((t) =>
      Array.isArray(t.subTasks) &&
      t.subTasks.some((s) => (s.text || '').trim().length > 0) &&
      !t.subTaskSummary
    );
    for (const t of targets) {
      await regenerateSubTaskSummary(t.id, t.subTasks);
      await new Promise((r) => setTimeout(r, 600));
    }
    showFlash('AI summaries synced');
  }, [allTasks]);

  // ── Estimate handlers ────────────────────────────────────────────────────
  // New: pre-allocate an RTDB key so storage uploads have a stable path even
  // before the record is persisted. Edit: pass the existing record + persisted=true.
  const handleAddEstimate = () => {
    const newId = push(ref(db, ESTIMATES_PATH)).key;
    setEstimateEditing({ ...estimateBlank(newId), persisted: false, isRevision: false });
  };
  const handleEditEstimate = (estimate) => {
    setEstimateEditing({ ...estimate, persisted: true, isRevision: false });
  };
  const handleEditArchivedEstimate = (estimate) => {
    setRevisionPrompt(estimate);
  };
  const handleRevisionAnswer = (yes) => {
    if (!revisionPrompt) return;
    const target = revisionPrompt;
    setRevisionPrompt(null);
    setEstimateEditing({ ...target, persisted: true, isRevision: !!yes });
  };

  const handleSaveEstimate = (form) => {
    const { id, persisted, isRevision, ...rest } = form;
    const now = new Date().toISOString();
    if (persisted) {
      update(ref(db, `${ESTIMATES_PATH}/${id}`), { ...rest, updatedAt: now })
        .catch((e) => console.error('[command-center] estimate save failed:', e));
    } else {
      // First write — set the full record at the pre-allocated key.
      set(ref(db, `${ESTIMATES_PATH}/${id}`), {
        ...rest,
        id,
        completed: !!rest.completed,
        createdAt: now,
        updatedAt: now,
      }).catch((e) => console.error('[command-center] estimate create failed:', e));
    }
    setEstimateEditing(null);
    if (isRevision) showFlash('✓ Revision saved — moved to active');
  };

  const handleDeleteEstimate = async (estimate) => {
    const id = typeof estimate === 'string' ? estimate : estimate?.id;
    if (!id) return;
    const record = typeof estimate === 'object' ? estimate : allEstimates.find((e) => e.id === id);
    const label = record?.customerName ? `"${record.customerName}"` : 'this estimate';
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${label}? This removes the record and any uploaded files.`)) return;
    // Best-effort: clear attachments from Storage before removing the record.
    if (record && Array.isArray(record.attachments)) {
      for (const a of record.attachments) {
        if (a?.path) {
          try { await deleteObject(storageRef(storage, a.path)); }
          catch (e) { /* file may already be gone — non-fatal */ }
        }
      }
    }
    remove(ref(db, `${ESTIMATES_PATH}/${id}`))
      .catch((e) => console.error('[command-center] estimate delete failed:', e));
    setEstimateEditing(null);
  };

  const handleToggleEstimateComplete = (estimate) => {
    const next = !estimate.completed;
    update(ref(db, `${ESTIMATES_PATH}/${estimate.id}`), {
      completed: next,
      completedAt: next ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }).catch((e) => console.error('[command-center] estimate toggle failed:', e));
    if (next) showFlash('✓ Estimate moved to archive');
  };

  // ── Rob's estimates extras — toggle pill + body override when active ────
  const robEstimates = useMemo(() => allEstimates, [allEstimates]);
  const robActiveCount = useMemo(
    () => allEstimates.filter((e) => !e.completed).length,
    [allEstimates]
  );
  const robProps = useMemo(() => {
    const toggle = (
      <button
        onClick={() => setRobEstimatesView((v) => !v)}
        title={robEstimatesView ? 'Back to tasks' : 'Show estimates'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 10px', minHeight: '32px',
          background: robEstimatesView ? 'transparent' : 'rgba(245,158,11,0.12)',
          border: `1px solid ${robEstimatesView ? '#3f3f46' : 'rgba(245,158,11,0.5)'}`,
          borderRadius: '6px', cursor: 'pointer',
          color: robEstimatesView ? '#a1a1aa' : '#fbbf24',
          fontFamily: FB, fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        {robEstimatesView
          ? <><ArrowLeft size={12} /> Tasks</>
          : <><ClipboardList size={12} /> Estimates{robActiveCount > 0 ? ` · ${robActiveCount}` : ''}</>}
      </button>
    );
    const body = robEstimatesView ? (
      <EstimatesView
        estimates={robEstimates}
        onAdd={handleAddEstimate}
        onEdit={handleEditEstimate}
        onEditArchived={handleEditArchivedEstimate}
        onToggleComplete={handleToggleEstimateComplete}
        onDelete={handleDeleteEstimate}
      />
    ) : null;
    return { headerToggleButton: toggle, bodyOverride: body };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robEstimatesView, robActiveCount, robEstimates]);

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
      minHeight: 'calc(100vh - 36px)',
      ...(isMobile
        ? { overflow: 'visible' }
        : { height: 'calc(100vh - 36px)', overflow: 'hidden' }),
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
        <div className="cc-header-row" style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>

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
          <div className="cc-stats" style={{ display: 'flex', alignItems: 'center' }}>
            <StatBlock label="Urgent"     value={stats.urgent}   tone="red"     />
            <StatBlock label="Due Soon"   value={stats.today}    tone="amber"   />
            <StatBlock label="Total Open" value={stats.total}    tone="zinc"    />
            <StatBlock label="Done Today" value={doneTodayTotal} tone="emerald" />
          </div>

          {/* Sync AI Summaries — Rob only, hidden in estimates view */}
          {!robEstimatesView && isRobAuth && (
            <button
              onClick={batchGenerateAISummaries}
              title="Generate AI summaries for tasks missing them"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 10px', minHeight: '32px',
                background: 'rgba(245,158,11,0.10)',
                border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: '6px', cursor: 'pointer',
                color: '#fbbf24',
                fontFamily: FB, fontSize: '11px', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              🤖 Sync AI Summaries
            </button>
          )}

          {/* Live clock */}
          <LiveClock />
        </div>
      </header>

      {/* ── COLUMN MAIN ── */}
      {isMobile ? (
        <main style={{
          position: 'relative', flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column', overflow: 'visible',
        }}>
          {/* Person tabs */}
          <div style={{
            display: 'flex',
            background: '#09090b',
            borderBottom: '1px solid #27272a',
            flexShrink: 0,
          }}>
            {TEAM.map((person, i) => {
              const active = mobileIndex === i;
              const acc = ACCENTS[person.accent];
              return (
                <button
                  key={person.id}
                  onClick={() => setMobileIndex(i)}
                  style={{
                    flex: 1, minHeight: '48px', padding: '12px 8px',
                    background: active ? 'rgba(24,24,27,0.95)' : 'transparent',
                    border: 'none',
                    borderBottom: active ? `2px solid ${acc.dot}` : '2px solid transparent',
                    color: active ? acc.text : '#71717a',
                    fontFamily: FD, fontSize: '14px', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'color 0.2s, border-color 0.2s, background 0.2s',
                  }}
                >
                  {person.id === 'robert' ? 'ROB' : person.name}
                </button>
              );
            })}
          </div>

          {/* Sliding column track */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              position: 'relative', flex: 1, minHeight: 0,
              overflowX: 'hidden', overflowY: 'visible',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'flex-start',
              width: `${TEAM.length * 100}%`,
              transform: `translateX(-${mobileIndex * (100 / TEAM.length)}%)`,
              transition: 'transform 0.3s ease-out',
            }}>
              {TEAM.map(person => (
                <div key={person.id} style={{
                  flex: `0 0 ${100 / TEAM.length}%`,
                  padding: '12px',
                  boxSizing: 'border-box', minWidth: 0,
                }}>
                  <PersonColumn
                    person={person}
                    tasks={tasksByPerson[person.id] || []}
                    doneCount={(completedTodayByPerson[person.id] || []).length}
                    onAdd={handleAdd}
                    onQuickAdd={handleQuickAdd}
                    onEdit={setEditing}
                    onComplete={handleComplete}
                    onToggleSubTask={handleToggleSubTask}
                    onShowNotes={setViewingNotes}
                    onShowDone={setViewingDoneFor}
                    isMobile={true}
                    {...(person.id === 'robert' ? robProps : {})}
                  />
                </div>
              ))}
            </div>

            {/* Swipe affordance arrows */}
            {mobileIndex > 0 && (
              <div style={{
                position: 'absolute', left: '2px', top: '50%',
                transform: 'translateY(-50%)',
                color: '#52525b', opacity: 0.55,
                pointerEvents: 'none',
                animation: 'iconDot 2.5s ease-in-out infinite',
              }}>
                <ChevronLeft size={22} strokeWidth={2.5} />
              </div>
            )}
            {mobileIndex < TEAM.length - 1 && (
              <div style={{
                position: 'absolute', right: '2px', top: '50%',
                transform: 'translateY(-50%)',
                color: '#52525b', opacity: 0.55,
                pointerEvents: 'none',
                animation: 'iconDot 2.5s ease-in-out infinite',
              }}>
                <ChevronRight size={22} strokeWidth={2.5} />
              </div>
            )}
          </div>
        </main>
      ) : (
        <main
          className="cc-main"
          style={{
            position: 'relative', flex: 1, minHeight: 0,
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gridTemplateRows: '1fr',
            gap: '16px', padding: '16px 24px', overflow: 'hidden',
          }}
        >
          {TEAM.map(person => (
            <PersonColumn
              key={person.id}
              person={person}
              tasks={tasksByPerson[person.id] || []}
              doneCount={(completedTodayByPerson[person.id] || []).length}
              onAdd={handleAdd}
              onQuickAdd={handleQuickAdd}
              onEdit={setEditing}
              onComplete={handleComplete}
              onToggleSubTask={handleToggleSubTask}
              onShowNotes={setViewingNotes}
              onShowDone={setViewingDoneFor}
              {...(person.id === 'robert' ? robProps : {})}
            />
          ))}
        </main>
      )}

      {/* ── FOOTER ── */}
      <footer className="cc-footer" style={{
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

      {revisionPrompt && (
        <RevisionPromptModal
          estimate={revisionPrompt}
          onAnswer={handleRevisionAnswer}
          onClose={() => setRevisionPrompt(null)}
        />
      )}

      {estimateEditing && (
        <EstimateModal
          estimate={estimateEditing}
          isRevision={!!estimateEditing.isRevision}
          onSave={handleSaveEstimate}
          onDelete={handleDeleteEstimate}
          onClose={() => setEstimateEditing(null)}
        />
      )}

    </div>
    </>
  );
}
