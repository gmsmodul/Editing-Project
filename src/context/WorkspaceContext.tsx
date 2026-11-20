import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import {
  EDITING_AUTO_STOP_LABEL,
  computeEditingAutoStopIso,
  computeCrewWorkload,
  type CrewWorkloadSummary,
} from '../utils/formatters';
import type {
  AppNotification,
  AutoReportSettings,
  CrewMember,
  ManagerDivision,
  PageId,
  ProjectWorkflowActionPayload,
  ToastMessage,
  UserDashboardConfig,
  WorkCategory,
  WorkItem,
  WorkspaceState,
} from '../types';

interface WorkspaceContextValue {
  workspace: WorkspaceState | null;
  loading: boolean;
  wsConnected: boolean;
  nowMs: number;
  activePage: PageId;
  prevPage: PageId;
  setActivePage: (page: PageId) => void;
  kanbanDivisionFilter: 'all' | ManagerDivision;
  setKanbanDivisionFilter: (filter: 'all' | ManagerDivision) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentCrewId: string;
  setCurrentCrewId: (crewId: string) => void;
  currentCrew: CrewMember | null;
  isAdminProject: boolean;
  isVideoManager: boolean;
  isTechManager: boolean;
  isManager: boolean;
  isProjectLead: boolean;
  crewWorkloads: CrewWorkloadSummary[];
  unreadNotifCount: number;
  browserPushEnabled: boolean;
  toggleBrowserPush: () => Promise<void>;
  toasts: ToastMessage[];
  triggerToast: (title: string, message: string, type?: ToastMessage['type']) => void;
  // Modal / Drawer controls
  selectedWorkItemId: string | null;
  setSelectedWorkItemId: (id: string | null) => void;
  createModalOpen: boolean;
  createDefaultCategory: WorkCategory;
  createDefaultDate: string | null;
  openCreateModal: (category?: WorkCategory, defaultDate?: string) => void;
  closeCreateModal: () => void;
  // Server mutations
  refreshWorkspace: () => Promise<void>;
  createWorkItem: (
    payload: Omit<WorkItem, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'loggedSeconds'>
  ) => Promise<void>;
  updateWorkItem: (id: string, patch: Partial<WorkItem>) => Promise<void>;
  deleteWorkItem: (id: string) => Promise<void>;
  transitionProjectWorkflow: (id: string, payload: ProjectWorkflowActionPayload) => Promise<void>;
  startTimer: (workItemId: string, crewId?: string, note?: string) => Promise<void>;
  stopTimer: (timerId: string) => Promise<void>;
  addManualTimeLog: (payload: {
    workItemId: string;
    crewId?: string;
    hours: number;
    startTime?: string;
    endTime?: string;
    note?: string;
    date?: string;
  }) => Promise<void>;
  updateCrewCapacity: (crewId: string, maxWeeklyHours: number) => Promise<void>;
  updateDashboardConfig: (patch: Partial<UserDashboardConfig>) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  sendUrgentBroadcast: (workItem: WorkItem, customNote?: string) => Promise<void>;
  updateAutoReportSettings: (patch: Partial<AutoReportSettings>) => Promise<void>;
  generateMonthlyReportNow: (monthKey?: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [activePage, setActivePageState] = useState<PageId>('overview');
  const [prevPage, setPrevPage] = useState<PageId>('overview');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('servomedia-theme') === 'dark' ? 'dark' : 'light';
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [currentCrewId, setCurrentCrewIdState] = useState<string>('crew-laras');
  const [kanbanDivisionFilter, setKanbanDivisionFilter] = useState<'all' | ManagerDivision>('all');

  const setActivePage = useCallback((next: PageId) => {
    // Normalize any legacy unified PageIds safely
    const raw = next as string;
    if (raw === 'kanban_tech') {
      setKanbanDivisionFilter('technical_support');
    }
    const normalized: PageId =
      raw === 'intake'
        ? 'overview'
        : raw === 'approval' ||
            raw === 'approval_video' ||
            raw === 'approval_tech' ||
            raw === 'handover' ||
            raw === 'handover_video' ||
            raw === 'handover_tech'
          ? 'project_manager'
          : raw === 'kanban' || raw === 'kanban_tech'
            ? 'kanban_video'
            : next;
    setActivePageState((curr) => {
      if (curr !== normalized) setPrevPage(curr);
      return normalized;
    });
  }, []);

  const setCurrentCrewId = useCallback(
    (crewId: string) => {
      setCurrentCrewIdState(crewId);
      const nextMember = workspace?.crew.find((c) => c.id === crewId);
      if (!nextMember) return;
      if (nextMember.accessRole === 'tech_manager') {
        setKanbanDivisionFilter('technical_support');
      } else if (nextMember.accessRole === 'video_manager') {
        setKanbanDivisionFilter('video_production');
      }
    },
    [workspace]
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('servomedia-theme', theme);
  }, [theme]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDefaultCategory, setCreateDefaultCategory] = useState<WorkCategory>('project');
  const [createDefaultDate, setCreateDefaultDate] = useState<string | null>(null);
  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    return Notification.permission === 'granted';
  });

  const browserPushRef = useRef(browserPushEnabled);
  browserPushRef.current = browserPushEnabled;

  const triggerToast = useCallback(
    (title: string, message: string, type: ToastMessage['type'] = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, message, type }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const fireBrowserPush = useCallback((notification: AppNotification) => {
    if (
      browserPushRef.current &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(notification.title, {
          body: notification.message,
          tag: notification.id,
        });
      } catch {
        // Ignore if blocked in sandboxed iframe
      }
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    try {
      const data = await api.getWorkspace();
      setWorkspace(data);
    } catch {
      triggerToast('Gagal Sinkronisasi', 'Tidak dapat mengambil data terbaru dari server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  // Initial fetch + WebSocket real-time connection with auto-reconnect
  useEffect(() => {
    void refreshWorkspace();

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          if (!disposed) {
            reconnectTimer = window.setTimeout(connect, 3000);
          }
        };
        ws.onerror = () => {
          setWsConnected(false);
        };
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as {
              type: string;
              data?: WorkspaceState;
              notification?: AppNotification;
            };
            if (payload.type === 'workspace:sync' && payload.data) {
              setWorkspace(payload.data);
              setLoading(false);
            } else if (payload.type === 'notification:push' && payload.notification) {
              const n = payload.notification;
              fireBrowserPush(n);
              const toastType =
                n.type === 'overload' || n.type === 'urgent'
                  ? 'warning'
                  : n.type === 'deadline'
                    ? 'info'
                    : 'success';
              triggerToast(n.title, n.message, toastType);
            }
          } catch {
            // Ignore malformed socket frames
          }
        };
      } catch {
        setWsConnected(false);
      }
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [refreshWorkspace, fireBrowserPush, triggerToast]);

  // Real-time 1-second clock tick for active timers
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Client-side exact-second 16:30 auto-stop enforcement for Editing project timers
  const autoStoppingIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!workspace) return;
    for (const timer of workspace.activeTimers) {
      if (autoStoppingIdsRef.current.has(timer.id)) continue;
      const item = workspace.workItems.find((w) => w.id === timer.workItemId);
      if (!item || item.category !== 'project' || item.discipline !== 'Editing') continue;
      const cutoffIso =
        timer.autoStopAt || computeEditingAutoStopIso(new Date(timer.startedAt));
      const cutoffMs = new Date(cutoffIso).getTime();
      if (Number.isFinite(cutoffMs) && nowMs >= cutoffMs) {
        autoStoppingIdsRef.current.add(timer.id);
        void api
          .stopTimer(timer.id, { autoStopped: true, endedAt: cutoffIso })
          .then((res) => {
            setWorkspace(res.state);
            const mins = Math.max(1, Math.round(res.durationSeconds / 60));
            triggerToast(
              `Auto-Stop ${EDITING_AUTO_STOP_LABEL}`,
              `Timer Editing ${item.requestNo || item.code} otomatis berhenti pukul ${EDITING_AUTO_STOP_LABEL} (${mins} menit tersimpan).`,
              'info'
            );
          })
          .catch(() => {
            // Will be retried or finalized by server sweep
          })
          .finally(() => {
            autoStoppingIdsRef.current.delete(timer.id);
          });
      }
    }
  }, [nowMs, workspace, triggerToast]);

  const toggleBrowserPush = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      triggerToast('Push Tidak Didukung', 'Browser ini tidak mendukung Web Push Notification.', 'warning');
      return;
    }
    if (browserPushEnabled) {
      setBrowserPushEnabled(false);
      triggerToast('Push Dimatikan', 'Notifikasi push desktop dinonaktifkan; notifikasi in-app tetap aktif.', 'info');
      return;
    }
    if (Notification.permission === 'granted') {
      setBrowserPushEnabled(true);
      triggerToast('Push Aktif', 'Pembaruan mendesak, tenggat, dan peringatan overload akan dikirim ke browser.', 'success');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setBrowserPushEnabled(true);
        triggerToast('Push Diaktifkan', 'Notifikasi push browser aktif untuk seluruh pembaruan mendesak.', 'success');
      } else {
        setBrowserPushEnabled(false);
        triggerToast('Izin Ditolak', 'Notifikasi tetap tampil secara real-time di pusat notifikasi aplikasi.', 'warning');
      }
    } catch {
      setBrowserPushEnabled(true);
      triggerToast('Push In-App Aktif', 'Notifikasi real-time aktif melalui jalur WebSocket aplikasi.', 'info');
    }
  }, [browserPushEnabled, triggerToast]);

  const currentCrew = useMemo(() => {
    if (!workspace) return null;
    return workspace.crew.find((c) => c.id === currentCrewId) || workspace.crew[0] || null;
  }, [workspace, currentCrewId]);

  const isAdminProject = currentCrew?.accessRole === 'admin_project';
  const isVideoManager = currentCrew?.accessRole === 'video_manager';
  const isTechManager = currentCrew?.accessRole === 'tech_manager';
  const isManager = isVideoManager || isTechManager;
  const isProjectLead = isAdminProject || isManager;

  const openCreateModal = useCallback(
    (category?: WorkCategory, defaultDate?: string) => {
      const requested = category || (isAdminProject || isManager ? 'project' : 'routine');
      // Crew members create & fill Routine/Flexible tasks themselves; Admin Project / Managers create Projects
      const resolvedCategory: WorkCategory =
        requested === 'project' && !(isAdminProject || isManager) ? 'routine' : requested;
      setCreateDefaultCategory(resolvedCategory);
      setCreateDefaultDate(defaultDate || null);
      setCreateModalOpen(true);
    },
    [isAdminProject, isManager]
  );

  const closeCreateModal = useCallback(() => {
    setCreateModalOpen(false);
    setCreateDefaultDate(null);
  }, []);

  const createWorkItem = useCallback(
    async (payload: Omit<WorkItem, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'loggedSeconds'>) => {
      const res = await api.createWorkItem({ ...payload, actorCrewId: currentCrewId });
      setWorkspace(res.state);
      triggerToast('Berhasil Ditambahkan', `${res.item.code} · ${res.item.title}`, 'success');
    },
    [currentCrewId, triggerToast]
  );

  const updateWorkItem = useCallback(
    async (id: string, patch: Partial<WorkItem>) => {
      const res = await api.updateWorkItem(id, patch);
      setWorkspace(res.state);
    },
    []
  );

  const deleteWorkItem = useCallback(
    async (id: string) => {
      const res = await api.deleteWorkItem(id);
      setWorkspace(res.state);
      if (selectedWorkItemId === id) setSelectedWorkItemId(null);
      triggerToast('Item Dihapus', 'Pekerjaan telah dihapus dari papan & jadwal tim.', 'info');
    },
    [selectedWorkItemId, triggerToast]
  );

  const transitionProjectWorkflow = useCallback(
    async (id: string, payload: ProjectWorkflowActionPayload) => {
      const res = await api.transitionProjectWorkflow(id, payload);
      setWorkspace(res.state);
      const toastMap: Record<ProjectWorkflowActionPayload['action'], { title: string; msg: string; type: ToastMessage['type'] }> = {
        resubmit_to_manager: {
          title: 'Project Dikirim Ulang',
          msg: `${res.item.code} dikembalikan ke antrean review Manager.`,
          type: 'success',
        },
        return_to_admin: {
          title: 'Dikembalikan ke Admin Project',
          msg: `${res.item.code} meminta kelengkapan form dari Admin Project.`,
          type: 'warning',
        },
        reject_project: {
          title: 'Project Ditolak Manager',
          msg: `${res.item.requestNo || res.item.code} ditolak dan dinotifikasikan ke Admin Project.`,
          type: 'error',
        },
        approve_assign: {
          title: 'Project Disetujui & Ditugaskan',
          msg: `${res.item.code} resmi masuk ke papan eksekusi Crew.`,
          type: 'success',
        },
        submit_to_manager: {
          title: 'Diserahkan ke Manager',
          msg: `${res.item.code} selesai dikerjakan Crew dan menunggu QC Manager.`,
          type: 'info',
        },
        request_crew_revision: {
          title: 'Revisi Dikembalikan ke Crew',
          msg: `${res.item.code} dikembalikan ke Crew untuk perbaikan.`,
          type: 'warning',
        },
        deliver_to_client: {
          title: 'Project Diberikan ke Klien',
          msg: `${res.item.code} resmi selesai dan diserahkan ke ${res.item.clientName || 'Klien'}.`,
          type: 'success',
        },
      };
      const t = toastMap[payload.action];
      triggerToast(t.title, t.msg, t.type);
    },
    [triggerToast]
  );

  const startTimer = useCallback(
    async (workItemId: string, crewId?: string, note?: string) => {
      const targetCrew = crewId || currentCrewId;
      const targetItem = workspace?.workItems.find((w) => w.id === workItemId);
      const isEditingProj =
        targetItem?.category === 'project' && targetItem?.discipline === 'Editing';
      const nowDate = new Date();
      const res = await api.startTimer(workItemId, targetCrew, note, {
        autoStopAt: isEditingProj ? computeEditingAutoStopIso(nowDate) : undefined,
        timezoneOffsetMinutes: nowDate.getTimezoneOffset(),
      });
      setWorkspace(res.state);
      const item = res.state.workItems.find((w) => w.id === workItemId);
      const editingNote =
        item?.category === 'project' && item?.discipline === 'Editing'
          ? ` (otomatis stop pukul ${EDITING_AUTO_STOP_LABEL})`
          : '';
      triggerToast(
        'Timer Dimulai',
        `Melacak waktu nyata untuk ${item?.requestNo || item?.code || 'tugas'}${editingNote}.`,
        'info'
      );
    },
    [currentCrewId, workspace, triggerToast]
  );

  const stopTimer = useCallback(
    async (timerId: string) => {
      const res = await api.stopTimer(timerId);
      setWorkspace(res.state);
      const mins = Math.max(1, Math.round(res.durationSeconds / 60));
      triggerToast(
        res.autoStopped ? `Auto-Stop ${EDITING_AUTO_STOP_LABEL}` : 'Timer Disimpan',
        res.autoStopped
          ? `Timer Editing otomatis berhenti pukul ${EDITING_AUTO_STOP_LABEL} (${mins} menit tersimpan).`
          : `Durasi ${mins} menit telah tercatat pada log waktu tim.`,
        'success'
      );
    },
    [triggerToast]
  );

  const addManualTimeLog = useCallback(
    async (payload: {
      workItemId: string;
      crewId?: string;
      hours: number;
      startTime?: string;
      endTime?: string;
      note?: string;
      date?: string;
    }) => {
      const res = await api.addManualTimeLog({
        ...payload,
        workDate: payload.date,
        crewId: payload.crewId || currentCrewId,
      });
      setWorkspace(res.state);
      const rangeText =
        payload.startTime && payload.endTime
          ? ` (${payload.startTime}–${payload.endTime})`
          : '';
      triggerToast(
        'Log Manual Disimpan',
        `Durasi ${payload.hours} jam${rangeText} telah ditambahkan ke log pekerjaan.`,
        'success'
      );
    },
    [currentCrewId, triggerToast]
  );

  const updateCrewCapacity = useCallback(
    async (crewId: string, maxWeeklyHours: number) => {
      const res = await api.updateCrewCapacity(crewId, maxWeeklyHours);
      setWorkspace(res.state);
      triggerToast('Batas Kapasitas Diperbarui', `Batas beban mingguan diatur ke ${maxWeeklyHours} jam.`, 'success');
    },
    [triggerToast]
  );

  const updateDashboardConfig = useCallback(
    async (patch: Partial<UserDashboardConfig>) => {
      const res = await api.updateDashboardConfig(currentCrewId, patch);
      setWorkspace(res.state);
    },
    [currentCrewId]
  );

  const markNotificationRead = useCallback(async (id: string) => {
    const res = await api.markNotificationRead(id);
    setWorkspace(res.state);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const res = await api.markAllNotificationsRead();
    setWorkspace(res.state);
    triggerToast('Notifikasi Dibaca', 'Semua notifikasi telah ditandai sudah dibaca.', 'info');
  }, [triggerToast]);

  const sendUrgentBroadcast = useCallback(
    async (workItem: WorkItem, customNote?: string) => {
      const isTechProject =
        workItem.routedManager === 'technical_support' || workItem.discipline === 'Installasi';
      const res = await api.pushUrgentNotification({
        type: 'urgent',
        title: `Push Mendesak: ${workItem.code} · ${workItem.title}`,
        message:
          customNote ||
          `Pembaruan status mendesak (${workItem.status} · ${workItem.progress}%) oleh kru. Mohon tindak lanjut segera.`,
        workItemId: workItem.id,
        crewId: workItem.assigneeId,
        targetPage:
          workItem.category === 'project'
            ? isTechProject
              ? 'kanban_tech'
              : 'kanban_video'
            : 'tasks',
      });
      setWorkspace(res.state);
    },
    []
  );

  const updateAutoReportSettings = useCallback(
    async (patch: Partial<AutoReportSettings>) => {
      const res = await api.updateAutoReportSettings(patch);
      setWorkspace(res.state);
      triggerToast('Jadwal Laporan Diperbarui', 'Pengaturan laporan otomatis akhir bulan telah disimpan.', 'success');
    },
    [triggerToast]
  );

  const generateMonthlyReportNow = useCallback(
    async (monthKey?: string) => {
      const res = await api.generateMonthlyReport(monthKey || '2026-11', false);
      setWorkspace(res.state);
    },
    []
  );

  const crewWorkloads = useMemo(() => {
    if (!workspace) return [];
    return computeCrewWorkload(
      workspace.crew,
      workspace.workItems,
      workspace.activeTimers,
      nowMs,
      workspace.timeLogs
    );
  }, [workspace, nowMs]);

  const unreadNotifCount = useMemo(() => {
    if (!workspace) return 0;
    return workspace.notifications.filter((n) => !n.read).length;
  }, [workspace]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspace,
      loading,
      wsConnected,
      nowMs,
      activePage,
      prevPage,
      setActivePage,
      kanbanDivisionFilter,
      setKanbanDivisionFilter,
      theme,
      toggleTheme,
      sidebarOpen,
      setSidebarOpen,
      currentCrewId,
      setCurrentCrewId,
      currentCrew,
      isAdminProject,
      isVideoManager,
      isTechManager,
      isManager,
      isProjectLead,
      crewWorkloads,
      unreadNotifCount,
      browserPushEnabled,
      toggleBrowserPush,
      toasts,
      triggerToast,
      selectedWorkItemId,
      setSelectedWorkItemId,
      createModalOpen,
      createDefaultCategory,
      createDefaultDate,
      openCreateModal,
      closeCreateModal,
      refreshWorkspace,
      createWorkItem,
      updateWorkItem,
      deleteWorkItem,
      transitionProjectWorkflow,
      startTimer,
      stopTimer,
      addManualTimeLog,
      updateCrewCapacity,
      updateDashboardConfig,
      markNotificationRead,
      markAllNotificationsRead,
      sendUrgentBroadcast,
      updateAutoReportSettings,
      generateMonthlyReportNow,
    }),
    [
      workspace,
      loading,
      wsConnected,
      nowMs,
      activePage,
      prevPage,
      setActivePage,
      kanbanDivisionFilter,
      theme,
      toggleTheme,
      sidebarOpen,
      currentCrewId,
      currentCrew,
      isAdminProject,
      isVideoManager,
      isTechManager,
      isManager,
      isProjectLead,
      crewWorkloads,
      unreadNotifCount,
      browserPushEnabled,
      toggleBrowserPush,
      toasts,
      triggerToast,
      selectedWorkItemId,
      createModalOpen,
      createDefaultCategory,
      createDefaultDate,
      openCreateModal,
      closeCreateModal,
      refreshWorkspace,
      createWorkItem,
      updateWorkItem,
      deleteWorkItem,
      transitionProjectWorkflow,
      startTimer,
      stopTimer,
      addManualTimeLog,
      updateCrewCapacity,
      updateDashboardConfig,
      markNotificationRead,
      markAllNotificationsRead,
      sendUrgentBroadcast,
      updateAutoReportSettings,
      generateMonthlyReportNow,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
