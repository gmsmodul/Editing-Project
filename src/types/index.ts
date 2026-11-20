export type PageId =
  | 'intake'
  | 'project_manager'
  | 'approval_video'
  | 'kanban_video'
  | 'handover_video'
  | 'approval_tech'
  | 'kanban_tech'
  | 'handover_tech'
  | 'overview'
  | 'gantt'
  | 'calendar'
  | 'workload'
  | 'analytics'
  | 'tasks';

export type PastelThemeKey = 'periwinkle' | 'peach' | 'coral' | 'mint' | 'rose';

export interface PastelTheme {
  bg: string;
  header: string;
  border: string;
  text: string;
  dot: string;
  hex: string;
}

export type WorkCategory = 'project' | 'routine' | 'flexible';

export type ProjectDiscipline = 'Shooting' | 'Editing' | 'Installasi';

export type AccessRole = 'admin_project' | 'video_manager' | 'tech_manager' | 'crew';

export type ManagerDivision = 'video_production' | 'technical_support';

export type ProjectWorkflowStage =
  | 'pending_review'
  | 'revision_admin'
  | 'rejected_manager'
  | 'in_execution'
  | 'pending_handover'
  | 'delivered_client';

export type ProjectStatus =
  | 'Waiting List'
  | 'On Progress'
  | 'Review'
  | 'Revision'
  | 'Completed'
  | 'On Hold'
  | 'Rejected';

export type PriorityLevel = 'Mendesak' | 'Tinggi' | 'Sedang' | 'Rendah';

export type DifficultyLevel = 'Mudah' | 'Menengah' | 'Kompleks' | 'Kritis';

export type KanbanStage = 'backlog' | 'preprod' | 'production' | 'review' | 'done';

export type TaskStatus = 'Belum Mulai' | 'Sedang Dikerjakan' | 'Review' | 'Selesai';

export type RecurrenceType = 'Sekali' | 'Harian' | 'Mingguan' | 'Bulanan';

export interface CrewMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  accessRole: AccessRole;
  division: 'Shooting' | 'Editing' | 'Installasi' | 'Operasional';
  maxWeeklyHours: number;
  avatarBg: string;
  avatarText: string;
  email: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface AssignmentHistoryEntry {
  id: string;
  type: 'assigned' | 'reassigned' | 'added_collaborator' | 'removed_collaborator';
  fromCrewIds: string[];
  toCrewIds: string[];
  actorCrewId?: string;
  note?: string;
  createdAt: string;
}

export interface WorkItem {
  id: string;
  code: string;
  title: string;
  description: string;
  category: WorkCategory;
  discipline?: ProjectDiscipline;
  priority: PriorityLevel;
  difficulty: DifficultyLevel;
  estimatedHours: number;
  loggedSeconds: number;
  assigneeId: string;
  assigneeIds?: string[];
  assignmentHistory?: AssignmentHistoryEntry[];
  kanbanStage: KanbanStage;
  status: TaskStatus;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  location?: string;
  recurrence?: RecurrenceType;
  progress: number; // 0..100
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  // End-to-End Project Workflow & Standardized Intake Fields
  requestNo?: string;
  coordinatorDepartment?: string;
  clientName?: string;
  clientPhone?: string;
  clientContact?: string;
  receivedDate?: string; // YYYY-MM-DD
  shootingDate?: string; // YYYY-MM-DD (Shooting only)
  shootingStartTime?: string; // HH:mm (Shooting only)
  shootingEndTime?: string; // HH:mm (Shooting only)
  calendarCoordination?: boolean;
  projectStatus?: ProjectStatus;
  changeNotes?: string;
  workflowStage?: ProjectWorkflowStage;
  routedManager?: ManagerDivision;
  createdByAdminId?: string;
  approvedByManagerId?: string;
  approvedAt?: string;
  revisionNote?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedByManagerId?: string;
  handoverNote?: string;
  deliveredToClientAt?: string;
}

export interface ActiveTimer {
  id: string;
  workItemId: string;
  crewId: string;
  startedAt: string; // ISO
  autoStopAt?: string; // ISO (16:30 local cutoff for Editing projects)
  note?: string;
}

export interface TimeLogEntry {
  id: string;
  workItemId: string;
  crewId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  note?: string;
  source?: 'auto' | 'manual';
  autoStopped?: boolean;
}

export type NotificationType = 'urgent' | 'overload' | 'deadline' | 'report' | 'update';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  workItemId?: string;
  crewId?: string;
  targetPage?: PageId;
}

export type DashboardWidgetId =
  | 'summary_strip'
  | 'live_tracker'
  | 'crew_workload'
  | 'urgent_deadlines'
  | 'today_schedule'
  | 'weekly_productivity';

export interface UserDashboardConfig {
  crewId: string;
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
  density: 'comfortable' | 'compact';
}

export interface MonthlyCrewBreakdown {
  crewId: string;
  crewName: string;
  role: string;
  projectHours: number;
  routineHours: number;
  flexibleHours: number;
  completedCount: number;
  utilizationPct: number;
}

export interface MonthlyReportRecord {
  id: string;
  monthKey: string;
  monthLabel: string;
  generatedAt: string;
  autoGenerated: boolean;
  totalProjectsCompleted: number;
  totalRoutineCompleted: number;
  totalFlexibleCompleted: number;
  totalTrackedHours: number;
  totalEstimatedHours: number;
  onTimeRate: number;
  overloadIncidents: number;
  crewBreakdown: MonthlyCrewBreakdown[];
}

export interface AutoReportSettings {
  enabled: boolean;
  dayOfMonth: 'last_day' | '28' | '1';
  runTime: string;
  includeRoutineAndFlexible: boolean;
  lastRunAt: string;
}

export interface WeeklyProductivityPoint {
  weekLabel: string;
  plannedHours: number;
  trackedHours: number;
  completedProjects: number;
  completedNonProject: number;
}

export interface WorkspaceState {
  crew: CrewMember[];
  workItems: WorkItem[];
  activeTimers: ActiveTimer[];
  timeLogs: TimeLogEntry[];
  notifications: AppNotification[];
  dashboardConfigs: Record<string, UserDashboardConfig>;
  monthlyReports: MonthlyReportRecord[];
  autoReportSettings: AutoReportSettings;
  weeklyHistory: WeeklyProductivityPoint[];
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export type ProjectWorkflowActionPayload =
  | {
      action: 'resubmit_to_manager';
      actorCrewId: string;
      title?: string;
      description?: string;
      requestNo?: string;
      coordinatorDepartment?: string;
      clientName?: string;
      clientPhone?: string;
      clientContact?: string;
      discipline?: ProjectDiscipline;
      location?: string;
      receivedDate?: string;
      dueDate?: string;
      shootingDate?: string;
      shootingStartTime?: string;
      shootingEndTime?: string;
      calendarCoordination?: boolean;
      projectStatus?: ProjectStatus;
      changeNotes?: string;
      priority?: PriorityLevel;
    }
  | {
      action: 'return_to_admin';
      actorCrewId: string;
      revisionNote: string;
    }
  | {
      action: 'reject_project';
      actorCrewId: string;
      rejectionReason: string;
    }
  | {
      action: 'approve_assign';
      actorCrewId: string;
      assigneeId: string;
      assigneeIds?: string[];
      estimatedHours: number;
      difficulty: DifficultyLevel;
      startDate: string;
      dueDate: string;
      dueTime?: string;
    }
  | {
      action: 'submit_to_manager';
      actorCrewId: string;
      handoverNote?: string;
    }
  | {
      action: 'request_crew_revision';
      actorCrewId: string;
      revisionNote: string;
    }
  | {
      action: 'deliver_to_client';
      actorCrewId: string;
      handoverNote?: string;
    };
