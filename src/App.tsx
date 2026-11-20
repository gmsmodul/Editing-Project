/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { PageTransition } from './components/ui/PageTransition';
import { ElasticPullToRefresh } from './components/ui/ElasticPullToRefresh';
import { ToastContainer } from './components/ui/ToastContainer';
import type { PageId } from './types';

// Lazy-loaded pages & heavy modals for code-splitting and fast initial load
const OverviewPage = lazy(() =>
  import('./components/pages/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const ProjectManagerPage = lazy(() =>
  import('./components/pages/ProjectManagerPage').then((m) => ({ default: m.ProjectManagerPage }))
);
const KanbanPage = lazy(() =>
  import('./components/pages/KanbanPage').then((m) => ({ default: m.KanbanPage }))
);
const GanttPage = lazy(() =>
  import('./components/pages/GanttPage').then((m) => ({ default: m.GanttPage }))
);
const RoutineFlexiblePage = lazy(() =>
  import('./components/pages/RoutineFlexiblePage').then((m) => ({
    default: m.RoutineFlexiblePage,
  }))
);
const CalendarPage = lazy(() =>
  import('./components/pages/CalendarPage').then((m) => ({ default: m.CalendarPage }))
);
const WorkloadPage = lazy(() =>
  import('./components/pages/WorkloadPage').then((m) => ({ default: m.WorkloadPage }))
);
const AnalyticsReportsPage = lazy(() =>
  import('./components/pages/AnalyticsReportsPage').then((m) => ({
    default: m.AnalyticsReportsPage,
  }))
);
const CreateWorkItemModal = lazy(() =>
  import('./components/modals/CreateWorkItemModal').then((m) => ({
    default: m.CreateWorkItemModal,
  }))
);
const WorkItemDetailDrawer = lazy(() =>
  import('./components/modals/WorkItemDetailDrawer').then((m) => ({
    default: m.WorkItemDetailDrawer,
  }))
);

const PageLoadingFallback: React.FC = () => (
  <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-4 w-full">
    <div className="grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.08] border border-black/[0.12] rounded-2xl overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="p-4 sm:p-5 space-y-3 bg-white dark:bg-[#15181E]">
          <div className="h-3 w-20 rounded-full ui-skeleton-shimmer" />
          <div className="h-7 w-24 rounded-lg ui-skeleton-shimmer" />
          <div className="h-3 w-28 rounded-full ui-skeleton-shimmer" />
        </div>
      ))}
    </div>
    <div className="h-64 rounded-2xl border border-black/[0.12] dark:border-white/[0.08] ui-skeleton-shimmer" />
  </div>
);

// Exact gmsmodul/UI-KIT soft morphing masked shell tint wash per menu
const MENU_SHELL_TINTS: Record<PageId, { light: string; dark: string }> = {
  intake: { light: '#E6E0FF', dark: '#4C3F82' },
  project_manager: { light: '#FCE3EC', dark: '#6E2F49' },
  approval_video: { light: '#FCE3EC', dark: '#73314B' },
  kanban_video: { light: '#FCE3EC', dark: '#73314B' },
  handover_video: { light: '#FDE8F0', dark: '#6E2F49' },
  approval_tech: { light: '#DFEEFF', dark: '#244A6E' },
  kanban_tech: { light: '#DFEEFF', dark: '#244A6E' },
  handover_tech: { light: '#DEF3F7', dark: '#225360' },
  overview: { light: '#E6E0FF', dark: '#4C3F82' },
  gantt: { light: '#DFEEFF', dark: '#2E4C73' },
  calendar: { light: '#DFF5EB', dark: '#285D49' },
  workload: { light: '#FDEEDB', dark: '#6E4E28' },
  analytics: { light: '#E3E7FF', dark: '#39417A' },
  tasks: { light: '#DEF3F7', dark: '#285863' },
};

const SHELL_TINT_MASK_LIGHT =
  'linear-gradient(135deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.22) 28%, rgba(0,0,0,0) 56%)';
const SHELL_TINT_MASK_DARK =
  'linear-gradient(135deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.14) 28%, rgba(0,0,0,0) 56%)';

const MainShell: React.FC = () => {
  const {
    activePage,
    prevPage,
    theme,
    loading,
    workspace,
    refreshWorkspace,
    createModalOpen,
    selectedWorkItemId,
  } = useWorkspace();
  const shellTint = MENU_SHELL_TINTS[activePage] || MENU_SHELL_TINTS.overview;
  const activeTintColor = theme === 'dark' ? shellTint.dark : shellTint.light;
  const activeMask = theme === 'dark' ? SHELL_TINT_MASK_DARK : SHELL_TINT_MASK_LIGHT;

  const renderPage = () => {
    if (loading && !workspace) {
      return <PageLoadingFallback />;
    }

    switch (activePage) {
      case 'intake':
        return <OverviewPage />;
      case 'project_manager':
      case 'approval_video':
      case 'approval_tech':
      case 'handover_video':
      case 'handover_tech':
        return <ProjectManagerPage />;
      case 'kanban_video':
      case 'kanban_tech':
        return <KanbanPage />;
      case 'overview':
        return <OverviewPage />;
      case 'gantt':
        return <GanttPage />;
      case 'tasks':
        return <RoutineFlexiblePage />;
      case 'calendar':
        return <CalendarPage />;
      case 'workload':
        return <WorkloadPage />;
      case 'analytics':
        return <AnalyticsReportsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-[#E8E9F0] dark:bg-[#0B0D10] p-1.5 sm:p-2 md:p-2.5 font-sans text-[#1C1D21] dark:text-[#F3F4F6] flex justify-center items-stretch selection:bg-[#D6D4FF] selection:text-[#1C1D21] dark:selection:bg-[#ee2e65]/30 dark:selection:text-white transition-colors duration-200">
      {/* Main Container Shell — Exact gmsmodul/ServoLution-app framed rounded pastel shell on mobile & desktop */}
      <div className="app-shell-container ui-kit-root w-full md:h-full bg-gradient-to-br from-[#F1EFFE] via-[#F8F9FC] to-[#ECF8F2] dark:from-[#161922] dark:via-[#15181E] dark:to-[#131C1A] rounded-[22px] sm:rounded-[26px] md:rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_70px_-15px_rgba(0,0,0,0.65)] border border-white/80 dark:border-white/[0.08] flex overflow-hidden relative min-w-0 min-h-0">
        <motion.div
          aria-hidden="true"
          animate={{ backgroundColor: activeTintColor }}
          transition={{ duration: 0.48, ease: [0.23, 1, 0.32, 1] }}
          style={{
            backgroundColor: activeTintColor,
            maskImage: activeMask,
            WebkitMaskImage: activeMask,
          }}
          className="pointer-events-none absolute inset-0 z-0 opacity-85 md:opacity-100"
        />

        <Sidebar />

        <main className="relative z-10 flex-1 bg-white dark:bg-[#121418] m-1.5 sm:m-2.5 rounded-[18px] sm:rounded-[24px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] dark:shadow-none border border-black/[0.12] dark:border-white/[0.08] flex flex-col min-w-0 min-h-0 overflow-hidden pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-0 transition-colors duration-200">
          <Header />
          <ElasticPullToRefresh onRefresh={refreshWorkspace}>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
              <PageTransition activePage={activePage} prevPage={prevPage}>
                <Suspense fallback={<PageLoadingFallback />}>{renderPage()}</Suspense>
              </PageTransition>
            </div>
          </ElasticPullToRefresh>
        </main>
      </div>

      <MobileBottomNav />
      {createModalOpen && (
        <Suspense fallback={null}>
          <CreateWorkItemModal />
        </Suspense>
      )}
      {selectedWorkItemId && (
        <Suspense fallback={null}>
          <WorkItemDetailDrawer />
        </Suspense>
      )}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <WorkspaceProvider>
        <MainShell />
      </WorkspaceProvider>
    </MotionConfig>
  );
}
