import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  ChevronDown,
  Sliders,
  PenLine,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ACTION_BTN_DANGER_SOFT } from '../../constants/buttonStyles';
import { getWorkBarColor } from '../../constants/theme';
import {
  EDITING_AUTO_STOP_LABEL,
  formatDurationClock,
  formatHoursCompact,
  formatRelativeTimeId,
  getPerCrewEstimatedHours,
  getTimerElapsedSeconds,
  getWorkItemAssigneeIds,
  isCrewAssignedToItem,
  type CrewWorkloadSummary,
} from '../../utils/formatters';
import { DEFAULT_PAGE_SIZE, PaginationBar } from '../ui/PaginationBar';
import { LazyLoadSentinel } from '../ui/LazyLoadSentinel';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { CrewMember } from '../../types';

const CREW_TASK_BATCH = 10;

interface ReassignSplitDropdownProps {
  taskCode: string;
  fromCrewId: string;
  crewList: CrewMember[];
  crewWorkloads: CrewWorkloadSummary[];
  onSelect: (targetCrewId: string) => void;
}

const ReassignSplitDropdown: React.FC<ReassignSplitDropdownProps> = ({
  taskCode,
  fromCrewId,
  crewList,
  crewWorkloads,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 230,
  });

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 232;
    const estHeight = Math.min(280, crewList.length * 46 + 40);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < estHeight + 12 && rect.top > estHeight + 12
        ? rect.top - estHeight - 6
        : rect.bottom + 6;
    const left = Math.max(
      12,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)
    );
    setPos({ top, left, width: menuWidth });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleScrollOrResize = () => updatePosition();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  const targetOptions = crewList
    .filter((c) => c.id !== fromCrewId)
    .map((member) => {
      const wl = crewWorkloads.find((w) => w.crew.id === member.id);
      return {
        member,
        utilizationPct: wl?.utilizationPct || 0,
        isOverloaded: Boolean(wl?.isOverloaded),
      };
    })
    .sort((a, b) => a.utilizationPct - b.utilizationPct);

  const toggleMenu = () => {
    playUiMotionSound('tick');
    setOpen((prev) => !prev);
  };

  return (
    <div ref={triggerRef} className="inline-flex items-stretch rounded-lg border border-black/[0.14] dark:border-white/[0.15] bg-white dark:bg-[#1E222B] overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={toggleMenu}
        aria-label={`Alihkan ${taskCode} ke kru lain`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 text-[12px] font-medium text-[#1C1D21] dark:text-gray-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
      >
        <ArrowRightLeft className="w-3.5 h-3.5 text-[#6E717A] dark:text-gray-400 shrink-0" />
        <span>Alihkan</span>
      </button>
      <span className="w-px bg-black/[0.10] dark:bg-white/[0.12] my-1.5" aria-hidden="true" />
      <button
        type="button"
        onClick={toggleMenu}
        aria-label={`Buka daftar kru untuk alihkan ${taskCode}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center justify-center w-7 h-8 text-[#6E717A] dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-[#1C1D21] dark:hover:text-white transition-colors cursor-pointer"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[90] rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#1B1F27] shadow-xl py-1.5 overflow-hidden"
          >
            <div className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#6E717A] dark:text-gray-400 border-b border-black/[0.06] dark:border-white/[0.07]">
              Alihkan ke kru lain
            </div>
            <div className="max-h-[240px] overflow-y-auto py-1 ui-scrollbar-violet">
              {targetOptions.map(({ member, utilizationPct, isOverloaded }) => (
                <button
                  key={member.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    playUiMotionSound('pop');
                    setOpen(false);
                    onSelect(member.id);
                  }}
                  className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-[#FAFBFD] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${member.avatarBg} ${member.avatarText}`}
                    >
                      {member.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#1C1D21] dark:text-gray-100 truncate">
                        {member.name}
                      </div>
                      <div className="text-[10.5px] text-[#6E717A] dark:text-gray-400 truncate">
                        {member.division}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-mono tabular-nums font-semibold shrink-0 ${
                      isOverloaded
                        ? 'text-[#C11448] dark:text-[#FCA5A5]'
                        : 'text-[#146C43] dark:text-[#6EE7B7]'
                    }`}
                  >
                    {utilizationPct}%
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export const WorkloadPage: React.FC = () => {
  const {
    workspace,
    nowMs,
    crewWorkloads,
    startTimer,
    stopTimer,
    updateCrewCapacity,
    updateWorkItem,
    setSelectedWorkItemId,
    triggerToast,
  } = useWorkspace();

  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState<number>(40);
  const [crewTaskLimits, setCrewTaskLimits] = useState<Record<string, number>>({});
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(DEFAULT_PAGE_SIZE);

  const crewById = useMemo(
    () => new Map((workspace?.crew || []).map((c) => [c.id, c])),
    [workspace?.crew]
  );

  const workItemById = useMemo(
    () => new Map((workspace?.workItems || []).map((w) => [w.id, w])),
    [workspace?.workItems]
  );

  const allTimeLogs = workspace?.timeLogs || [];
  const logsTotalPages = Math.max(1, Math.ceil(allTimeLogs.length / logsPageSize));
  const safeLogsPage = Math.min(logsPage, logsTotalPages);

  useEffect(() => {
    setLogsPage(1);
  }, [logsPageSize]);

  useEffect(() => {
    if (logsPage > logsTotalPages) setLogsPage(logsTotalPages);
  }, [logsPage, logsTotalPages]);

  const paginatedTimeLogs = useMemo(() => {
    const start = (safeLogsPage - 1) * logsPageSize;
    return allTimeLogs.slice(start, start + logsPageSize);
  }, [allTimeLogs, safeLogsPage, logsPageSize]);

  if (!workspace) return null;

  const handleReassignTask = async (
    workItemId: string,
    fromCrewId: string,
    nextCrewId: string
  ) => {
    if (fromCrewId === nextCrewId) return;
    const item = workspace.workItems.find((w) => w.id === workItemId);
    const targetCrew = workspace.crew.find((c) => c.id === nextCrewId);
    const currentIds = item ? getWorkItemAssigneeIds(item) : [fromCrewId];
    const replaced = currentIds.map((cid) => (cid === fromCrewId ? nextCrewId : cid));
    const uniqueNextIds = Array.from(new Set(replaced));
    await updateWorkItem(workItemId, {
      assigneeId: uniqueNextIds[0] || nextCrewId,
      assigneeIds: uniqueNextIds,
    });
    triggerToast(
      'Tugas Dialihkan',
      `Slot pekerjaan berhasil dialihkan ke ${targetCrew?.name || 'kru lain'} untuk menyeimbangkan beban.`,
      'success'
    );
  };

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-4 sm:space-y-5 w-full ui-stagger">
      {/* Section 1: Active Running Timers */}
      <section className="rounded-2xl border border-black/[0.12] bg-white p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-[#1C1D21]">
            Timer Sedang Berjalan ({workspace.activeTimers.length})
          </h2>
          {workspace.activeTimers.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#C11448]">
              <span className="w-2 h-2 rounded-full bg-[#ee2e65] animate-pulse" />
              Aktif Live
            </span>
          )}
        </div>

        {workspace.activeTimers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {workspace.activeTimers.map((timer) => {
              const item = workspace.workItems.find((w) => w.id === timer.workItemId);
              const member = workspace.crew.find((c) => c.id === timer.crewId);
              if (!item || !member) return null;
              const elapsedSec = getTimerElapsedSeconds(timer, nowMs);
              const isEditingProj =
                item.category === 'project' && item.discipline === 'Editing';
              return (
                <div
                  key={timer.id}
                  className="p-3.5 rounded-2xl border border-[#FBC2D4] bg-[#FEF1F5]/55 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedWorkItemId(item.id)}
                      className="text-[13.5px] font-bold text-[#1C1D21] hover:text-[#ee2e65] truncate block max-w-full text-left cursor-pointer"
                    >
                      {item.requestNo || item.code} · {item.title}
                    </button>
                    <div className="text-[12px] text-[#525660] mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="truncate">
                        {member.name}
                        {timer.note ? ` · ${timer.note}` : ''}
                      </span>
                      {isEditingProj && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#F0EFFC] text-[#3F3B99] text-[10px] font-semibold shrink-0">
                          Auto-stop {EDITING_AUTO_STOP_LABEL}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="font-mono tabular-nums text-[16px] font-bold text-[#C11448]">
                      {formatDurationClock(elapsedSec)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void stopTimer(timer.id)}
                      className={ACTION_BTN_DANGER_SOFT}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[12.5px] text-[#6E717A] py-2">
            Belum ada timer yang sedang berjalan. Klik tombol <strong>Play</strong> pada daftar tugas kru di bawah untuk memulai.
          </div>
        )}
      </section>

      {/* Section 2: Crew Workload Guardrail & Rebalance Panel */}
      <section className="rounded-2xl border border-black/[0.12] bg-white p-4 sm:p-5 space-y-4">
        <h2 className="text-[15px] font-bold text-[#1C1D21]">Kapasitas &amp; Beban Kru</h2>

        <div className="space-y-4">
          {crewWorkloads.map((wl) => {
            const crewTasks = workspace.workItems.filter(
              (i) =>
                isCrewAssignedToItem(i, wl.crew.id) &&
                i.status !== 'Selesai' &&
                !(
                  i.category === 'project' &&
                  (i.workflowStage === 'pending_review' ||
                    i.workflowStage === 'revision_admin' ||
                    i.workflowStage === 'rejected_manager')
                )
            );
            const maxScale = Math.max(wl.crew.maxWeeklyHours, wl.totalActiveHours);
            const isEditing = editingLimitId === wl.crew.id;

            return (
              <div
                key={wl.crew.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  wl.isOverloaded
                    ? 'border-[#F5B7B1] bg-[#FFECEB]/35'
                    : 'border-black/[0.08] bg-[#FAFBFD]'
                }`}
              >
                {/* Crew Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${wl.crew.avatarBg} ${wl.crew.avatarText}`}
                    >
                      {wl.crew.initials}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14.5px] font-bold text-[#1C1D21]">{wl.crew.name}</h3>
                        {wl.isOverloaded ? (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#C11448]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            OVERLOAD ({wl.utilizationPct}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#146C43]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aman ({wl.utilizationPct}%)
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#6E717A]">
                        {wl.crew.role} · {wl.crew.division} · Aktual terlacak{' '}
                        <span className="font-mono tabular-nums font-medium text-[#1C1D21]">
                          {wl.trackedHours} jam
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Configurable Weekly Limit */}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={10}
                          max={60}
                          value={limitDraft}
                          onChange={(e) => setLimitDraft(Number(e.target.value))}
                          className="w-16 px-2 py-1 rounded-lg border border-black/[0.15] bg-white font-mono tabular-nums text-[12.5px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void updateCrewCapacity(wl.crew.id, limitDraft);
                            setEditingLimitId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#ee2e65] text-white text-[12px] font-semibold cursor-pointer"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLimitId(null)}
                          className="px-2 py-1 rounded-lg bg-white border border-black/[0.10] text-[12px] text-[#525660] cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLimitId(wl.crew.id);
                          setLimitDraft(wl.crew.maxWeeklyHours);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-black/[0.09] text-[12px] font-mono tabular-nums text-[#1C1D21] hover:bg-[#F4F5F8] cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-[#6E717A]" />
                        {wl.totalActiveHours} / {wl.crew.maxWeeklyHours} jam
                      </button>
                    )}
                  </div>
                </div>

                {/* Stacked Bar */}
                <div className="relative h-3 w-full rounded-full bg-black/[0.06] overflow-hidden flex">
                  <div
                    style={{ width: `${(wl.projectHours / maxScale) * 100}%` }}
                    className="h-full bg-[#ee2e65]"
                  />
                  <div
                    style={{ width: `${(wl.routineHours / maxScale) * 100}%` }}
                    className="h-full bg-[#10B981]"
                  />
                  <div
                    style={{ width: `${(wl.flexibleHours / maxScale) * 100}%` }}
                    className="h-full bg-[#F59E0B]"
                  />
                </div>

                {/* Crew Active Assignments with 1-Click Reallocation (lazy-loaded 10/batch) */}
                <div className="divide-y divide-black/[0.06] bg-white rounded-xl border border-black/[0.07] px-3">
                  {crewTasks.slice(0, crewTaskLimits[wl.crew.id] ?? CREW_TASK_BATCH).map((task) => {
                    const bar = getWorkBarColor(task.category, task.discipline);
                    const ids = getWorkItemAssigneeIds(task);
                    const isMulti = ids.length > 1;
                    const shareHours = getPerCrewEstimatedHours(task);
                    const runningTimer = workspace.activeTimers.find(
                      (t) => t.workItemId === task.id && t.crewId === wl.crew.id
                    );
                    const runningSec = runningTimer ? getTimerElapsedSeconds(runningTimer, nowMs) : 0;
                    return (
                      <div
                        key={`${wl.crew.id}-${task.id}`}
                        className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-[12.5px]"
                      >
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setSelectedWorkItemId(task.id)}
                            className="font-semibold text-[#1C1D21] hover:text-[#ee2e65] truncate block max-w-full text-left cursor-pointer"
                          >
                            {task.code} · {task.title}
                          </button>
                          <div className="text-[11px] text-[#6E717A] font-mono tabular-nums">
                            <span className={`font-sans font-medium ${bar.textClass}`}>
                              {bar.label}
                            </span>{' '}
                            · {task.priority} · {task.difficulty} ·{' '}
                            {isMulti
                              ? `${shareHours}j/kru (Tim ${ids.length} kru)`
                              : `${task.estimatedHours} jam`}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0">
                          <ReassignSplitDropdown
                            taskCode={task.requestNo || task.code}
                            fromCrewId={wl.crew.id}
                            crewList={workspace.crew}
                            crewWorkloads={crewWorkloads}
                            onSelect={(targetCrewId) =>
                              void handleReassignTask(task.id, wl.crew.id, targetCrewId)
                            }
                          />

                          {task.category !== 'project' ? (
                            <button
                              type="button"
                              onClick={() => {
                                playUiMotionSound('tick');
                                setSelectedWorkItemId(task.id);
                              }}
                              title={`Catat jam pengerjaan ${task.code}`}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#F4F5F8] hover:bg-[#FEF1F5] border border-black/[0.10] text-[#1C1D21] hover:text-[#ee2e65] text-[12px] font-semibold transition-colors cursor-pointer shrink-0"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                              <span>Catat Jam</span>
                            </button>
                          ) : runningTimer ? (
                            <button
                              type="button"
                              onClick={() => void stopTimer(runningTimer.id)}
                              title={`Hentikan timer ${wl.crew.name}`}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#FFECEB] border border-[#F5B7B1] text-[#C11448] hover:bg-[#FDD8D5] text-[12px] font-mono tabular-nums font-semibold transition-colors cursor-pointer shrink-0"
                            >
                              <Square className="w-3 h-3 fill-current" />
                              {formatDurationClock(runningSec)}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                playUiMotionSound('success');
                                void startTimer(task.id, wl.crew.id);
                              }}
                              title={`Mulai timer untuk ${wl.crew.name}`}
                              aria-label={`Mulai timer ${task.code} untuk ${wl.crew.name}`}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#ee2e65] hover:bg-[#d82157] text-white text-[12px] font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Play</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {crewTasks.length > (crewTaskLimits[wl.crew.id] ?? CREW_TASK_BATCH) && (
                    <div className="py-2">
                      <LazyLoadSentinel
                        remaining={
                          crewTasks.length - (crewTaskLimits[wl.crew.id] ?? CREW_TASK_BATCH)
                        }
                        batchSize={CREW_TASK_BATCH}
                        onLoadMore={() =>
                          setCrewTaskLimits((prev) => ({
                            ...prev,
                            [wl.crew.id]:
                              (prev[wl.crew.id] ?? CREW_TASK_BATCH) + CREW_TASK_BATCH,
                          }))
                        }
                        itemLabel="tugas"
                        autoLoad={false}
                        compact
                      />
                    </div>
                  )}
                  {crewTasks.length === 0 && (
                    <div className="py-3 text-[12px] text-[#6E717A]">
                      Tidak ada tanggungan aktif saat ini.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: Recent Tracked Time Logs — Mobile Cards + Desktop Table + Pagination */}
      <section className="rounded-2xl border border-black/[0.12] bg-white overflow-hidden">
        <div className="p-4 sm:p-5 pb-3 sm:pb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-[#1C1D21]">
            Riwayat Sesi Pelacakan Waktu ({allTimeLogs.length})
          </h2>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-black/[0.06] px-4 pb-3">
          {paginatedTimeLogs.map((log) => {
            const crew = crewById.get(log.crewId);
            const item = workItemById.get(log.workItemId);
            const isManual = log.source === 'manual';
            return (
              <div key={`mob-log-${log.id}`} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#1C1D21] leading-snug">
                    {item ? `${item.code} · ${item.title}` : log.workItemId}
                  </span>
                  <span className="font-mono tabular-nums text-[12.5px] font-semibold text-[#1C1D21] shrink-0">
                    {formatHoursCompact(log.durationSeconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11.5px] text-[#6E717A]">
                  <span className="truncate">
                    {crew?.name || '-'} ·{' '}
                    <span className={isManual ? 'text-[#3F3B99] font-medium' : 'text-[#146C43] font-medium'}>
                      {isManual
                        ? 'Manual'
                        : log.autoStopped
                          ? `Auto-stop ${EDITING_AUTO_STOP_LABEL}`
                          : 'Auto'}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatRelativeTimeId(log.endedAt)}</span>
                </div>
                {log.note && <div className="text-[11.5px] text-[#6E717A] truncate">{log.note}</div>}
              </div>
            );
          })}
          {paginatedTimeLogs.length === 0 && (
            <div className="py-6 text-center text-[12.5px] text-[#6E717A]">
              Belum ada riwayat sesi pelacakan waktu.
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto ui-scrollbar-violet px-5 pb-3">
          <table className="w-full text-left border-collapse min-w-[600px] text-[12.5px]">
            <thead>
              <tr className="border-b border-black/[0.08] text-[11.5px] text-[#6E717A]">
                <th className="py-2 pr-3">Kru</th>
                <th className="py-2 px-3">Pekerjaan</th>
                <th className="py-2 px-3">Metode</th>
                <th className="py-2 px-3">Catatan Sesi</th>
                <th className="py-2 px-3 text-right">Durasi</th>
                <th className="py-2 pl-3 text-right">Selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {paginatedTimeLogs.map((log) => {
                const crew = crewById.get(log.crewId);
                const item = workItemById.get(log.workItemId);
                const isManual = log.source === 'manual';
                return (
                  <tr key={log.id} className="hover:bg-[#FAFBFD]">
                    <td className="py-2.5 pr-3 font-medium text-[#1C1D21]">{crew?.name || '-'}</td>
                    <td className="py-2.5 px-3 text-[#1C1D21]">
                      {item ? `${item.code} · ${item.title}` : log.workItemId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        data-dark-preserve="true"
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                          isManual
                            ? 'bg-[#F0EFFC] text-[#3F3B99] border-[#C7C4FF]'
                            : 'bg-[#E6F9F0] text-[#146C43] border-[#A3E4C6]'
                        }`}
                      >
                        {isManual
                          ? 'Manual'
                          : log.autoStopped
                            ? `Auto-stop ${EDITING_AUTO_STOP_LABEL}`
                            : 'Auto Timer'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#6E717A]">{log.note || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#1C1D21]">
                      {formatHoursCompact(log.durationSeconds)}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-[#6E717A] tabular-nums">
                      {formatRelativeTimeId(log.endedAt)}
                    </td>
                  </tr>
                );
              })}
              {paginatedTimeLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6E717A]">
                    Belum ada riwayat sesi pelacakan waktu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer (mulai dari 10 item) */}
        <PaginationBar
          currentPage={safeLogsPage}
          totalItems={allTimeLogs.length}
          pageSize={logsPageSize}
          onPageChange={setLogsPage}
          onPageSizeChange={setLogsPageSize}
          itemLabel="sesi"
        />
      </section>
    </div>
  );
};
