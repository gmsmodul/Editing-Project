import React, { useMemo, useState } from 'react';
import {
  Send,
  AlertTriangle,
  RotateCcw,
  XCircle,
  CalendarCheck2,
  Clock,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  ACTION_BTN_PRIMARY,
  ACTION_BTN_SECONDARY,
} from '../../constants/buttonStyles';
import {
  MANAGER_DIVISION_META,
  WORKFLOW_STAGE_META,
  getRoutedManagerForDiscipline,
  getWorkBarColor,
} from '../../constants/theme';
import {
  REFERENCE_TODAY,
  addDays,
  formatShortDateId,
  formatShootingSchedule,
  getProjectStatusBadgeClass,
} from '../../utils/formatters';
import { ProjectFieldsForm, type ProjectFieldsValue } from '../ui/ProjectFieldsForm';
import { WorkflowStepper } from '../ui/WorkflowStepper';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { ManagerDivision, WorkItem } from '../../types';

function createInitialProjectForm(): ProjectFieldsValue {
  return {
    title: '',
    requestNo: '',
    coordinatorDepartment: '',
    clientName: '',
    clientPhone: '',
    receivedDate: REFERENCE_TODAY,
    requiredDate: addDays(REFERENCE_TODAY, 4),
    shootingDate: '',
    shootingStartTime: '',
    shootingEndTime: '',
    calendarCoordination: false,
    discipline: 'Shooting',
    changeNotes: '',
  };
}

function workItemToProjectForm(item: WorkItem): ProjectFieldsValue {
  return {
    title: item.title || '',
    requestNo: item.requestNo || '',
    coordinatorDepartment: item.coordinatorDepartment || '',
    clientName: item.clientName || '',
    clientPhone: item.clientPhone || item.clientContact || '',
    receivedDate: item.receivedDate || item.startDate || REFERENCE_TODAY,
    requiredDate: item.dueDate || REFERENCE_TODAY,
    shootingDate: item.discipline === 'Shooting' ? item.shootingDate || '' : '',
    shootingStartTime: item.discipline === 'Shooting' ? item.shootingStartTime || '' : '',
    shootingEndTime: item.discipline === 'Shooting' ? item.shootingEndTime || '' : '',
    calendarCoordination: Boolean(item.calendarCoordination),
    discipline: item.discipline || 'Shooting',
    changeNotes: item.changeNotes ?? item.description ?? '',
  };
}

export const IntakePage: React.FC = () => {
  const {
    workspace,
    currentCrewId,
    createWorkItem,
    transitionProjectWorkflow,
    setSelectedWorkItemId,
    setActivePage,
  } = useWorkspace();

  const [form, setForm] = useState<ProjectFieldsValue>(createInitialProjectForm);
  const [titleError, setTitleError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);
  const [revDraft, setRevDraft] = useState<ProjectFieldsValue | null>(null);
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);
  const [listDivision, setListDivision] = useState<ManagerDivision>('video_production');

  const projects = useMemo(
    () => (workspace?.workItems || []).filter((w) => w.category === 'project'),
    [workspace]
  );

  const videoProjects = useMemo(
    () =>
      projects.filter(
        (p) => (p.routedManager || getRoutedManagerForDiscipline(p.discipline)) === 'video_production'
      ),
    [projects]
  );

  const techProjects = useMemo(
    () =>
      projects.filter(
        (p) => (p.routedManager || getRoutedManagerForDiscipline(p.discipline)) === 'technical_support'
      ),
    [projects]
  );

  const visibleListProjects = listDivision === 'technical_support' ? techProjects : videoProjects;

  const returnedProjects = useMemo(
    () => projects.filter((p) => p.workflowStage === 'revision_admin'),
    [projects]
  );

  const rejectedProjects = useMemo(
    () => projects.filter((p) => p.workflowStage === 'rejected_manager'),
    [projects]
  );

  if (!workspace) return null;

  const routedDiv = getRoutedManagerForDiscipline(form.discipline);
  const routedMeta = MANAGER_DIVISION_META[routedDiv];
  const routedManagerPerson = workspace.crew.find((c) =>
    routedDiv === 'technical_support'
      ? c.accessRole === 'tech_manager'
      : c.accessRole === 'video_manager'
  );

  const handleSubmitClientProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setTitleError(true);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      playUiMotionSound('success');
      const isShooting = form.discipline === 'Shooting';
      const received = form.receivedDate || REFERENCE_TODAY;
      const required = form.requiredDate || received;
      const effectiveStart = (isShooting && form.shootingDate) || received;
      const effectiveDue = required < effectiveStart ? effectiveStart : required;

      await createWorkItem({
        title: form.title.trim(),
        description: form.changeNotes.trim() || 'Brief project klien.',
        category: 'project',
        discipline: form.discipline,
        priority: 'Tinggi',
        difficulty: 'Menengah',
        estimatedHours: form.discipline === 'Installasi' ? 10 : 8,
        assigneeId: routedManagerPerson?.id || currentCrewId,
        kanbanStage: 'backlog',
        status: 'Belum Mulai',
        startDate: effectiveStart,
        dueDate: effectiveDue,
        dueTime: isShooting && form.shootingEndTime ? form.shootingEndTime : '17:00',
        recurrence: 'Sekali',
        progress: 0,
        checklist: [],
        requestNo: form.requestNo.trim() || undefined,
        coordinatorDepartment: form.coordinatorDepartment.trim() || 'Marketing',
        clientName: form.clientName.trim() || 'Klien Umum',
        clientPhone: form.clientPhone.trim() || undefined,
        clientContact: form.clientPhone.trim() || undefined,
        receivedDate: received,
        shootingDate: isShooting ? form.shootingDate || undefined : undefined,
        shootingStartTime: isShooting ? form.shootingStartTime || undefined : undefined,
        shootingEndTime: isShooting ? form.shootingEndTime || undefined : undefined,
        calendarCoordination: form.calendarCoordination,
        changeNotes: form.changeNotes.trim() || undefined,
        workflowStage: 'pending_review',
        routedManager: routedDiv,
        createdByAdminId: currentCrewId,
      });

      setListDivision(routedDiv);
      setTitleError(false);
      setForm(createInitialProjectForm());
    } finally {
      setSubmitting(false);
    }
  };

  const openRevisionEditor = (item: WorkItem) => {
    setEditingRevisionId(item.id);
    setRevDraft(workItemToProjectForm(item));
  };

  const handleResubmit = async (itemId: string) => {
    if (!revDraft || !revDraft.title.trim() || resubmittingId) return;
    setResubmittingId(itemId);
    try {
      playUiMotionSound('success');
      const isShooting = revDraft.discipline === 'Shooting';
      await transitionProjectWorkflow(itemId, {
        action: 'resubmit_to_manager',
        actorCrewId: currentCrewId,
        title: revDraft.title.trim(),
        description: revDraft.changeNotes.trim() || undefined,
        requestNo: revDraft.requestNo.trim() || undefined,
        coordinatorDepartment: revDraft.coordinatorDepartment.trim() || undefined,
        clientName: revDraft.clientName.trim() || undefined,
        clientPhone: revDraft.clientPhone.trim() || undefined,
        clientContact: revDraft.clientPhone.trim() || undefined,
        discipline: revDraft.discipline,
        receivedDate: revDraft.receivedDate || undefined,
        dueDate: revDraft.requiredDate || undefined,
        shootingDate: isShooting ? revDraft.shootingDate : '',
        shootingStartTime: isShooting ? revDraft.shootingStartTime : '',
        shootingEndTime: isShooting ? revDraft.shootingEndTime : '',
        calendarCoordination: revDraft.calendarCoordination,
        changeNotes: revDraft.changeNotes.trim(),
      });
      setEditingRevisionId(null);
      setRevDraft(null);
    } finally {
      setResubmittingId(null);
    }
  };

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-4 w-full ui-stagger">
      <WorkflowStepper currentStep={1} />

      {/* Compact Returned-for-Revision Strip */}
      {returnedProjects.length > 0 && (
        <section className="rounded-2xl border border-[#FAD7A0] bg-[#FFF5E6]/45 p-4 space-y-3">
          <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#8C5811]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Perlu Dilengkapi ({returnedProjects.length})
          </div>

          <div className="divide-y divide-[#FAD7A0]/60">
            {returnedProjects.map((item) => {
              const isEditing = editingRevisionId === item.id && revDraft;
              return (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedWorkItemId(item.id)}
                        className="text-[13.5px] font-bold text-[#1C1D21] hover:text-[#ee2e65] text-left cursor-pointer"
                      >
                        {item.requestNo || item.code} · {item.title}
                      </button>
                      <div className="text-[12px] text-[#8C5811] mt-0.5">
                        {item.revisionNote || 'Lengkapi detail project.'}
                      </div>
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => openRevisionEditor(item)}
                        className={ACTION_BTN_PRIMARY}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Perbaiki
                      </button>
                    )}
                  </div>

                  {isEditing && revDraft && (
                    <div className="pt-3 border-t border-[#FAD7A0]/60 bg-white dark:bg-[#15181E] rounded-2xl p-4 space-y-4">
                      <ProjectFieldsForm
                        value={revDraft}
                        onChange={(patch) =>
                          setRevDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                        }
                        compact
                      />

                      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRevisionId(null);
                            setRevDraft(null);
                          }}
                          className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={resubmittingId === item.id || !revDraft.title.trim()}
                          onClick={() => void handleResubmit(item.id)}
                          className={`${ACTION_BTN_PRIMARY} w-full sm:w-auto`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          Kirim Ulang ke Manager
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Rejected by Manager Strip — Admin can inform client, delete via detail modal, or resubmit */}
      {rejectedProjects.length > 0 && (
        <section className="rounded-2xl border border-[#F5B7B1] bg-[#FFECEB]/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#942922]">
              <XCircle className="w-4 h-4 shrink-0" />
              Ditolak Manager ({rejectedProjects.length})
            </div>
            <span className="text-[11.5px] text-[#942922]/85">
              Informasikan ke klien, arsipkan/hapus lewat detail, atau ajukan ulang bila jadwal/scope berubah.
            </span>
          </div>

          <div className="divide-y divide-[#F5B7B1]/60">
            {rejectedProjects.map((item) => {
              const isEditing = editingRevisionId === item.id && revDraft;
              const divMeta =
                MANAGER_DIVISION_META[
                  item.routedManager || getRoutedManagerForDiscipline(item.discipline)
                ];
              return (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedWorkItemId(item.id)}
                          className="text-[13.5px] font-bold text-[#1C1D21] hover:text-[#ee2e65] text-left cursor-pointer"
                        >
                          {item.requestNo || item.code} · {item.title}
                        </button>
                        <span className="text-[11px] font-semibold text-[#6E717A]">
                          · {divMeta.shortLabel}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#942922] mt-0.5">
                        <strong>Alasan penolakan:</strong>{' '}
                        {item.rejectionReason || 'Ditolak oleh Manager.'}
                      </div>
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedWorkItemId(item.id)}
                          className={ACTION_BTN_SECONDARY}
                        >
                          Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => openRevisionEditor(item)}
                          className={ACTION_BTN_PRIMARY}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Ajukan Ulang
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing && revDraft && (
                    <div className="pt-3 border-t border-[#F5B7B1]/50 bg-white dark:bg-[#15181E] rounded-2xl p-4 space-y-4">
                      <ProjectFieldsForm
                        value={revDraft}
                        onChange={(patch) =>
                          setRevDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                        }
                        compact
                      />

                      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRevisionId(null);
                            setRevDraft(null);
                          }}
                          className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={resubmittingId === item.id || !revDraft.title.trim()}
                          onClick={() => void handleResubmit(item.id)}
                          className={`${ACTION_BTN_PRIMARY} w-full sm:w-auto`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          Ajukan Ulang ke Manager
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Clean 2-Column Split: Standardized Project Form + Quiet Division Status List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        <section className="lg:col-span-7 rounded-2xl border border-black/[0.10] dark:border-white/[0.10] bg-white dark:bg-[#15181E] p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <h2 className="text-[15.5px] font-bold text-[#1C1D21] dark:text-gray-100">
              Form Project Baru
            </h2>
            <span className={`text-[12px] font-semibold ${routedMeta.textClass}`}>
              → {routedMeta.label}
            </span>
          </div>

          <form onSubmit={handleSubmitClientProject} className="space-y-5">
            <ProjectFieldsForm
              value={form}
              titleError={titleError}
              showRoutingHint={false}
              onChange={(patch) => {
                if (patch.title !== undefined && patch.title.trim()) {
                  setTitleError(false);
                }
                setForm((prev) => ({ ...prev, ...patch }));
              }}
            />

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className={`${ACTION_BTN_PRIMARY} w-full sm:w-auto`}
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Mengirim...' : `Kirim ke ${routedMeta.shortLabel}`}
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Clean Separated Division List */}
        <section className="lg:col-span-5 rounded-2xl border border-black/[0.10] dark:border-white/[0.10] bg-white dark:bg-[#15181E] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-[#1C1D21] dark:text-gray-100">
              Project Masuk ({visibleListProjects.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                playUiMotionSound('tick');
                setActivePage(listDivision === 'technical_support' ? 'approval_tech' : 'approval_video');
              }}
              className={`text-[12px] font-medium hover:underline cursor-pointer ${
                listDivision === 'technical_support' ? 'text-[#0284C7]' : 'text-[#ee2e65]'
              }`}
            >
              {listDivision === 'technical_support' ? 'Review Tech →' : 'Review Video →'}
            </button>
          </div>

          {/* Division Switcher so Admin never mixes Video Production & Technical Support */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                playUiMotionSound('tick');
                setListDivision('video_production');
              }}
              className={`py-1.5 px-2.5 rounded-lg text-[12px] transition-colors cursor-pointer truncate ${
                listDivision === 'video_production'
                  ? 'bg-white dark:bg-[#1E222B] text-[#9D113C] dark:text-[#fbc2d4] font-semibold shadow-2xs'
                  : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] font-medium'
              }`}
            >
              Video Prod. ({videoProjects.length})
            </button>
            <button
              type="button"
              onClick={() => {
                playUiMotionSound('tick');
                setListDivision('technical_support');
              }}
              className={`py-1.5 px-2.5 rounded-lg text-[12px] transition-colors cursor-pointer truncate ${
                listDivision === 'technical_support'
                  ? 'bg-white dark:bg-[#1E222B] text-[#0369A1] dark:text-[#7DD3FC] font-semibold shadow-2xs'
                  : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] font-medium'
              }`}
            >
              Tech Support ({techProjects.length})
            </button>
          </div>

          <div className="divide-y divide-black/[0.06] dark:divide-white/[0.07] max-h-[540px] overflow-y-auto pr-0.5 ui-scrollbar-violet">
            {visibleListProjects.map((item) => {
              const bar = getWorkBarColor(item.category, item.discipline);
              const stage = WORKFLOW_STAGE_META[item.workflowStage || 'in_execution'];
              const shootSched = formatShootingSchedule(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedWorkItemId(item.id)}
                  className="w-full text-left py-3 first:pt-0 last:pb-0 hover:text-[#ee2e65] transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[#1C1D21] dark:text-gray-100 truncate">
                      {item.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0 ${getProjectStatusBadgeClass(
                        item.projectStatus
                      )}`}
                    >
                      {item.projectStatus || stage.label}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-[#6E717A] dark:text-gray-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="font-mono font-medium text-[#1C1D21] dark:text-gray-200">
                      {item.requestNo || item.code}
                    </span>
                    <span>·</span>
                    <span className={`font-medium ${bar.textClass}`}>{item.discipline}</span>
                    {item.coordinatorDepartment && (
                      <>
                        <span>·</span>
                        <span>{item.coordinatorDepartment}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="truncate">{item.clientName || 'Internal'}</span>
                  </div>
                  <div className="text-[11px] text-[#6E717A] dark:text-gray-400 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    <span>Req: {formatShortDateId(item.dueDate)}</span>
                    {shootSched && (
                      <span className="inline-flex items-center gap-1 text-[#9D113C] dark:text-[#fbc2d4] font-medium">
                        <Clock className="w-3 h-3 shrink-0" />
                        Shoot {shootSched}
                      </span>
                    )}
                    {item.calendarCoordination && (
                      <span className="inline-flex items-center gap-1 text-[#0F6E4B] dark:text-[#6EE7B7]">
                        <CalendarCheck2 className="w-3 h-3 shrink-0" />
                        Kalender
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {visibleListProjects.length === 0 && (
              <div className="py-8 text-center text-[12.5px] text-[#6E717A]">
                Belum ada project pada divisi ini.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
