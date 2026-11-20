import type { ActiveTimer, CrewMember, ProjectStatus, TimeLogEntry, WorkItem } from '../types';

export const REFERENCE_TODAY = '2026-11-18';

export const PROJECT_STATUS_LIST: ProjectStatus[] = [
  'Waiting List',
  'On Progress',
  'Review',
  'Revision',
  'Completed',
  'On Hold',
  'Rejected',
];

export function getProjectStatusBadgeClass(status?: ProjectStatus): string {
  switch (status) {
    case 'On Progress':
      return 'bg-[#F0EFFC] dark:bg-[#6852EC]/20 text-[#3F3B99] dark:text-[#C4B5FD]';
    case 'Review':
      return 'bg-[#FFF5E6] dark:bg-[#F59E0B]/20 text-[#8C5811] dark:text-[#FCD34D]';
    case 'Revision':
      return 'bg-[#FFF5E6] dark:bg-[#F59E0B]/20 text-[#8C5811] dark:text-[#FCD34D]';
    case 'Rejected':
      return 'bg-[#FFECEB] dark:bg-[#EF4444]/25 text-[#942922] dark:text-[#FCA5A5]';
    case 'Completed':
      return 'bg-[#E6F7F0] dark:bg-[#10B981]/20 text-[#0F6E4B] dark:text-[#6EE7B7]';
    case 'On Hold':
      return 'bg-black/[0.06] dark:bg-white/[0.1] text-[#525660] dark:text-gray-300';
    case 'Waiting List':
    default:
      return 'bg-[#EEF2F6] dark:bg-white/[0.08] text-[#334155] dark:text-gray-200';
  }
}

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  if (!y || !m || !d) return dateStr;
  return `${d} ${months[m - 1] || ''} ${y}`;
}

export function formatShootingSchedule(
  item: Pick<WorkItem, 'discipline' | 'shootingDate' | 'shootingStartTime' | 'shootingEndTime'>
): string | null {
  if (item.discipline !== 'Shooting' || !item.shootingDate) return null;
  const datePart = formatShortDateId(item.shootingDate);
  if (item.shootingStartTime && item.shootingEndTime) {
    return `${datePart} · ${item.shootingStartTime}–${item.shootingEndTime}`;
  }
  if (item.shootingStartTime) {
    return `${datePart} · ${item.shootingStartTime}`;
  }
  return datePart;
}

export function getWorkItemAssigneeIds(
  item: Pick<WorkItem, 'assigneeId' | 'assigneeIds'>
): string[] {
  const raw = Array.isArray(item.assigneeIds) && item.assigneeIds.length > 0
    ? item.assigneeIds
    : item.assigneeId
      ? [item.assigneeId]
      : [];
  const unique: string[] = [];
  for (const id of raw) {
    if (id && !unique.includes(id)) unique.push(id);
  }
  if (unique.length === 0 && item.assigneeId) {
    unique.push(item.assigneeId);
  }
  return unique;
}

export function isCrewAssignedToItem(
  item: Pick<WorkItem, 'assigneeId' | 'assigneeIds'>,
  crewId: string
): boolean {
  return getWorkItemAssigneeIds(item).includes(crewId);
}

export function getPerCrewEstimatedHours(
  item: Pick<WorkItem, 'estimatedHours' | 'assigneeId' | 'assigneeIds'>
): number {
  const count = Math.max(1, getWorkItemAssigneeIds(item).length);
  return Number((item.estimatedHours / count).toFixed(1));
}

export function getWorkItemAssignees(
  item: Pick<WorkItem, 'assigneeId' | 'assigneeIds'>,
  crew: CrewMember[]
): CrewMember[] {
  const ids = getWorkItemAssigneeIds(item);
  const result: CrewMember[] = [];
  for (const id of ids) {
    const member = crew.find((c) => c.id === id);
    if (member) result.push(member);
  }
  return result;
}

export function formatAssigneeSummary(
  item: Pick<WorkItem, 'assigneeId' | 'assigneeIds'>,
  crew: CrewMember[],
  options?: { short?: boolean }
): string {
  const assignees = getWorkItemAssignees(item, crew);
  if (assignees.length === 0) return 'Belum ditugaskan';
  if (assignees.length === 1) {
    return options?.short ? assignees[0].name.split(' ')[0] : assignees[0].name;
  }
  if (options?.short) {
    const first = assignees[0].name.split(' ')[0];
    return `${first} +${assignees.length - 1}`;
  }
  if (assignees.length === 2) {
    return `${assignees[0].name} & ${assignees[1].name}`;
  }
  return `${assignees[0].name} +${assignees.length - 1} kru`;
}

export function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatHoursCompact(seconds: number): string {
  const hrs = seconds / 3600;
  if (hrs < 0.1 && seconds > 0) return `${Math.max(1, Math.round(seconds / 60))} mnt`;
  return `${hrs.toFixed(1)} jam`;
}

export const EDITING_AUTO_STOP_HOUR = 16;
export const EDITING_AUTO_STOP_MINUTE = 30;
export const EDITING_AUTO_STOP_LABEL = '16:30';

export function computeEditingAutoStopIso(startedAtDate: Date = new Date()): string {
  const cutoff = new Date(startedAtDate.getTime());
  cutoff.setHours(EDITING_AUTO_STOP_HOUR, EDITING_AUTO_STOP_MINUTE, 0, 0);
  if (cutoff.getTime() <= startedAtDate.getTime()) {
    cutoff.setDate(cutoff.getDate() + 1);
  }
  return cutoff.toISOString();
}

export function getTimerElapsedSeconds(timer: ActiveTimer, nowMs: number): number {
  const startMs = new Date(timer.startedAt).getTime();
  const cutoffMs = timer.autoStopAt ? new Date(timer.autoStopAt).getTime() : Infinity;
  const effectiveNow = Math.min(nowMs, cutoffMs);
  return Math.max(0, Math.floor((effectiveNow - startMs) / 1000));
}

export function computeManualTimeRange(
  startTime: string,
  endTime: string
): {
  valid: boolean;
  minutes: number;
  durationSeconds: number;
  hours: number;
  hoursLabel: string;
} {
  const parseHm = (val: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec((val || '').trim());
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  };
  const s = parseHm(startTime);
  const e = parseHm(endTime);
  if (s === null || e === null || e <= s) {
    return { valid: false, minutes: 0, durationSeconds: 0, hours: 0, hoursLabel: '0 jam' };
  }
  const minutes = e - s;
  const hours = Number((minutes / 60).toFixed(2));
  const hoursLabel = `${hours} jam`;
  return {
    valid: true,
    minutes,
    durationSeconds: minutes * 60,
    hours,
    hoursLabel,
  };
}

export function getLiveLoggedSeconds(
  item: WorkItem,
  activeTimers: ActiveTimer[],
  nowMs: number
): number {
  let total = item.loggedSeconds;
  for (const timer of activeTimers) {
    if (timer.workItemId === item.id) {
      total += getTimerElapsedSeconds(timer, nowMs);
    }
  }
  return total;
}

export function formatShortDateId(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  if (!y || !m || !d) return dateStr;
  return `${d} ${months[m - 1] || ''}`;
}

export function formatFullDateId(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  if (!y || !m || !d) return dateStr;
  return `${d} ${months[m - 1] || ''} ${y}`;
}

export function formatRelativeTimeId(isoString: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} hari lalu`;
}

export function daysBetween(startDateStr: string, endDateStr: string): number {
  const s = new Date(`${startDateStr}T00:00:00Z`).getTime();
  const e = new Date(`${endDateStr}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86400000);
}

export function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function getDeadlineStatus(
  dueDate: string,
  status: string,
  todayStr: string = REFERENCE_TODAY
): {
  label: string;
  severity: 'done' | 'overdue' | 'soon' | 'normal';
  daysLeft: number;
} {
  if (status === 'Selesai') {
    return { label: 'Selesai', severity: 'done', daysLeft: 999 };
  }
  const diff = daysBetween(todayStr, dueDate);
  if (diff < 0) {
    return { label: `Terlambat ${Math.abs(diff)} hari`, severity: 'overdue', daysLeft: diff };
  }
  if (diff === 0) {
    return { label: 'Jatuh tempo hari ini', severity: 'overdue', daysLeft: 0 };
  }
  if (diff <= 2) {
    return { label: diff === 1 ? 'Besok (H-1)' : `H-${diff} (Segera)`, severity: 'soon', daysLeft: diff };
  }
  return { label: `${formatShortDateId(dueDate)}`, severity: 'normal', daysLeft: diff };
}

export interface CrewWorkloadSummary {
  crew: CrewMember;
  projectHours: number;
  routineHours: number;
  flexibleHours: number;
  totalActiveHours: number;
  trackedHours: number;
  utilizationPct: number;
  isOverloaded: boolean;
  isNearLimit: boolean;
  activeCount: number;
  completedCount: number;
}

export function computeCrewWorkload(
  crew: CrewMember[],
  workItems: WorkItem[],
  activeTimers: ActiveTimer[],
  nowMs: number,
  timeLogs?: TimeLogEntry[]
): CrewWorkloadSummary[] {
  return crew.map((member) => {
    const assigned = workItems.filter((item) => isCrewAssignedToItem(item, member.id));
    const active = assigned.filter((item) => {
      if (item.status === 'Selesai' || item.kanbanStage === 'done') return false;
      if (
        item.category === 'project' &&
        (item.workflowStage === 'pending_review' ||
          item.workflowStage === 'revision_admin' ||
          item.workflowStage === 'rejected_manager')
      ) {
        return false;
      }
      return true;
    });
    const completed = assigned.filter((item) => item.status === 'Selesai' || item.kanbanStage === 'done');

    const projectHours = Number(
      active
        .filter((i) => i.category === 'project')
        .reduce((sum, i) => sum + getPerCrewEstimatedHours(i), 0)
        .toFixed(1)
    );
    const routineHours = Number(
      active
        .filter((i) => i.category === 'routine')
        .reduce((sum, i) => sum + getPerCrewEstimatedHours(i), 0)
        .toFixed(1)
    );
    const flexibleHours = Number(
      active
        .filter((i) => i.category === 'flexible')
        .reduce((sum, i) => sum + getPerCrewEstimatedHours(i), 0)
        .toFixed(1)
    );
    const totalActiveHours = Number((projectHours + routineHours + flexibleHours).toFixed(1));
    // Sum ALL time logs attributed to this crew member (including reassigned/previous projects)
    const loggedFromTimeLogs = (timeLogs || [])
      .filter((l) => l.crewId === member.id)
      .reduce((acc, l) => acc + l.durationSeconds, 0);
    // Sum ALL active timers running for this crew member
    const activeTimerSeconds = activeTimers
      .filter((t) => t.crewId === member.id)
      .reduce((acc, t) => acc + getTimerElapsedSeconds(t, nowMs), 0);
    // Plus any legacy seeded loggedSeconds on currently assigned items that aren't backed by timeLogs
    const unattributedAssignedSeconds = assigned.reduce((sum, item) => {
      const ids = getWorkItemAssigneeIds(item);
      const itemLogSum = (timeLogs || [])
        .filter((l) => l.workItemId === item.id)
        .reduce((acc, l) => acc + l.durationSeconds, 0);
      const unattributed = Math.max(0, item.loggedSeconds - itemLogSum);
      return sum + Math.round(unattributed / Math.max(1, ids.length));
    }, 0);
    const trackedSeconds = loggedFromTimeLogs + activeTimerSeconds + unattributedAssignedSeconds;
    const trackedHours = Number((trackedSeconds / 3600).toFixed(1));
    const utilizationPct = Math.round((totalActiveHours / Math.max(1, member.maxWeeklyHours)) * 100);

    return {
      crew: member,
      projectHours,
      routineHours,
      flexibleHours,
      totalActiveHours,
      trackedHours,
      utilizationPct,
      isOverloaded: totalActiveHours > member.maxWeeklyHours,
      isNearLimit: utilizationPct >= 85 && totalActiveHours <= member.maxWeeklyHours,
      activeCount: active.length,
      completedCount: completed.length,
    };
  });
}

export interface ProjectCrewContribution {
  crew: CrewMember;
  status: 'active' | 'previous';
  loggedSeconds: number;
  sessionsCount: number;
  activeTimer?: ActiveTimer;
  sharePct: number;
}

export function computeProjectCrewContributions(
  item: WorkItem,
  crewList: CrewMember[],
  timeLogs: TimeLogEntry[],
  activeTimers: ActiveTimer[],
  nowMs: number
): ProjectCrewContribution[] {
  const activeIds = getWorkItemAssigneeIds(item);
  const itemLogs = timeLogs.filter((l) => l.workItemId === item.id);
  const itemTimers = activeTimers.filter((t) => t.workItemId === item.id);

  // Collect all crew IDs who are currently assigned, previously logged time, or appeared in assignment history
  const involvedIds: string[] = [...activeIds];
  const pushUnique = (cid: string) => {
    if (cid && !involvedIds.includes(cid)) involvedIds.push(cid);
  };
  for (const log of itemLogs) pushUnique(log.crewId);
  for (const tmr of itemTimers) pushUnique(tmr.crewId);
  for (const hist of item.assignmentHistory || []) {
    for (const cid of hist.fromCrewIds) pushUnique(cid);
    for (const cid of hist.toCrewIds) pushUnique(cid);
  }

  const rows = involvedIds
    .map((cid) => {
      const member = crewList.find((c) => c.id === cid);
      if (!member) return null;
      const isActive = activeIds.includes(cid);
      const memberLogs = itemLogs.filter((l) => l.crewId === cid);
      const logSec = memberLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
      const running = itemTimers.find((t) => t.crewId === cid);
      const liveSec = running ? getTimerElapsedSeconds(running, nowMs) : 0;
      return {
        crew: member,
        status: (isActive ? 'active' : 'previous') as 'active' | 'previous',
        loggedSeconds: logSec + liveSec,
        sessionsCount: memberLogs.length + (running ? 1 : 0),
        activeTimer: running,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const totalSec = rows.reduce((acc, r) => acc + r.loggedSeconds, 0);
  return rows
    .map((r) => ({
      ...r,
      sharePct: totalSec > 0 ? Math.round((r.loggedSeconds / totalSec) * 100) : 0,
    }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.loggedSeconds - a.loggedSeconds;
    });
}
