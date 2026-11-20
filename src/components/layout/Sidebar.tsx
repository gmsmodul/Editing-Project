import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Kanban,
  GanttChart,
  ListChecks,
  Calendar,
  Timer,
  BarChart3,
  Clapperboard,
  PanelLeft,
  ChevronDown,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ACCESS_ROLE_META, getRoutedManagerForDiscipline } from '../../constants/theme';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { PageId } from '../../types';

export type NavSection = 'dashboard' | 'monitoring' | 'crew';

export const NAV_ITEMS: Array<{
  id: PageId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  section: NavSection;
}> = [
  { id: 'overview', label: 'Dasbor Project', shortLabel: 'Dasbor', icon: LayoutDashboard, section: 'dashboard' },
  { id: 'project_manager', label: 'Project Manager', shortLabel: 'Project Mgr', icon: ClipboardCheck, section: 'dashboard' },
  { id: 'kanban_video', label: 'Kanban Eksekusi', shortLabel: 'Kanban', icon: Kanban, section: 'dashboard' },
  { id: 'gantt', label: 'Gantt Terpadu', shortLabel: 'Gantt', icon: GanttChart, section: 'monitoring' },
  { id: 'calendar', label: 'Kalender Tim', shortLabel: 'Kalender', icon: Calendar, section: 'monitoring' },
  { id: 'workload', label: 'Waktu & Beban Kru', shortLabel: 'Beban Kru', icon: Timer, section: 'monitoring' },
  { id: 'analytics', label: 'Analitik & Laporan', shortLabel: 'Laporan', icon: BarChart3, section: 'monitoring' },
  { id: 'tasks', label: 'Task', shortLabel: 'Task', icon: ListChecks, section: 'crew' },
];

export const NAV_SECTION_META: Record<
  NavSection,
  { label: string; dotClass?: string; labelClass?: string }
> = {
  dashboard: { label: 'Utama' },
  monitoring: { label: 'Monitoring & Jadwal' },
  crew: { label: 'Ruang Mandiri Kru' },
};

// Re-export Kanban icon reference so downstream imports stay clean if needed
export { Kanban };

export const Sidebar: React.FC = () => {
  const {
    activePage,
    setActivePage,
    sidebarOpen,
    setSidebarOpen,
    workspace,
    currentCrew,
    currentCrewId,
    setCurrentCrewId,
    crewWorkloads,
  } = useWorkspace();

  const [crewMenuOpen, setCrewMenuOpen] = useState(false);
  const navListRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0,
    height: 40,
    visible: false,
  });

  const overloadedCount = crewWorkloads.filter((w) => w.isOverloaded).length;
  const activeTimerCount = workspace?.activeTimers.length || 0;

  const projects = (workspace?.workItems || []).filter((w) => w.category === 'project');
  const videoProjects = projects.filter(
    (p) => (p.routedManager || getRoutedManagerForDiscipline(p.discipline)) === 'video_production'
  );
  const techProjects = projects.filter(
    (p) => (p.routedManager || getRoutedManagerForDiscipline(p.discipline)) === 'technical_support'
  );

  const counts = {
    revision: projects.filter(
      (p) => p.workflowStage === 'revision_admin' || p.workflowStage === 'rejected_manager'
    ).length,
    videoReview: videoProjects.filter((p) => p.workflowStage === 'pending_review').length,
    videoExec: videoProjects.filter(
      (p) => p.workflowStage === 'in_execution' || (!p.workflowStage && p.status !== 'Selesai')
    ).length,
    videoHandover: videoProjects.filter((p) => p.workflowStage === 'pending_handover').length,
    techReview: techProjects.filter((p) => p.workflowStage === 'pending_review').length,
    techExec: techProjects.filter(
      (p) => p.workflowStage === 'in_execution' || (!p.workflowStage && p.status !== 'Selesai')
    ).length,
    techHandover: techProjects.filter((p) => p.workflowStage === 'pending_handover').length,
  };

  useLayoutEffect(() => {
    const activeEl = itemRefs.current[activePage];
    const container = navListRef.current;
    if (!activeEl || !container) return;
    setIndicator({
      top: activeEl.offsetTop,
      height: activeEl.offsetHeight,
      visible: true,
    });
  }, [activePage, sidebarOpen]);

  const getBadge = (id: PageId): { text: string; toneClass: string } | null => {
    const totalManagerQueue =
      counts.videoReview + counts.techReview + counts.videoHandover + counts.techHandover;
    const totalExec = counts.videoExec + counts.techExec;
    if (id === 'overview' && counts.revision > 0) {
      return { text: `${counts.revision} rev`, toneClass: 'text-[#C11448] dark:text-[#fbc2d4]' };
    }
    if (id === 'project_manager' && totalManagerQueue > 0) {
      return { text: `${totalManagerQueue}`, toneClass: 'text-[#C11448] dark:text-[#fbc2d4]' };
    }
    if (id === 'kanban_video' && totalExec > 0) {
      return { text: `${totalExec}`, toneClass: 'text-[#6C5DD3] dark:text-violet-300' };
    }
    return null;
  };

  return (
    <aside
      className={`hidden md:flex md:static inset-y-0 left-0 z-40 h-full max-h-full overflow-hidden shrink-0 flex-col transition-all duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] bg-transparent backdrop-blur-md border-r border-black/[0.12] dark:border-white/[0.08] ${
        sidebarOpen ? 'w-[266px]' : 'w-[84px]'
      } p-4 select-none`}
    >
      {/* Brand Logo Header — Exact gmsmodul/UI-KIT layout */}
      <div className="shrink-0 flex items-center justify-between px-2 pt-1 pb-4">
        <button
          type="button"
          onClick={() => {
            playUiMotionSound('tick');
            setActivePage('overview');
          }}
          className="flex items-center gap-3 min-w-0 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-full bg-[#ee2e65] flex items-center justify-center text-white shadow-[0_4px_12px_-3px_rgba(238,46,101,0.45)] shrink-0 group-hover:brightness-105 transition-all">
            <Clapperboard className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0 text-left">
              <span className="block font-semibold text-[16px] tracking-tight text-[#1C1D21] dark:text-[#F3F4F6] leading-tight">
                ServoMedia
              </span>
              <span className="block text-[10.5px] font-medium text-[#646772] dark:text-gray-400 leading-tight">
                Multimedia OS
              </span>
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            playUiMotionSound('tick');
            setSidebarOpen((prev) => !prev);
          }}
          title={sidebarOpen ? 'Ciutkan Sidebar' : 'Perluas Sidebar'}
          className="hidden md:flex w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/[0.06] items-center justify-center text-[#5A5D67] dark:text-gray-400 transition-colors cursor-pointer shrink-0"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Main Navigation — Exact gmsmodul/UI-KIT sliding white active pill & separated division sections */}
      <nav
        aria-label="Navigasi Utama"
        className="flex-1 min-h-0 overflow-y-auto custom-sidebar-scrollbar pr-0.5"
      >
        <div ref={navListRef} className="relative space-y-1 pb-2">
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-0 right-0 top-0 rounded-lg bg-white dark:bg-[#121418] shadow-xs dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-[transform,height,opacity] duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
              indicator.visible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              height: `${indicator.height}px`,
              transform: `translate3d(0, ${indicator.top}px, 0)`,
            }}
          />

          {NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const showOverloadHint = item.id === 'workload' && overloadedCount > 0;
            const showActiveTimerCount = item.id === 'workload' && activeTimerCount > 0;
            const badge = getBadge(item.id);
            const prevSection = NAV_ITEMS[idx - 1]?.section;
            const isSectionStart = idx === 0 || item.section !== prevSection;
            const sectionMeta = NAV_SECTION_META[item.section];
            const isTechItem = false;

            return (
              <React.Fragment key={item.id}>
                {isSectionStart && (
                  <div
                    className={
                      idx === 0
                        ? 'pt-1'
                        : 'pt-2.5 mt-2.5 border-t border-black/[0.10] dark:border-white/[0.08]'
                    }
                  >
                    {sidebarOpen && (
                      <div
                        className={`relative z-10 px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                          sectionMeta.labelClass || 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {sectionMeta.dotClass && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sectionMeta.dotClass}`} />
                        )}
                        <span>{sectionMeta.label}</span>
                      </div>
                    )}
                  </div>
                )}
                <button
                  ref={(el) => {
                    itemRefs.current[item.id] = el;
                  }}
                  type="button"
                  onClick={() => {
                    playUiMotionSound('tick');
                    setActivePage(item.id);
                  }}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`relative z-10 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-[#1C1D21] dark:text-white font-semibold'
                      : 'text-[#5A5D67] dark:text-gray-300 hover:text-[#1C1D21] dark:hover:text-white font-medium'
                  } ${!sidebarOpen ? 'justify-center px-0' : ''}`}
                >
                  <Icon
                    className={`w-[17px] h-[17px] shrink-0 transition-colors ${
                      isActive
                        ? isTechItem
                          ? 'text-[#0284C7]'
                          : 'text-[#ee2e65]'
                        : 'text-[#646772] dark:text-gray-400'
                    }`}
                  />
                  {sidebarOpen && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {sidebarOpen && badge && (
                    <span
                      className={`text-[11px] font-mono tabular-nums font-bold shrink-0 ${badge.toneClass}`}
                    >
                      {badge.text}
                    </span>
                  )}
                  {sidebarOpen && showOverloadHint && (
                    <span
                      className="text-[11px] font-mono tabular-nums font-semibold text-[#C11448] dark:text-[#fbc2d4] shrink-0 flex items-center gap-0.5"
                      title={`${overloadedCount} kru melebihi batas beban kerja`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {overloadedCount}
                    </span>
                  )}
                  {sidebarOpen && !showOverloadHint && showActiveTimerCount && (
                    <span className="text-[11px] font-mono tabular-nums font-semibold text-[#6C5DD3] dark:text-violet-300 shrink-0">
                      {activeTimerCount} aktif
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </nav>

      {/* Active Role & Crew Switcher */}
      {currentCrew && workspace && (
        <div className="shrink-0 pt-3 mt-3 border-t border-black/[0.10] dark:border-white/[0.08] relative">
          <button
            type="button"
            onClick={() => {
              playUiMotionSound('pop');
              setCrewMenuOpen((o) => !o);
            }}
            className={`w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/75 dark:hover:bg-white/[0.06] transition-colors cursor-pointer ${
              !sidebarOpen ? 'justify-center' : ''
            }`}
            title="Ganti Profil & Role Aktif"
          >
            <div
              data-dark-preserve="true"
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[11.5px] font-bold shrink-0 ${currentCrew.avatarBg} ${currentCrew.avatarText}`}
            >
              {currentCrew.initials}
            </div>
            {sidebarOpen && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-[13px] font-semibold text-[#1C1D21] dark:text-gray-100 truncate">
                    {currentCrew.name}
                  </div>
                  <div className="text-[11px] text-[#646772] dark:text-gray-400 truncate">
                    {ACCESS_ROLE_META[currentCrew.accessRole]?.shortLabel || currentCrew.role}
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-[#646772] dark:text-gray-400 shrink-0 transition-transform ${
                    crewMenuOpen ? 'rotate-180 text-[#ee2e65]' : ''
                  }`}
                />
              </>
            )}
          </button>

          {crewMenuOpen && (
            <div
              className={`absolute bottom-full mb-2 ${
                sidebarOpen ? 'left-0 right-0' : 'left-2 w-72'
              } bg-white/95 dark:bg-[#15181E]/95 backdrop-blur-sm rounded-xl border border-gray-300 dark:border-white/[0.14] shadow-[0_16px_38px_-10px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_42px_-10px_rgba(0,0,0,0.75)] p-1.5 z-50 animate-ui-pop-up`}
            >
              <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Ganti Peran / Profil Aktif
              </div>
              <div className="space-y-0.5 max-h-72 overflow-y-auto">
                {workspace.crew.map((member) => {
                  const wl = crewWorkloads.find((w) => w.crew.id === member.id);
                  const selected = member.id === currentCrewId;
                  const roleMeta = ACCESS_ROLE_META[member.accessRole];
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        playUiMotionSound('tick');
                        setCurrentCrewId(member.id);
                        setCrewMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#FEF1F5] dark:bg-[#ee2e65]/20 text-[#9D113C] dark:text-[#fbc2d4]'
                          : 'hover:bg-gray-50 dark:hover:bg-white/[0.06] text-[#1C1D21] dark:text-gray-200'
                      }`}
                    >
                      <span
                        data-dark-preserve="true"
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${member.avatarBg} ${member.avatarText}`}
                      >
                        {member.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold truncate">{member.name}</div>
                        <div className="text-[11px] text-[#646772] dark:text-gray-400 truncate">
                          <span className={`font-semibold ${roleMeta?.accentText || ''}`}>
                            {roleMeta?.shortLabel || member.role}
                          </span>
                          {' · '}
                          <span className="font-mono tabular-nums">
                            {wl ? `${wl.totalActiveHours}/${member.maxWeeklyHours}j` : member.division}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
