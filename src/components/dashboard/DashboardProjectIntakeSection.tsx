import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Send,
  AlertTriangle,
  RotateCcw,
  XCircle,
  CalendarCheck2,
  Clock,
  Search,
  X,
  Eye,
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
  formatShortDateId,
  formatShootingSchedule,
  getDeadlineStatus,
  getProjectStatusBadgeClass,
} from '../../utils/formatters';
import { ProjectFieldsForm, type ProjectFieldsValue } from '../ui/ProjectFieldsForm';
import { CustomSelect } from '../ui/CustomSelect';
import { DEFAULT_PAGE_SIZE, PaginationBar } from '../ui/PaginationBar';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { ManagerDivision, ProjectStatus, WorkItem } from '../../types';

const PROJECT_STATUS_FILTER_OPTIONS: Array<{ value: 'Semua' | ProjectStatus; label: string }> = [
  { value: 'Semua', label: 'Semua Status' },
  { value: 'Waiting List', label: 'Waiting List' },
  { value: 'On Progress', label: 'On Progress' },
  { value: 'Review', label: 'Review' },
  { value: 'Revision', label: 'Revision' },
  { value: 'Completed', label: 'Completed' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Rejected', label: 'Rejected' },
];

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

export const DashboardProjectIntakeSection: React.FC = () => {
  const {
    workspace,
    currentCrewId,
    isTechManager,
    transitionProjectWorkflow,
    setSelectedWorkItemId,
  } = useWorkspace();

  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);
  const [revDraft, setRevDraft] = useState<ProjectFieldsValue | null>(null);
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);

  const [listDivision, setListDivision] = useState<ManagerDivision>(
    isTechManager ? 'technical_support' : 'video_production'
  );
  const [statusFilter, setStatusFilter] = useState<'Semua' | ProjectStatus>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const crewById = useMemo(
    () => new Map((workspace?.crew || []).map((c) => [c.id, c])),
    [workspace?.crew]
  );

  const projects = useMemo(
    () =>
      (workspace?.workItems || [])
        .filter((w) => w.category === 'project')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
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

  const divisionProjects = listDivision === 'technical_support' ? techProjects : videoProjects;

  const filteredProjects = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return divisionProjects.filter((p) => {
      if (statusFilter !== 'Semua' && p.projectStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.requestNo || '').toLowerCase().includes(q) ||
        (p.clientName || '').toLowerCase().includes(q) ||
        (p.coordinatorDepartment || '').toLowerCase().includes(q) ||
        (p.discipline || '').toLowerCase().includes(q)
      );
    });
  }, [divisionProjects, statusFilter, deferredSearch]);

  const totalItems = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [listDivision, statusFilter, deferredSearch, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProjects = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, safePage, pageSize]);

  const returnedProjects = useMemo(
    () => projects.filter((p) => p.workflowStage === 'revision_admin'),
    [projects]
  );

  const rejectedProjects = useMemo(
    () => projects.filter((p) => p.workflowStage === 'rejected_manager'),
    [projects]
  );

  if (!workspace) return null;

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
    <div className="space-y-4">
      {/* Returned-for-Revision Strip */}
      {returnedProjects.length > 0 && (
        <section className="rounded-2xl border border-[#FAD7A0] bg-[#FFF5E6]/45 dark:bg-amber-950/20 dark:border-amber-700/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#8C5811] dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Perlu Dilengkapi ({returnedProjects.length})
          </div>

          <div className="divide-y divide-[#FAD7A0]/60 dark:divide-amber-700/30">
            {returnedProjects.map((item) => {
              const isEditing = editingRevisionId === item.id && revDraft;
              return (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedWorkItemId(item.id)}
                        className="text-[13.5px] font-bold text-[#1C1D21] dark:text-gray-100 hover:text-[#ee2e65] text-left cursor-pointer"
                      >
                        {item.requestNo || item.code} · {item.title}
                      </button>
                      <div className="text-[12px] text-[#8C5811] dark:text-amber-200/90 mt-0.5">
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

      {/* Rejected by Manager Strip */}
      {rejectedProjects.length > 0 && (
        <section className="rounded-2xl border border-[#F5B7B1] bg-[#FFECEB]/40 dark:bg-rose-950/20 dark:border-rose-700/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#942922] dark:text-rose-300">
              <XCircle className="w-4 h-4 shrink-0" />
              Ditolak Manager ({rejectedProjects.length})
            </div>
            <span className="text-[11.5px] text-[#942922]/85 dark:text-rose-200/80">
              Informasikan ke klien, arsipkan/hapus lewat detail, atau ajukan ulang bila jadwal/scope berubah.
            </span>
          </div>

          <div className="divide-y divide-[#F5B7B1]/60 dark:divide-rose-700/30">
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
                          className="text-[13.5px] font-bold text-[#1C1D21] dark:text-gray-100 hover:text-[#ee2e65] text-left cursor-pointer"
                        >
                          {item.requestNo || item.code} · {item.title}
                        </button>
                        <span className="text-[11px] font-semibold text-[#6E717A] dark:text-gray-400">
                          · {divMeta.shortLabel}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#942922] dark:text-rose-200/90 mt-0.5">
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

      {/* Project — List Table + Video Prod & Tech Support Tabs + Status Filter + Pagination */}
      <section className="rounded-2xl border border-black/[0.12] dark:border-white/[0.10] bg-white dark:bg-[#15181E] overflow-hidden">
        {/* Header & Controls */}
        <div className="p-4 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-[#1C1D21] dark:text-gray-100">
                Project
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#F4F5F8] dark:bg-white/[0.08] text-[#525660] dark:text-gray-300 tabular-nums">
                {totalItems}
              </span>
            </div>

            {/* Division Filter Tabs */}
            <div className="inline-grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-white/[0.06] rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  playUiMotionSound('tick');
                  setListDivision('video_production');
                }}
                className={`py-1.5 px-3 rounded-lg text-[12px] transition-colors cursor-pointer whitespace-nowrap ${
                  listDivision === 'video_production'
                    ? 'bg-white dark:bg-[#1E222B] text-[#9D113C] dark:text-[#fbc2d4] font-semibold shadow-2xs'
                    : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] dark:hover:text-gray-200 font-medium'
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
                className={`py-1.5 px-3 rounded-lg text-[12px] transition-colors cursor-pointer whitespace-nowrap ${
                  listDivision === 'technical_support'
                    ? 'bg-white dark:bg-[#1E222B] text-[#0369A1] dark:text-[#7DD3FC] font-semibold shadow-2xs'
                    : 'text-[#6E717A] dark:text-gray-400 hover:text-[#1C1D21] dark:hover:text-gray-200 font-medium'
                }`}
              >
                Tech Support ({techProjects.length})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as 'Semua' | ProjectStatus)}
              ariaLabel="Filter status project"
              size="sm"
              rounded="xl"
              className="w-full sm:w-40"
              options={PROJECT_STATUS_FILTER_OPTIONS}
            />

            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#8A8D98] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode, judul, klien..."
                className="w-full h-9 pl-8 pr-7 rounded-xl border border-black/[0.12] dark:border-white/[0.12] bg-[#FAFBFD] dark:bg-[#1B1E24] focus:bg-white dark:focus:bg-[#181B21] focus:border-[#ee2e65] text-[12.5px] text-[#1C1D21] dark:text-gray-100 placeholder:text-[#8A8D98] outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8D98] hover:text-[#1C1D21] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Desktop List Table */}
        <div className="hidden md:block overflow-x-auto border-t border-black/[0.08] dark:border-white/[0.08]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFBFD] dark:bg-white/[0.03] border-b border-black/[0.08] dark:border-white/[0.08] text-[11px] font-semibold uppercase tracking-wider text-[#6E717A] dark:text-gray-400">
                <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">No. Request</th>
                <th className="py-2.5 px-3">Judul Project &amp; Tipe</th>
                <th className="py-2.5 px-3">Klien &amp; Dept</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Tanggal Digunakan</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Tanggal Approval</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Tahap &amp; Status</th>
                <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
              {paginatedProjects.map((item) => {
                const bar = getWorkBarColor(item.category, item.discipline);
                const stage = WORKFLOW_STAGE_META[item.workflowStage || 'in_execution'];
                const shootSched = formatShootingSchedule(item);
                const dl =
                  item.workflowStage !== 'rejected_manager'
                    ? getDeadlineStatus(item.dueDate, item.status)
                    : null;
                const approver = item.approvedByManagerId
                  ? crewById.get(item.approvedByManagerId) || null
                  : null;
                const approvedDateStr = item.approvedAt ? item.approvedAt.slice(0, 10) : null;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedWorkItemId(item.id)}
                    className="group hover:bg-[#FAFBFD] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <td className="py-3 pl-5 pr-3 align-top whitespace-nowrap">
                      <div className="font-mono text-[12px] font-semibold text-[#1C1D21] dark:text-gray-100">
                        {item.requestNo || item.code}
                      </div>
                      <div className="text-[11px] text-[#6E717A] dark:text-gray-400 mt-0.5 tabular-nums">
                        Masuk: {formatShortDateId(item.receivedDate || item.startDate)}
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top max-w-[300px]">
                      <div className="text-[13px] font-semibold text-[#1C1D21] dark:text-gray-100 group-hover:text-[#ee2e65] transition-colors truncate">
                        {item.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        <span className={`font-semibold ${bar.textClass}`}>{item.discipline}</span>
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
                    </td>

                    <td className="py-3 px-3 align-top max-w-[180px]">
                      <div className="text-[12.5px] font-medium text-[#1C1D21] dark:text-gray-100 truncate">
                        {item.clientName || 'Internal'}
                      </div>
                      <div className="text-[11px] text-[#6E717A] dark:text-gray-400 truncate mt-0.5">
                        {[item.coordinatorDepartment, item.clientPhone].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <div className="text-[12.5px] font-medium text-[#1C1D21] dark:text-gray-100 tabular-nums">
                        {formatShortDateId(item.dueDate)}
                      </div>
                      {dl && item.status !== 'Selesai' && (
                        <div
                          className={`text-[11px] font-medium mt-0.5 ${
                            dl.severity === 'overdue'
                              ? 'text-[#C11448]'
                              : dl.severity === 'soon'
                                ? 'text-[#B45309]'
                                : 'text-[#6E717A] dark:text-gray-400'
                          }`}
                        >
                          {dl.label}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      {approvedDateStr ? (
                        <>
                          <div className="text-[12.5px] font-medium text-[#146C43] dark:text-emerald-300 tabular-nums">
                            {formatShortDateId(approvedDateStr)}
                          </div>
                          {approver && (
                            <div className="text-[11px] text-[#6E717A] dark:text-gray-400 mt-0.5 truncate max-w-[130px]">
                              {approver.name.split(' ')[0]}
                            </div>
                          )}
                        </>
                      ) : item.workflowStage === 'rejected_manager' ? (
                        <div className="text-[12px] font-medium text-[#942922] dark:text-rose-300">
                          Ditolak
                        </div>
                      ) : (
                        <div className="text-[12px] text-[#8A8D98] dark:text-gray-500">
                          Belum disetujui
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getProjectStatusBadgeClass(
                          item.projectStatus
                        )}`}
                      >
                        {item.projectStatus || stage.label}
                      </span>
                      <div className="text-[11px] text-[#6E717A] dark:text-gray-400 mt-0.5">
                        {stage.label}
                      </div>
                    </td>

                    <td className="py-3 pl-3 pr-5 align-top text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWorkItemId(item.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#1B1E24] hover:border-[#ee2e65] hover:text-[#ee2e65] text-[11.5px] font-semibold text-[#525660] dark:text-gray-200 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detail
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paginatedProjects.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[13px] text-[#6E717A] dark:text-gray-400">
                    {searchQuery.trim() || statusFilter !== 'Semua'
                      ? 'Tidak ada project yang sesuai dengan filter saat ini.'
                      : 'Belum ada project pada divisi ini.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List Rows */}
        <div className="md:hidden border-t border-black/[0.08] dark:border-white/[0.08] divide-y divide-black/[0.06] dark:divide-white/[0.07]">
          {paginatedProjects.map((item) => {
            const bar = getWorkBarColor(item.category, item.discipline);
            const stage = WORKFLOW_STAGE_META[item.workflowStage || 'in_execution'];
            const shootSched = formatShootingSchedule(item);
            const approvedDateStr = item.approvedAt ? item.approvedAt.slice(0, 10) : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedWorkItemId(item.id)}
                className="w-full text-left p-4 hover:bg-[#FAFBFD] dark:hover:bg-white/[0.03] transition-colors cursor-pointer space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#1C1D21] dark:text-gray-100 leading-snug">
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
                  <span className={`font-semibold ${bar.textClass}`}>{item.discipline}</span>
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
                  <span>Digunakan: {formatShortDateId(item.dueDate)}</span>
                  <span>
                    · Approval:{' '}
                    {approvedDateStr
                      ? formatShortDateId(approvedDateStr)
                      : item.workflowStage === 'rejected_manager'
                        ? 'Ditolak'
                        : 'Belum'}
                  </span>
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

          {paginatedProjects.length === 0 && (
            <div className="py-10 px-4 text-center text-[12.5px] text-[#6E717A] dark:text-gray-400">
              {searchQuery.trim() || statusFilter !== 'Semua'
                ? 'Tidak ada project yang sesuai dengan filter saat ini.'
                : 'Belum ada project pada divisi ini.'}
            </div>
          )}
        </div>

        {/* Pagination Footer (mulai dari 10 item) */}
        <PaginationBar
          currentPage={safePage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="project"
          accent={listDivision === 'technical_support' ? 'sky' : 'rose'}
        />
      </section>
    </div>
  );
};
