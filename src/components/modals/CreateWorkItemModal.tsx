import React, { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ACTION_BTN_PRIMARY, ACTION_BTN_SECONDARY } from '../../constants/buttonStyles';
import { getRoutedManagerForDiscipline } from '../../constants/theme';
import { REFERENCE_TODAY, addDays } from '../../utils/formatters';
import { CustomSelect } from '../ui/CustomSelect';
import { ProjectFieldsForm, type ProjectFieldsValue } from '../ui/ProjectFieldsForm';
import { WorkflowStepper } from '../ui/WorkflowStepper';
import { useBottomSheetMotion } from '../../hooks/useBottomSheetMotion';
import type {
  DifficultyLevel,
  PriorityLevel,
  RecurrenceType,
  WorkCategory,
} from '../../types';

function makeDefaultProjectForm(baseDate: string): ProjectFieldsValue {
  return {
    title: '',
    requestNo: '',
    coordinatorDepartment: '',
    clientName: '',
    clientPhone: '',
    receivedDate: baseDate,
    requiredDate: addDays(baseDate, 3),
    shootingDate: '',
    shootingStartTime: '',
    shootingEndTime: '',
    calendarCoordination: false,
    discipline: 'Shooting',
    changeNotes: '',
  };
}

export const CreateWorkItemModal: React.FC = () => {
  const {
    createModalOpen,
    closeCreateModal,
    createDefaultCategory,
    createDefaultDate,
    workspace,
    currentCrew,
    currentCrewId,
    isProjectLead,
    crewWorkloads,
    createWorkItem,
  } = useWorkspace();

  const [category, setCategory] = useState<WorkCategory>('project');
  const [projectForm, setProjectForm] = useState<ProjectFieldsValue>(() =>
    makeDefaultProjectForm(REFERENCE_TODAY)
  );
  const [titleError, setTitleError] = useState(false);

  // Crew Routine / Flexible task states
  const [title, setTitle] = useState('');
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

  // Project Baru modal opens whenever 'project' category is requested
  const isProjectMode = createDefaultCategory === 'project';

  useEffect(() => {
    if (createModalOpen) {
      const nextCat: WorkCategory = isProjectMode
        ? 'project'
        : createDefaultCategory === 'flexible'
          ? 'flexible'
          : 'routine';
      const baseStart = createDefaultDate || REFERENCE_TODAY;
      setCategory(nextCat);
      setTitleError(false);

      if (nextCat === 'project') {
        setProjectForm(makeDefaultProjectForm(baseStart));
      } else {
        setTitle('');
        setDescription('');
        setPriority('Sedang');
        setDifficulty('Mudah');
        setEstimatedHours(3);
        setStartDate(baseStart);
        setDueDate(addDays(baseStart, 1));
        setDueTime('17:00');
        setLocation('Ruang Operasional');
      }
    }
  }, [
    createModalOpen,
    createDefaultCategory,
    createDefaultDate,
    isProjectMode,
  ]);

  const myProjectedWorkload = useMemo(() => {
    if (isProjectMode) return null;
    const wl = crewWorkloads.find((w) => w.crew.id === currentCrewId);
    if (!wl) return null;
    const nextHours = Number((wl.totalActiveHours + Number(estimatedHours || 0)).toFixed(1));
    const nextPct = Math.round((nextHours / wl.crew.maxWeeklyHours) * 100);
    return {
      crew: wl.crew,
      nextHours,
      nextPct,
      willOverload: nextHours > wl.crew.maxWeeklyHours,
    };
  }, [crewWorkloads, currentCrewId, estimatedHours, isProjectMode]);

  const { setSheetElement, backdropRef, animateClose, sheetGestureProps } = useBottomSheetMotion({
    onClose: closeCreateModal,
  });

  if (!createModalOpen || !workspace) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (isProjectMode) {
      if (!projectForm.title.trim()) {
        setTitleError(true);
        return;
      }
      setSubmitting(true);
      try {
        const isShooting = projectForm.discipline === 'Shooting';
        const routedManager = getRoutedManagerForDiscipline(projectForm.discipline);
        const managerMember = workspace.crew.find((c) =>
          routedManager === 'technical_support'
            ? c.accessRole === 'tech_manager'
            : c.accessRole === 'video_manager'
        );
        const received = projectForm.receivedDate || REFERENCE_TODAY;
        const required = projectForm.requiredDate || received;
        const effectiveStart = (isShooting && projectForm.shootingDate) || received;
        const effectiveDue = required < effectiveStart ? effectiveStart : required;

        await createWorkItem({
          title: projectForm.title.trim(),
          description: projectForm.changeNotes.trim() || 'Brief project klien.',
          category: 'project',
          discipline: projectForm.discipline,
          priority: 'Tinggi',
          difficulty: 'Menengah',
          estimatedHours: projectForm.discipline === 'Installasi' ? 10 : 8,
          assigneeId: managerMember?.id || currentCrewId,
          kanbanStage: 'backlog',
          status: 'Belum Mulai',
          startDate: effectiveStart,
          dueDate: effectiveDue,
          dueTime: isShooting && projectForm.shootingEndTime ? projectForm.shootingEndTime : '17:00',
          recurrence: 'Sekali',
          progress: 0,
          checklist: [],
          requestNo: projectForm.requestNo.trim() || undefined,
          coordinatorDepartment: projectForm.coordinatorDepartment.trim() || 'Marketing',
          clientName: projectForm.clientName.trim() || 'Klien Umum',
          clientPhone: projectForm.clientPhone.trim() || undefined,
          clientContact: projectForm.clientPhone.trim() || undefined,
          receivedDate: received,
          shootingDate: isShooting ? projectForm.shootingDate || undefined : undefined,
          shootingStartTime: isShooting ? projectForm.shootingStartTime || undefined : undefined,
          shootingEndTime: isShooting ? projectForm.shootingEndTime || undefined : undefined,
          calendarCoordination: projectForm.calendarCoordination,
          changeNotes: projectForm.changeNotes.trim() || undefined,
          workflowStage: 'pending_review',
          routedManager,
          createdByAdminId: currentCrewId,
        });
        animateClose();
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createWorkItem({
        title: title.trim(),
        description: description.trim() || 'Tercatat melalui ServoMedia Production OS.',
        category,
        priority,
        difficulty,
        estimatedHours: Math.max(0.5, Number(estimatedHours) || 1),
        assigneeId: currentCrewId,
        assigneeIds: [currentCrewId],
        kanbanStage: 'preprod',
        status: 'Belum Mulai',
        startDate,
        dueDate: dueDate < startDate ? startDate : dueDate,
        dueTime,
        location: location.trim() || undefined,
        recurrence: category === 'routine' ? recurrence : 'Sekali',
        progress: 0,
        checklist: [],
      });
      animateClose();
    } finally {
      setSubmitting(false);
    }
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
        className={`w-full ${
          isProjectMode ? 'sm:max-w-[720px]' : 'sm:max-w-xl'
        } bg-white dark:bg-[#15181E] rounded-t-[28px] sm:rounded-[24px] border-t sm:border border-black/[0.14] dark:border-white/[0.12] shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)] overflow-hidden animate-bottom-sheet max-h-[92dvh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile UI-KIT Bottom Sheet Drag Handle */}
        <div
          data-sheet-handle="true"
          className="sm:hidden flex justify-center py-2.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <span className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/25 animate-sheet-handle" />
        </div>

        {/* Header */}
        <div className="px-4 sm:px-6 pb-3.5 pt-1 sm:py-4 border-b border-black/[0.10] dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[15.5px] sm:text-[16px] font-bold text-[#1C1D21] dark:text-gray-100 truncate">
              {isProjectMode ? 'Project Baru' : 'Catat Tugas Rutin / Fleksibel'}
            </h2>
            <p className="text-[11.5px] sm:text-[12px] text-[#6E717A] dark:text-gray-400 truncate">
              {isProjectMode
                ? 'Otomatis diteruskan ke Manager divisi terkait.'
                : `Mandiri oleh ${currentCrew?.name || 'Kru'} · Masuk Gantt & Kalender.`}
            </p>
          </div>
          <button
            type="button"
            onClick={animateClose}
            aria-label="Tutup form"
            className="w-9 h-9 rounded-full hover:bg-[#F4F5F8] dark:hover:bg-white/[0.08] flex items-center justify-center text-[#525660] dark:text-gray-300 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
            {isProjectMode ? (
              <>
                <WorkflowStepper
                  currentStep={1}
                  division={getRoutedManagerForDiscipline(projectForm.discipline)}
                  onNavigate={animateClose}
                />
                <ProjectFieldsForm
                  value={projectForm}
                  titleError={titleError}
                  showRoutingHint={false}
                  compact
                  onChange={(patch) => {
                    if (patch.title !== undefined && patch.title.trim()) {
                      setTitleError(false);
                    }
                    setProjectForm((prev) => ({ ...prev, ...patch }));
                  }}
                />
              </>
            ) : (
              <>
                <div>
                  <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                    Jenis Tugas Mandiri Kru
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F4F5F8] dark:bg-white/[0.06] rounded-xl">
                    {(
                      [
                        { id: 'routine', label: 'Tugas Rutin' },
                        { id: 'flexible', label: 'Tugas Fleksibel' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCategory(opt.id)}
                        className={`py-2 text-[12.5px] rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                          category === opt.id
                            ? 'bg-white dark:bg-[#1E222B] text-[#1C1D21] dark:text-gray-100 font-semibold shadow-2xs'
                            : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] font-medium'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {!isProjectLead && (
                    <p className="mt-1.5 text-[11.5px] text-[#6E717A] flex items-center gap-1.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      Project Baru dibuat oleh Admin Project lalu direview Manager terkait.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                    Judul Pekerjaan
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      category === 'routine'
                        ? 'Contoh: Backup Footage & Pembersihan Sensor Kamera'
                        : 'Contoh: Support Livestream Mendadak / Dokumentasi Internal'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[13.5px] text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {category === 'routine' ? (
                    <div>
                      <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                        Frekuensi Rutin
                      </label>
                      <CustomSelect
                        value={recurrence}
                        onChange={(val) => setRecurrence(val as RecurrenceType)}
                        ariaLabel="Frekuensi Rutin"
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
                      <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                        Lokasi / Konteks
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[13px] text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                      Pengisi Tugas (Mandiri)
                    </label>
                    <div className="px-3 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-[#FAFBFD] dark:bg-white/[0.04] text-[13px] font-medium text-[#1C1D21] dark:text-gray-200 truncate">
                      {currentCrew?.name} ({currentCrew?.division})
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                      Prioritas
                    </label>
                    <CustomSelect
                      value={priority}
                      onChange={(val) => setPriority(val as PriorityLevel)}
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
                    <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                      Kesulitan
                    </label>
                    <CustomSelect
                      value={difficulty}
                      onChange={(val) => setDifficulty(val as DifficultyLevel)}
                      ariaLabel="Kesulitan"
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
                    <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                      Estimasi (Jam)
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      max={80}
                      step={0.5}
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[13px] font-mono tabular-nums text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                    />
                  </div>
                </div>

                {myProjectedWorkload && (
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 text-[12px] ${
                      myProjectedWorkload.willOverload
                        ? 'bg-[#FFECEB] border-[#F5B7B1] text-[#942922]'
                        : 'bg-[#E6F9F0] border-[#A3E4C6] text-[#146C43]'
                    }`}
                  >
                    {myProjectedWorkload.willOverload ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold">
                        {myProjectedWorkload.willOverload
                          ? 'Peringatan Overload Beban Kerja: '
                          : 'Kapasitas Aman: '}
                      </span>
                      {myProjectedWorkload.crew.name} ({myProjectedWorkload.nextHours}/
                      {myProjectedWorkload.crew.maxWeeklyHours}j · {myProjectedWorkload.nextPct}%)
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[12.5px] font-mono text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                      Tenggat Waktu
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[12.5px] font-mono text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                      Jam Tenggat
                    </label>
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[12.5px] font-mono text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                    />
                  </div>
                </div>

                {category === 'routine' && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                      Lokasi / Area Kerja
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Contoh: Gudang Gear, Ruang Server NAS, Studio Podcast"
                      className="w-full px-3.5 py-2 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[13px] text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-semibold text-[#1C1D21] dark:text-gray-200 mb-1.5">
                    Catatan Brief & Kebutuhan Teknis
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detail perangkat, format output, atau catatan penting lainnya..."
                    className="w-full px-3.5 py-2 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[13px] text-[#1C1D21] dark:text-gray-100 focus:outline-none focus:border-[#ee2e65] resize-none"
                  />
                </div>
              </>
            )}
          </div>

          <div className="px-4 sm:px-6 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:pb-3.5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-black/[0.08] dark:border-white/[0.08] bg-[#FAFBFD] dark:bg-[#121418] shrink-0">
            <button
              type="button"
              onClick={animateClose}
              className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`${ACTION_BTN_PRIMARY} w-full sm:w-auto`}
            >
              {submitting
                ? 'Mengirim...'
                : isProjectMode
                  ? 'Kirim Project'
                  : 'Simpan Tugas Mandiri'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
