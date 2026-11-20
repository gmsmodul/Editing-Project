import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Film,
  Wrench,
  CalendarCheck2,
  Clock,
  Phone,
  Send,
  ClipboardCheck,
  Users,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  ACTION_BTN_DANGER_SOFT,
  ACTION_BTN_PRIMARY,
  ACTION_BTN_SECONDARY,
} from '../../constants/buttonStyles';
import {
  MANAGER_DIVISION_META,
  getRoutedManagerForDiscipline,
  getWorkBarColor,
} from '../../constants/theme';
import {
  REFERENCE_TODAY,
  formatAssigneeSummary,
  formatHoursCompact,
  formatRelativeTimeId,
  formatShortDateId,
  formatShootingSchedule,
  getLiveLoggedSeconds,
  getProjectStatusBadgeClass,
} from '../../utils/formatters';
import { CustomSelect } from '../ui/CustomSelect';
import { MultiCrewPicker } from '../ui/MultiCrewPicker';
import { DEFAULT_PAGE_SIZE, PaginationBar } from '../ui/PaginationBar';
import { LazyLoadSentinel } from '../ui/LazyLoadSentinel';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { DifficultyLevel, ManagerDivision, WorkItem } from '../../types';

interface ApprovalDraft {
  assigneeIds: string[];
  estimatedHours: number;
  difficulty: DifficultyLevel;
  startDate: string;
  dueDate: string;
  dueTime: string;
  revisionNote: string;
  rejectionReason: string;
  mode: 'approve' | 'return' | 'reject';
}

const QUICK_REJECTION_REASONS = [
  'Jadwal bentrok dengan agenda prioritas',
  'Kapasitas tim penuh pada periode diminta',
  'Di luar scope / kapasitas divisi',
  'Dibatalkan atau ditunda oleh klien',
];

const LAZY_BATCH_SIZE = 10;

export const ProjectManagerPage: React.FC = () => {
  const {
    workspace,
    nowMs,
    currentCrewId,
    isTechManager,
    crewWorkloads,
    transitionProjectWorkflow,
    setSelectedWorkItemId,
    setActivePage,
  } = useWorkspace();

  const [division, setDivision] = useState<ManagerDivision>(
    isTechManager ? 'technical_support' : 'video_production'
  );
  const [drafts, setDrafts] = useState<Record<string, ApprovalDraft>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [revisionOpenId, setRevisionOpenId] = useState<string | null>(null);
  const [revisionText, setRevisionText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewLimit, setReviewLimit] = useState(LAZY_BATCH_SIZE);
  const [handoverLimit, setHandoverLimit] = useState(LAZY_BATCH_SIZE);
  const [deliveredPage, setDeliveredPage] = useState(1);
  const [deliveredPageSize, setDeliveredPageSize] = useState(DEFAULT_PAGE_SIZE);

  const isTech = division === 'technical_support';
  const divisionMeta = MANAGER_DIVISION_META[division];

  const allProjects = useMemo(
    () => (workspace?.workItems || []).filter((w) => w.category === 'project'),
    [workspace]
  );

  const videoActionCount = useMemo(
    () =>
      allProjects.filter(
        (p) =>
          (p.routedManager || getRoutedManagerForDiscipline(p.discipline)) === 'video_production' &&
          (p.workflowStage === 'pending_review' || p.workflowStage === 'pending_handover')
      ).length,
    [allProjects]
  );

  const techActionCount = useMemo(
    () =>
      allProjects.filter(
        (p) =>
          (p.routedManager || getRoutedManagerForDiscipline(p.discipline)) ===
            'technical_support' &&
          (p.workflowStage === 'pending_review' || p.workflowStage === 'pending_handover')
      ).length,
    [allProjects]
  );

  const divisionProjects = useMemo(
    () =>
      allProjects.filter(
        (p) => (p.routedManager || getRoutedManagerForDiscipline(p.discipline)) === division
      ),
    [allProjects, division]
  );

  const pendingReviewItems = useMemo(
    () => divisionProjects.filter((p) => p.workflowStage === 'pending_review'),
    [divisionProjects]
  );

  const pendingHandoverItems = useMemo(
    () => divisionProjects.filter((p) => p.workflowStage === 'pending_handover'),
    [divisionProjects]
  );

  const deliveredProjects = useMemo(
    () =>
      divisionProjects
        .filter((p) => p.workflowStage === 'delivered_client')
        .sort((a, b) =>
          (b.deliveredToClientAt || b.updatedAt).localeCompare(a.deliveredToClientAt || a.updatedAt)
        ),
    [divisionProjects]
  );

  const deliveredTotalPages = Math.max(1, Math.ceil(deliveredProjects.length / deliveredPageSize));
  const safeDeliveredPage = Math.min(deliveredPage, deliveredTotalPages);

  useEffect(() => {
    setReviewLimit(LAZY_BATCH_SIZE);
    setHandoverLimit(LAZY_BATCH_SIZE);
    setDeliveredPage(1);
  }, [division]);

  useEffect(() => {
    setDeliveredPage(1);
  }, [deliveredPageSize]);

  const visibleReviewItems = useMemo(
    () => pendingReviewItems.slice(0, reviewLimit),
    [pendingReviewItems, reviewLimit]
  );

  const visibleHandoverItems = useMemo(
    () => pendingHandoverItems.slice(0, handoverLimit),
    [pendingHandoverItems, handoverLimit]
  );

  const paginatedDelivered = useMemo(() => {
    const start = (safeDeliveredPage - 1) * deliveredPageSize;
    return deliveredProjects.slice(start, start + deliveredPageSize);
  }, [deliveredProjects, safeDeliveredPage, deliveredPageSize]);

  const assignableCrew = useMemo(() => {
    if (!workspace) return [];
    const crewOnly = workspace.crew.filter((c) => c.accessRole === 'crew');
    const base = crewOnly.length > 0 ? crewOnly : workspace.crew;
    return [...base].sort((a, b) => {
      const aMatch = isTech
        ? a.division === 'Installasi'
        : a.division === 'Shooting' || a.division === 'Editing';
      const bMatch = isTech
        ? b.division === 'Installasi'
        : b.division === 'Shooting' || b.division === 'Editing';
      if (aMatch === bMatch) return 0;
      return aMatch ? -1 : 1;
    });
  }, [workspace, isTech]);

  const sortedCrewWorkloads = useMemo(() => {
    return [...crewWorkloads].sort((a, b) => {
      const aMatch = isTech
        ? a.crew.division === 'Installasi'
        : a.crew.division === 'Shooting' || a.crew.division === 'Editing';
      const bMatch = isTech
        ? b.crew.division === 'Installasi'
        : b.crew.division === 'Shooting' || b.crew.division === 'Editing';
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
      return b.utilizationPct - a.utilizationPct;
    });
  }, [crewWorkloads, isTech]);

  if (!workspace) return null;

  const divisionManager = workspace.crew.find((c) =>
    isTech ? c.accessRole === 'tech_manager' : c.accessRole === 'video_manager'
  );

  const getDraft = (item: WorkItem): ApprovalDraft => {
    if (drafts[item.id]) return drafts[item.id];
    const matchingDiv = assignableCrew.filter((c) =>
      item.discipline === 'Installasi'
        ? c.division === 'Installasi'
        : c.division === item.discipline
    );
    const pool = matchingDiv.length > 0 ? matchingDiv : assignableCrew;
    const sorted = [...pool].sort((a, b) => {
      const wa = crewWorkloads.find((w) => w.crew.id === a.id)?.utilizationPct || 0;
      const wb = crewWorkloads.find((w) => w.crew.id === b.id)?.utilizationPct || 0;
      return wa - wb;
    });
    const defaultCrewId = sorted[0]?.id || assignableCrew[0]?.id || item.assigneeId;
    return {
      assigneeIds: [defaultCrewId],
      estimatedHours: item.estimatedHours || 8,
      difficulty: item.difficulty || 'Menengah',
      startDate:
        (item.discipline === 'Shooting' && item.shootingDate) ||
        item.receivedDate ||
        item.startDate ||
        REFERENCE_TODAY,
      dueDate: item.dueDate || REFERENCE_TODAY,
      dueTime:
        (item.discipline === 'Shooting' && item.shootingEndTime) ||
        item.dueTime ||
        '17:00',
      revisionNote: '',
      rejectionReason: '',
      mode: 'approve',
    };
  };

  const patchDraft = (item: WorkItem, patch: Partial<ApprovalDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [item.id]: { ...getDraft(item), ...patch },
    }));
  };

  const handleApproveAssign = async (item: WorkItem) => {
    const d = getDraft(item);
    const assignedIds =
      d.assigneeIds.length > 0 ? d.assigneeIds : [assignableCrew[0]?.id || item.assigneeId];
    setBusyId(item.id);
    try {
      playUiMotionSound('success');
      await transitionProjectWorkflow(item.id, {
        action: 'approve_assign',
        actorCrewId: currentCrewId,
        assigneeId: assignedIds[0],
        assigneeIds: assignedIds,
        estimatedHours: Math.max(0.5, Number(d.estimatedHours) || 1),
        difficulty: d.difficulty,
        startDate: d.startDate,
        dueDate: d.dueDate < d.startDate ? d.startDate : d.dueDate,
        dueTime: d.dueTime,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleReturnToAdmin = async (item: WorkItem) => {
    const d = getDraft(item);
    if (!d.revisionNote.trim()) return;
    setBusyId(item.id);
    try {
      playUiMotionSound('pop');
      await transitionProjectWorkflow(item.id, {
        action: 'return_to_admin',
        actorCrewId: currentCrewId,
        revisionNote: d.revisionNote.trim(),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectProject = async (item: WorkItem) => {
    const d = getDraft(item);
    if (!d.rejectionReason.trim()) return;
    setBusyId(item.id);
    try {
      playUiMotionSound('pop');
      await transitionProjectWorkflow(item.id, {
        action: 'reject_project',
        actorCrewId: currentCrewId,
        rejectionReason: d.rejectionReason.trim(),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeliver = async (item: WorkItem) => {
    setBusyId(item.id);
    try {
      playUiMotionSound('success');
      await transitionProjectWorkflow(item.id, {
        action: 'deliver_to_client',
        actorCrewId: currentCrewId,
        handoverNote: deliveryNotes[item.id]?.trim() || item.handoverNote || undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestCrewRevision = async (item: WorkItem) => {
    if (!revisionText.trim()) return;
    setBusyId(item.id);
    try {
      playUiMotionSound('pop');
      await transitionProjectWorkflow(item.id, {
        action: 'request_crew_revision',
        actorCrewId: currentCrewId,
        revisionNote: revisionText.trim(),
      });
      setRevisionOpenId(null);
      setRevisionText('');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-5 w-full ui-stagger">
      {/* Division Switcher & Manager Identity Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl border border-black/[0.08] dark:border-white/[0.08] w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              playUiMotionSound('tick');
              setDivision('video_production');
            }}
            className={`py-2 px-3.5 rounded-lg text-[12.5px] transition-colors cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap ${
              !isTech
                ? 'bg-white dark:bg-[#1E222B] text-[#9D113C] dark:text-[#fbc2d4] font-semibold shadow-2xs'
                : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] dark:hover:text-gray-200 font-medium'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>Video Production</span>
            {videoActionCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold tabular-nums bg-[#FEF1F5] dark:bg-[#ee2e65]/20 text-[#C11448] dark:text-[#fbc2d4]">
                {videoActionCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              playUiMotionSound('tick');
              setDivision('technical_support');
            }}
            className={`py-2 px-3.5 rounded-lg text-[12.5px] transition-colors cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap ${
              isTech
                ? 'bg-white dark:bg-[#1E222B] text-[#0369A1] dark:text-[#7DD3FC] font-semibold shadow-2xs'
                : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] dark:hover:text-gray-200 font-medium'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            <span>Technical Support</span>
            {techActionCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold tabular-nums bg-[#E0F2FE] dark:bg-sky-500/20 text-[#0369A1] dark:text-sky-300">
                {techActionCount}
              </span>
            )}
          </button>
        </div>

        <div
          data-dark-preserve="true"
          className={`rounded-xl border px-3.5 py-2 flex items-center justify-between gap-3 ${divisionMeta.bgClass} ${divisionMeta.borderClass}`}
        >
          <div className="text-[12px] text-[#525660] truncate">
            <strong className={divisionMeta.textClass}>{divisionMeta.disciplines}</strong>
            {divisionManager ? ` · Manager: ${divisionManager.name}` : ''}
          </div>
          <div className="flex items-center gap-2 text-[11.5px] font-mono tabular-nums font-bold shrink-0">
            <span className={divisionMeta.textClass}>{pendingReviewItems.length} review</span>
            <span className="text-black/20">·</span>
            <span className="text-[#146C43]">{pendingHandoverItems.length} serah terima</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: REVIEW PROJECT (LEFT) + KAPASITAS KRU (RIGHT) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <section className="xl:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#F0EFFC] dark:bg-violet-500/20 text-[#6C5DD3] dark:text-violet-300 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-4 h-4" />
              </span>
              <h2 className="text-[15px] font-bold text-[#1C1D21] dark:text-gray-100">
                Review Project ({pendingReviewItems.length})
              </h2>
            </div>
            <span className="text-[12px] text-[#6E717A] dark:text-gray-400">
              Approve &amp; tugaskan kru, kembalikan ke admin, atau tolak
            </span>
          </div>

        {pendingReviewItems.length > 0 ? (
          <div className="space-y-3.5">
            {visibleReviewItems.map((item) => {
              const bar = getWorkBarColor(item.category, item.discipline);
              const draft = getDraft(item);
              const assignedCount = Math.max(1, draft.assigneeIds.length);
              const perCrewShare = Number(
                (Number(draft.estimatedHours || 0) / assignedCount).toFixed(1)
              );
              const selectedProjections = draft.assigneeIds
                .map((cid) => {
                  const wl = crewWorkloads.find((w) => w.crew.id === cid);
                  if (!wl) return null;
                  const projectedHours = Number((wl.totalActiveHours + perCrewShare).toFixed(1));
                  const projectedPct = Math.round(
                    (projectedHours / Math.max(1, wl.crew.maxWeeklyHours)) * 100
                  );
                  return {
                    crew: wl.crew,
                    projectedHours,
                    projectedPct,
                    willOverload: projectedHours > wl.crew.maxWeeklyHours,
                  };
                })
                .filter((p): p is NonNullable<typeof p> => Boolean(p));

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-black/[0.12] dark:border-white/[0.10] bg-white dark:bg-[#15181E] p-4 sm:p-5 space-y-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#6E717A] dark:text-gray-400">
                        <span className="font-mono font-semibold text-[#1C1D21] dark:text-gray-100">
                          {item.requestNo || item.code}
                        </span>
                        <span>·</span>
                        <span className={`font-semibold ${bar.textClass}`}>{item.discipline}</span>
                        {item.coordinatorDepartment && (
                          <>
                            <span>·</span>
                            <span>{item.coordinatorDepartment}</span>
                          </>
                        )}
                        {item.projectStatus && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${getProjectStatusBadgeClass(
                              item.projectStatus
                            )}`}
                          >
                            {item.projectStatus}
                          </span>
                        )}
                        {item.calendarCoordination && (
                          <span className="inline-flex items-center gap-1 text-[#0F6E4B] dark:text-[#6EE7B7] font-medium">
                            <CalendarCheck2 className="w-3 h-3" />
                            Kalender
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedWorkItemId(item.id)}
                        className="mt-1 text-[15px] font-bold text-[#1C1D21] dark:text-gray-100 hover:text-[#ee2e65] text-left cursor-pointer"
                      >
                        {item.title}
                      </button>

                      <div className="mt-1.5 text-[12px] text-[#6E717A] dark:text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[#1C1D21] dark:text-gray-200 font-medium">
                          {item.clientName || 'Klien Umum'}
                        </span>
                        {item.clientPhone && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11.5px]">
                            <Phone className="w-3 h-3" />
                            {item.clientPhone}
                          </span>
                        )}
                        <span>·</span>
                        <span>
                          Received {formatShortDateId(item.receivedDate || item.startDate)} → Required{' '}
                          <strong className="text-[#1C1D21] dark:text-gray-200">
                            {formatShortDateId(item.dueDate)}
                          </strong>
                        </span>
                        {(() => {
                          const shootSched = formatShootingSchedule(item);
                          if (!shootSched) return null;
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF1F5] dark:bg-[#ee2e65]/20 text-[#9D113C] dark:text-[#fbc2d4] text-[11px] font-semibold">
                              <Clock className="w-3 h-3" />
                              Shooting: {shootSched}
                            </span>
                          );
                        })()}
                      </div>
                      {(item.changeNotes || item.description) && (
                        <p className="mt-1.5 text-[12px] text-[#525660] dark:text-gray-300 line-clamp-2">
                          {item.changeNotes || item.description}
                        </p>
                      )}
                    </div>

                    <div className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl sm:rounded-lg border border-gray-300 dark:border-white/[0.10] shrink-0">
                      <button
                        type="button"
                        onClick={() => patchDraft(item, { mode: 'approve' })}
                        className={`py-2 sm:py-1 px-2.5 rounded-lg sm:rounded-md text-[12px] cursor-pointer ${
                          draft.mode === 'approve'
                            ? 'bg-white dark:bg-[#1E222B] text-[#146C43] dark:text-emerald-300 font-semibold shadow-2xs'
                            : 'text-[#6E717A] dark:text-gray-400 font-medium'
                        }`}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => patchDraft(item, { mode: 'return' })}
                        className={`py-2 sm:py-1 px-2.5 rounded-lg sm:rounded-md text-[12px] cursor-pointer ${
                          draft.mode === 'return'
                            ? 'bg-white dark:bg-[#1E222B] text-[#8C5811] dark:text-amber-300 font-semibold shadow-2xs'
                            : 'text-[#6E717A] dark:text-gray-400 font-medium'
                        }`}
                      >
                        Kembalikan
                      </button>
                      <button
                        type="button"
                        onClick={() => patchDraft(item, { mode: 'reject' })}
                        className={`py-2 sm:py-1 px-2.5 rounded-lg sm:rounded-md text-[12px] cursor-pointer ${
                          draft.mode === 'reject'
                            ? 'bg-white dark:bg-[#1E222B] text-[#942922] dark:text-rose-300 font-semibold shadow-2xs'
                            : 'text-[#6E717A] dark:text-gray-400 font-medium'
                        }`}
                      >
                        Tolak
                      </button>
                    </div>
                  </div>

                  {/* Decision Form */}
                  <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                    {draft.mode === 'approve' ? (
                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#646772] dark:text-gray-400 mb-1.5">
                            Crew Pelaksana (Bisa Pilih Lebih dari 1)
                          </label>
                          <MultiCrewPicker
                            crew={assignableCrew}
                            selectedIds={draft.assigneeIds}
                            onChange={(nextIds) => patchDraft(item, { assigneeIds: nextIds })}
                            crewWorkloads={crewWorkloads}
                            estimatedHours={Number(draft.estimatedHours) || 0}
                            accent={isTech ? 'sky' : 'rose'}
                            compact
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-[#646772] dark:text-gray-400 mb-1">
                              Total Durasi (Jam)
                            </label>
                            <input
                              type="number"
                              min={0.5}
                              max={120}
                              step={0.5}
                              value={draft.estimatedHours}
                              onChange={(e) =>
                                patchDraft(item, { estimatedHours: Number(e.target.value) })
                              }
                              className="w-full h-9 px-3 rounded-xl border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-[#1B1E24] text-xs font-mono tabular-nums text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-[#646772] dark:text-gray-400 mb-1">
                              Kesulitan
                            </label>
                            <CustomSelect
                              value={draft.difficulty}
                              onChange={(val) =>
                                patchDraft(item, { difficulty: val as DifficultyLevel })
                              }
                              ariaLabel="Tingkat Kesulitan"
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

                          <div>
                            <label className="block text-[11px] font-semibold text-[#646772] dark:text-gray-400 mb-1">
                              Tenggat
                            </label>
                            <input
                              type="date"
                              value={draft.dueDate}
                              onChange={(e) => patchDraft(item, { dueDate: e.target.value })}
                              className="w-full h-9 px-2.5 rounded-xl border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-[#1B1E24] text-xs font-mono text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {selectedProjections.map((proj) => (
                              <span
                                key={proj.crew.id}
                                className={`text-[12px] font-medium inline-flex items-center gap-1.5 ${
                                  proj.willOverload ? 'text-[#C11448]' : 'text-[#146C43]'
                                }`}
                              >
                                {proj.willOverload ? (
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                )}
                                {proj.crew.name.split(' ')[0]}:{' '}
                                <span className="font-mono tabular-nums font-semibold">
                                  {proj.projectedHours}/{proj.crew.maxWeeklyHours}j ({proj.projectedPct}%)
                                </span>
                                {proj.willOverload ? ' · Overload' : ''}
                              </span>
                            ))}
                          </div>

                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void handleApproveAssign(item)}
                            className={`${ACTION_BTN_PRIMARY} w-full sm:w-auto`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {busyId === item.id
                              ? 'Memproses...'
                              : assignedCount > 1
                                ? `Approve & Kirim ke ${assignedCount} Crew`
                                : 'Approve & Kirim ke Crew'}
                          </button>
                        </div>
                      </div>
                    ) : draft.mode === 'return' ? (
                      <div className="space-y-2">
                        <p className="text-[11.5px] text-[#8C5811] dark:text-amber-300">
                          Kembalikan ke Admin Project jika data atau brief belum lengkap untuk direvisi lalu dikirim ulang.
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                          <input
                            type="text"
                            value={draft.revisionNote}
                            onChange={(e) => patchDraft(item, { revisionNote: e.target.value })}
                            placeholder="Catatan kekurangan untuk Admin Project..."
                            className="w-full sm:flex-1 h-10 sm:h-9 px-3 rounded-xl border border-[#FAD7A0] bg-white dark:bg-[#1B1E24] text-xs text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#D97706]"
                          />
                          <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => patchDraft(item, { mode: 'approve' })}
                              className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={!draft.revisionNote.trim() || busyId === item.id}
                              onClick={() => void handleReturnToAdmin(item)}
                              className={`${ACTION_BTN_DANGER_SOFT} w-full sm:w-auto`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Kembalikan
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-[11.5px] text-[#942922] dark:text-rose-300">
                          Project yang ditolak tidak akan masuk ke papan Crew, kalender tim, atau beban kru. Admin Project akan menerima notifikasi beserta alasannya.
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {QUICK_REJECTION_REASONS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => patchDraft(item, { rejectionReason: preset })}
                              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors cursor-pointer ${
                                draft.rejectionReason === preset
                                  ? 'bg-[#FFECEB] border-[#F5B7B1] text-[#942922] font-semibold'
                                  : 'bg-white dark:bg-[#1B1E24] border-black/[0.12] dark:border-white/[0.12] text-[#525660] dark:text-gray-300 hover:border-[#F5B7B1] hover:text-[#942922]'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                          <input
                            type="text"
                            value={draft.rejectionReason}
                            onChange={(e) => patchDraft(item, { rejectionReason: e.target.value })}
                            placeholder="Tulis alasan penolakan project untuk disampaikan ke Admin & Klien..."
                            className="w-full sm:flex-1 h-10 sm:h-9 px-3 rounded-xl border border-[#F5B7B1] bg-white dark:bg-[#1B1E24] text-xs text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#C11448]"
                          />
                          <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => patchDraft(item, { mode: 'approve' })}
                              className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={!draft.rejectionReason.trim() || busyId === item.id}
                              onClick={() => void handleRejectProject(item)}
                              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full bg-[#C11448] text-white text-[12px] font-semibold hover:bg-[#9D113C] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer w-full sm:w-auto"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {busyId === item.id ? 'Memproses...' : 'Tolak Project'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            <LazyLoadSentinel
              remaining={pendingReviewItems.length - visibleReviewItems.length}
              batchSize={LAZY_BATCH_SIZE}
              onLoadMore={() => setReviewLimit((prev) => prev + LAZY_BATCH_SIZE)}
              itemLabel="review"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#15181E] py-8 text-center text-[13px] text-[#6E717A] dark:text-gray-400">
            Tidak ada antrean review untuk {isTech ? 'Technical Support' : 'Video Production'}.
          </div>
        )}
        </section>

        {/* KAPASITAS KRU — Right Beside Review Project */}
        <aside className="xl:col-span-4 xl:sticky xl:top-3 rounded-2xl border border-black/[0.12] dark:border-white/[0.10] bg-white dark:bg-[#15181E] p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-[#FEF1F5] dark:bg-[#ee2e65]/20 text-[#ee2e65] flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-[14.5px] font-bold text-[#1C1D21] dark:text-gray-100 truncate">
                Kapasitas Kru
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                playUiMotionSound('tick');
                setActivePage('workload');
              }}
              className="text-[12px] font-medium text-[#ee2e65] hover:underline cursor-pointer shrink-0"
            >
              Kelola →
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#6E717A] dark:text-gray-400 pb-1 border-b border-black/[0.06] dark:border-white/[0.08]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[#ee2e65]" />
              Project
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[#10B981]" />
              Rutin
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[#F59E0B]" />
              Fleksibel
            </span>
          </div>

          <div className="space-y-3">
            {sortedCrewWorkloads.map((wl) => {
              const maxScale = Math.max(wl.crew.maxWeeklyHours, wl.totalActiveHours);
              const projPct = (wl.projectHours / maxScale) * 100;
              const routPct = (wl.routineHours / maxScale) * 100;
              const flexPct = (wl.flexibleHours / maxScale) * 100;
              const isMatchDiv = isTech
                ? wl.crew.division === 'Installasi'
                : wl.crew.division === 'Shooting' || wl.crew.division === 'Editing';

              return (
                <div key={wl.crew.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-[#1C1D21] dark:text-gray-100 truncate">
                        {wl.crew.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                          isMatchDiv
                            ? isTech
                              ? 'bg-[#E0F2FE] dark:bg-sky-500/20 text-[#0369A1] dark:text-sky-300'
                              : 'bg-[#FEF1F5] dark:bg-[#ee2e65]/20 text-[#9D113C] dark:text-[#fbc2d4]'
                            : 'bg-[#F4F5F8] dark:bg-white/[0.07] text-[#6E717A] dark:text-gray-400'
                        }`}
                      >
                        {wl.crew.division}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums text-[11.5px] shrink-0">
                      <span className="text-[#6E717A] dark:text-gray-400">
                        {wl.totalActiveHours}/{wl.crew.maxWeeklyHours}j
                      </span>
                      {wl.isOverloaded ? (
                        <span className="text-[#C11448] font-bold inline-flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          {wl.utilizationPct}%
                        </span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            wl.isNearLimit ? 'text-[#B45309]' : 'text-[#146C43]'
                          }`}
                        >
                          {wl.utilizationPct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden flex">
                    <div style={{ width: `${projPct}%` }} className="h-full bg-[#ee2e65]" />
                    <div style={{ width: `${routPct}%` }} className="h-full bg-[#10B981]" />
                    <div style={{ width: `${flexPct}%` }} className="h-full bg-[#F59E0B]" />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* SECTION 2: SIAP DISERAHKAN KE KLIEN */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#FEF1F5] dark:bg-[#ee2e65]/20 text-[#ee2e65] flex items-center justify-center shrink-0">
              <Send className="w-3.5 h-3.5" />
            </span>
            <h2 className="text-[15px] font-bold text-[#1C1D21] dark:text-gray-100">
              Siap Diserahkan ke Klien ({pendingHandoverItems.length})
            </h2>
          </div>
          <span className="text-[12px] text-[#6E717A] dark:text-gray-400">
            QC hasil kru sebelum diserahkan ke klien
          </span>
        </div>

        {pendingHandoverItems.length > 0 ? (
          <div className="space-y-3">
            {visibleHandoverItems.map((item) => {
              const bar = getWorkBarColor(item.category, item.discipline);
              const crewLabel = formatAssigneeSummary(item, workspace.crew);
              const liveSec = getLiveLoggedSeconds(item, workspace.activeTimers, nowMs);

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-black/[0.12] dark:border-white/[0.10] bg-white dark:bg-[#15181E] p-4 sm:p-5 space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#6E717A] dark:text-gray-400">
                        <span className="font-mono font-semibold text-[#1C1D21] dark:text-gray-100">
                          {item.requestNo || item.code}
                        </span>
                        <span>·</span>
                        <span className={`font-semibold ${bar.textClass}`}>{item.discipline}</span>
                        {item.coordinatorDepartment && (
                          <>
                            <span>·</span>
                            <span>{item.coordinatorDepartment}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{item.clientName || 'Klien Umum'}</span>
                        {item.clientPhone && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="w-3 h-3" />
                            {item.clientPhone}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedWorkItemId(item.id)}
                        className="mt-1 text-[15px] font-bold text-[#1C1D21] dark:text-gray-100 hover:text-[#ee2e65] text-left cursor-pointer"
                      >
                        {item.title}
                      </button>

                      {(() => {
                        const shootSched = formatShootingSchedule(item);
                        if (!shootSched) return null;
                        return (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF1F5] dark:bg-[#ee2e65]/20 text-[#9D113C] dark:text-[#fbc2d4] text-[11px] font-semibold">
                            <Clock className="w-3 h-3" />
                            Shooting: {shootSched}
                          </div>
                        );
                      })()}

                      {item.handoverNote && (
                        <p className="mt-1 text-[12.5px] text-[#525660] dark:text-gray-300">
                          {item.handoverNote}
                        </p>
                      )}
                    </div>

                    <div className="flex sm:block items-center justify-between gap-2 sm:text-right shrink-0 text-[12px] pt-1 sm:pt-0">
                      <div className="font-semibold text-[#1C1D21] dark:text-gray-100">{crewLabel}</div>
                      <div className="font-mono tabular-nums text-[#6E717A] dark:text-gray-400">
                        {formatHoursCompact(liveSec)} / {item.estimatedHours}j
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        value={deliveryNotes[item.id] ?? item.handoverNote ?? ''}
                        onChange={(e) =>
                          setDeliveryNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Catatan serah terima / tautan file..."
                        className="w-full sm:flex-1 h-10 sm:h-9 px-3 rounded-xl border border-gray-300 dark:border-white/[0.14] bg-white dark:bg-[#1B1E24] text-xs text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                      />
                      <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRevisionOpenId((curr) => (curr === item.id ? null : item.id));
                            setRevisionText('');
                          }}
                          className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Revisi Crew
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void handleDeliver(item)}
                          className={`${ACTION_BTN_PRIMARY} w-full sm:w-auto`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          Berikan ke Klien
                        </button>
                      </div>
                    </div>

                    {revisionOpenId === item.id && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={revisionText}
                          onChange={(e) => setRevisionText(e.target.value)}
                          placeholder="Catatan revisi untuk Crew..."
                          className="w-full sm:flex-1 h-10 sm:h-9 px-3 rounded-xl border border-[#F5B7B1] bg-white dark:bg-[#1B1E24] text-xs text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                        />
                        <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setRevisionOpenId(null)}
                            className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={!revisionText.trim() || busyId === item.id}
                            onClick={() => void handleRequestCrewRevision(item)}
                            className={`${ACTION_BTN_DANGER_SOFT} w-full sm:w-auto`}
                          >
                            Kirim Revisi
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            <LazyLoadSentinel
              remaining={pendingHandoverItems.length - visibleHandoverItems.length}
              batchSize={LAZY_BATCH_SIZE}
              onLoadMore={() => setHandoverLimit((prev) => prev + LAZY_BATCH_SIZE)}
              itemLabel="project"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#15181E] py-8 text-center text-[13px] text-[#6E717A] dark:text-gray-400">
            Belum ada project {isTech ? 'Technical Support' : 'Video Production'} yang menunggu serah terima ke klien.
          </div>
        )}
      </section>

      {/* SECTION 3: SELESAI DISERAHKAN */}
      <section className="rounded-2xl border border-black/[0.12] dark:border-white/[0.10] bg-white dark:bg-[#15181E] overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2 border-b border-black/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#E6F9F0] dark:bg-emerald-500/20 text-[#146C43] dark:text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <h2 className="text-[15px] font-bold text-[#1C1D21] dark:text-gray-100">
              Selesai Diserahkan ({deliveredProjects.length})
            </h2>
          </div>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-black/[0.06] dark:divide-white/[0.07]">
          {paginatedDelivered.map((item) => {
            const crewLabel = formatAssigneeSummary(item, workspace.crew);
            return (
              <button
                key={`mob-del-${item.id}`}
                type="button"
                onClick={() => setSelectedWorkItemId(item.id)}
                className="w-full text-left p-4 space-y-1 hover:bg-[#FAFBFD] dark:hover:bg-white/[0.03] cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#1C1D21] dark:text-gray-100 leading-snug">
                    {item.requestNo || item.code} · {item.title}
                  </span>
                  <span className="text-[11.5px] font-mono tabular-nums font-semibold text-[#1C1D21] dark:text-gray-200 shrink-0">
                    {formatHoursCompact(item.loggedSeconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11.5px] text-[#6E717A] dark:text-gray-400">
                  <span className="truncate">
                    {item.clientName || 'Internal'} · {crewLabel}
                  </span>
                  <span className="text-[#146C43] dark:text-emerald-300 shrink-0 tabular-nums">
                    {item.deliveredToClientAt
                      ? formatRelativeTimeId(item.deliveredToClientAt)
                      : formatShortDateId(item.dueDate)}
                  </span>
                </div>
              </button>
            );
          })}
          {paginatedDelivered.length === 0 && (
            <div className="py-8 text-center text-[12.5px] text-[#6E717A] dark:text-gray-400">
              Belum ada arsip project selesai diserahkan untuk divisi ini.
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto ui-scrollbar-violet">
          <table className="w-full text-left border-collapse min-w-[600px] text-[12.5px]">
            <thead>
              <tr className="bg-[#FAFBFD] dark:bg-white/[0.03] border-b border-black/[0.08] dark:border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider text-[#6E717A] dark:text-gray-400">
                <th className="py-2.5 pl-5 pr-3">Project</th>
                <th className="py-2.5 px-3">Klien &amp; Dept</th>
                <th className="py-2.5 px-3">Crew</th>
                <th className="py-2.5 px-3 text-right">Durasi</th>
                <th className="py-2.5 pl-3 pr-5 text-right">Diserahkan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
              {paginatedDelivered.map((item) => {
                const crewLabel = formatAssigneeSummary(item, workspace.crew);
                const bar = getWorkBarColor(item.category, item.discipline);
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedWorkItemId(item.id)}
                    className="hover:bg-[#FAFBFD] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <td className="py-3 pl-5 pr-3">
                      <div className="font-semibold text-[#1C1D21] dark:text-gray-100 hover:text-[#ee2e65]">
                        {item.requestNo || item.code} · {item.title}
                      </div>
                      <div className={`text-[11px] font-semibold mt-0.5 ${bar.textClass}`}>
                        {item.discipline}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[#525660] dark:text-gray-300">
                      <div className="font-medium text-[#1C1D21] dark:text-gray-100">
                        {item.clientName || 'Internal'}
                      </div>
                      {item.coordinatorDepartment && (
                        <div className="text-[11px] text-[#6E717A] dark:text-gray-400">
                          {item.coordinatorDepartment}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#525660] dark:text-gray-300">{crewLabel}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#1C1D21] dark:text-gray-100">
                      {formatHoursCompact(item.loggedSeconds)}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right text-[#146C43] dark:text-emerald-300 font-medium tabular-nums">
                      {item.deliveredToClientAt
                        ? formatRelativeTimeId(item.deliveredToClientAt)
                        : formatShortDateId(item.dueDate)}
                    </td>
                  </tr>
                );
              })}
              {paginatedDelivered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#6E717A] dark:text-gray-400">
                    Belum ada arsip project selesai diserahkan untuk divisi ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination for Delivered Archive (mulai dari 10 item) */}
        <PaginationBar
          currentPage={safeDeliveredPage}
          totalItems={deliveredProjects.length}
          pageSize={deliveredPageSize}
          onPageChange={setDeliveredPage}
          onPageSizeChange={setDeliveredPageSize}
          itemLabel="project"
          accent={isTech ? 'sky' : 'rose'}
        />
      </section>
    </div>
  );
};
