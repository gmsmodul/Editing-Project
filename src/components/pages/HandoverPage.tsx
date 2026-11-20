import React, { useMemo, useState } from 'react';
import { Send, RotateCcw, Film, Wrench, Phone, Clock } from 'lucide-react';
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
  formatAssigneeSummary,
  formatHoursCompact,
  formatRelativeTimeId,
  formatShortDateId,
  formatShootingSchedule,
  getLiveLoggedSeconds,
} from '../../utils/formatters';
import { WorkflowStepper } from '../ui/WorkflowStepper';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { ManagerDivision, WorkItem } from '../../types';

interface HandoverPageProps {
  division: ManagerDivision;
}

export const HandoverPage: React.FC<HandoverPageProps> = ({ division }) => {
  const {
    workspace,
    nowMs,
    currentCrewId,
    transitionProjectWorkflow,
    setSelectedWorkItemId,
  } = useWorkspace();

  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [revisionOpenId, setRevisionOpenId] = useState<string | null>(null);
  const [revisionText, setRevisionText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const isTech = division === 'technical_support';
  const divisionMeta = MANAGER_DIVISION_META[division];

  const pendingHandover = useMemo(() => {
    if (!workspace) return [];
    return workspace.workItems.filter((item) => {
      if (item.category !== 'project' || item.workflowStage !== 'pending_handover') return false;
      const routed = item.routedManager || getRoutedManagerForDiscipline(item.discipline);
      return routed === division;
    });
  }, [workspace, division]);

  const deliveredProjects = useMemo(() => {
    if (!workspace) return [];
    return workspace.workItems
      .filter((item) => {
        if (item.category !== 'project' || item.workflowStage !== 'delivered_client') return false;
        const routed = item.routedManager || getRoutedManagerForDiscipline(item.discipline);
        return routed === division;
      })
      .sort((a, b) =>
        (b.deliveredToClientAt || b.updatedAt).localeCompare(a.deliveredToClientAt || a.updatedAt)
      );
  }, [workspace, division]);

  if (!workspace) return null;

  const divisionManager = workspace.crew.find((c) =>
    isTech ? c.accessRole === 'tech_manager' : c.accessRole === 'video_manager'
  );

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
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-4 w-full ui-stagger">
      <WorkflowStepper currentStep={4} division={division} />

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
              {isTech ? 'Serah Terima · Technical Support' : 'Serah Terima · Video Production'}
            </div>
            <div className="text-[11.5px] text-[#525660] truncate">
              {divisionMeta.disciplines}
              {divisionManager ? ` · Manager: ${divisionManager.name}` : ''}
            </div>
          </div>
        </div>
        <span className={`text-[12px] font-mono tabular-nums font-bold ${divisionMeta.textClass}`}>
          {pendingHandover.length} siap diserahkan
        </span>
      </div>

      {/* Pending QC & Client Handover */}
      <section className="space-y-3">
        <h2 className="text-[14.5px] font-bold text-[#1C1D21]">
          Siap Diserahkan ke Klien ({pendingHandover.length})
        </h2>

        {pendingHandover.length > 0 ? (
          <div className="space-y-3">
            {pendingHandover.map((item) => {
              const bar = getWorkBarColor(item.category, item.discipline);
              const crewLabel = formatAssigneeSummary(item, workspace.crew);
              const liveSec = getLiveLoggedSeconds(item, workspace.activeTimers, nowMs);

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-black/[0.12] bg-white p-4 sm:p-5 space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
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
                        className="mt-1 text-[15px] font-bold text-[#1C1D21] hover:text-[#ee2e65] text-left cursor-pointer"
                      >
                        {item.title}
                      </button>

                      {(() => {
                        const shootSched = formatShootingSchedule(item);
                        if (!shootSched) return null;
                        return (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF1F5] text-[#9D113C] text-[11px] font-semibold">
                            <Clock className="w-3 h-3" />
                            Shooting: {shootSched}
                          </div>
                        );
                      })()}

                      {item.handoverNote && (
                        <p className="mt-1 text-[12.5px] text-[#525660]">{item.handoverNote}</p>
                      )}
                    </div>

                    <div className="flex sm:block items-center justify-between gap-2 sm:text-right shrink-0 text-[12px] pt-1 sm:pt-0">
                      <div className="font-semibold text-[#1C1D21]">{crewLabel}</div>
                      <div className="font-mono tabular-nums text-[#6E717A]">
                        {formatHoursCompact(liveSec)} / {item.estimatedHours}j
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-black/[0.06] space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        value={deliveryNotes[item.id] ?? item.handoverNote ?? ''}
                        onChange={(e) =>
                          setDeliveryNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Catatan serah terima / tautan file..."
                        className="w-full sm:flex-1 h-10 sm:h-9 px-3 rounded-xl border border-gray-300 bg-white text-xs text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
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
                          className="w-full sm:flex-1 h-10 sm:h-9 px-3 rounded-xl border border-[#F5B7B1] bg-white text-xs text-[#1C1D21] focus:outline-none focus:border-[#ee2e65]"
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
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/[0.12] bg-white py-8 text-center text-[13px] text-[#6E717A]">
            Belum ada project {isTech ? 'Technical Support' : 'Video Production'} yang menunggu serah terima.
          </div>
        )}
      </section>

      {/* Delivered Archive: Mobile Cards + Desktop Table */}
      <section className="rounded-2xl border border-black/[0.12] bg-white p-4 sm:p-5 space-y-3">
        <h2 className="text-[14.5px] font-bold text-[#1C1D21]">
          Selesai &amp; Diserahkan ({deliveredProjects.length})
        </h2>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-black/[0.06]">
          {deliveredProjects.map((item) => {
            const crewLabel = formatAssigneeSummary(item, workspace.crew);
            return (
              <button
                key={`mob-del-${item.id}`}
                type="button"
                onClick={() => setSelectedWorkItemId(item.id)}
                className="w-full text-left py-3 first:pt-0 last:pb-0 space-y-1 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#1C1D21] leading-snug">
                    {item.requestNo || item.code} · {item.title}
                  </span>
                  <span className="text-[11.5px] font-mono tabular-nums font-semibold text-[#1C1D21] shrink-0">
                    {formatHoursCompact(item.loggedSeconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11.5px] text-[#6E717A]">
                  <span className="truncate">
                    {item.clientName || 'Internal'} · {crewLabel}
                  </span>
                  <span className="text-[#146C43] shrink-0 tabular-nums">
                    {item.deliveredToClientAt
                      ? formatRelativeTimeId(item.deliveredToClientAt)
                      : formatShortDateId(item.dueDate)}
                  </span>
                </div>
              </button>
            );
          })}
          {deliveredProjects.length === 0 && (
            <div className="py-6 text-center text-[12.5px] text-[#6E717A]">
              Belum ada arsip serah terima untuk divisi ini.
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto ui-scrollbar-violet">
          <table className="w-full text-left border-collapse min-w-[600px] text-[12.5px]">
            <thead>
              <tr className="border-b border-black/[0.08] text-[11.5px] text-[#6E717A]">
                <th className="py-2 pr-3">Project</th>
                <th className="py-2 px-3">Klien</th>
                <th className="py-2 px-3">Crew</th>
                <th className="py-2 px-3 text-right">Durasi</th>
                <th className="py-2 pl-3 text-right">Diserahkan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {deliveredProjects.map((item) => {
                const crewLabel = formatAssigneeSummary(item, workspace.crew);
                return (
                  <tr key={item.id} className="hover:bg-[#FAFBFD]">
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => setSelectedWorkItemId(item.id)}
                        className="font-semibold text-[#1C1D21] hover:text-[#ee2e65] text-left cursor-pointer"
                      >
                        {item.requestNo || item.code} · {item.title}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-[#525660]">
                      <div>{item.clientName || 'Internal'}</div>
                      {item.coordinatorDepartment && (
                        <div className="text-[11px] text-[#6E717A]">{item.coordinatorDepartment}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#525660]">{crewLabel}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1C1D21]">
                      {formatHoursCompact(item.loggedSeconds)}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-[#146C43] tabular-nums">
                      {item.deliveredToClientAt
                        ? formatRelativeTimeId(item.deliveredToClientAt)
                        : formatShortDateId(item.dueDate)}
                    </td>
                  </tr>
                );
              })}
              {deliveredProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#6E717A]">
                    Belum ada arsip serah terima untuk divisi ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
