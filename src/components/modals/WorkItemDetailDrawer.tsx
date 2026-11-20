import React, { useEffect, useState } from 'react';
import {
  X,
  Play,
  Square,
  BellRing,
  Trash2,
  Plus,
  CheckSquare,
  Square as UncheckedBox,
  AlertTriangle,
  MapPin,
  Calendar,
  Building2,
  Send,
  PenLine,
  Phone,
  Clock,
  CalendarCheck2,
  Check,
  Users,
  History,
  ArrowRightLeft,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  ACTION_BTN_DANGER_SOFT,
  ACTION_BTN_PRIMARY,
  ACTION_BTN_SECONDARY,
  ACTION_BTN_SOFT_PRIMARY,
} from '../../constants/buttonStyles';
import {
  KANBAN_COLUMNS,
  MANAGER_DIVISION_META,
  WORKFLOW_STAGE_META,
  getRoutedManagerForDiscipline,
  getWorkBarColor,
} from '../../constants/theme';
import {
  EDITING_AUTO_STOP_LABEL,
  REFERENCE_TODAY,
  computeManualTimeRange,
  computeProjectCrewContributions,
  formatDisplayDate,
  formatDurationClock,
  formatFullDateId,
  formatHoursCompact,
  formatRelativeTimeId,
  formatShootingSchedule,
  getDeadlineStatus,
  getLiveLoggedSeconds,
  getPerCrewEstimatedHours,
  getProjectStatusBadgeClass,
  getTimerElapsedSeconds,
  getWorkItemAssigneeIds,
  isCrewAssignedToItem,
} from '../../utils/formatters';
import { CustomSelect } from '../ui/CustomSelect';
import { MultiCrewPicker } from '../ui/MultiCrewPicker';
import { ProjectFieldsForm, type ProjectFieldsValue } from '../ui/ProjectFieldsForm';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { useBottomSheetMotion } from '../../hooks/useBottomSheetMotion';
import type {
  DifficultyLevel,
  KanbanStage,
  PriorityLevel,
} from '../../types';

export const WorkItemDetailDrawer: React.FC = () => {
  const {
    workspace,
    selectedWorkItemId,
    setSelectedWorkItemId,
    nowMs,
    currentCrewId,
    isProjectLead,
    crewWorkloads,
    updateWorkItem,
    deleteWorkItem,
    transitionProjectWorkflow,
    startTimer,
    stopTimer,
    addManualTimeLog,
    setActivePage,
    sendUrgentBroadcast,
    triggerToast,
  } = useWorkspace();

  const [newCheckText, setNewCheckText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [manualStartTime, setManualStartTime] = useState<string>('09:00');
  const [manualEndTime, setManualEndTime] = useState<string>('11:00');
  const [manualCrewId, setManualCrewId] = useState<string>('');
  const [manualNote, setManualNote] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [editingProjectFields, setEditingProjectFields] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectFieldsValue | null>(null);
  const [savingProjectFields, setSavingProjectFields] = useState(false);

  useEffect(() => {
    setEditingProjectFields(false);
    setProjectDraft(null);
    setManualCrewId('');
  }, [selectedWorkItemId]);

  const { setSheetElement, backdropRef, animateClose, sheetGestureProps } = useBottomSheetMotion({
    onClose: () => {
      setConfirmDelete(false);
      setEditingProjectFields(false);
      setProjectDraft(null);
      setSelectedWorkItemId(null);
    },
  });

  useEffect(() => {
    if (!selectedWorkItemId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') animateClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedWorkItemId, animateClose]);

  if (!workspace || !selectedWorkItemId) return null;

  const item = workspace.workItems.find((w) => w.id === selectedWorkItemId);
  if (!item) return null;

  const color = getWorkBarColor(item.category, item.discipline);
  const itemAssigneeIds = getWorkItemAssigneeIds(item);
  const itemTimers = workspace.activeTimers.filter((t) => t.workItemId === item.id);
  const timerActorCrewId = isCrewAssignedToItem(item, currentCrewId)
    ? currentCrewId
    : item.assigneeId;
  const myRunningTimer = itemTimers.find((t) => t.crewId === timerActorCrewId);
  const liveSeconds = getLiveLoggedSeconds(item, workspace.activeTimers, nowMs);
  const deadline = getDeadlineStatus(item.dueDate, item.status);
  const overloadedAssignees = itemAssigneeIds
    .map((cid) => crewWorkloads.find((w) => w.crew.id === cid))
    .filter((w): w is NonNullable<typeof w> => Boolean(w && w.isOverloaded));
  const perCrewHours = getPerCrewEstimatedHours(item);
  const isTechProject =
    item.routedManager === 'technical_support' || item.discipline === 'Installasi';
  const projectAssignableCrew = workspace.crew.filter((c) => c.accessRole === 'crew');
  const effectiveManualCrewId =
    manualCrewId && itemAssigneeIds.includes(manualCrewId)
      ? manualCrewId
      : timerActorCrewId;
  const crewContributions = computeProjectCrewContributions(
    item,
    workspace.crew,
    workspace.timeLogs,
    workspace.activeTimers,
    nowMs
  );
  const activeContributions = crewContributions.filter((c) => c.status === 'active');
  const previousContributions = crewContributions.filter((c) => c.status === 'previous');
  const itemLogs = workspace.timeLogs.filter((l) => l.workItemId === item.id);
  const assignmentHistory = item.assignmentHistory || [];

  const handleToggleChecklist = (checkId: string) => {
    const nextList = item.checklist.map((c) => (c.id === checkId ? { ...c, done: !c.done } : c));
    const doneCount = nextList.filter((c) => c.done).length;
    const nextProgress =
      nextList.length > 0 ? Math.round((doneCount / nextList.length) * 100) : item.progress;
    void updateWorkItem(item.id, { checklist: nextList, progress: nextProgress });
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckText.trim()) return;
    const nextList = [
      ...item.checklist,
      { id: `chk-${Date.now()}`, text: newCheckText.trim(), done: false },
    ];
    void updateWorkItem(item.id, { checklist: nextList });
    setNewCheckText('');
  };

  const handleSendUrgentPush = async () => {
    await sendUrgentBroadcast(item);
    triggerToast(
      'Push Mendesak Terkirim',
      `Seluruh kru yang terhubung menerima notifikasi pembaruan ${item.code}.`,
      'warning'
    );
  };

  return (
    <div
      ref={backdropRef}
      data-modal-sheet-backdrop="true"
      className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-ui-fade"
      onClick={animateClose}
    >
      <div
        ref={setSheetElement}
        {...sheetGestureProps}
        role="dialog"
        aria-modal="true"
        aria-label={`Detail ${item.title}`}
        className="w-full sm:max-w-2xl bg-white dark:bg-[#15181E] max-h-[92dvh] sm:max-h-[90dvh] rounded-t-[28px] sm:rounded-[24px] shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)] border-t sm:border border-black/[0.14] dark:border-white/[0.12] flex flex-col overflow-hidden animate-bottom-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile UI-KIT Bottom Sheet Drag Handle */}
        <div
          data-sheet-handle="true"
          className="sm:hidden flex justify-center py-2.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <span className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/25 animate-sheet-handle" />
        </div>

        {/* Top Bar */}
        <div className="px-4 sm:px-6 pb-3.5 pt-1 sm:py-4 border-b border-black/[0.10] dark:border-white/[0.08] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[#6E717A]">
              <span className="font-mono font-semibold text-[#1C1D21]">
                {item.requestNo || item.code}
              </span>
              <span aria-hidden="true">·</span>
              <span className={`font-semibold ${color.textClass}`}>{color.label}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  deadline.severity === 'overdue'
                    ? 'text-[#C11448] font-semibold'
                    : deadline.severity === 'soon'
                      ? 'text-[#B45309] font-semibold'
                      : ''
                }
              >
                {deadline.label}
              </span>
            </div>
            <h2 className="text-[16px] sm:text-[17px] font-bold text-[#1C1D21] mt-1 leading-snug">
              {item.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={animateClose}
            aria-label="Tutup modal detail"
            className="w-9 h-9 rounded-full hover:bg-[#F4F5F8] dark:hover:bg-white/[0.08] flex items-center justify-center text-[#525660] shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Project Workflow Stage & Standardized Intake Metadata */}
          {item.category === 'project' && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FAFBFD] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {(() => {
                  const stage = WORKFLOW_STAGE_META[item.workflowStage || 'in_execution'];
                  const mgr =
                    MANAGER_DIVISION_META[
                      item.routedManager || getRoutedManagerForDiscipline(item.discipline)
                    ];
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        data-dark-preserve="true"
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${stage.bgClass} ${stage.textClass} ${stage.borderClass}`}
                      >
                        Tahap {stage.step}: {stage.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getProjectStatusBadgeClass(
                          item.projectStatus
                        )}`}
                      >
                        {item.projectStatus || 'Waiting List'}
                      </span>
                      <span className={`text-[11px] font-semibold ${mgr.textClass}`}>
                        · {mgr.shortLabel}
                      </span>
                    </div>
                  );
                })()}
                {isProjectLead && !editingProjectFields && (
                  <button
                    type="button"
                    onClick={() => {
                      setProjectDraft({
                        title: item.title,
                        requestNo: item.requestNo || '',
                        coordinatorDepartment: item.coordinatorDepartment || '',
                        clientName: item.clientName || '',
                        clientPhone: item.clientPhone || item.clientContact || '',
                        receivedDate: item.receivedDate || item.startDate,
                        requiredDate: item.dueDate,
                        shootingDate: item.discipline === 'Shooting' ? item.shootingDate || '' : '',
                        shootingStartTime:
                          item.discipline === 'Shooting' ? item.shootingStartTime || '' : '',
                        shootingEndTime:
                          item.discipline === 'Shooting' ? item.shootingEndTime || '' : '',
                        calendarCoordination: Boolean(item.calendarCoordination),
                        discipline: item.discipline || 'Shooting',
                        changeNotes: item.changeNotes ?? item.description ?? '',
                      });
                      setEditingProjectFields(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#1A1D24] text-[11.5px] font-semibold text-[#1C1D21] dark:text-gray-200 hover:border-[#ee2e65] cursor-pointer"
                  >
                    <PenLine className="w-3 h-3" />
                    Edit Field
                  </button>
                )}
              </div>

              {editingProjectFields && projectDraft ? (
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3.5">
                  <ProjectFieldsForm
                    value={projectDraft}
                    onChange={(patch) =>
                      setProjectDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                    }
                    compact
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProjectFields(false);
                        setProjectDraft(null);
                      }}
                      className={ACTION_BTN_SECONDARY}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={savingProjectFields || !projectDraft.title.trim()}
                      onClick={async () => {
                        setSavingProjectFields(true);
                        try {
                          const isShoot = projectDraft.discipline === 'Shooting';
                          await updateWorkItem(item.id, {
                            title: projectDraft.title.trim(),
                            requestNo: projectDraft.requestNo.trim() || item.requestNo,
                            coordinatorDepartment: projectDraft.coordinatorDepartment.trim(),
                            clientName: projectDraft.clientName.trim(),
                            clientPhone: projectDraft.clientPhone.trim(),
                            clientContact: projectDraft.clientPhone.trim(),
                            receivedDate: projectDraft.receivedDate,
                            dueDate: projectDraft.requiredDate || item.dueDate,
                            startDate:
                              (isShoot && projectDraft.shootingDate) ||
                              projectDraft.receivedDate ||
                              item.startDate,
                            shootingDate: isShoot ? projectDraft.shootingDate : undefined,
                            shootingStartTime: isShoot ? projectDraft.shootingStartTime : undefined,
                            shootingEndTime: isShoot ? projectDraft.shootingEndTime : undefined,
                            calendarCoordination: projectDraft.calendarCoordination,
                            discipline: projectDraft.discipline,
                            changeNotes: projectDraft.changeNotes.trim(),
                            description: projectDraft.changeNotes.trim() || item.description,
                          });
                          setEditingProjectFields(false);
                          setProjectDraft(null);
                        } finally {
                          setSavingProjectFields(false);
                        }
                      }}
                      className={ACTION_BTN_PRIMARY}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {savingProjectFields ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px]">
                    <div>
                      <div className="text-[10.5px] font-medium text-[#6E717A]">No Request</div>
                      <div className="font-mono font-semibold text-[#1C1D21] dark:text-gray-100">
                        {item.requestNo || item.code}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-medium text-[#6E717A]">
                        Coordinator department
                      </div>
                      <div className="font-medium text-[#1C1D21] dark:text-gray-100">
                        {item.coordinatorDepartment || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-medium text-[#6E717A]">Client</div>
                      <div className="font-medium text-[#1C1D21] dark:text-gray-100 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-[#ee2e65] shrink-0" />
                        <span className="truncate">{item.clientName || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-medium text-[#6E717A]">Phone number</div>
                      <div className="font-mono font-medium text-[#1C1D21] dark:text-gray-100 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#6E717A] shrink-0" />
                        <span className="truncate">{item.clientPhone || item.clientContact || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-medium text-[#6E717A]">Received date</div>
                      <div className="font-medium text-[#1C1D21] dark:text-gray-100">
                        {formatDisplayDate(item.receivedDate || item.startDate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-medium text-[#6E717A]">Required date</div>
                      <div className="font-medium text-[#1C1D21] dark:text-gray-100">
                        {formatDisplayDate(item.dueDate)}
                      </div>
                    </div>
                  </div>

                  {/* Conditional Shooting Schedule Display */}
                  {item.discipline === 'Shooting' && (
                    <div className="px-3 py-2 rounded-xl bg-[#FEF1F5] dark:bg-[#ee2e65]/15 border border-[#F895B5]/50 dark:border-[#ee2e65]/30 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#9D113C] dark:text-[#fbc2d4]">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        Jadwal Shooting
                      </span>
                      <span className="font-mono font-semibold text-[#1C1D21] dark:text-gray-100">
                        {formatShootingSchedule(item) || 'Belum dijadwalkan'}
                      </span>
                    </div>
                  )}

                  {/* Quick Calendar Coordination Toggle */}
                  <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#1C1D21] dark:text-gray-200">
                      <CalendarCheck2 className="w-3.5 h-3.5 text-[#0F6E4B]" />
                      Calendar Coordination
                    </span>
                    <ToggleSwitch
                      checked={Boolean(item.calendarCoordination)}
                      onChange={(checked) =>
                        void updateWorkItem(item.id, { calendarCoordination: checked })
                      }
                      color="dark"
                      size="sm"
                      ariaLabel="Calendar Coordination"
                    />
                  </div>

                  {item.changeNotes && (
                    <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] text-[12px] text-[#525660] dark:text-gray-300">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6E717A] block mb-0.5">
                        Change notes
                      </span>
                      {item.changeNotes}
                    </div>
                  )}
                </>
              )}

              {item.revisionNote && (
                <div className="p-2.5 rounded-xl bg-[#FFF5E6] border border-[#FAD7A0] text-[12px] text-[#8C5811]">
                  <strong>Catatan Revisi:</strong> {item.revisionNote}
                </div>
              )}
              {item.rejectionReason && (
                <div className="p-2.5 rounded-xl bg-[#FFECEB] border border-[#F5B7B1] text-[12px] text-[#942922]">
                  <strong>Alasan Penolakan Manager:</strong> {item.rejectionReason}
                </div>
              )}
              {item.handoverNote && (
                <div className="p-2.5 rounded-xl bg-[#E6F9F0] border border-[#A3E4C6] text-[12px] text-[#146C43]">
                  <strong>Catatan Serah Terima:</strong> {item.handoverNote}
                </div>
              )}
            </div>
          )}

          {/* Live Real-Time Time Tracker (Projects) / Working Hours Log (Routine & Flexible) */}
          <div className="p-4 rounded-2xl bg-[#FAFBFD] border border-black/[0.08] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-medium text-[#6E717A]">
                  <span>
                    {item.category === 'project'
                      ? 'Pelacakan Waktu Nyata'
                      : 'Catatan Jam Dikerjakan'}{' '}
                    (Estimasi {item.estimatedHours} jam
                    {itemAssigneeIds.length > 1
                      ? ` · ~${perCrewHours}j/kru × ${itemAssigneeIds.length} kru`
                      : ''}
                    )
                  </span>
                  {item.category === 'project' && item.discipline === 'Editing' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0EFFC] text-[#3F3B99] text-[10.5px] font-semibold">
                      <Clock className="w-3 h-3" />
                      Auto-stop {EDITING_AUTO_STOP_LABEL}
                    </span>
                  )}
                </div>
                <div className="text-[24px] font-bold font-mono tabular-nums text-[#1C1D21] mt-0.5">
                  {item.category === 'project'
                    ? formatDurationClock(liveSeconds)
                    : formatHoursCompact(liveSeconds)}
                </div>
              </div>
              {item.category === 'project' ? (
                myRunningTimer ? (
                  <button
                    type="button"
                    onClick={() => void stopTimer(myRunningTimer.id)}
                    className={ACTION_BTN_DANGER_SOFT}
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Stop Timer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startTimer(item.id, timerActorCrewId)}
                    className={ACTION_BTN_PRIMARY}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Timer
                  </button>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-black/[0.09] text-[11.5px] font-medium text-[#525660]">
                  <PenLine className="w-3 h-3 text-[#ee2e65]" />
                  {itemLogs.length} catatan jam
                </span>
              )}
            </div>

            {/* Active simultaneous timers when multiple crew work on this project */}
            {itemTimers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {itemTimers.map((tmr) => {
                  const member = workspace.crew.find((c) => c.id === tmr.crewId);
                  const elapsed = getTimerElapsedSeconds(tmr, nowMs);
                  return (
                    <span
                      key={tmr.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-black/[0.09] text-[11px] font-medium text-[#1C1D21]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ee2e65] animate-pulse" />
                      <span>{member?.name.split(' ')[0] || 'Kru'}</span>
                      <span className="font-mono tabular-nums text-[#ee2e65] font-semibold">
                        {formatDurationClock(elapsed)}
                      </span>
                      {tmr.id !== myRunningTimer?.id && (
                        <button
                          type="button"
                          onClick={() => void stopTimer(tmr.id)}
                          className="ml-0.5 text-[10px] font-semibold text-[#942922] hover:underline cursor-pointer"
                        >
                          Stop
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Inline Manual Time Range (Start -> End, Auto-Calculated Hours) */}
            {(() => {
              const manualRange = computeManualTimeRange(manualStartTime, manualEndTime);
              return (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!manualRange.valid || savingManual) return;
                    setSavingManual(true);
                    try {
                      await addManualTimeLog({
                        workItemId: item.id,
                        crewId: effectiveManualCrewId,
                        hours: manualRange.hours,
                        startTime: manualStartTime,
                        endTime: manualEndTime,
                        date: REFERENCE_TODAY,
                        note: manualNote.trim() || 'Input jam kerja manual',
                      });
                      setManualNote('');
                    } finally {
                      setSavingManual(false);
                    }
                  }}
                  className="pt-3 border-t border-black/[0.07] space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#646772] flex items-center gap-1">
                      <PenLine className="w-3 h-3" />
                      Input Manual Hari Ini
                    </span>
                    <span
                      className={`text-[11px] font-mono tabular-nums font-semibold px-2 py-0.5 rounded-full ${
                        manualRange.valid
                          ? 'bg-[#E6F9F0] text-[#146C43]'
                          : 'bg-[#FFECEB] text-[#942922]'
                      }`}
                    >
                      {manualRange.valid ? `Otomatis: ${manualRange.hoursLabel}` : 'Waktu akhir > awal'}
                    </span>
                  </div>

                  {itemAssigneeIds.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] font-medium text-[#6E717A]">Untuk kru:</span>
                      {itemAssigneeIds.map((cid) => {
                        const member = workspace.crew.find((c) => c.id === cid);
                        if (!member) return null;
                        const active = effectiveManualCrewId === cid;
                        return (
                          <button
                            key={cid}
                            type="button"
                            onClick={() => setManualCrewId(cid)}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                                : 'bg-white text-[#525660] border-black/[0.12] hover:border-black/[0.25]'
                            }`}
                          >
                            {member.name.split(' ')[0]}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <label className="space-y-1">
                      <span className="block text-[10.5px] font-medium text-[#6E717A]">
                        Waktu Awal
                      </span>
                      <input
                        type="time"
                        required
                        value={manualStartTime}
                        onChange={(e) => setManualStartTime(e.target.value)}
                        aria-label="Waktu awal pengerjaan"
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
                        value={manualEndTime}
                        onChange={(e) => setManualEndTime(e.target.value)}
                        aria-label="Waktu akhir pengerjaan"
                        className="w-full h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs font-mono tabular-nums text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                      />
                    </label>
                    <div className="col-span-2 sm:col-span-1 space-y-1">
                      <span className="block text-[10.5px] font-medium text-[#6E717A]">
                        Total Jam (Otomatis)
                      </span>
                      <div
                        className={`w-full h-9 px-2.5 rounded-lg border flex items-center justify-between text-xs font-mono tabular-nums font-semibold ${
                          manualRange.valid
                            ? 'border-black/[0.08] bg-[#F4F5F8] text-[#1C1D21]'
                            : 'border-[#F5B7B1] bg-[#FFECEB]/60 text-[#942922]'
                        }`}
                      >
                        <span>{manualRange.valid ? manualRange.hours : '—'}</span>
                        <span className="text-[11px] font-sans font-normal text-[#6E717A]">
                          jam
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      placeholder="Catatan singkat pengerjaan..."
                      className="flex-1 min-w-0 h-9 px-2.5 rounded-lg border border-gray-300 bg-white text-xs text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
                    />
                    <button
                      type="submit"
                      disabled={savingManual || !manualRange.valid}
                      className="h-9 px-3.5 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 text-[11.5px] font-semibold text-[#1C1D21] cursor-pointer shrink-0"
                    >
                      {savingManual ? '...' : '+ Catat'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>

          {/* Description & Location */}
          <div>
            <p className="text-[13px] text-[#525660] leading-relaxed">{item.description}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[12px] text-[#6E717A]">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {formatFullDateId(item.startDate)} — {formatFullDateId(item.dueDate)}
                {item.dueTime ? ` (${item.dueTime})` : ''}
              </span>
              {item.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {item.location}
                </span>
              )}
            </div>
          </div>

          {/* Core Editable Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {item.category === 'project' ? (
              <div className="sm:col-span-2">
                <label className="block text-[11.5px] font-semibold text-[#646772] mb-1.5">
                  Tim Kru Pelaksana (Bisa Lebih dari 1)
                </label>
                <MultiCrewPicker
                  crew={projectAssignableCrew.length > 0 ? projectAssignableCrew : workspace.crew}
                  selectedIds={itemAssigneeIds}
                  onChange={(nextIds) =>
                    void updateWorkItem(item.id, {
                      assigneeId: nextIds[0],
                      assigneeIds: nextIds,
                    })
                  }
                  crewWorkloads={crewWorkloads}
                  estimatedHours={item.estimatedHours}
                  disabled={!isProjectLead}
                  accent={isTechProject ? 'sky' : 'rose'}
                  compact
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11.5px] font-semibold text-[#646772] mb-1">
                  Kru Penanggung Jawab
                </label>
                <CustomSelect
                  value={item.assigneeId}
                  onChange={(val) =>
                    void updateWorkItem(item.id, { assigneeId: val, assigneeIds: [val] })
                  }
                  ariaLabel="Kru Penanggung Jawab"
                  rounded="xl"
                  className="w-full"
                  options={workspace.crew.map((c) => {
                    const wl = crewWorkloads.find((w) => w.crew.id === c.id);
                    return {
                      value: c.id,
                      label: c.name,
                      meta: `${wl?.totalActiveHours || 0}/${c.maxWeeklyHours}j`,
                    };
                  })}
                />
              </div>
            )}

            <div>
              <label className="block text-[11.5px] font-semibold text-[#646772] mb-1">
                {item.category === 'project' ? 'Status Project (Otomatis)' : 'Status Pekerjaan (Otomatis)'}
              </label>
              <div className="h-[38px] px-3 rounded-xl border border-black/[0.08] bg-[#FAFBFD] flex items-center justify-between gap-2">
                {item.category === 'project' ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11.5px] font-semibold ${getProjectStatusBadgeClass(
                      item.projectStatus
                    )}`}
                  >
                    {item.projectStatus || 'Waiting List'}
                  </span>
                ) : (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11.5px] font-semibold ${
                      item.status === 'Selesai'
                        ? 'bg-[#E6F7F0] text-[#0F6E4B]'
                        : item.status === 'Sedang Dikerjakan'
                          ? 'bg-[#F0EFFC] text-[#3F3B99]'
                          : item.status === 'Review'
                            ? 'bg-[#FFF5E6] text-[#8C5811]'
                            : 'bg-[#EEF2F6] text-[#334155]'
                    }`}
                  >
                    {item.status}
                  </span>
                )}
                <span className="text-[10.5px] text-[#6E717A] truncate">
                  {item.category === 'project' ? 'Ikuti alur & papan' : 'Ikuti timer & progres'}
                </span>
              </div>
            </div>

            {item.category === 'project' && (
              <div>
                <label className="block text-[11.5px] font-semibold text-[#646772] mb-1">
                  Tahap Kanban Project
                </label>
                <CustomSelect
                  value={item.kanbanStage}
                  onChange={(val) =>
                    void updateWorkItem(item.id, { kanbanStage: val as KanbanStage })
                  }
                  ariaLabel="Tahap Kanban Project"
                  rounded="xl"
                  className="w-full"
                  options={KANBAN_COLUMNS.map((col) => ({ value: col.id, label: col.title }))}
                />
              </div>
            )}

            <div>
              <label className="block text-[11.5px] font-semibold text-[#646772] mb-1">
                Prioritas
              </label>
              <CustomSelect
                value={item.priority}
                onChange={(val) =>
                  void updateWorkItem(item.id, { priority: val as PriorityLevel })
                }
                ariaLabel="Prioritas"
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
              <label className="block text-[11.5px] font-semibold text-[#646772] mb-1">
                Tingkat Kesulitan
              </label>
              <CustomSelect
                value={item.difficulty}
                onChange={(val) =>
                  void updateWorkItem(item.id, { difficulty: val as DifficultyLevel })
                }
                ariaLabel="Tingkat Kesulitan"
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
              <label className="block text-[11.5px] font-semibold text-[#6E717A] mb-1">
                Estimasi Durasi (Jam)
              </label>
              <input
                type="number"
                min={0.5}
                max={80}
                step={0.5}
                value={item.estimatedHours}
                onChange={(e) =>
                  void updateWorkItem(item.id, {
                    estimatedHours: Math.max(0.5, Number(e.target.value) || 1),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-black/[0.11] text-[13px] font-mono tabular-nums text-[#1C1D21] bg-white focus:outline-none focus:border-[#ee2e65]"
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-semibold text-[#6E717A] mb-1">
                Progres ({item.progress}%)
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={item.progress}
                onChange={(e) => void updateWorkItem(item.id, { progress: Number(e.target.value) })}
                className="w-full accent-[#ee2e65] mt-2 cursor-pointer"
              />
            </div>
          </div>

          {/* Overload warning if any assigned crew is overloaded */}
          {overloadedAssignees.length > 0 && (
            <div className="p-3 rounded-xl bg-[#FFECEB] border border-[#F5B7B1] text-[#942922] text-[12px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {overloadedAssignees.map((w, idx) => (
                  <React.Fragment key={w.crew.id}>
                    {idx > 0 ? ', ' : ''}
                    <strong>{w.crew.name}</strong> ({w.totalActiveHours}/{w.crew.maxWeeklyHours} jam)
                  </React.Fragment>
                ))}{' '}
                saat ini mengalami overload. Tambah kru pendukung atau alihkan tugas untuk
                menyeimbangkan beban.
              </span>
            </div>
          )}

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-bold text-[#1C1D21]">Checklist Pengerjaan</h3>
              <span className="text-[11.5px] font-mono tabular-nums text-[#6E717A]">
                {item.checklist.filter((c) => c.done).length}/{item.checklist.length} selesai
              </span>
            </div>

            <div className="space-y-1.5">
              {item.checklist.map((chk) => (
                <button
                  key={chk.id}
                  type="button"
                  onClick={() => handleToggleChecklist(chk.id)}
                  className="w-full text-left px-3 py-2 rounded-xl border border-black/[0.07] hover:bg-[#FAFBFD] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  {chk.done ? (
                    <CheckSquare className="w-4 h-4 text-[#10B981] shrink-0" />
                  ) : (
                    <UncheckedBox className="w-4 h-4 text-[#8C9099] shrink-0" />
                  )}
                  <span
                    className={`text-[13px] ${
                      chk.done ? 'line-through text-[#8C9099]' : 'text-[#1C1D21]'
                    }`}
                  >
                    {chk.text}
                  </span>
                </button>
              ))}
            </div>

            <form onSubmit={handleAddChecklist} className="mt-2.5 flex items-center gap-2">
              <input
                type="text"
                value={newCheckText}
                onChange={(e) => setNewCheckText(e.target.value)}
                placeholder="Tambah item checklist..."
                className="flex-1 px-3 py-2 rounded-xl border border-black/[0.10] text-[12.5px] focus:outline-none focus:border-[#ee2e65]"
              />
              <button type="submit" className={ACTION_BTN_SECONDARY}>
                <Plus className="w-3.5 h-3.5" />
                Tambah
              </button>
            </form>
          </div>

          {/* Collaborative Crew Contributions & Preserved Handoff / Work History */}
          <div className="p-4 rounded-2xl bg-[#FAFBFD] border border-black/[0.08] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#525660]" />
                <h3 className="text-[13px] font-bold text-[#1C1D21]">
                  Kontribusi Kru &amp; Riwayat Pengerjaan
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {activeContributions.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#F0EFFC] text-[#3F3B99] text-[10.5px] font-semibold">
                    Kolaborasi {activeContributions.length} Kru
                  </span>
                )}
                {previousContributions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#F4F5F8] text-[#525660] text-[10.5px] font-semibold">
                    +{previousContributions.length} Kru Sebelumnya
                  </span>
                )}
              </div>
            </div>

            {/* Per-Crew Contribution Breakdown (Active + Previous Preserved) */}
            <div className="space-y-2">
              {crewContributions.map((entry) => {
                const isPrev = entry.status === 'previous';
                const running = entry.activeTimer;
                return (
                  <div
                    key={entry.crew.id}
                    className={`p-2.5 rounded-xl border space-y-1.5 ${
                      isPrev
                        ? 'border-dashed border-black/[0.12] bg-white/70'
                        : 'border-black/[0.08] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          data-dark-preserve="true"
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold shrink-0 ${entry.crew.avatarBg} ${entry.crew.avatarText}`}
                        >
                          {entry.crew.initials}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12.5px] font-semibold text-[#1C1D21] truncate">
                              {entry.crew.name}
                            </span>
                            {isPrev ? (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#F4F5F8] text-[#6E717A] text-[10px] font-semibold">
                                Kru Sebelumnya
                              </span>
                            ) : activeContributions.length > 1 ? (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#E6F9F0] text-[#146C43] text-[10px] font-semibold">
                                Kolaborasi Aktif
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#FEF1F5] text-[#C11448] text-[10px] font-semibold">
                                Aktif
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#6E717A]">
                            {entry.crew.role} · {entry.sessionsCount} sesi
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="font-mono tabular-nums text-[12.5px] font-bold text-[#1C1D21]">
                            {entry.loggedSeconds > 0
                              ? formatHoursCompact(entry.loggedSeconds)
                              : '0 jam'}
                          </div>
                          {entry.sharePct > 0 && (
                            <div className="text-[10px] font-mono tabular-nums text-[#6E717A]">
                              {entry.sharePct}% kontribusi
                            </div>
                          )}
                        </div>
                        {!isPrev && activeContributions.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              running
                                ? void stopTimer(running.id)
                                : void startTimer(item.id, entry.crew.id)
                            }
                            title={
                              running
                                ? `Stop timer ${entry.crew.name}`
                                : `Mulai timer untuk ${entry.crew.name}`
                            }
                            className={`h-7 px-2 rounded-lg text-[10.5px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                              running
                                ? 'bg-[#FFECEB] text-[#942922] hover:bg-[#FAD2CF]'
                                : 'bg-[#F4F5F8] text-[#1C1D21] hover:bg-[#FEF1F5] hover:text-[#ee2e65]'
                            }`}
                          >
                            {running ? (
                              <>
                                <Square className="w-2.5 h-2.5 fill-current" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Play className="w-2.5 h-2.5 fill-current" />
                                Start
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {entry.sharePct > 0 && (
                      <div className="h-1.5 w-full rounded-full bg-black/[0.06] overflow-hidden">
                        <div
                          style={{ width: `${entry.sharePct}%` }}
                          className={`h-full rounded-full ${
                            isPrev ? 'bg-[#94A3B8]' : 'bg-[#ee2e65]'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Assignment / Handoff Trail */}
            {assignmentHistory.length > 0 && (
              <div className="pt-2.5 border-t border-black/[0.07] space-y-1.5">
                <div className="text-[11px] font-semibold text-[#646772] flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3" />
                  Riwayat Penugasan &amp; Pengalihan
                </div>
                <div className="space-y-1">
                  {assignmentHistory.slice(0, 5).map((hist) => (
                    <div
                      key={hist.id}
                      className="flex items-start justify-between gap-2 text-[11.5px] text-[#525660]"
                    >
                      <span className="leading-snug">{hist.note}</span>
                      <span className="text-[10.5px] text-[#8C9099] shrink-0 tabular-nums">
                        {formatRelativeTimeId(hist.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-Project Session Logs */}
            {itemLogs.length > 0 && (
              <div className="pt-2.5 border-t border-black/[0.07] space-y-1.5">
                <div className="text-[11px] font-semibold text-[#646772] flex items-center gap-1">
                  <History className="w-3 h-3" />
                  Riwayat Log Sesi ({itemLogs.length})
                </div>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5">
                  {itemLogs.slice(0, 8).map((log) => {
                    const logCrew = workspace.crew.find((c) => c.id === log.crewId);
                    const isPrevCrew = !itemAssigneeIds.includes(log.crewId);
                    return (
                      <div
                        key={log.id}
                        className="px-2.5 py-2 rounded-xl bg-white border border-black/[0.06] flex items-start justify-between gap-2 text-[11.5px]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[#1C1D21]">
                              {logCrew?.name || 'Kru'}
                            </span>
                            {isPrevCrew && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#F4F5F8] text-[#6E717A] text-[9.5px] font-semibold">
                                Sebelumnya
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-semibold ${
                                log.source === 'manual' ? 'text-[#3F3B99]' : 'text-[#146C43]'
                              }`}
                            >
                              {log.source === 'manual'
                                ? 'Manual'
                                : log.autoStopped
                                  ? `Auto-stop ${EDITING_AUTO_STOP_LABEL}`
                                  : 'Auto'}
                            </span>
                          </div>
                          {log.note && (
                            <div className="text-[11px] text-[#6E717A] truncate mt-0.5">
                              {log.note}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono tabular-nums font-semibold text-[#1C1D21]">
                            {formatHoursCompact(log.durationSeconds)}
                          </div>
                          <div className="text-[10px] text-[#8C9099] tabular-nums">
                            {formatRelativeTimeId(log.endedAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:pb-3.5 border-t border-black/[0.08] dark:border-white/[0.08] bg-[#FAFBFD] dark:bg-[#121418] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.category === 'project' && item.workflowStage === 'in_execution' && (
              <button
                type="button"
                onClick={() =>
                  void transitionProjectWorkflow(item.id, {
                    action: 'submit_to_manager',
                    actorCrewId: currentCrewId,
                    handoverNote: 'Project selesai dikerjakan Crew dan dikembalikan ke Manager.',
                  })
                }
                className={ACTION_BTN_PRIMARY}
              >
                <Send className="w-3.5 h-3.5" />
                Serahkan ke Manager
              </button>
            )}
            {item.category === 'project' && item.workflowStage === 'pending_handover' && (
              <button
                type="button"
                onClick={() =>
                  void transitionProjectWorkflow(item.id, {
                    action: 'deliver_to_client',
                    actorCrewId: currentCrewId,
                  })
                }
                className={ACTION_BTN_PRIMARY}
              >
                <Send className="w-3.5 h-3.5" />
                Berikan ke Klien
              </button>
            )}
            {item.category === 'project' && item.workflowStage === 'pending_review' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedWorkItemId(null);
                  setActivePage('project_manager');
                }}
                className={ACTION_BTN_PRIMARY}
              >
                Review di Project Manager
              </button>
            )}
            {item.category === 'project' && item.workflowStage === 'revision_admin' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedWorkItemId(null);
                  setActivePage('overview');
                }}
                className={ACTION_BTN_PRIMARY}
              >
                Lengkapi di Dasbor
              </button>
            )}
            {item.category === 'project' && item.workflowStage === 'rejected_manager' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedWorkItemId(null);
                  setActivePage('overview');
                }}
                className={ACTION_BTN_PRIMARY}
              >
                Tindaklanjuti di Dasbor
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSendUrgentPush()}
              className={ACTION_BTN_SOFT_PRIMARY}
            >
              <BellRing className="w-3.5 h-3.5" />
              Push Mendesak
            </button>
          </div>

          {(item.category === 'project' ? isProjectLead : item.assigneeId === currentCrewId || isProjectLead) &&
            (confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className={ACTION_BTN_SECONDARY}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    void deleteWorkItem(item.id);
                  }}
                  className={ACTION_BTN_DANGER_SOFT}
                >
                  Konfirmasi Hapus
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] font-medium text-[#942922] hover:bg-[#FFECEB] transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
