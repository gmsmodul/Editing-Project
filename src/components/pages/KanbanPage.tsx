import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Square,
  Search,
  AlertTriangle,
  Clock,
  Send,
  PenLine,
  Film,
  Wrench,
  Layers,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  ACTION_BTN_PRIMARY,
  ACTION_BTN_SECONDARY,
  ACTION_BTN_SOFT_PRIMARY,
} from '../../constants/buttonStyles';
import {
  KANBAN_COLUMNS,
  MANAGER_DIVISION_META,
  PRIORITY_STYLE,
  getRoutedManagerForDiscipline,
  getWorkBarColor,
} from '../../constants/theme';
import {
  REFERENCE_TODAY,
  computeManualTimeRange,
  formatHoursCompact,
  formatShootingSchedule,
  getDeadlineStatus,
  getLiveLoggedSeconds,
  getProjectStatusBadgeClass,
  getWorkItemAssignees,
  isCrewAssignedToItem,
} from '../../utils/formatters';
import { CustomSelect } from '../ui/CustomSelect';
import { HorizontalSlideTrack } from '../ui/HorizontalSlideTrack';
import { LazyLoadSentinel } from '../ui/LazyLoadSentinel';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { KanbanStage, PriorityLevel, ProjectDiscipline, WorkItem } from '../../types';

const KANBAN_COLUMN_BATCH = 10;

export const KanbanPage: React.FC = () => {
  const {
    workspace,
    nowMs,
    currentCrewId,
    crewWorkloads,
    kanbanDivisionFilter,
    setKanbanDivisionFilter,
    updateWorkItem,
    transitionProjectWorkflow,
    startTimer,
    stopTimer,
    addManualTimeLog,
    setSelectedWorkItemId,
    triggerToast,
  } = useWorkspace();

  const isAll = kanbanDivisionFilter === 'all';
  const isTech = kanbanDivisionFilter === 'technical_support';
  const divisionMeta = !isAll ? MANAGER_DIVISION_META[kanbanDivisionFilter] : null;

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [disciplineFilter, setDisciplineFilter] = useState<'Semua' | ProjectDiscipline>('Semua');
  const [priorityFilter, setPriorityFilter] = useState<'Semua' | PriorityLevel>('Semua');
  const [crewFilter, setCrewFilter] = useState<string>('Semua');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<KanbanStage | null>(null);
  const [mobileStage, setMobileStage] = useState<KanbanStage>('production');
  const [columnLimits, setColumnLimits] = useState<Partial<Record<KanbanStage, number>>>({});

  const [manualLogOpen, setManualLogOpen] = useState(false);
  const [manualItemId, setManualItemId] = useState<string>('');
  const [manualStartTime, setManualStartTime] = useState<string>('09:00');
  const [manualEndTime, setManualEndTime] = useState<string>('11:00');
  const [manualDate, setManualDate] = useState<string>(REFERENCE_TODAY);
  const [manualNote, setManualNote] = useState<string>('');
  const [savingManual, setSavingManual] = useState(false);

  // Reset local filters when switching division tab
  useEffect(() => {
    setDisciplineFilter('Semua');
    setCrewFilter('Semua');
    setManualItemId('');
    setColumnLimits({});
  }, [kanbanDivisionFilter]);

  useEffect(() => {
    setColumnLimits({});
  }, [deferredSearch, disciplineFilter, priorityFilter, crewFilter]);

  const allKanbanProjects = useMemo(() => {
    if (!workspace) return [];
    return workspace.workItems.filter((item) => {
      if (item.category !== 'project') return false;
      if (
        item.workflowStage === 'pending_review' ||
        item.workflowStage === 'revision_admin' ||
        item.workflowStage === 'rejected_manager'
      ) {
        return false;
      }
      return true;
    });
  }, [workspace]);

  const videoTabCount = useMemo(
    () =>
      allKanbanProjects.filter(
        (item) =>
          (item.routedManager || getRoutedManagerForDiscipline(item.discipline)) ===
          'video_production'
      ).length,
    [allKanbanProjects]
  );

  const techTabCount = useMemo(
    () =>
      allKanbanProjects.filter(
        (item) =>
          (item.routedManager || getRoutedManagerForDiscipline(item.discipline)) ===
          'technical_support'
      ).length,
    [allKanbanProjects]
  );

  const projectItems = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return allKanbanProjects.filter((item) => {
      const routed = item.routedManager || getRoutedManagerForDiscipline(item.discipline);
      if (!isAll && routed !== kanbanDivisionFilter) return false;
      if (!isTech && disciplineFilter !== 'Semua' && item.discipline !== disciplineFilter) {
        return false;
      }
      if (priorityFilter !== 'Semua' && item.priority !== priorityFilter) return false;
      if (crewFilter !== 'Semua' && !isCrewAssignedToItem(item, crewFilter)) return false;
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !item.code.toLowerCase().includes(q) &&
        !(item.requestNo || '').toLowerCase().includes(q) &&
        !(item.coordinatorDepartment || '').toLowerCase().includes(q) &&
        !(item.clientName || '').toLowerCase().includes(q) &&
        !(item.clientPhone || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [
    allKanbanProjects,
    isAll,
    kanbanDivisionFilter,
    isTech,
    deferredSearch,
    disciplineFilter,
    priorityFilter,
    crewFilter,
  ]);

  const cardsByStage = useMemo(() => {
    const grouped = {} as Record<KanbanStage, WorkItem[]>;
    for (const col of KANBAN_COLUMNS) {
      grouped[col.id] = [];
    }
    for (const item of projectItems) {
      const list = grouped[item.kanbanStage];
      if (list) list.push(item);
    }
    return grouped;
  }, [projectItems]);

  const executingProjects = useMemo(
    () =>
      projectItems.filter(
        (p) => p.workflowStage === 'in_execution' || (!p.workflowStage && p.status !== 'Selesai')
      ),
    [projectItems]
  );

  const divisionCrewOptions = useMemo(() => {
    if (!workspace) return [];
    if (isAll) return workspace.crew;
    const filtered = workspace.crew.filter((c) =>
      isTech
        ? c.division === 'Installasi' || c.accessRole === 'tech_manager'
        : c.division === 'Shooting' || c.division === 'Editing' || c.accessRole === 'video_manager'
    );
    return filtered.length > 0 ? filtered : workspace.crew;
  }, [workspace, isAll, isTech]);

  if (!workspace) return null;

  const divisionManager = !isAll
    ? workspace.crew.find((c) =>
        isTech ? c.accessRole === 'tech_manager' : c.accessRole === 'video_manager'
      )
    : null;
  const effectiveManualId = manualItemId || executingProjects[0]?.id || projectItems[0]?.id || '';

  const moveCard = async (itemId: string, targetStage: KanbanStage) => {
    const item = workspace.workItems.find((w) => w.id === itemId);
    if (!item || item.kanbanStage === targetStage) return;

    if (targetStage === 'review' && item.workflowStage === 'in_execution') {
      await transitionProjectWorkflow(item.id, {
        action: 'submit_to_manager',
        actorCrewId: currentCrewId,
        handoverNote: 'Project selesai dikerjakan dan dikembalikan ke Manager.',
      });
      return;
    }

    const colTitle = KANBAN_COLUMNS.find((c) => c.id === targetStage)?.title || targetStage;
    await updateWorkItem(itemId, { kanbanStage: targetStage });
    triggerToast('Status Project Diperbarui', `${item.code} → ${colTitle}`, 'info');
  };

  const handleSubmitToManager = async (item: WorkItem) => {
    playUiMotionSound('success');
    await transitionProjectWorkflow(item.id, {
      action: 'submit_to_manager',
      actorCrewId: currentCrewId,
      handoverNote: 'Selesai dikerjakan Crew, siap ditinjau Manager.',
    });
  };

  const manualRange = computeManualTimeRange(manualStartTime, manualEndTime);

  const handleSaveManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveManualId || !manualRange.valid || savingManual) return;
    setSavingManual(true);
    try {
      playUiMotionSound('success');
      await addManualTimeLog({
        workItemId: effectiveManualId,
        crewId: currentCrewId,
        hours: manualRange.hours,
        startTime: manualStartTime,
        endTime: manualEndTime,
        date: manualDate,
        note: manualNote.trim() || 'Log jam manual',
      });
      setManualNote('');
      setManualLogOpen(false);
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-3.5 sm:space-y-4 md:h-full flex flex-col">
      {/* Unified Division Filter Tabs + Compact Status Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="grid grid-cols-3 sm:inline-grid sm:grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl border border-black/[0.08] dark:border-white/[0.08] w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              playUiMotionSound('tick');
              setKanbanDivisionFilter('all');
            }}
            className={`py-1.5 px-3 rounded-lg text-[12px] transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
              isAll
                ? 'bg-white dark:bg-[#1E222B] text-[#1C1D21] dark:text-white font-semibold shadow-2xs'
                : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] dark:hover:text-gray-200 font-medium'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Semua ({allKanbanProjects.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playUiMotionSound('tick');
              setKanbanDivisionFilter('video_production');
            }}
            className={`py-1.5 px-3 rounded-lg text-[12px] transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
              kanbanDivisionFilter === 'video_production'
                ? 'bg-white dark:bg-[#1E222B] text-[#9D113C] dark:text-[#fbc2d4] font-semibold shadow-2xs'
                : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] dark:hover:text-gray-200 font-medium'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>Video Prod. ({videoTabCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playUiMotionSound('tick');
              setKanbanDivisionFilter('technical_support');
            }}
            className={`py-1.5 px-3 rounded-lg text-[12px] transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
              isTech
                ? 'bg-white dark:bg-[#1E222B] text-[#0369A1] dark:text-[#7DD3FC] font-semibold shadow-2xs'
                : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] dark:hover:text-gray-200 font-medium'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            <span>Tech Support ({techTabCount})</span>
          </button>
        </div>

        <div
          data-dark-preserve={divisionMeta ? 'true' : undefined}
          className={`rounded-xl border px-3.5 py-2 flex items-center justify-between gap-3 ${
            divisionMeta
              ? `${divisionMeta.bgClass} ${divisionMeta.borderClass}`
              : 'bg-[#F6F7FA] dark:bg-white/[0.04] border-black/[0.08] dark:border-white/[0.10]'
          }`}
        >
          <span className="text-[11.5px] text-[#525660] dark:text-gray-300 truncate">
            {divisionMeta ? (
              <>
                <strong className={divisionMeta.textClass}>{divisionMeta.disciplines}</strong>
                {divisionManager ? ` · ${divisionManager.name}` : ''}
              </>
            ) : (
              'Semua divisi · Shooting, Editing & Installasi'
            )}
          </span>
          <span
            className={`text-[12px] font-mono tabular-nums font-bold shrink-0 ${
              divisionMeta ? divisionMeta.textClass : 'text-[#1C1D21] dark:text-gray-100'
            }`}
          >
            {projectItems.length} project
          </span>
        </div>
      </div>

      {/* Mobile-First Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 flex-1">
          <div className="relative col-span-2 sm:flex-1 sm:min-w-[160px] sm:max-w-[230px]">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isAll
                  ? 'Cari project...'
                  : isTech
                    ? 'Cari project installasi...'
                    : 'Cari project video...'
              }
              className="w-full h-10 sm:h-9 pl-8 pr-3 rounded-xl sm:rounded-lg border border-gray-300 bg-white text-xs text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-[#ee2e65]"
            />
          </div>

          {!isTech && (
            <CustomSelect
              value={disciplineFilter}
              onChange={(val) => setDisciplineFilter(val as 'Semua' | ProjectDiscipline)}
              ariaLabel="Filter tipe"
              size="sm"
              className="w-full sm:w-auto sm:min-w-[130px]"
              options={
                isAll
                  ? [
                      { value: 'Semua', label: 'Semua Tipe' },
                      { value: 'Shooting', label: 'Shooting' },
                      { value: 'Editing', label: 'Editing' },
                      { value: 'Installasi', label: 'Installasi' },
                    ]
                  : [
                      { value: 'Semua', label: 'Semua Tipe' },
                      { value: 'Shooting', label: 'Shooting' },
                      { value: 'Editing', label: 'Editing' },
                    ]
              }
            />
          )}

          <CustomSelect
            value={priorityFilter}
            onChange={(val) => setPriorityFilter(val as 'Semua' | PriorityLevel)}
            ariaLabel="Filter prioritas"
            size="sm"
            className="w-full sm:w-auto sm:min-w-[125px]"
            options={[
              { value: 'Semua', label: 'Prioritas' },
              { value: 'Mendesak', label: 'Mendesak' },
              { value: 'Tinggi', label: 'Tinggi' },
              { value: 'Sedang', label: 'Sedang' },
              { value: 'Rendah', label: 'Rendah' },
            ]}
          />

          <CustomSelect
            value={crewFilter}
            onChange={setCrewFilter}
            ariaLabel="Filter kru"
            size="sm"
            className={`${isTech ? '' : 'col-span-2 sm:col-span-1'} w-full sm:w-auto sm:min-w-[135px]`}
            options={[
              { value: 'Semua', label: 'Semua Kru' },
              ...divisionCrewOptions.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            playUiMotionSound('pop');
            setManualLogOpen((o) => !o);
          }}
          className={`${manualLogOpen ? ACTION_BTN_SOFT_PRIMARY : ACTION_BTN_SECONDARY} w-full md:w-auto`}
        >
          <PenLine className="w-3.5 h-3.5" />
          Input Jam Manual
        </button>
      </div>

      {/* Collapsible Manual Log Form */}
      {manualLogOpen && (
        <form
          onSubmit={handleSaveManualLog}
          className="p-3.5 rounded-2xl border border-[#C7C4FF] bg-[#F0EFFC]/45 space-y-2.5 animate-ui-modal"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-4 space-y-1">
              <span className="block text-[10.5px] font-semibold text-[#525660]">Project</span>
              <CustomSelect
                value={effectiveManualId}
                onChange={setManualItemId}
                ariaLabel="Pilih project"
                size="sm"
                searchable
                className="w-full"
                options={projectItems.map((p) => ({
                  value: p.id,
                  label: `${p.requestNo || p.code} · ${p.title}`,
                }))}
              />
            </div>

            <label className="md:col-span-2 space-y-1">
              <span className="block text-[10.5px] font-semibold text-[#525660]">Tanggal</span>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                aria-label="Tanggal"
                className="w-full h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-mono text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
              />
            </label>

            <label className="md:col-span-2 space-y-1">
              <span className="block text-[10.5px] font-semibold text-[#525660]">Waktu Awal</span>
              <input
                type="time"
                required
                value={manualStartTime}
                onChange={(e) => setManualStartTime(e.target.value)}
                aria-label="Waktu awal pengerjaan"
                className="w-full h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-mono tabular-nums text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
              />
            </label>

            <label className="md:col-span-2 space-y-1">
              <span className="block text-[10.5px] font-semibold text-[#525660]">Waktu Akhir</span>
              <input
                type="time"
                required
                value={manualEndTime}
                onChange={(e) => setManualEndTime(e.target.value)}
                aria-label="Waktu akhir pengerjaan"
                className="w-full h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-mono tabular-nums text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
              />
            </label>

            <div className="md:col-span-2 space-y-1">
              <span className="block text-[10.5px] font-semibold text-[#525660]">
                Durasi (Otomatis)
              </span>
              <div
                className={`w-full h-9 px-2.5 rounded-lg border flex items-center justify-center text-xs font-mono tabular-nums font-semibold ${
                  manualRange.valid
                    ? 'border-[#A3E4C6] bg-[#E6F9F0]/80 text-[#146C43]'
                    : 'border-[#F5B7B1] bg-[#FFECEB] text-[#942922]'
                }`}
              >
                {manualRange.valid ? manualRange.hoursLabel : 'Akhir > Awal'}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Catatan pengerjaan manual..."
              className="flex-1 h-9 px-3 rounded-lg border border-gray-300 bg-white text-xs text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
            />
            <button
              type="submit"
              disabled={savingManual || !effectiveManualId || !manualRange.valid}
              className={`${ACTION_BTN_PRIMARY} sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Simpan Log
            </button>
          </div>
        </form>
      )}

      {/* Mobile Stage Switcher (md:hidden) — UI-KIT HorizontalSlideTrack with moving rail */}
      <HorizontalSlideTrack
        className="md:hidden"
        accent="primary"
        visibility="mobile-only"
        activeKey={mobileStage}
        trackClassName="flex items-center gap-1.5"
      >
        {KANBAN_COLUMNS.map((col) => {
          const count = cardsByStage[col.id].length;
          const active = mobileStage === col.id;
          return (
            <button
              key={`mob-tab-${col.id}`}
              type="button"
              data-slide-active={active ? 'true' : undefined}
              onClick={() => {
                playUiMotionSound('tick');
                setMobileStage(col.id);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap shrink-0 flex items-center gap-1.5 border transition-colors cursor-pointer ${
                active
                  ? isTech
                    ? 'bg-[#0284C7] text-white border-[#0284C7] font-semibold shadow-xs'
                    : 'bg-[#ee2e65] text-white border-[#ee2e65] font-semibold shadow-xs'
                  : 'bg-white dark:bg-[#1B1E24] text-[#525660] dark:text-gray-300 border-black/[0.12] dark:border-white/[0.12] font-medium'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : col.dotColor}`} />
              <span>{col.title}</span>
              <span className="font-mono tabular-nums text-[11px] opacity-85">{count}</span>
            </button>
          );
        })}
      </HorizontalSlideTrack>

      {/* Kanban Board: Single Full-Width Column on Mobile, Horizontal 5-Column Drag-and-Drop on md+ */}
      <div
        data-no-pull="true"
        className="flex-1 min-h-0 md:overflow-x-auto pb-2 md:pb-3 ui-scrollbar-violet"
      >
        <div className="grid grid-cols-1 md:grid-flow-col md:auto-cols-[minmax(268px,1fr)] gap-3.5 md:min-h-[480px]">
          {KANBAN_COLUMNS.map((col, colIndex) => {
            const cards = cardsByStage[col.id];
            const colLimit = columnLimits[col.id] ?? KANBAN_COLUMN_BATCH;
            const visibleCards = cards.slice(0, colLimit);
            const wipExceeded = col.wipLimit !== null && cards.length > col.wipLimit;
            const isDropTarget = dragOverCol === col.id;
            const visibleOnMobile = mobileStage === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(col.id);
                }}
                onDragLeave={() => setDragOverCol((prev) => (prev === col.id ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedId = e.dataTransfer.getData('text/plain') || draggingId;
                  setDragOverCol(null);
                  setDraggingId(null);
                  if (droppedId) void moveCard(droppedId, col.id);
                }}
                className={`${visibleOnMobile ? 'flex' : 'hidden md:flex'} rounded-2xl border p-3 flex-col transition-colors ${
                  isDropTarget
                    ? isTech
                      ? 'bg-[#E0F2FE]/70 border-[#0284C7]/60'
                      : 'bg-[#FEF1F5]/70 border-[#ee2e65]/60'
                    : 'bg-[#F6F7FA] border-black/[0.06]'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between gap-2 px-1 pb-2.5 mb-2.5 border-b border-black/[0.06]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${col.dotColor}`} />
                    <h2 className="text-[13px] font-bold text-[#1C1D21] truncate">{col.title}</h2>
                  </div>
                  <div className="text-[11.5px] font-mono tabular-nums shrink-0 flex items-center gap-1">
                    <span className={wipExceeded ? 'text-[#C11448] font-bold' : 'text-[#6E717A]'}>
                      {cards.length}
                    </span>
                    {wipExceeded && <AlertTriangle className="w-3.5 h-3.5 text-[#C11448]" />}
                  </div>
                </div>

                {/* Minimal Scannable Cards (Lazy-loaded 10 per batch) */}
                <div className="space-y-2.5 flex-1">
                  {visibleCards.map((item) => {
                    const assignees = getWorkItemAssignees(item, workspace.crew);
                    const bar = getWorkBarColor(item.category, item.discipline);
                    const dl = getDeadlineStatus(item.dueDate, item.status);
                    const isMeAssigned = isCrewAssignedToItem(item, currentCrewId);
                    const timerActorId = isMeAssigned ? currentCrewId : item.assigneeId;
                    const itemTimers = workspace.activeTimers.filter(
                      (t) => t.workItemId === item.id
                    );
                    const myTimer = itemTimers.find((t) => t.crewId === timerActorId);
                    const runningTimer = isMeAssigned ? myTimer : itemTimers[0];
                    const liveSec = getLiveLoggedSeconds(item, workspace.activeTimers, nowMs);

                    return (
                      <article
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(item.id);
                          e.dataTransfer.setData('text/plain', item.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                        className={`rounded-xl bg-white border border-black/[0.07] p-3.5 transition-shadow hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,0.14)] cursor-grab active:cursor-grabbing ${
                          draggingId === item.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono text-[#6E717A] truncate">
                            {item.requestNo || item.code} ·{' '}
                            <span className={`font-sans font-semibold ${bar.textClass}`}>
                              {item.discipline}
                            </span>
                          </span>
                          {item.projectStatus ? (
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${getProjectStatusBadgeClass(
                                item.projectStatus
                              )}`}
                            >
                              {item.projectStatus}
                            </span>
                          ) : (
                            <span className={PRIORITY_STYLE[item.priority].text}>
                              {item.priority}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedWorkItemId(item.id)}
                          className="mt-1.5 text-[13.5px] font-bold text-[#1C1D21] hover:text-[#ee2e65] text-left leading-snug line-clamp-2 block w-full cursor-pointer"
                        >
                          {item.title}
                        </button>

                        <div className="mt-1.5 text-[11.5px] text-[#6E717A] flex items-center justify-between gap-2">
                          <span className="truncate">
                            {item.clientName || 'Internal'}
                            {item.coordinatorDepartment ? ` · ${item.coordinatorDepartment}` : ''}
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {formatHoursCompact(liveSec)} / {item.estimatedHours}j
                          </span>
                        </div>

                        {(() => {
                          const shootSched = formatShootingSchedule(item);
                          if (!shootSched) return null;
                          return (
                            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF1F5] text-[#9D113C] text-[10.5px] font-semibold max-w-full truncate">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">Shoot {shootSched}</span>
                            </div>
                          );
                        })()}

                        {item.revisionNote && item.workflowStage === 'in_execution' && (
                          <div className="mt-2 text-[11px] text-[#942922] truncate">
                            Revisi: {item.revisionNote}
                          </div>
                        )}

                        <div className="mt-2.5 h-1 w-full rounded-full bg-[#EFEFF4] overflow-hidden">
                          <div
                            style={{ width: `${item.progress}%` }}
                            className={`h-full rounded-full ${bar.barClass}`}
                          />
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-black/[0.05] flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {assignees.length > 0 && (
                              <div
                                className="flex items-center -space-x-1.5 shrink-0"
                                title={assignees
                                  .map((member) => {
                                    const mwl = crewWorkloads.find((w) => w.crew.id === member.id);
                                    return `${member.name}${mwl?.isOverloaded ? ' (Overload)' : ''}`;
                                  })
                                  .join(', ')}
                              >
                                {assignees.slice(0, 3).map((member) => (
                                  <span
                                    key={member.id}
                                    data-dark-preserve="true"
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9.5px] font-bold ring-2 ring-white dark:ring-[#1B1E24] ${member.avatarBg} ${member.avatarText}`}
                                  >
                                    {member.initials}
                                  </span>
                                ))}
                                {assignees.length > 3 && (
                                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9.5px] font-bold bg-[#EFEFF4] text-[#525660] ring-2 ring-white dark:ring-[#1B1E24]">
                                    +{assignees.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                            <span
                              className={`text-[11px] inline-flex items-center gap-1 truncate ${
                                dl.severity === 'overdue'
                                  ? 'text-[#C11448] font-semibold'
                                  : dl.severity === 'soon'
                                    ? 'text-[#B45309] font-semibold'
                                    : 'text-[#6E717A]'
                              }`}
                            >
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">{dl.label}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1 md:gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                runningTimer
                                  ? void stopTimer(runningTimer.id)
                                  : void startTimer(item.id, timerActorId)
                              }
                              title={
                                runningTimer
                                  ? 'Stop Timer'
                                  : itemTimers.length > 0
                                    ? `Start Timer (${itemTimers.length} kru aktif)`
                                    : 'Start Timer'
                              }
                              className={`relative w-9 h-9 md:w-7 md:h-7 rounded-lg flex items-center justify-center cursor-pointer ${
                                runningTimer
                                  ? 'bg-[#FFECEB] text-[#942922]'
                                  : 'bg-[#F6F7FA] md:bg-transparent hover:bg-[#FEF1F5] text-[#525660] hover:text-[#ee2e65]'
                              }`}
                            >
                              {runningTimer ? (
                                <Square className="w-3.5 h-3.5 md:w-3 md:h-3 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 md:w-3 md:h-3 fill-current" />
                              )}
                              {!runningTimer && itemTimers.length > 0 && (
                                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#ee2e65] animate-pulse" />
                              )}
                            </button>

                            {item.workflowStage === 'in_execution' && (
                              <button
                                type="button"
                                onClick={() => void handleSubmitToManager(item)}
                                title="Selesai & Kembalikan ke Manager"
                                className="w-9 h-9 md:w-7 md:h-7 rounded-lg bg-[#FEF1F5]/70 md:bg-transparent hover:bg-[#FEF1F5] text-[#ee2e65] flex items-center justify-center cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {colIndex > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  void moveCard(item.id, KANBAN_COLUMNS[colIndex - 1].id)
                                }
                                title="Geser kiri"
                                className="w-8 h-9 md:w-6 md:h-7 rounded-lg bg-[#F6F7FA] md:bg-transparent hover:bg-[#F4F5F8] text-[#6E717A] flex items-center justify-center cursor-pointer"
                              >
                                <ArrowLeft className="w-3.5 h-3.5 md:w-3 md:h-3" />
                              </button>
                            )}
                            {colIndex < KANBAN_COLUMNS.length - 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  void moveCard(item.id, KANBAN_COLUMNS[colIndex + 1].id)
                                }
                                title="Geser kanan"
                                className="w-8 h-9 md:w-6 md:h-7 rounded-lg bg-[#F6F7FA] md:bg-transparent hover:bg-[#F4F5F8] text-[#6E717A] flex items-center justify-center cursor-pointer"
                              >
                                <ArrowRight className="w-3.5 h-3.5 md:w-3 md:h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {cards.length > visibleCards.length && (
                    <LazyLoadSentinel
                      remaining={cards.length - visibleCards.length}
                      batchSize={KANBAN_COLUMN_BATCH}
                      onLoadMore={() =>
                        setColumnLimits((prev) => ({
                          ...prev,
                          [col.id]: (prev[col.id] ?? KANBAN_COLUMN_BATCH) + KANBAN_COLUMN_BATCH,
                        }))
                      }
                      itemLabel="kartu"
                      compact
                    />
                  )}

                  {cards.length === 0 && (
                    <div className="py-8 text-center text-[12px] text-[#8C9099] border border-dashed border-black/[0.08] rounded-xl">
                      Kosong
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
