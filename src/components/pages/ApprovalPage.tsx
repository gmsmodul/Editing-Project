import React, { useMemo, useState } from 'react';
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
  formatShortDateId,
  formatShootingSchedule,
  getProjectStatusBadgeClass,
} from '../../utils/formatters';
import { CustomSelect } from '../ui/CustomSelect';
import { MultiCrewPicker } from '../ui/MultiCrewPicker';
import { WorkflowStepper } from '../ui/WorkflowStepper';
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

interface ApprovalPageProps {
  division: ManagerDivision;
}

export const ApprovalPage: React.FC<ApprovalPageProps> = ({ division }) => {
  const {
    workspace,
    currentCrewId,
    crewWorkloads,
    transitionProjectWorkflow,
    setSelectedWorkItemId,
  } = useWorkspace();

  const [drafts, setDrafts] = useState<Record<string, ApprovalDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const isTech = division === 'technical_support';
  const divisionMeta = MANAGER_DIVISION_META[division];

  const assignableCrew = useMemo(() => {
    if (!workspace) return [];
    const crewOnly = workspace.crew.filter((c) => c.accessRole === 'crew');
    const base = crewOnly.length > 0 ? crewOnly : workspace.crew;
    // Prioritize crew belonging to this division first
    return [...base].sort((a, b) => {
      const aMatch = isTech ? a.division === 'Installasi' : a.division === 'Shooting' || a.division === 'Editing';
      const bMatch = isTech ? b.division === 'Installasi' : b.division === 'Shooting' || b.division === 'Editing';
      if (aMatch === bMatch) return 0;
      return aMatch ? -1 : 1;
    });
  }, [workspace, isTech]);

  const pendingItems = useMemo(() => {
    if (!workspace) return [];
    return workspace.workItems.filter((item) => {
      if (item.category !== 'project' || item.workflowStage !== 'pending_review') return false;
      const routed = item.routedManager || getRoutedManagerForDiscipline(item.discipline);
      return routed === division;
    });
  }, [workspace, division]);

  const returnedToAdminItems = useMemo(() => {
    if (!workspace) return [];
    return workspace.workItems.filter((item) => {
      if (item.category !== 'project' || item.workflowStage !== 'revision_admin') return false;
      const routed = item.routedManager || getRoutedManagerForDiscipline(item.discipline);
      return routed === division;
    });
  }, [workspace, division]);

  const rejectedItems = useMemo(() => {
    if (!workspace) return [];
    return workspace.workItems.filter((item) => {
      if (item.category !== 'project' || item.workflowStage !== 'rejected_manager') return false;
      const routed = item.routedManager || getRoutedManagerForDiscipline(item.discipline);
      return routed === division;
    });
  }, [workspace, division]);

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
    const assignedIds = d.assigneeIds.length > 0 ? d.assigneeIds : [assignableCrew[0]?.id || item.assigneeId];
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

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-4 w-full ui-stagger">
      <WorkflowStepper currentStep={2} division={division} />

      {/* Dedicated Division Identity Strip */}
      <div
        data-dark-preserve="true"
        className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${divisionMeta.bgClass} ${divisionMeta.borderClass}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isTech ? 'bg-[#0284C7] text-white' : 'bg-[#ee2e65] text-white'
            }`}
          >
            {isTech ? <Wrench className="w-4 h-4" /> : <Film className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <div className={`text-[13.5px] font-bold leading-tight ${divisionMeta.textClass}`}>
              {isTech ? 'Divisi Technical Support' : 'Divisi Video Production'}
            </div>
            <div className="text-[11.5px] text-[#525660] truncate">
              {divisionMeta.disciplines}
              {divisionManager ? ` · Manager: ${divisionManager.name}` : ''}
            </div>
          </div>
        </div>
        <span className={`text-[12px] font-mono tabular-nums font-bold ${divisionMeta.textClass}`}>
          {pendingItems.length} antrean review
        </span>
      </div>

      {/* Pending Review Cards — Flat Single-Elevation */}
      {pendingItems.length > 0 ? (
        <div className="space-y-4">
          {pendingItems.map((item) => {
            const bar = getWorkBarColor(item.category, item.discipline);
            const draft = getDraft(item);
            const assignedCount = Math.max(1, draft.assigneeIds.length);
            const perCrewShare = Number((Number(draft.estimatedHours || 0) / assignedCount).toFixed(1));
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
                className="rounded-2xl border border-black/[0.12] bg-white p-4 sm:p-5 space-y-3.5 sm:space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#6E717A]">
                      <span className="font-mono font-semibold text-[#1C1D21]">
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
                        <span className="inline-flex items-center gap-1 text-[#0F6E4B] font-medium">
                          <CalendarCheck2 className="w-3 h-3" />
                          Kalender
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedWorkItemId(item.id)}
                      className="mt-1 text-[15px] font-bold text-[#1C1D21] hover:text-[#ee2e65] text-left cursor-pointer"
                    >
                      {item.title}
                    </button>

                    <div className="mt-1.5 text-[12px] text-[#6E717A] flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[#1C1D21] font-medium">
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
                        <strong className="text-[#1C1D21]">{formatShortDateId(item.dueDate)}</strong>
                      </span>
                      {(() => {
                        const shootSched = formatShootingSchedule(item);
                        if (!shootSched) return null;
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF1F5] text-[#9D113C] text-[11px] font-semibold">
                            <Clock className="w-3 h-3" />
                            Shooting: {shootSched}
                          </span>
                        );
                      })()}
                    </div>
                    {(item.changeNotes || item.description) && (
                      <p className="mt-1.5 text-[12px] text-[#525660] line-clamp-2">
                        {item.changeNotes || item.description}
                      </p>
                    )}
                  </div>

                  <div className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-gray-100 rounded-xl sm:rounded-lg border border-gray-300 shrink-0">
                    <button
                      type="button"
                      onClick={() => patchDraft(item, { mode: 'approve' })}
                      className={`py-2 sm:py-1 px-2.5 rounded-lg sm:rounded-md text-[12px] cursor-pointer ${
                        draft.mode === 'approve'
                          ? 'bg-white text-[#146C43] font-semibold shadow-2xs'
                          : 'text-[#6E717A] font-medium'
                      }`}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => patchDraft(item, { mode: 'return' })}
                      className={`py-2 sm:py-1 px-2.5 rounded-lg sm:rounded-md text-[12px] cursor-pointer ${
                        draft.mode === 'return'
                          ? 'bg-white text-[#8C5811] font-semibold shadow-2xs'
                          : 'text-[#6E717A] font-medium'
                      }`}
                    >
                      Kembalikan
                    </button>
                    <button
                      type="button"
                      onClick={() => patchDraft(item, { mode: 'reject' })}
                      className={`py-2 sm:py-1 px-2.5 rounded-lg sm:rounded-md text-[12px] cursor-pointer ${
                        draft.mode === 'reject'
                          ? 'bg-white text-[#942922] font-semibold shadow-2xs'
                          : 'text-[#6E717A] font-medium'
                      }`}
                    >
                      Tolak
                    </button>
                  </div>
                </div>

                {/* Form Directly Separated by Hairline */}
                <div className="pt-3 border-t border-black/[0.06]">
                  {draft.mode === 'approve' ? (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#646772] mb-1.5">
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
                          <label className="block text-[11px] font-semibold text-[#646772] mb-1">
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
                            className="w-full h-9 px-3 rounded-xl border border-gray-300 bg-white text-xs font-mono tabular-nums text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#646772] mb-1">
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
                          <label className="block text-[11px] font-semibold text-[#646772] mb-1">
                            Tenggat
                          </label>
                          <input
                            type="date"
                            value={draft.dueDate}
                            onChange={(e) => patchDraft(item, { dueDate: e.target.value })}
                            className="w-full h-9 px-2.5 rounded-xl border border-gray-300 bg-white text-xs font-mono text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
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
                      <p className="text-[11.5px] text-[#8C5811]">
                        Kembalikan ke Admin Project jika data atau brief belum lengkap untuk direvisi lalu dikirim ulang.
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <input
                          type="text"
                          value={draft.revisionNote}
                          onChange={(e) => patchDraft(item, { revisionNote: e.target.value })}
                          placeholder="Catatan kekurangan untuk Admin Project..."
                          className="w-full sm:flex-1 h-10 sm:h-9 px-3 rounded-xl border border-[#FAD7A0] bg-white text-xs text-[#1C1D21] focus:outline-none focus:border-[#D97706]"
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
                      <p className="text-[11.5px] text-[#942922]">
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
                                : 'bg-white border-black/[0.12] text-[#525660] hover:border-[#F5B7B1] hover:text-[#942922]'
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
                          className="w-full sm:flex-1 h-10 sm:h-9 px-3 rounded-xl border border-[#F5B7B1] bg-white text-xs text-[#1C1D21] focus:outline-none focus:border-[#C11448]"
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
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/[0.12] bg-white py-10 text-center text-[13px] text-[#6E717A]">
          Tidak ada antrean review untuk {isTech ? 'Technical Support' : 'Video Production'}.
        </div>
      )}

      {/* Quiet Returned List */}
      {returnedToAdminItems.length > 0 && (
        <section className="rounded-2xl border border-black/[0.12] bg-white p-4 space-y-2.5">
          <h2 className="text-[13.5px] font-bold text-[#1C1D21]">
            Dikembalikan ke Admin ({returnedToAdminItems.length})
          </h2>
          <div className="divide-y divide-black/[0.06]">
            {returnedToAdminItems.map((item) => (
              <div
                key={item.id}
                className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-[12.5px]"
              >
                <div className="min-w-0 truncate">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkItemId(item.id)}
                    className="font-semibold text-[#1C1D21] hover:text-[#ee2e65] cursor-pointer"
                  >
                    {item.requestNo || item.code} · {item.title}
                  </button>
                  <span className="text-[#8C5811] ml-2">{item.revisionNote}</span>
                </div>
                <span className="text-[11.5px] text-[#8C5811] font-medium shrink-0">Revisi Admin</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quiet Rejected Archive List */}
      {rejectedItems.length > 0 && (
        <section className="rounded-2xl border border-[#F5B7B1] bg-[#FFECEB]/30 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#942922]">
            <XCircle className="w-4 h-4 shrink-0" />
            Project Ditolak ({rejectedItems.length})
          </div>
          <div className="divide-y divide-[#F5B7B1]/60">
            {rejectedItems.map((item) => (
              <div
                key={item.id}
                className="py-2 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3 text-[12.5px]"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkItemId(item.id)}
                    className="font-semibold text-[#1C1D21] hover:text-[#ee2e65] cursor-pointer text-left"
                  >
                    {item.requestNo || item.code} · {item.title}
                  </button>
                  {item.rejectionReason && (
                    <span className="text-[#942922] ml-2">Alasan: {item.rejectionReason}</span>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#FFECEB] text-[#942922] text-[11px] font-semibold shrink-0">
                  Ditolak
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
