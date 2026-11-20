import type {
  AccessRole,
  DashboardWidgetId,
  DifficultyLevel,
  KanbanStage,
  ManagerDivision,
  PastelTheme,
  PastelThemeKey,
  PriorityLevel,
  ProjectDiscipline,
  ProjectWorkflowStage,
  WorkCategory,
} from '../types';

export const PASTEL_THEMES: Record<PastelThemeKey, PastelTheme> = {
  periwinkle: {
    bg: 'bg-[#F0EFFC]',
    header: 'bg-[#D6D4FF]',
    border: 'border-[#C7C4FF]',
    text: 'text-[#3F3B99]',
    dot: 'bg-[#6C5DD3]',
    hex: '#6C5DD3',
  },
  peach: {
    bg: 'bg-[#FFF5E6]',
    header: 'bg-[#FDE6C4]',
    border: 'border-[#FAD7A0]',
    text: 'text-[#8C5811]',
    dot: 'bg-[#F59E0B]',
    hex: '#F59E0B',
  },
  coral: {
    bg: 'bg-[#FFECEB]',
    header: 'bg-[#FAD2CF]',
    border: 'border-[#F5B7B1]',
    text: 'text-[#942922]',
    dot: 'bg-[#EF4444]',
    hex: '#EF4444',
  },
  mint: {
    bg: 'bg-[#E6F9F0]',
    header: 'bg-[#C4F0DC]',
    border: 'border-[#A3E4C6]',
    text: 'text-[#146C43]',
    dot: 'bg-[#10B981]',
    hex: '#10B981',
  },
  rose: {
    bg: 'bg-[#FEF1F5]',
    header: 'bg-[#FDE0E9]',
    border: 'border-[#FBC2D4]',
    text: 'text-[#9D113C]',
    dot: 'bg-[#ee2e65]',
    hex: '#ee2e65',
  },
};

export function getRoutedManagerForDiscipline(discipline?: ProjectDiscipline): ManagerDivision {
  return discipline === 'Installasi' ? 'technical_support' : 'video_production';
}

export const MANAGER_DIVISION_META: Record<
  ManagerDivision,
  {
    label: string;
    shortLabel: string;
    disciplines: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  video_production: {
    label: 'Video Production Manager',
    shortLabel: 'Video Prod Mgr',
    disciplines: 'Shooting & Editing',
    bgClass: 'bg-[#FEF1F5]',
    textClass: 'text-[#9D113C]',
    borderClass: 'border-[#FBC2D4]',
  },
  technical_support: {
    label: 'Technical Support Manager',
    shortLabel: 'Tech Support Mgr',
    disciplines: 'Installasi',
    bgClass: 'bg-[#E0F2FE]',
    textClass: 'text-[#0369A1]',
    borderClass: 'border-[#BAE6FD]',
  },
};

export const ACCESS_ROLE_META: Record<
  AccessRole,
  { label: string; shortLabel: string; accentText: string }
> = {
  admin_project: {
    label: 'Admin Project',
    shortLabel: 'Admin Project',
    accentText: 'text-[#3F3B99]',
  },
  video_manager: {
    label: 'Video Production Manager',
    shortLabel: 'Video Prod Mgr',
    accentText: 'text-[#9D113C]',
  },
  tech_manager: {
    label: 'Technical Support Manager',
    shortLabel: 'Tech Support Mgr',
    accentText: 'text-[#0369A1]',
  },
  crew: {
    label: 'Crew',
    shortLabel: 'Crew',
    accentText: 'text-[#146C43]',
  },
};

export const WORKFLOW_STAGE_META: Record<
  ProjectWorkflowStage,
  {
    step: number;
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  pending_review: {
    step: 2,
    label: 'Menunggu Review Manager',
    bgClass: 'bg-[#FFF5E6]',
    textClass: 'text-[#8C5811]',
    borderClass: 'border-[#FAD7A0]',
  },
  revision_admin: {
    step: 1,
    label: 'Dikembalikan ke Admin',
    bgClass: 'bg-[#FFF5E6]',
    textClass: 'text-[#8C5811]',
    borderClass: 'border-[#FAD7A0]',
  },
  rejected_manager: {
    step: 2,
    label: 'Ditolak Manager',
    bgClass: 'bg-[#FFECEB]',
    textClass: 'text-[#942922]',
    borderClass: 'border-[#F5B7B1]',
  },
  in_execution: {
    step: 3,
    label: 'Dikerjakan Crew',
    bgClass: 'bg-[#F0EFFC]',
    textClass: 'text-[#3F3B99]',
    borderClass: 'border-[#C7C4FF]',
  },
  pending_handover: {
    step: 4,
    label: 'Dikembalikan ke Manager',
    bgClass: 'bg-[#FEF1F5]',
    textClass: 'text-[#9D113C]',
    borderClass: 'border-[#FBC2D4]',
  },
  delivered_client: {
    step: 4,
    label: 'Diserahkan ke Klien',
    bgClass: 'bg-[#E6F9F0]',
    textClass: 'text-[#146C43]',
    borderClass: 'border-[#A3E4C6]',
  },
};

export const WORK_CATEGORY_META: Record<
  WorkCategory,
  {
    label: string;
    shortLabel: string;
    colorHex: string;
    barClass: string;
    surfaceClass: string;
    textClass: string;
    borderClass: string;
    theme: PastelThemeKey;
  }
> = {
  project: {
    label: 'Project Shooting, Editing & Installasi',
    shortLabel: 'Project',
    colorHex: '#ee2e65',
    barClass: 'bg-[#ee2e65]',
    surfaceClass: 'bg-[#FEF1F5]',
    textClass: 'text-[#9D113C]',
    borderClass: 'border-[#FBC2D4]',
    theme: 'rose',
  },
  routine: {
    label: 'Tugas Rutin',
    shortLabel: 'Rutin',
    colorHex: '#10B981',
    barClass: 'bg-[#10B981]',
    surfaceClass: 'bg-[#E6F9F0]',
    textClass: 'text-[#146C43]',
    borderClass: 'border-[#A3E4C6]',
    theme: 'mint',
  },
  flexible: {
    label: 'Tugas Fleksibel',
    shortLabel: 'Fleksibel',
    colorHex: '#F59E0B',
    barClass: 'bg-[#F59E0B]',
    surfaceClass: 'bg-[#FFF5E6]',
    textClass: 'text-[#8C5811]',
    borderClass: 'border-[#FAD7A0]',
    theme: 'peach',
  },
};

export function getWorkBarColor(category: WorkCategory, discipline?: ProjectDiscipline): {
  barClass: string;
  hex: string;
  softBg: string;
  textClass: string;
  borderClass: string;
  label: string;
} {
  if (category === 'routine') {
    return {
      barClass: 'bg-[#10B981]',
      hex: '#10B981',
      softBg: 'bg-[#E6F9F0]',
      textClass: 'text-[#146C43]',
      borderClass: 'border-[#A3E4C6]',
      label: 'Tugas Rutin',
    };
  }
  if (category === 'flexible') {
    return {
      barClass: 'bg-[#F59E0B]',
      hex: '#F59E0B',
      softBg: 'bg-[#FFF5E6]',
      textClass: 'text-[#8C5811]',
      borderClass: 'border-[#FAD7A0]',
      label: 'Tugas Fleksibel',
    };
  }
  if (discipline === 'Installasi') {
    return {
      barClass: 'bg-[#0284C7]',
      hex: '#0284C7',
      softBg: 'bg-[#E0F2FE]',
      textClass: 'text-[#0369A1]',
      borderClass: 'border-[#BAE6FD]',
      label: 'Project · Installasi',
    };
  }
  if (discipline === 'Editing') {
    return {
      barClass: 'bg-[#6C5DD3]',
      hex: '#6C5DD3',
      softBg: 'bg-[#F0EFFC]',
      textClass: 'text-[#3F3B99]',
      borderClass: 'border-[#C7C4FF]',
      label: 'Project · Editing',
    };
  }
  return {
    barClass: 'bg-[#ee2e65]',
    hex: '#ee2e65',
    softBg: 'bg-[#FEF1F5]',
    textClass: 'text-[#9D113C]',
    borderClass: 'border-[#FBC2D4]',
    label: `Project · ${discipline || 'Shooting'}`,
  };
}

export const KANBAN_COLUMNS: Array<{
  id: KanbanStage;
  title: string;
  wipLimit: number | null;
  dotColor: string;
}> = [
  { id: 'backlog', title: 'Antrean Crew', wipLimit: null, dotColor: 'bg-[#78909C]' },
  { id: 'preprod', title: 'Persiapan', wipLimit: 3, dotColor: 'bg-[#6C5DD3]' },
  { id: 'production', title: 'Sedang Dikerjakan', wipLimit: 4, dotColor: 'bg-[#ee2e65]' },
  { id: 'review', title: 'Kembali ke Manager', wipLimit: 3, dotColor: 'bg-[#F59E0B]' },
  { id: 'done', title: 'Diserahkan ke Klien', wipLimit: null, dotColor: 'bg-[#10B981]' },
];

export const PRIORITY_STYLE: Record<PriorityLevel, { text: string; weight: number }> = {
  Mendesak: { text: 'text-[#C11448] font-semibold', weight: 4 },
  Tinggi: { text: 'text-[#B45309] font-semibold', weight: 3 },
  Sedang: { text: 'text-[#3F3B99] font-medium', weight: 2 },
  Rendah: { text: 'text-[#6E717A] font-medium', weight: 1 },
};

export const DIFFICULTY_META: Record<
  DifficultyLevel,
  { label: string; points: number; textClass: string }
> = {
  Mudah: { label: 'Mudah', points: 1, textClass: 'text-[#146C43]' },
  Menengah: { label: 'Menengah', points: 2, textClass: 'text-[#3F3B99]' },
  Kompleks: { label: 'Kompleks', points: 3, textClass: 'text-[#B45309]' },
  Kritis: { label: 'Kritis', points: 4, textClass: 'text-[#C11448]' },
};

export const DEFAULT_DASHBOARD_WIDGETS: Array<{
  id: DashboardWidgetId;
  title: string;
  description: string;
}> = [
  {
    id: 'summary_strip',
    title: 'Ringkasan Project Real-Time',
    description: 'Project aktif (Shooting, Editing, Installasi), kapasitas kru, jam terlacak, dan tenggat dekat.',
  },
  {
    id: 'urgent_deadlines',
    title: 'Tenggat Project Dekat & Mendesak',
    description: 'Daftar project yang jatuh tempo dalam 48 jam atau berprioritas mendesak.',
  },
  {
    id: 'today_schedule',
    title: 'Jadwal Project Hari Ini',
    description: 'Agenda project shooting, editing, dan installasi yang berjalan hari ini.',
  },
];
