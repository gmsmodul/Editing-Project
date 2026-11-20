import React, { useMemo } from 'react';
import {
  Play,
  Square,
  Clock,
  CheckCircle2,
  Clapperboard,
  Users,
  Timer,
  Plus,
} from 'lucide-react';
import { DashboardProjectIntakeSection } from '../dashboard/DashboardProjectIntakeSection';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ACTION_BTN_PRIMARY } from '../../constants/buttonStyles';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import { DEFAULT_DASHBOARD_WIDGETS, getWorkBarColor, PRIORITY_STYLE } from '../../constants/theme';
import {
  REFERENCE_TODAY,
  formatAssigneeSummary,
  formatHoursCompact,
  getDeadlineStatus,
  getLiveLoggedSeconds,
  isCrewAssignedToItem,
} from '../../utils/formatters';
import type { DashboardWidgetId } from '../../types';

export const OverviewPage: React.FC = () => {
  const {
    workspace,
    nowMs,
    currentCrewId,
    isProjectLead,
    crewWorkloads,
    setActivePage,
    setKanbanDivisionFilter,
    setSelectedWorkItemId,
    startTimer,
    stopTimer,
    updateDashboardConfig,
    openCreateModal,
  } = useWorkspace();

  const defaultKanbanPage = 'kanban_video' as const;

  const config = useMemo(() => {
    const fallbackOrder = DEFAULT_DASHBOARD_WIDGETS.map((w) => w.id);
    if (!workspace) {
      return {
        crewId: currentCrewId,
        widgetOrder: fallbackOrder,
        hiddenWidgets: [] as DashboardWidgetId[],
        density: 'comfortable' as const,
      };
    }
    return (
      workspace.dashboardConfigs[currentCrewId] || {
        crewId: currentCrewId,
        widgetOrder: fallbackOrder,
        hiddenWidgets: [],
        density: 'comfortable',
      }
    );
  }, [workspace, currentCrewId]);

  if (!workspace) return null;

  const isCompact = config.density === 'compact';

  const activeProjects = workspace.workItems.filter(
    (w) =>
      w.category === 'project' &&
      w.status !== 'Selesai' &&
      w.workflowStage !== 'rejected_manager'
  );
  const activeProjectIds = new Set(
    workspace.workItems
      .filter((w) => w.category === 'project' && w.workflowStage !== 'rejected_manager')
      .map((w) => w.id)
  );
  const activeProjectTimers = workspace.activeTimers.filter((t) =>
    activeProjectIds.has(t.workItemId)
  );
  const overloadedCrew = crewWorkloads.filter((w) => w.isOverloaded);
  const avgUtilization = Math.round(
    crewWorkloads.reduce((acc, w) => acc + w.utilizationPct, 0) / Math.max(1, crewWorkloads.length)
  );
  const totalProjectTrackedSec = workspace.workItems
    .filter((w) => w.category === 'project')
    .reduce((acc, item) => acc + getLiveLoggedSeconds(item, workspace.activeTimers, nowMs), 0);

  const urgentOrSoonItems = workspace.workItems
    .filter((w) => {
      if (
        w.category !== 'project' ||
        w.status === 'Selesai' ||
        w.workflowStage === 'rejected_manager'
      ) {
        return false;
      }
      const dl = getDeadlineStatus(w.dueDate, w.status);
      return w.priority === 'Mendesak' || dl.daysLeft <= 2;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const todayScheduleItems = workspace.workItems
    .filter(
      (w) =>
        w.category === 'project' &&
        w.workflowStage !== 'rejected_manager' &&
        ((w.startDate <= REFERENCE_TODAY && w.dueDate >= REFERENCE_TODAY) ||
          (w.discipline === 'Shooting' && w.shootingDate === REFERENCE_TODAY))
    )
    .sort((a, b) => {
      const aTime =
        a.discipline === 'Shooting' && a.shootingDate === REFERENCE_TODAY && a.shootingStartTime
          ? a.shootingStartTime
          : a.dueTime || '23:59';
      const bTime =
        b.discipline === 'Shooting' && b.shootingDate === REFERENCE_TODAY && b.shootingStartTime
          ? b.shootingStartTime
          : b.dueTime || '23:59';
      return aTime.localeCompare(bTime);
    });

  const resetDashboard = () => {
    void updateDashboardConfig({
      widgetOrder: DEFAULT_DASHBOARD_WIDGETS.map((w) => w.id),
      hiddenWidgets: [],
      density: 'comfortable',
    });
  };

  const REMOVED_DASHBOARD_WIDGETS = new Set<DashboardWidgetId>([
    'crew_workload',
    'live_tracker',
    'weekly_productivity',
  ]);
  const visibleWidgets = config.widgetOrder.filter(
    (id) => !REMOVED_DASHBOARD_WIDGETS.has(id) && !config.hiddenWidgets.includes(id)
  );
  const showSummary = visibleWidgets.includes('summary_strip');
  const secondaryWidgets = visibleWidgets.filter((id) => id !== 'summary_strip');

  const renderSecondaryWidget = (widgetId: DashboardWidgetId) => {
    switch (widgetId) {
      case 'urgent_deadlines':
        return (
          <section
            key={widgetId}
            className={`rounded-2xl border border-black/[0.12] bg-white ${isCompact ? 'p-4' : 'p-5'}`}
          >
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h2 className="text-[14.5px] font-bold text-[#1C1D21]">Tenggat Dekat</h2>
              <button
                type="button"
                onClick={() => setActivePage(defaultKanbanPage)}
                className="text-[12px] font-medium text-[#ee2e65] hover:underline cursor-pointer"
              >
                Eksekusi →
              </button>
            </div>

            <div className="divide-y divide-black/[0.06]">
              {urgentOrSoonItems.slice(0, 4).map((item) => {
                const crewLabel = formatAssigneeSummary(item, workspace.crew);
                const dl = getDeadlineStatus(item.dueDate, item.status);
                const isMeAssigned = isCrewAssignedToItem(item, currentCrewId);
                const timerActorId = isMeAssigned ? currentCrewId : item.assigneeId;
                const running = isMeAssigned
                  ? workspace.activeTimers.find(
                      (t) => t.workItemId === item.id && t.crewId === timerActorId
                    )
                  : workspace.activeTimers.find((t) => t.workItemId === item.id);

                return (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedWorkItemId(item.id)}
                        className="text-[13px] font-semibold text-[#1C1D21] hover:text-[#ee2e65] text-left truncate block max-w-full cursor-pointer"
                      >
                        {item.title}
                      </button>
                      <div className="text-[11.5px] text-[#6E717A] flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[#1C1D21]">{item.requestNo || item.code}</span>
                        <span>·</span>
                        <span className={PRIORITY_STYLE[item.priority].text}>{item.priority}</span>
                        <span>·</span>
                        <span className="truncate">{crewLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11.5px] font-semibold whitespace-nowrap ${
                          dl.severity === 'overdue' ? 'text-[#C11448]' : 'text-[#B45309]'
                        }`}
                      >
                        {dl.label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          running
                            ? void stopTimer(running.id)
                            : void startTimer(item.id, timerActorId)
                        }
                        title={running ? 'Stop' : 'Start'}
                        className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer ${
                          running
                            ? 'bg-[#FFECEB] text-[#942922]'
                            : 'bg-[#F4F5F8] hover:bg-[#FEF1F5] text-[#525660] hover:text-[#ee2e65]'
                        }`}
                      >
                        {running ? (
                          <Square className="w-3 h-3 fill-current" />
                        ) : (
                          <Play className="w-3 h-3 fill-current" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {urgentOrSoonItems.length === 0 && (
                <div className="py-6 text-center text-[12.5px] text-[#146C43] flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Semua tenggat aman.
                </div>
              )}
            </div>
          </section>
        );

      case 'today_schedule':
        return (
          <section
            key={widgetId}
            className={`rounded-2xl border border-black/[0.12] bg-white ${isCompact ? 'p-4' : 'p-5'}`}
          >
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h2 className="text-[14.5px] font-bold text-[#1C1D21]">Jadwal Hari Ini</h2>
              {isProjectLead ? (
                <button
                  type="button"
                  onClick={() => openCreateModal('project', REFERENCE_TODAY)}
                  className="text-[12px] font-medium text-[#ee2e65] hover:underline cursor-pointer"
                >
                  + Tambah
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActivePage('calendar')}
                  className="text-[12px] font-medium text-[#ee2e65] hover:underline cursor-pointer"
                >
                  Kalender →
                </button>
              )}
            </div>

            <div className="divide-y divide-black/[0.06]">
              {todayScheduleItems.slice(0, 4).map((item) => {
                const crewLabel = formatAssigneeSummary(item, workspace.crew);
                const bar = getWorkBarColor(item.category, item.discipline);
                const isShootingToday =
                  item.discipline === 'Shooting' && item.shootingDate === REFERENCE_TODAY;
                const timeBadge =
                  isShootingToday && item.shootingStartTime
                    ? `${item.shootingStartTime}${item.shootingEndTime ? `–${item.shootingEndTime}` : ''}`
                    : item.dueTime || '17:00';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedWorkItemId(item.id)}
                    className="w-full text-left py-2.5 first:pt-0 last:pb-0 hover:text-[#ee2e65] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-1.5 h-6 rounded-full shrink-0 ${bar.barClass}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#1C1D21] truncate">
                          {item.title}
                        </div>
                        <div className="text-[11.5px] text-[#6E717A] truncate">
                          {item.requestNo || item.code} · {item.discipline} · {crewLabel}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11.5px] font-mono tabular-nums text-[#6E717A] shrink-0">
                      {timeBadge}
                    </span>
                  </button>
                );
              })}
              {todayScheduleItems.length === 0 && (
                <div className="py-6 text-center text-[12.5px] text-[#6E717A]">
                  Belum ada jadwal project hari ini.
                </div>
              )}
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-4 w-full ui-stagger">
      {/* Top Action Row: Division Shortcuts (Left) + Project Baru Modal Button (Top Right, Above KPI) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setKanbanDivisionFilter('video_production');
              setActivePage('kanban_video');
            }}
            className="h-9 px-3 rounded-xl border border-[#FBC2D4] bg-[#FEF1F5]/75 hover:bg-[#FEF1F5] text-[#9D113C] text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#ee2e65]" />
            <span>Video Prod.</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setKanbanDivisionFilter('technical_support');
              setActivePage('kanban_video');
            }}
            className="h-9 px-3 rounded-xl border border-[#BAE6FD] bg-[#E0F2FE]/75 hover:bg-[#E0F2FE] text-[#0369A1] text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />
            <span>Tech Support</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            playUiMotionSound('pop');
            openCreateModal('project');
          }}
          className={`${ACTION_BTN_PRIMARY} w-full sm:w-auto`}
        >
          <Plus className="w-4 h-4" />
          <span>Project Baru</span>
        </button>
      </div>

      {/* Hero KPI Strip — Clean ServoLution 4-Column Pastel Strip */}
      {showSummary && (
        <section
          aria-label="Ringkasan Operasional"
          className="kpi-container grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-black/[0.08] border border-black/[0.12] rounded-2xl overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setActivePage(defaultKanbanPage)}
            className={`${isCompact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'} text-left bg-[#E6F9F0] hover:bg-[#DCF4E9] transition-colors cursor-pointer`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#146C43]">
              <span>Project Aktif</span>
              <Clapperboard className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <div className="kpi-value text-2xl sm:text-[28px] font-bold text-[#1C1D21] mt-2 tabular-nums">
              {activeProjects.length}
            </div>
            <div className="mt-1 text-[11px] sm:text-[11.5px] text-[#35684E] tabular-nums truncate">
              {activeProjects.filter((p) => p.discipline === 'Shooting').length} Shoot ·{' '}
              {activeProjects.filter((p) => p.discipline === 'Editing').length} Edit ·{' '}
              {activeProjects.filter((p) => p.discipline === 'Installasi').length} Inst
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('workload')}
            className={`${isCompact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'} text-left bg-[#F0EFFC] hover:bg-[#E6E4FA] transition-colors cursor-pointer border-l border-black/[0.08] md:border-l-0`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#3F3B99]">
              <span>Waktu Terlacak</span>
              <Timer className="w-4 h-4 text-[#6C5DD3] shrink-0" />
            </div>
            <div className="kpi-value text-2xl sm:text-[28px] font-bold text-[#1C1D21] mt-2 tabular-nums">
              {formatHoursCompact(totalProjectTrackedSec)}
            </div>
            <div className="mt-1 text-[11px] sm:text-[11.5px] text-[#5854A8] tabular-nums truncate">
              {activeProjectTimers.length} timer berjalan
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('calendar')}
            className={`${isCompact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'} text-left bg-[#FFF5E6] hover:bg-[#FFEBD1] transition-colors cursor-pointer`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#8C5811]">
              <span>Tenggat Dekat</span>
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            </div>
            <div className="kpi-value text-2xl sm:text-[28px] font-bold text-[#1C1D21] mt-2 tabular-nums">
              {urgentOrSoonItems.length}
            </div>
            <div className="mt-1 text-[11px] sm:text-[11.5px] text-[#7A592A] truncate">≤ 48 jam / mendesak</div>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('workload')}
            className={`${isCompact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'} text-left bg-[#FEF1F5] hover:bg-[#FCE6EE] transition-colors cursor-pointer border-l border-black/[0.08] md:border-l-0`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#9D113C]">
              <span>Beban Kru</span>
              <Users className="w-4 h-4 text-[#ee2e65] shrink-0" />
            </div>
            <div className="kpi-value text-2xl sm:text-[28px] font-bold text-[#1C1D21] mt-2 tabular-nums">
              {avgUtilization}%
            </div>
            <div className="mt-1 text-[11px] sm:text-[11.5px] text-[#7D3A51] tabular-nums truncate">
              {overloadedCrew.length > 0
                ? `${overloadedCrew.length} kru overload`
                : 'Semua kru aman'}
            </div>
          </button>
        </section>
      )}

      {/* Accordion Project Baru + List Table Project Masuk (Video Prod & Tech Support + Pagination) */}
      <DashboardProjectIntakeSection />

      {/* Clean 2-Column Operational Grid */}
      {secondaryWidgets.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {secondaryWidgets.map((wId) => renderSecondaryWidget(wId))}
        </div>
      ) : !showSummary ? (
        <div className="py-12 text-center rounded-2xl border border-dashed border-black/[0.12] bg-[#FAFBFD]">
          <p className="text-[13px] text-[#525660]">Semua widget sedang disembunyikan.</p>
          <button type="button" onClick={resetDashboard} className={`${ACTION_BTN_PRIMARY} mt-3`}>
            Tampilkan Default
          </button>
        </div>
      ) : null}
    </div>
  );
};
