import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getRoutedManagerForDiscipline } from '../../constants/theme';
import { HorizontalSlideTrack } from './HorizontalSlideTrack';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { ManagerDivision, PageId } from '../../types';

interface WorkflowStepperProps {
  currentStep?: 1 | 2 | 3 | 4;
  division?: ManagerDivision;
  onNavigate?: () => void;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStep,
  division,
  onNavigate,
}) => {
  const { workspace, setActivePage, isTechManager } = useWorkspace();

  const resolvedDivision: ManagerDivision =
    division || (isTechManager ? 'technical_support' : 'video_production');
  const isTech = resolvedDivision === 'technical_support';

  const allProjects = (workspace?.workItems || []).filter((w) => w.category === 'project');
  const divisionProjects = allProjects.filter(
    (p) => (p.routedManager || getRoutedManagerForDiscipline(p.discipline)) === resolvedDivision
  );

  const revisionCount = division
    ? divisionProjects.filter((p) => p.workflowStage === 'revision_admin').length
    : allProjects.filter((p) => p.workflowStage === 'revision_admin').length;
  const reviewCount = divisionProjects.filter((p) => p.workflowStage === 'pending_review').length;
  const executionCount = divisionProjects.filter(
    (p) => p.workflowStage === 'in_execution' || (!p.workflowStage && p.status !== 'Selesai')
  ).length;
  const handoverCount = divisionProjects.filter((p) => p.workflowStage === 'pending_handover').length;

  const steps: Array<{
    step: 1 | 2 | 3 | 4;
    pageId: PageId;
    label: string;
    shortLabel: string;
    count: number;
  }> = [
    { step: 1, pageId: 'overview', label: '1. Project Baru', shortLabel: '1. Baru', count: revisionCount },
    {
      step: 2,
      pageId: 'project_manager',
      label: isTech ? '2. Review Tech' : '2. Review Video',
      shortLabel: '2. Review',
      count: reviewCount,
    },
    {
      step: 3,
      pageId: 'kanban_video',
      label: '3. Kanban Eksekusi',
      shortLabel: '3. Eksekusi',
      count: executionCount,
    },
    {
      step: 4,
      pageId: 'project_manager',
      label: isTech ? '4. Serah Terima Tech' : '4. Serah Terima Video',
      shortLabel: '4. Klien',
      count: handoverCount,
    },
  ];

  const activePillClass = isTech
    ? 'bg-[#0284C7] md:bg-[#E0F2FE] text-white md:text-[#0369A1] font-semibold shadow-xs md:shadow-none'
    : 'bg-[#ee2e65] md:bg-[#FEF1F5] text-white md:text-[#9D113C] font-semibold shadow-xs md:shadow-none';

  return (
    <div className="border-b border-black/[0.10] dark:border-white/[0.08] pb-2">
      <HorizontalSlideTrack
        accent="primary"
        visibility="mobile-only"
        activeKey={`${resolvedDivision}-${currentStep}`}
        trackClassName="flex items-center gap-1.5"
      >
        {steps.map((s, idx) => {
          const active = currentStep === s.step;
          return (
            <React.Fragment key={s.step}>
              <button
                type="button"
                data-slide-active={active ? 'true' : undefined}
                onClick={() => {
                  playUiMotionSound('tick');
                  onNavigate?.();
                  setActivePage(s.pageId);
                }}
                className={`px-3 py-1.5 rounded-full md:rounded-lg text-[12px] sm:text-[12.5px] whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? activePillClass
                    : 'bg-[#F4F5F8] md:bg-transparent text-[#525660] md:text-[#6E717A] hover:text-[#1C1D21] md:hover:bg-black/[0.03] font-medium'
                }`}
              >
                <span className="sm:hidden">{s.shortLabel}</span>
                <span className="hidden sm:inline">{s.label}</span>
                {s.count > 0 && (
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      active ? 'opacity-90' : 'opacity-75'
                    }`}
                  >
                    ({s.count})
                  </span>
                )}
              </button>
              {idx < steps.length - 1 && (
                <ChevronRight className="hidden md:block w-3.5 h-3.5 text-[#A0A4AE] shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </HorizontalSlideTrack>
    </div>
  );
};
