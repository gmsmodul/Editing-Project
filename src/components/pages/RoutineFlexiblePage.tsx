import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Repeat,
  Sparkles,
  Search,
  Clock,
  PenLine,
  X,
  Calendar,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ACTION_BTN_PRIMARY, ACTION_BTN_SECONDARY } from '../../constants/buttonStyles';
import { PRIORITY_STYLE, getWorkBarColor } from '../../constants/theme';
import {
  REFERENCE_TODAY,
  addDays,
  computeManualTimeRange,
  formatHoursCompact,
  formatShortDateId,
  getDeadlineStatus,
  getLiveLoggedSeconds,
} from '../../utils/formatters';
import { CustomSelect } from '../ui/CustomSelect';
import { DEFAULT_PAGE_SIZE, PaginationBar } from '../ui/PaginationBar';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type {
  DifficultyLevel,
  PriorityLevel,
  RecurrenceType,
  TimeLogEntry,
  WorkItem,
} from '../../types';

const MONTHS_ID_FULL = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const MONTHS_ID_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function formatLogRangeLabel(log: TimeLogEntry): string {
  const fromNote = /\((\d{2}:\d{2}[–-]\d{2}:\d{2})\)/.exec(log.note || '');
  if (fromNote) return fromNote[1];
  const s = log.startedAt?.slice(11, 16);
  const e = log.endedAt?.slice(11, 16);
  if (s && e && s !== e) return `${s}–${e}`;
  return formatHoursCompact(log.durationSeconds);
}

interface WeekGroup {
  weekNumber: number;
  weekLabel: string;
  rangeLabel: string;
  items: WorkItem[];
}

interface MonthGroup {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g., November 2026
  totalCount: number;
  completedCount: number;
  weeks: WeekGroup[];
}

function getMonthAndWeekInfo(isoDate: string): {
  monthKey: string;
  monthLabel: string;
  weekNumber: number;
  rangeLabel: string;
} {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : REFERENCE_TODAY;
  const [y, m, d] = safe.split('-').map(Number);
  const monthIdx = Math.max(0, Math.min(11, (m || 1) - 1));
  const daysInMonth = new Date(Date.UTC(y, monthIdx + 1, 0)).getUTCDate();
  const weekNumber = Math.ceil((d || 1) / 7); // 1..5
  const startDay = (weekNumber - 1) * 7 + 1;
  const endDay = Math.min(weekNumber * 7, daysInMonth);
  return {
    monthKey: `${y}-${String(m).padStart(2, '0')}`,
    monthLabel: `${MONTHS_ID_FULL[monthIdx]} ${y}`,
    weekNumber,
    rangeLabel: `${startDay}–${endDay} ${MONTHS_ID_SHORT[monthIdx]}`,
  };
}

export const RoutineFlexiblePage: React.FC = () => {
  const {
    workspace,
    nowMs,
    currentCrew,
    currentCrewId,
    isProjectLead,
    crewWorkloads,
    createWorkItem,
    updateWorkItem,
    addManualTimeLog,
    setSelectedWorkItemId,
    triggerToast,
  } = useWorkspace();

  // Filters, sorting & pagination (mulai dari 10 item)
  const [tab, setTab] = useState<'all' | 'routine' | 'flexible'>('all');
  const [scopeMode, setScopeMode] = useState<'mine' | 'team'>(isProjectLead ? 'team' : 'mine');
  const [crewFilter, setCrewFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Inline Task creation form (left column)
  const [taskCategory, setTaskCategory] = useState<'routine' | 'flexible'>('routine');
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('Sedang');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Mudah');
  const [estimatedHours, setEstimatedHours] = useState<number>(3);
  const [startDate, setStartDate] = useState<string>(REFERENCE_TODAY);
  const [dueDate, setDueDate] = useState<string>(addDays(REFERENCE_TODAY, 1));
  const [dueTime, setDueTime] = useState<string>('17:00');
  const [location, setLocation] = useState<string>('Ruang Operasional');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('Mingguan');
  const [submitting, setSubmitting] = useState(false);

  // Inline working-hours log editor per task
  const [loggingItemId, setLoggingItemId] = useState<string | null>(null);
  const [logDate, setLogDate] = useState<string>(REFERENCE_TODAY);
  const [logStartTime, setLogStartTime] = useState<string>('09:00');
  const [logEndTime, setLogEndTime] = useState<string>('11:00');
  const [logNote, setLogNote] = useState<string>('');
  const [savingLog, setSavingLog] = useState<boolean>(false);

  const crewById = useMemo(
    () => new Map((workspace?.crew || []).map((c) => [c.id, c])),
    [workspace?.crew]
  );

  const logsByWorkItemId = useMemo(() => {
    const map = new Map<string, TimeLogEntry[]>();
    for (const log of workspace?.timeLogs || []) {
      const list = map.get(log.workItemId);
      if (list) list.push(log);
      else map.set(log.workItemId, [log]);
    }
    return map;
  }, [workspace?.timeLogs]);

  const items = useMemo(() => {
    if (!workspace) return [];
    const q = deferredSearch.trim().toLowerCase();
    return workspace.workItems.filter((w) => {
      if (w.category === 'project') return false;
      if (tab !== 'all' && w.category !== tab) return false;
      if (scopeMode === 'mine' && w.assigneeId !== currentCrewId) return false;
      if (scopeMode === 'team' && crewFilter !== 'all' && w.assigneeId !== crewFilter) {
        return false;
      }
      if (q && !w.title.toLowerCase().includes(q) && !w.code.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [workspace, tab, scopeMode, currentCrewId, crewFilter, deferredSearch]);

  // Pre-sort all matching tasks by Month -> Week -> Date -> Title before paginating
  const sortedItems = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      const aDate = a.dueDate || a.startDate || REFERENCE_TODAY;
      const bDate = b.dueDate || b.startDate || REFERENCE_TODAY;
      const aInfo = getMonthAndWeekInfo(aDate);
      const bInfo = getMonthAndWeekInfo(bDate);
      const monthCmp = aInfo.monthKey.localeCompare(bInfo.monthKey);
      if (monthCmp !== 0) return monthCmp * dir;
      const weekCmp = aInfo.weekNumber - bInfo.weekNumber;
      if (weekCmp !== 0) return weekCmp * dir;
      const dateCmp = aDate.localeCompare(bDate);
      return dateCmp !== 0 ? dateCmp * dir : a.title.localeCompare(b.title);
    });
  }, [items, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, scopeMode, crewFilter, deferredSearch, sortOrder, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, safePage, pageSize]);

  // Hierarchical grouping for the current page: Month -> Week of month
  const groupedMonths = useMemo<MonthGroup[]>(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    const monthMap = new Map<
      string,
      {
        monthKey: string;
        monthLabel: string;
        weekMap: Map<number, WeekGroup>;
      }
    >();

    for (const item of paginatedItems) {
      const anchorDate = item.dueDate || item.startDate || REFERENCE_TODAY;
      const info = getMonthAndWeekInfo(anchorDate);
      let mGroup = monthMap.get(info.monthKey);
      if (!mGroup) {
        mGroup = {
          monthKey: info.monthKey,
          monthLabel: info.monthLabel,
          weekMap: new Map(),
        };
        monthMap.set(info.monthKey, mGroup);
      }
      let wGroup = mGroup.weekMap.get(info.weekNumber);
      if (!wGroup) {
        wGroup = {
          weekNumber: info.weekNumber,
          weekLabel: `Minggu ${info.weekNumber}`,
          rangeLabel: info.rangeLabel,
          items: [],
        };
        mGroup.weekMap.set(info.weekNumber, wGroup);
      }
      wGroup.items.push(item);
    }

    return Array.from(monthMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey) * dir)
      .map((m) => {
        const weeks = Array.from(m.weekMap.values()).sort(
          (a, b) => (a.weekNumber - b.weekNumber) * dir
        );
        const allMonthItems = weeks.flatMap((w) => w.items);
        return {
          monthKey: m.monthKey,
          monthLabel: m.monthLabel,
          totalCount: allMonthItems.length,
          completedCount: allMonthItems.filter((i) => i.status === 'Selesai').length,
          weeks,
        };
      });
  }, [paginatedItems, sortOrder]);

  const myProjectedWorkload = useMemo(() => {
    const wl = crewWorkloads.find((w) => w.crew.id === currentCrewId);
    if (!wl) return null;
    const nextHours = Number((wl.totalActiveHours + Number(estimatedHours || 0)).toFixed(1));
    const nextPct = Math.round((nextHours / Math.max(1, wl.crew.maxWeeklyHours)) * 100);
    return {
      crew: wl.crew,
      nextHours,
      nextPct,
      willOverload: nextHours > wl.crew.maxWeeklyHours,
    };
  }, [crewWorkloads, currentCrewId, estimatedHours]);

  if (!workspace) return null;

  const routineCount = workspace.workItems.filter((w) => w.category === 'routine').length;
  const flexibleCount = workspace.workItems.filter((w) => w.category === 'flexible').length;

  const logRange = computeManualTimeRange(logStartTime, logEndTime);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      playUiMotionSound('success');
      const safeStart = startDate || REFERENCE_TODAY;
      const safeDue = dueDate && dueDate >= safeStart ? dueDate : safeStart;
      await createWorkItem({
        title: title.trim(),
        description: description.trim() || 'Tercatat melalui ServoMedia Production OS.',
        category: taskCategory,
        priority,
        difficulty,
        estimatedHours: Math.max(0.5, Number(estimatedHours) || 1),
        assigneeId: currentCrewId,
        assigneeIds: [currentCrewId],
        kanbanStage: 'backlog',
        status: 'Belum Mulai',
        startDate: safeStart,
        dueDate: safeDue,
        dueTime: dueTime || '17:00',
        location: location.trim() || undefined,
        recurrence: taskCategory === 'routine' ? recurrence : 'Sekali',
        progress: 0,
        checklist: [],
      });
      setTitle('');
      setTitleError(false);
      setDescription('');
      setEstimatedHours(3);
      setStartDate(REFERENCE_TODAY);
      setDueDate(addDays(REFERENCE_TODAY, 1));
    } finally {
      setSubmitting(false);
    }
  };

  const openLogEditor = (itemId: string) => {
    playUiMotionSound('tick');
    if (loggingItemId === itemId) {
      setLoggingItemId(null);
      return;
    }
    setLoggingItemId(itemId);
    setLogDate(REFERENCE_TODAY);
    setLogStartTime('09:00');
    setLogEndTime('11:00');
    setLogNote('');
  };

  const handleSaveHoursLog = async (e: React.FormEvent, itemId: string, assigneeId: string) => {
    e.preventDefault();
    if (!logRange.valid || savingLog) return;
    setSavingLog(true);
    try {
      playUiMotionSound('success');
      await addManualTimeLog({
        workItemId: itemId,
        crewId: assigneeId || currentCrewId,
        hours: logRange.hours,
        startTime: logStartTime,
        endTime: logEndTime,
        date: logDate,
        note: logNote.trim() || 'Catatan jam pengerjaan',
      });
      setLoggingItemId(null);
      setLogNote('');
    } finally {
      setSavingLog(false);
    }
  };

  const toggleDone = async (id: string, currentlyDone: boolean) => {
    await updateWorkItem(id, {
      status: currentlyDone ? 'Sedang Dikerjakan' : 'Selesai',
      progress: currentlyDone ? 50 : 100,
    });
    triggerToast(
      currentlyDone ? 'Status Dibuka Kembali' : 'Task Diselesaikan',
      'Perubahan status langsung tersinkron ke Gantt Chart dan Kalender Tim.',
      'success'
    );
  };

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 w-full ui-stagger">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Inline Form Task Baru */}
        <section className="xl:col-span-4 xl:sticky xl:top-4 rounded-2xl border border-black/[0.12] dark:border-white/[0.10] bg-white dark:bg-[#15181E] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-[#1C1D21] dark:text-gray-100">
              Form Task Baru
            </h2>
            <span className="text-[11.5px] font-medium text-[#6E717A] truncate">
              {currentCrew?.name || 'Kru'}
            </span>
          </div>

          <form onSubmit={handleCreateTask} className="space-y-3.5">
            {/* Kategori Task: Rutin / Fleksibel */}
            <div>
              <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1.5">
                Kategori Task *
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    playUiMotionSound('tick');
                    setTaskCategory('routine');
                  }}
                  className={`py-2 px-3 rounded-lg text-[12.5px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    taskCategory === 'routine'
                      ? 'bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] font-semibold shadow-xs'
                      : 'text-[#646772] dark:text-gray-400 hover:text-[#1C1D21] font-medium'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  Rutin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playUiMotionSound('tick');
                    setTaskCategory('flexible');
                  }}
                  className={`py-2 px-3 rounded-lg text-[12.5px] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    taskCategory === 'flexible'
                      ? 'bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] font-semibold shadow-xs'
                      : 'text-[#646772] dark:text-gray-400 hover:text-[#1C1D21] font-medium'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Fleksibel
                </button>
              </div>
            </div>

            {/* Judul Task */}
            <div>
              <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                Judul Task *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value.trim()) setTitleError(false);
                }}
                placeholder={
                  taskCategory === 'routine'
                    ? 'Contoh: Backup Storage NAS Mingguan'
                    : 'Contoh: Dokumentasi Tamu Kunjungan VIP'
                }
                className={`w-full h-10 px-3 rounded-xl border bg-white dark:bg-[#14171D] text-[13px] text-[#1C1D21] dark:text-gray-100 placeholder:text-[#8E93A0] focus:outline-none transition-all ${
                  titleError
                    ? 'border-[#E11D48] focus:ring-2 focus:ring-[#E11D48]/15'
                    : 'border-black/[0.12] dark:border-white/[0.12] focus:border-[#0F172A] dark:focus:border-white/40'
                }`}
              />
              {titleError && (
                <p className="mt-1 text-[11px] text-[#C11448]">Judul task wajib diisi.</p>
              )}
            </div>

            {/* Prioritas & Kesulitan */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                  Prioritas
                </label>
                <CustomSelect
                  value={priority}
                  onChange={(val) => setPriority(val as PriorityLevel)}
                  ariaLabel="Prioritas Task"
                  size="sm"
                  rounded="xl"
                  className="w-full"
                  options={[
                    { value: 'Mendesak', label: 'Mendesak' },
                    { value: 'Tinggi', label: 'Tinggi' },
                    { value: 'Sedang', label: 'Sedang' },
                    { value: 'Rendah', label: 'Rendah' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                  Kesulitan
                </label>
                <CustomSelect
                  value={difficulty}
                  onChange={(val) => setDifficulty(val as DifficultyLevel)}
                  ariaLabel="Tingkat Kesulitan Task"
                  size="sm"
                  rounded="xl"
                  className="w-full"
                  options={[
                    { value: 'Mudah', label: 'Mudah' },
                    { value: 'Menengah', label: 'Menengah' },
                    { value: 'Kompleks', label: 'Kompleks' },
                    { value: 'Kritis', label: 'Kritis' },
                  ]}
                />
              </div>
            </div>

            {/* Estimasi Jam & Frekuensi / Jam Tenggat */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                  Estimasi (Jam)
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={40}
                  step={0.5}
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-xs font-mono tabular-nums text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              {taskCategory === 'routine' ? (
                <div>
                  <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                    Frekuensi
                  </label>
                  <CustomSelect
                    value={recurrence}
                    onChange={(val) => setRecurrence(val as RecurrenceType)}
                    ariaLabel="Frekuensi Tugas Rutin"
                    size="sm"
                    rounded="xl"
                    className="w-full"
                    options={[
                      { value: 'Harian', label: 'Harian' },
                      { value: 'Mingguan', label: 'Mingguan' },
                      { value: 'Bulanan', label: 'Bulanan' },
                    ]}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                    Jam Tenggat
                  </label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-xs font-mono tabular-nums text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              )}
            </div>

            {/* Tanggal Mulai & Tenggat */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setStartDate(nextStart);
                    if (dueDate && nextStart > dueDate) setDueDate(nextStart);
                  }}
                  className="w-full h-9 px-2.5 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-xs font-mono text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                  Tenggat
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-xs font-mono text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#0F172A]"
                />
              </div>
            </div>

            {/* Lokasi */}
            <div>
              <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                Lokasi (Opsional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ruang Operasional / Studio..."
                className="w-full h-9 px-3 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-xs text-[#1C1D21] dark:text-gray-100 placeholder:text-[#8E93A0] focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            {/* Catatan */}
            <div>
              <label className="block text-[12px] font-medium text-[#4B505C] dark:text-gray-300 mb-1">
                Catatan (Opsional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detail singkat pengerjaan..."
                className="w-full px-3 py-2 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-xs text-[#1C1D21] dark:text-gray-100 placeholder:text-[#8E93A0] focus:outline-none focus:border-[#0F172A] resize-y"
              />
            </div>

            {/* Subtle Capacity Projection */}
            {myProjectedWorkload && (
              <div
                className={`px-3 py-2 rounded-xl border text-[11.5px] flex items-center justify-between gap-2 ${
                  myProjectedWorkload.willOverload
                    ? 'bg-[#FFECEB]/60 border-[#F5B7B1] text-[#942922]'
                    : 'bg-[#FAFBFD] border-black/[0.08] text-[#525660]'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  {myProjectedWorkload.willOverload ? (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#C11448]" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#146C43]" />
                  )}
                  Beban {myProjectedWorkload.crew.name.split(' ')[0]}
                </span>
                <span className="font-mono tabular-nums font-semibold shrink-0">
                  {myProjectedWorkload.nextHours}/{myProjectedWorkload.crew.maxWeeklyHours}j ({myProjectedWorkload.nextPct}%)
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`${ACTION_BTN_PRIMARY} w-full`}
            >
              <Plus className="w-4 h-4" />
              {submitting
                ? 'Menyimpan...'
                : taskCategory === 'routine'
                  ? 'Simpan Task Rutin'
                  : 'Simpan Task Fleksibel'}
            </button>
          </form>
        </section>

        {/* RIGHT COLUMN: Filters + Month -> Week Grouped Task Table */}
        <div className="xl:col-span-8 space-y-3.5 min-w-0">
          {/* Header Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-gray-100 border border-gray-300 rounded-xl sm:rounded-lg">
                <button
                  type="button"
                  onClick={() => setScopeMode('mine')}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-lg sm:rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                    scopeMode === 'mine'
                      ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Saya ({currentCrew?.name.split(' ')[0]})
                </button>
                <button
                  type="button"
                  onClick={() => setScopeMode('team')}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-lg sm:rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                    scopeMode === 'team'
                      ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Semua Kru
                </button>
              </div>

              <div className="flex sm:inline-flex items-center gap-1 p-1 bg-gray-100 border border-gray-300 rounded-xl sm:rounded-lg overflow-x-auto no-scrollbar max-w-full">
                <button
                  type="button"
                  onClick={() => setTab('all')}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-lg sm:rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                    tab === 'all' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Semua ({routineCount + flexibleCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('routine')}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-lg sm:rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                    tab === 'routine'
                      ? 'bg-white text-[#146C43] shadow-2xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Rutin ({routineCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('flexible')}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-lg sm:rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                    tab === 'flexible'
                      ? 'bg-white text-[#8C5811] shadow-2xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Fleksibel ({flexibleCount})
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:min-w-[175px]">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari task..."
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-gray-300 bg-white text-xs text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-[#ee2e65]"
                />
              </div>

              {scopeMode === 'team' && (
                <CustomSelect
                  value={crewFilter}
                  onChange={setCrewFilter}
                  ariaLabel="Filter kru"
                  size="sm"
                  className="w-36 sm:w-auto sm:min-w-[140px]"
                  options={[
                    { value: 'all', label: 'Semua Kru' },
                    ...workspace.crew.map((c) => ({ value: c.id, label: c.name, meta: c.division })),
                  ]}
                />
              )}

              <button
                type="button"
                onClick={() => {
                  playUiMotionSound('tick');
                  setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                }}
                title="Ubah urutan Bulan & Minggu"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-[#1C1D21] cursor-pointer shrink-0"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#6E717A]" />
                {sortOrder === 'asc' ? 'Bulan ↑' : 'Bulan ↓'}
              </button>
            </div>
          </div>

          {/* Mobile Grouped List (Bulan -> Minggu) */}
          <div className="md:hidden space-y-3.5">
            {groupedMonths.map((month) => (
              <div
                key={`mob-month-${month.monthKey}`}
                className="rounded-2xl border border-black/[0.12] bg-white overflow-hidden"
              >
                <div className="px-3.5 py-2.5 bg-[#FAFBFD] border-b border-black/[0.08] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#1C1D21]">
                    <Calendar className="w-3.5 h-3.5 text-[#ee2e65]" />
                    {month.monthLabel}
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-[#6E717A]">
                    {month.completedCount}/{month.totalCount} selesai
                  </span>
                </div>

                {month.weeks.map((week) => (
                  <div key={`mob-week-${month.monthKey}-${week.weekNumber}`}>
                    <div className="px-3.5 py-1.5 bg-[#F4F5F8]/70 border-y border-black/[0.06] flex items-center justify-between text-[11px] font-semibold text-[#525660]">
                      <span>
                        {week.weekLabel} · {week.rangeLabel}
                      </span>
                      <span className="font-mono tabular-nums">{week.items.length} task</span>
                    </div>

                    <div className="divide-y divide-black/[0.06]">
                      {week.items.map((item) => {
                        const crew = crewById.get(item.assigneeId);
                        const bar = getWorkBarColor(item.category, item.discipline);
                        const dl = getDeadlineStatus(item.dueDate, item.status);
                        const done = item.status === 'Selesai';
                        const liveSec = getLiveLoggedSeconds(item, workspace.activeTimers, nowMs);
                        const itemLogs = logsByWorkItemId.get(item.id) || [];
                        const latestLog = itemLogs[0];
                        const isLogging = loggingItemId === item.id;

                        return (
                          <div key={`mob-task-${item.id}`} className="p-3.5 space-y-2.5">
                            <div className="flex items-start gap-2.5">
                              <button
                                type="button"
                                onClick={() => void toggleDone(item.id, done)}
                                aria-label={done ? 'Tandai belum selesai' : 'Tandai selesai'}
                                className="mt-0.5 w-7 h-7 -ml-1 flex items-center justify-center cursor-pointer text-[#6E717A] hover:text-[#10B981] shrink-0"
                              >
                                {done ? (
                                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                                ) : (
                                  <Circle className="w-5 h-5" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedWorkItemId(item.id)}
                                  className={`text-[13.5px] font-semibold text-left leading-snug block w-full cursor-pointer ${
                                    done ? 'line-through text-[#8C9099]' : 'text-[#1C1D21]'
                                  }`}
                                >
                                  {item.title}
                                </button>
                                <div className="mt-0.5 text-[11.5px] text-[#6E717A] flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                  <span className="font-mono text-[#1C1D21]">{item.code}</span>
                                  <span>·</span>
                                  <span className={`font-semibold ${bar.textClass}`}>{bar.label}</span>
                                  <span>·</span>
                                  <span className={PRIORITY_STYLE[item.priority].text}>
                                    {item.priority}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="pl-8 flex items-center justify-between gap-2">
                              <div className="min-w-0 text-[11.5px] text-[#6E717A] truncate">
                                <span className="font-medium text-[#1C1D21]">{crew?.name || '-'}</span>
                                {' · '}
                                <span
                                  className={
                                    dl.severity === 'overdue' ? 'text-[#C11448] font-semibold' : ''
                                  }
                                >
                                  {dl.label}
                                </span>
                                {' · '}
                                <span className="font-mono tabular-nums">
                                  {latestLog
                                    ? `${formatLogRangeLabel(latestLog)} (${formatHoursCompact(liveSec)})`
                                    : `${formatHoursCompact(liveSec)}/${item.estimatedHours}j`}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => openLogEditor(item.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium shrink-0 cursor-pointer transition-colors ${
                                  isLogging
                                    ? 'bg-[#FEF1F5] text-[#ee2e65] border border-[#FBC2D4]'
                                    : 'bg-[#F4F5F8] text-[#1C1D21] hover:bg-[#FEF1F5] hover:text-[#ee2e65]'
                                }`}
                              >
                                {isLogging ? (
                                  <>
                                    <X className="w-3 h-3" />
                                    Tutup
                                  </>
                                ) : (
                                  <>
                                    <PenLine className="w-3 h-3" />
                                    Catat Jam
                                  </>
                                )}
                              </button>
                            </div>

                            {isLogging && (
                              <form
                                onSubmit={(e) => void handleSaveHoursLog(e, item.id, item.assigneeId)}
                                className="ml-8 p-3 rounded-xl bg-[#FAFBFD] border border-black/[0.08] space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold text-[#1C1D21]">
                                    Catatan Jam Dikerjakan
                                  </span>
                                  <span
                                    className={`text-[11px] font-mono tabular-nums font-semibold px-2 py-0.5 rounded-full ${
                                      logRange.valid
                                        ? 'bg-[#E6F9F0] text-[#146C43]'
                                        : 'bg-[#FFECEB] text-[#942922]'
                                    }`}
                                  >
                                    {logRange.valid ? logRange.hoursLabel : 'Akhir > Awal'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <label className="col-span-2 space-y-1">
                                    <span className="block text-[10.5px] font-medium text-[#6E717A]">
                                      Tanggal
                                    </span>
                                    <input
                                      type="date"
                                      value={logDate}
                                      onChange={(e) => setLogDate(e.target.value)}
                                      className="w-full h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-mono text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                                    />
                                  </label>
                                  <label className="space-y-1">
                                    <span className="block text-[10.5px] font-medium text-[#6E717A]">
                                      Waktu Awal
                                    </span>
                                    <input
                                      type="time"
                                      required
                                      value={logStartTime}
                                      onChange={(e) => setLogStartTime(e.target.value)}
                                      className="w-full h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-mono tabular-nums text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                                    />
                                  </label>
                                  <label className="space-y-1">
                                    <span className="block text-[10.5px] font-medium text-[#6E717A]">
                                      Waktu Akhir
                                    </span>
                                    <input
                                      type="time"
                                      required
                                      value={logEndTime}
                                      onChange={(e) => setLogEndTime(e.target.value)}
                                      className="w-full h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-mono tabular-nums text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                                    />
                                  </label>
                                </div>

                                <input
                                  type="text"
                                  value={logNote}
                                  onChange={(e) => setLogNote(e.target.value)}
                                  placeholder="Catatan singkat pengerjaan (opsional)..."
                                  className="w-full h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                                />

                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setLoggingItemId(null)}
                                    className={ACTION_BTN_SECONDARY}
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={savingLog || !logRange.valid}
                                    className={`${ACTION_BTN_PRIMARY} disabled:opacity-50`}
                                  >
                                    {savingLog ? 'Menyimpan...' : 'Simpan Jam'}
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {groupedMonths.length === 0 && (
              <div className="rounded-2xl border border-black/[0.12] bg-white py-10 text-center text-[13px] text-[#6E717A]">
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-[#8C9099]" />
                Belum ada task pada filter ini.
              </div>
            )}
          </div>

          {/* Desktop Structured Table Sorted by Month -> Week */}
          <div className="hidden md:block space-y-4">
            {groupedMonths.map((month) => (
              <div
                key={`month-${month.monthKey}`}
                className="rounded-2xl border border-black/[0.12] bg-white overflow-hidden"
              >
                {/* Month Header */}
                <div className="px-4 py-2.5 bg-[#FAFBFD] border-b border-black/[0.10] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#ee2e65]" />
                    <h3 className="text-[13.5px] font-bold text-[#1C1D21]">{month.monthLabel}</h3>
                    <span className="text-[11px] font-medium text-[#6E717A]">
                      · {month.weeks.length} minggu
                    </span>
                  </div>
                  <span className="text-[11.5px] font-mono tabular-nums font-semibold text-[#525660]">
                    {month.completedCount}/{month.totalCount} selesai
                  </span>
                </div>

                <div className="overflow-x-auto ui-scrollbar-violet">
                  <table className="w-full text-left border-collapse min-w-[680px]">
                    <thead>
                      <tr className="border-b border-black/[0.08] bg-white text-[11px] font-semibold text-[#646772]">
                        <th className="py-2.5 pl-4 pr-2 w-10">Selesai</th>
                        <th className="py-2.5 px-2.5">Task &amp; Kategori</th>
                        <th className="py-2.5 px-2.5">Kru</th>
                        <th className="py-2.5 px-2.5">Jadwal</th>
                        <th className="py-2.5 px-2.5 text-right">Est / Aktual</th>
                        <th className="py-2.5 pl-2.5 pr-4 text-right">Jam Dikerjakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.06] text-[12.5px]">
                      {month.weeks.map((week) => (
                        <React.Fragment key={`week-${month.monthKey}-${week.weekNumber}`}>
                          {/* Week Subheader Row */}
                          <tr className="bg-[#F4F5F8]/75">
                            <td colSpan={6} className="px-4 py-1.5">
                              <div className="flex items-center justify-between text-[11.5px]">
                                <span className="font-bold text-[#1C1D21]">
                                  {week.weekLabel}{' '}
                                  <span className="font-normal text-[#6E717A]">
                                    ({week.rangeLabel})
                                  </span>
                                </span>
                                <span className="font-mono tabular-nums text-[11px] text-[#6E717A]">
                                  {week.items.length} task
                                </span>
                              </div>
                            </td>
                          </tr>

                          {week.items.map((item) => {
                            const crew = crewById.get(item.assigneeId);
                            const bar = getWorkBarColor(item.category, item.discipline);
                            const dl = getDeadlineStatus(item.dueDate, item.status);
                            const done = item.status === 'Selesai';
                            const liveSec = getLiveLoggedSeconds(item, workspace.activeTimers, nowMs);
                            const itemLogs = logsByWorkItemId.get(item.id) || [];
                            const latestLog = itemLogs[0];
                            const isLogging = loggingItemId === item.id;

                            return (
                              <React.Fragment key={item.id}>
                                <tr className="hover:bg-[#FAFBFD] transition-colors">
                                  <td className="py-2.5 pl-4 pr-2 align-middle">
                                    <button
                                      type="button"
                                      onClick={() => void toggleDone(item.id, done)}
                                      aria-label={done ? 'Tandai belum selesai' : 'Tandai selesai'}
                                      className="cursor-pointer text-[#6E717A] hover:text-[#10B981] transition-colors"
                                    >
                                      {done ? (
                                        <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                                      ) : (
                                        <Circle className="w-5 h-5" />
                                      )}
                                    </button>
                                  </td>

                                  <td className="py-2.5 px-2.5 align-middle">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedWorkItemId(item.id)}
                                      className={`font-semibold text-left hover:text-[#ee2e65] cursor-pointer ${
                                        done ? 'line-through text-[#8C9099]' : 'text-[#1C1D21]'
                                      }`}
                                    >
                                      {item.title}
                                    </button>
                                    <div className="text-[11px] text-[#6E717A] mt-0.5 flex flex-wrap items-center gap-1.5">
                                      <span className="font-mono font-semibold text-[#1C1D21]">
                                        {item.code}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span className={`font-semibold ${bar.textClass}`}>
                                        {bar.label}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span className={PRIORITY_STYLE[item.priority].text}>
                                        {item.priority}
                                      </span>
                                      {item.location && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span>{item.location}</span>
                                        </>
                                      )}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-2.5 align-middle">
                                    {crew && (
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${crew.avatarBg} ${crew.avatarText}`}
                                        >
                                          {crew.initials}
                                        </span>
                                        <div className="min-w-0">
                                          <div className="text-[12px] font-medium text-[#1C1D21] truncate">
                                            {crew.name}
                                          </div>
                                          <div className="text-[10.5px] text-[#6E717A] truncate">
                                            {crew.division}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-2.5 align-middle">
                                    <div
                                      className={`text-[11.5px] font-medium flex items-center gap-1 ${
                                        dl.severity === 'overdue'
                                          ? 'text-[#C11448] font-semibold'
                                          : dl.severity === 'soon'
                                            ? 'text-[#B45309] font-semibold'
                                            : 'text-[#1C1D21]'
                                      }`}
                                    >
                                      <Clock className="w-3 h-3 shrink-0" />
                                      {dl.label}
                                    </div>
                                    <div className="text-[10.5px] text-[#6E717A] mt-0.5">
                                      {item.category === 'routine'
                                        ? `${item.recurrence || 'Mingguan'}`
                                        : 'Fleksibel'}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-2.5 align-middle text-right font-mono tabular-nums">
                                    <div className="text-[12px] font-semibold text-[#1C1D21]">
                                      {item.estimatedHours}j
                                    </div>
                                    <div className="text-[10.5px] text-[#6E717A]">
                                      {formatHoursCompact(liveSec)}
                                    </div>
                                  </td>

                                  <td className="py-2.5 pl-2.5 pr-4 align-middle text-right">
                                    <div className="inline-flex items-center justify-end gap-1.5">
                                      {latestLog && (
                                        <span
                                          title={latestLog.note || 'Catatan jam terakhir'}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAFBFD] border border-black/[0.08] text-[10.5px] font-mono tabular-nums text-[#525660]"
                                        >
                                          <Clock className="w-3 h-3 text-[#6E717A]" />
                                          {formatLogRangeLabel(latestLog)}
                                          {itemLogs.length > 1 && (
                                            <span className="text-[10px] font-semibold text-[#ee2e65]">
                                              +{itemLogs.length - 1}
                                            </span>
                                          )}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => openLogEditor(item.id)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11.5px] font-medium transition-colors cursor-pointer shrink-0 ${
                                          isLogging
                                            ? 'bg-[#FEF1F5] text-[#ee2e65] border border-[#FBC2D4]'
                                            : 'bg-[#F4F5F8] hover:bg-[#FEF1F5] text-[#1C1D21] hover:text-[#ee2e65]'
                                        }`}
                                      >
                                        {isLogging ? (
                                          <>
                                            <X className="w-3 h-3" />
                                            Tutup
                                          </>
                                        ) : (
                                          <>
                                            <PenLine className="w-3 h-3" />
                                            Catat Jam
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {isLogging && (
                                  <tr className="bg-[#FAFBFD]">
                                    <td colSpan={6} className="px-4 py-3">
                                      <form
                                        onSubmit={(e) =>
                                          void handleSaveHoursLog(e, item.id, item.assigneeId)
                                        }
                                        className="space-y-2.5"
                                      >
                                        <div className="grid grid-cols-12 gap-2 items-end">
                                          <label className="col-span-2 space-y-1">
                                            <span className="block text-[10.5px] font-semibold text-[#6E717A]">
                                              Tanggal
                                            </span>
                                            <input
                                              type="date"
                                              value={logDate}
                                              onChange={(e) => setLogDate(e.target.value)}
                                              className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs font-mono text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                                            />
                                          </label>

                                          <label className="col-span-2 space-y-1">
                                            <span className="block text-[10.5px] font-semibold text-[#6E717A]">
                                              Waktu Awal
                                            </span>
                                            <input
                                              type="time"
                                              required
                                              value={logStartTime}
                                              onChange={(e) => setLogStartTime(e.target.value)}
                                              className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs font-mono tabular-nums text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                                            />
                                          </label>

                                          <label className="col-span-2 space-y-1">
                                            <span className="block text-[10.5px] font-semibold text-[#6E717A]">
                                              Waktu Akhir
                                            </span>
                                            <input
                                              type="time"
                                              required
                                              value={logEndTime}
                                              onChange={(e) => setLogEndTime(e.target.value)}
                                              className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs font-mono tabular-nums text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                                            />
                                          </label>

                                          <div className="col-span-2 space-y-1">
                                            <span className="block text-[10.5px] font-semibold text-[#6E717A]">
                                              Durasi
                                            </span>
                                            <div
                                              className={`h-9 px-2 rounded-lg border flex items-center text-xs font-mono tabular-nums font-semibold ${
                                                logRange.valid
                                                  ? 'border-[#A3E4C6] bg-[#E6F9F0]/60 text-[#146C43]'
                                                  : 'border-[#F5B7B1] bg-[#FFECEB]/70 text-[#942922]'
                                              }`}
                                            >
                                              {logRange.valid ? logRange.hoursLabel : 'Akhir > Awal'}
                                            </div>
                                          </div>

                                          <label className="col-span-2 space-y-1">
                                            <span className="block text-[10.5px] font-semibold text-[#6E717A]">
                                              Catatan
                                            </span>
                                            <input
                                              type="text"
                                              value={logNote}
                                              onChange={(e) => setLogNote(e.target.value)}
                                              placeholder="Ringkasan..."
                                              className="w-full h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                                            />
                                          </label>

                                          <div className="col-span-2 flex items-center justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => setLoggingItemId(null)}
                                              className="h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-medium text-[#525660] hover:bg-gray-50 cursor-pointer"
                                            >
                                              Batal
                                            </button>
                                            <button
                                              type="submit"
                                              disabled={savingLog || !logRange.valid}
                                              className="h-9 px-3 rounded-lg bg-[#ee2e65] hover:bg-[#d82157] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                                            >
                                              {savingLog ? '...' : 'Simpan'}
                                            </button>
                                          </div>
                                        </div>

                                        {itemLogs.length > 0 && (
                                          <div className="pt-2 border-t border-black/[0.06] flex flex-wrap items-center gap-1.5 text-[11px] text-[#6E717A]">
                                            <span className="font-semibold text-[#525660]">
                                              Riwayat jam:
                                            </span>
                                            {itemLogs.slice(0, 4).map((l) => (
                                              <span
                                                key={l.id}
                                                className="px-2 py-0.5 rounded-full bg-white border border-black/[0.08] font-mono tabular-nums text-[#1C1D21]"
                                              >
                                                {formatShortDateId(l.startedAt.slice(0, 10))} ·{' '}
                                                {formatLogRangeLabel(l)} (
                                                {formatHoursCompact(l.durationSeconds)})
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </form>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {groupedMonths.length === 0 && (
              <div className="rounded-2xl border border-black/[0.12] bg-white py-12 text-center text-[13px] text-[#6E717A]">
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-[#8C9099]" />
                Belum ada task pada filter ini.
              </div>
            )}
          </div>

          {/* Pagination Footer (mulai dari 10 item) */}
          <div className="rounded-2xl border border-black/[0.12] dark:border-white/[0.10] bg-white dark:bg-[#15181E] overflow-hidden">
            <PaginationBar
              currentPage={safePage}
              totalItems={sortedItems.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="task"
              className="border-t-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
