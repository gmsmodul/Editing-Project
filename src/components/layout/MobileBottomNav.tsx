import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Home,
  Kanban,
  Calendar,
  ChevronsUpDown,
  Search,
  Bell,
  Plus,
  Users,
  ArrowLeft,
  X,
  CheckCheck,
  ChevronRight,
  AlertTriangle,
  Clock,
  FileText,
  Zap,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ACCESS_ROLE_META, getWorkBarColor } from '../../constants/theme';
import {
  formatAssigneeSummary,
  formatRelativeTimeId,
  getWorkItemAssigneeIds,
} from '../../utils/formatters';
import { NAV_ITEMS } from './Sidebar';
import { useBottomSheetMotion } from '../../hooks/useBottomSheetMotion';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { PageId } from '../../types';

export const MobileBottomNav: React.FC = () => {
  const {
    activePage,
    setActivePage,
    workspace,
    currentCrew,
    currentCrewId,
    setCurrentCrewId,
    isAdminProject,
    isProjectLead,
    unreadNotifCount,
    markNotificationRead,
    markAllNotificationsRead,
    openCreateModal,
    setSelectedWorkItemId,
  } = useWorkspace();

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [menuSubview, setMenuSubview] = useState<'nav' | 'notifications' | 'quickCreate' | 'role'>('nav');
  const [mobileNotifFilter, setMobileNotifFilter] = useState<'all' | 'unread' | 'urgent'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const menuCloseTimerRef = useRef<number | null>(null);
  const pillBarRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const openMenuSmoothly = () => {
    if (menuCloseTimerRef.current) {
      window.clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
    playUiMotionSound('pop');
    setMenuClosing(false);
    setMenuOpen(true);
  };

  const closeMenuSmoothly = () => {
    if (!menuOpen || menuClosing) return;
    playUiMotionSound('tick');
    setMenuClosing(true);
    menuCloseTimerRef.current = window.setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
      menuCloseTimerRef.current = null;
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (menuCloseTimerRef.current) window.clearTimeout(menuCloseTimerRef.current);
    };
  }, []);

  const {
    setSheetElement: setSearchSheetEl,
    backdropRef: searchBackdropRef,
    animateClose: animateCloseSearch,
    sheetGestureProps: searchGestureProps,
  } = useBottomSheetMotion({
    alwaysBottomSheet: true,
    onClose: () => {
      setSearchOpen(false);
      setSearchQuery('');
    },
  });

  const isTechUser =
    currentCrew?.accessRole === 'tech_manager' || currentCrew?.division === 'Installasi';

  const stageCounts = useMemo(() => {
    const projects = workspace?.workItems.filter((w) => w.category === 'project') || [];
    const video = projects.filter(
      (p) => (p.routedManager || (p.discipline === 'Installasi' ? 'technical_support' : 'video_production')) === 'video_production'
    );
    const tech = projects.filter(
      (p) => (p.routedManager || (p.discipline === 'Installasi' ? 'technical_support' : 'video_production')) === 'technical_support'
    );
    return {
      intake: projects.filter((p) => p.workflowStage === 'revision_admin').length,
      approval_video: video.filter((p) => p.workflowStage === 'pending_review').length,
      kanban_video: video.filter((p) => (p.workflowStage || 'in_execution') === 'in_execution').length,
      handover_video: video.filter((p) => p.workflowStage === 'pending_handover').length,
      approval_tech: tech.filter((p) => p.workflowStage === 'pending_review').length,
      kanban_tech: tech.filter((p) => (p.workflowStage || 'in_execution') === 'in_execution').length,
      handover_tech: tech.filter((p) => p.workflowStage === 'pending_handover').length,
    };
  }, [workspace]);

  // Exact gmsmodul/ServoLution-app 3 primary icon slots + 4th overflow trigger
  const primarySlots: Array<{
    id: PageId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    dot?: boolean;
  }> = [
    {
      id: 'overview',
      label: 'Dashboard',
      icon: Home,
      dot: stageCounts.intake > 0,
    },
    {
      id: 'kanban_video',
      label: 'Progress',
      icon: Kanban,
      dot: stageCounts.kanban_video + stageCounts.kanban_tech > 0,
    },
    { id: 'calendar', label: 'Calendar', icon: Calendar, dot: unreadNotifCount > 0 },
  ];

  const primaryIds = new Set(primarySlots.map((s) => s.id));
  const popupModules = NAV_ITEMS.filter((m) => !primaryIds.has(m.id));
  const isOverflowActive = !primaryIds.has(activePage);
  const activeOverflowModule = isOverflowActive
    ? NAV_ITEMS.find((m) => m.id === activePage)
    : undefined;

  const activeSlotIndex = isOverflowActive
    ? 3
    : primarySlots.findIndex((s) => s.id === activePage);

  // Gliding brand-primary active pill calculation (exact ServoLution-app pattern)
  useLayoutEffect(() => {
    const updateIndicator = () => {
      const bar = pillBarRef.current;
      const btn = slotRefs.current[activeSlotIndex];
      if (!bar || !btn) return;
      const barRect = bar.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      if (btnRect.width === 0) return;
      setIndicator({
        left: btnRect.left - barRect.left,
        width: btnRect.width,
        ready: true,
      });
    };

    updateIndicator();
    const bar = pillBarRef.current;
    const ro = typeof ResizeObserver !== 'undefined' && bar ? new ResizeObserver(updateIndicator) : null;
    if (ro && bar) ro.observe(bar);
    window.addEventListener('resize', updateIndicator);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeSlotIndex, activePage, menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuSubview('nav');
    }
  }, [menuOpen]);

  useEffect(() => {
    if (searchOpen) {
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 140);
      return () => window.clearTimeout(id);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenuSmoothly();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, menuClosing]);

  const handleSelectPage = (id: PageId) => {
    playUiMotionSound('tick');
    setActivePage(id);
    closeMenuSmoothly();
  };

  const quickCreateActions = useMemo(() => {
    const items: Array<{ label: string; action: () => void }> = [];
    if (isAdminProject || isProjectLead) {
      items.push({
        label: '1. Project Baru (Dashboard)',
        action: () => {
          setActivePage('overview');
        },
      });
    }
    items.push({
      label: 'Task Baru (Rutin / Fleksibel)',
      action: () => {
        setActivePage('tasks');
      },
    });
    return items;
  }, [isAdminProject, isProjectLead, setActivePage]);

  const filteredNotifications = useMemo(() => {
    const list = workspace?.notifications || [];
    if (mobileNotifFilter === 'unread') return list.filter((n) => !n.read);
    if (mobileNotifFilter === 'urgent') {
      return list.filter((n) => n.type === 'urgent' || n.type === 'overload' || n.type === 'deadline');
    }
    return list;
  }, [workspace, mobileNotifFilter]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchedModules = NAV_ITEMS.filter(
      (m) => !q || m.label.toLowerCase().includes(q) || m.shortLabel.toLowerCase().includes(q)
    ).slice(0, q ? 5 : 4);

    const crewMap = new Map((workspace?.crew || []).map((c) => [c.id, c.name]));
    const matchedItems = (workspace?.workItems || [])
      .filter((item) => {
        if (!q) return true;
        const assigneesText = getWorkItemAssigneeIds(item)
          .map((cid) => crewMap.get(cid) || '')
          .join(' ')
          .toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          (item.requestNo || '').toLowerCase().includes(q) ||
          (item.coordinatorDepartment || '').toLowerCase().includes(q) ||
          assigneesText.includes(q) ||
          (item.clientName || '').toLowerCase().includes(q) ||
          (item.clientPhone || '').toLowerCase().includes(q) ||
          (item.discipline || '').toLowerCase().includes(q)
        );
      })
      .slice(0, q ? 8 : 5);

    return { matchedModules, matchedItems };
  }, [workspace, searchQuery]);

  const getModuleBadge = (id: PageId): number | null => {
    const managerQueue =
      stageCounts.approval_video +
      stageCounts.approval_tech +
      stageCounts.handover_video +
      stageCounts.handover_tech;
    if (id === 'project_manager' && managerQueue > 0) return managerQueue;
    if (id === 'intake' && stageCounts.intake > 0) return stageCounts.intake;
    if (id === 'kanban_video' && stageCounts.kanban_video > 0) return stageCounts.kanban_video;
    if (id === 'kanban_tech' && stageCounts.kanban_tech > 0) return stageCounts.kanban_tech;
    return null;
  };

  const ActiveOverflowIcon = activeOverflowModule?.icon;

  return (
    <>
      {/* Backdrop + Anchored Floating Vertical Popup Menu (Exact ServoLution-app fold-up/fold-down motion) */}
      {menuOpen && (
        <div
          onClick={closeMenuSmoothly}
          className={`${
            menuClosing ? 'animate-ui-fade-out' : 'animate-ui-fade'
          } fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] md:hidden no-print`}
        >
          <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] inset-x-4 max-w-[352px] mx-auto pointer-events-none">
            <div
              onClick={(e) => e.stopPropagation()}
              data-ui-portal="true"
              className={`${
                menuClosing ? 'animate-menu-fold-down' : 'animate-menu-fold-up'
              } pointer-events-auto w-[min(280px,100%)] max-h-[calc(100vh-92px)] bg-white dark:bg-[#15181E] rounded-[24px] shadow-[0_20px_48px_-12px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.85)] border border-black/[0.14] dark:border-white/[0.14] flex flex-col overflow-hidden`}
            >
              {/* Top Profile & Quick Utility Header */}
              <div className="px-3.5 pt-3 pb-2.5 border-b border-black/[0.12] dark:border-white/[0.10] flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuSubview((prev) => (prev === 'role' ? 'nav' : 'role'))}
                  className="flex items-center gap-2 min-w-0 text-left cursor-pointer group"
                >
                  <div
                    data-dark-preserve="true"
                    className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs ${
                      currentCrew?.avatarBg || 'bg-[#ee2e65]'
                    } ${currentCrew?.avatarText || 'text-white'}`}
                  >
                    {currentCrew?.initials || 'SM'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#1C1D21] dark:text-gray-100 truncate group-hover:text-[#ee2e65] transition-colors">
                      {currentCrew?.name || 'ServoMedia'}
                    </div>
                    <div className="text-[10px] text-[#8A8D98] dark:text-gray-400 leading-tight truncate">
                      {currentCrew
                        ? ACCESS_ROLE_META[currentCrew.accessRole]?.shortLabel || currentCrew.role
                        : 'Multimedia OS'}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Ganti Peran / Kru"
                    onClick={() => setMenuSubview((prev) => (prev === 'role' ? 'nav' : 'role'))}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      menuSubview === 'role'
                        ? 'bg-[#F0EFFC] text-[#3F3B99]'
                        : 'hover:bg-[#F4F5F8] dark:hover:bg-white/[0.08] text-[#4B4E57] dark:text-gray-300'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Buat Cepat"
                    onClick={() =>
                      setMenuSubview((prev) => (prev === 'quickCreate' ? 'nav' : 'quickCreate'))
                    }
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      menuSubview === 'quickCreate'
                        ? 'bg-[#FDE0E9] text-[#9D113C] rotate-45'
                        : 'bg-[#ee2e65] text-white hover:brightness-105 shadow-xs'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Subview: Main Navigation List */}
              {menuSubview === 'nav' && (
                <div className="overflow-y-auto p-2 space-y-0.5 overscroll-contain">
                  {popupModules.map((item) => {
                    const Icon = item.icon;
                    const isCurrent = activePage === item.id;
                    const badge = getModuleBadge(item.id);
                    const isTechItem = false;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPage(item.id)}
                        className={`touch-target-44 w-full flex items-center justify-between px-3 py-2 rounded-full text-left transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer ${
                          isCurrent
                            ? isTechItem
                              ? 'bg-[#0284C7] text-white font-semibold shadow-[0_6px_16px_-6px_rgba(2,132,199,0.55)]'
                              : 'bg-[#ee2e65] text-white font-semibold shadow-[0_6px_16px_-6px_rgba(238,46,101,0.55)]'
                            : 'text-[#1C1D21] dark:text-gray-200 hover:bg-[#F4F5F8] dark:hover:bg-white/[0.06] font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isCurrent
                                ? 'text-white stroke-[2.2px]'
                                : isTechItem
                                  ? 'text-[#0369A1] dark:text-sky-300 stroke-[1.8px]'
                                  : 'text-[#1C1D21] dark:text-gray-300 stroke-[1.8px]'
                            }`}
                          />
                          <span className="text-[13px] truncate">{item.label}</span>
                        </div>

                        {badge !== null && (
                          <span
                            className={`min-w-[22px] h-[20px] px-1.5 rounded-full text-[10.5px] font-bold flex items-center justify-center shrink-0 tabular-nums ${
                              isCurrent
                                ? isTechItem
                                  ? 'bg-white text-[#0284C7]'
                                  : 'bg-white text-[#ee2e65]'
                                : isTechItem
                                  ? 'bg-[#0284C7] text-white'
                                  : 'bg-[#EF4444] text-white'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  <div className="my-1 border-t border-black/[0.12] dark:border-white/[0.10] mx-2" />

                  <button
                    type="button"
                    onClick={() => setMenuSubview('notifications')}
                    className="touch-target-44 w-full flex items-center justify-between px-3 py-2 rounded-full text-left text-[#1C1D21] dark:text-gray-200 hover:bg-[#F4F5F8] dark:hover:bg-white/[0.06] font-medium transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Bell className="w-4 h-4 shrink-0 text-[#1C1D21] dark:text-gray-300 stroke-[1.8px]" />
                      <span className="text-[13px] truncate">Notifikasi</span>
                    </div>
                    {unreadNotifCount > 0 && (
                      <span className="min-w-[22px] h-[20px] px-1.5 rounded-full bg-[#EF4444] text-white text-[10.5px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                        {unreadNotifCount}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Subview: Quick Create */}
              {menuSubview === 'quickCreate' && (
                <div className="p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 px-1 pb-1">
                    <button
                      type="button"
                      onClick={() => setMenuSubview('nav')}
                      className="w-6 h-6 rounded-full hover:bg-[#F4F5F8] flex items-center justify-center text-[#525660] cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8D98]">
                      Buat Cepat
                    </span>
                  </div>

                  {quickCreateActions.map((act) => (
                    <button
                      key={act.label}
                      type="button"
                      onClick={() => {
                        closeMenuSmoothly();
                        act.action();
                      }}
                      className="touch-target-44 w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#FAFBFD] dark:bg-[#181B21] hover:bg-[#FEF1F5] text-[#1C1D21] dark:text-gray-100 hover:text-[#ee2e65] text-[12.5px] font-semibold border border-black/[0.06] dark:border-white/[0.08] transition-colors cursor-pointer"
                    >
                      <span>{act.label}</span>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              )}

              {/* Subview: Switch Active Role / Crew */}
              {menuSubview === 'role' && workspace && (
                <div className="p-2.5 space-y-1.5 overflow-y-auto overscroll-contain">
                  <div className="flex items-center gap-1.5 px-1 pb-1">
                    <button
                      type="button"
                      onClick={() => setMenuSubview('nav')}
                      className="w-6 h-6 rounded-full hover:bg-[#F4F5F8] flex items-center justify-center text-[#525660] cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8D98]">
                      Ganti Peran Aktif
                    </span>
                  </div>
                  {workspace.crew.map((member) => {
                    const roleMeta = ACCESS_ROLE_META[member.accessRole];
                    const selected = member.id === currentCrewId;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          playUiMotionSound('tick');
                          setCurrentCrewId(member.id);
                          setMenuSubview('nav');
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-left transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#ee2e65] text-white font-semibold'
                            : 'bg-[#FAFBFD] dark:bg-[#181B21] text-[#1C1D21] dark:text-gray-200 hover:bg-[#F4F5F8]'
                        }`}
                      >
                        <span
                          data-dark-preserve="true"
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            selected ? 'bg-white/20 text-white' : `${member.avatarBg} ${member.avatarText}`
                          }`}
                        >
                          {member.initials}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-semibold truncate">{member.name}</div>
                          <div
                            className={`text-[10px] truncate ${
                              selected ? 'text-white/80' : 'text-[#646772] dark:text-gray-400'
                            }`}
                          >
                            {roleMeta?.shortLabel || member.role}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Subview: Notifications */}
              {menuSubview === 'notifications' && (
                <div className="p-2.5 flex flex-col max-h-[360px]">
                  <div className="flex items-center justify-between gap-2 px-1 pb-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMenuSubview('nav')}
                        className="w-6 h-6 rounded-full hover:bg-[#F4F5F8] flex items-center justify-center text-[#525660] cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[12px] font-semibold text-[#1C1D21] dark:text-gray-100">
                        Notifikasi
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead()}
                      className="text-[11px] font-semibold text-[#ee2e65] flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Dibaca
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1B1E24] p-0.5 rounded-lg mb-2">
                    {(
                      [
                        { id: 'all', label: 'Semua' },
                        { id: 'unread', label: 'Baru' },
                        { id: 'urgent', label: 'Penting' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMobileNotifFilter(tab.id)}
                        className={`flex-1 py-1 rounded-md text-[11px] font-medium cursor-pointer ${
                          mobileNotifFilter === tab.id
                            ? 'bg-white dark:bg-[#121418] text-gray-900 dark:text-white font-semibold shadow-2xs'
                            : 'text-gray-500'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 overscroll-contain">
                    {filteredNotifications.slice(0, 8).map((n) => {
                      const Icon =
                        n.type === 'overload'
                          ? AlertTriangle
                          : n.type === 'urgent'
                            ? Zap
                            : n.type === 'deadline'
                              ? Clock
                              : FileText;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            void markNotificationRead(n.id);
                            if (n.workItemId) setSelectedWorkItemId(n.workItemId);
                            else if (n.targetPage) setActivePage(n.targetPage);
                            closeMenuSmoothly();
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border text-[11.5px] flex items-start gap-2 cursor-pointer ${
                            n.read
                              ? 'bg-gray-50 dark:bg-[#181B21] border-black/[0.06]'
                              : 'bg-[#FEF1F5]/70 dark:bg-[#ee2e65]/15 border-[#FBC2D4]/70'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 text-[#ee2e65] shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[#1C1D21] dark:text-gray-100 truncate">
                              {n.title}
                            </div>
                            <div className="text-[10.5px] text-[#646772] dark:text-gray-400 line-clamp-2 mt-0.5">
                              {n.message}
                            </div>
                            <div className="text-[10px] text-[#8A8D98] mt-0.5 tabular-nums">
                              {formatRelativeTimeId(n.createdAt)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {filteredNotifications.length === 0 && (
                      <div className="py-6 text-center text-[11.5px] text-gray-500">
                        Tidak ada notifikasi.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exact gmsmodul/ServoLution-app Compact One-Handed Floating Bottom Pill Dock + Detached Search Button */}
      <div className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] inset-x-4 max-w-[352px] mx-auto z-40 md:hidden flex items-center gap-2 no-print">
        {/* Main Floating Pill Dock */}
        <nav
          ref={pillBarRef}
          aria-label="Navigasi Mobile"
          className="relative flex-1 bg-white/95 dark:bg-[#15181E]/95 backdrop-blur-md rounded-full p-1 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18)] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.75)] border border-black/[0.14] dark:border-white/[0.14] flex items-center justify-between"
        >
          {/* Gliding Brand-Primary Active Pill */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-[#ee2e65] shadow-[0_5px_14px_-4px_rgba(238,46,101,0.55)] transition-[transform,width,opacity] duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
              indicator.ready ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              width: `${indicator.width}px`,
              transform: `translate3d(${indicator.left}px, 0, 0)`,
            }}
          />

          {primarySlots.map((slot, index) => {
            const Icon = slot.icon;
            const isActive = activeSlotIndex === index;
            return (
              <button
                key={slot.id}
                ref={(el) => {
                  slotRefs.current[index] = el;
                }}
                type="button"
                aria-label={slot.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  playUiMotionSound('tick');
                  setActivePage(slot.id);
                  closeMenuSmoothly();
                }}
                className={`relative z-10 flex-1 h-10 rounded-full flex items-center justify-center transition-colors duration-200 cursor-pointer ${
                  isActive
                    ? 'text-white'
                    : 'text-[#1C1D21] dark:text-gray-200 hover:text-[#ee2e65]'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-[18px] h-[18px] ${
                      isActive ? 'stroke-[2.2px]' : 'stroke-[1.9px]'
                    }`}
                  />
                  {slot.dot && (
                    <span
                      className={`w-2 h-2 rounded-full absolute -top-0.5 -right-1 ring-[1.5px] ${
                        isActive
                          ? 'bg-white ring-[#ee2e65]'
                          : 'bg-[#EF4444] ring-white dark:ring-[#15181E]'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}

          {/* Slot 4: Overflow Menu Trigger (Expands & shows active module icon + chevrons when an overflow module is active) */}
          <button
            ref={(el) => {
              slotRefs.current[3] = el;
            }}
            type="button"
            aria-label="Buka menu navigasi"
            aria-expanded={menuOpen && !menuClosing}
            onClick={() => (menuOpen && !menuClosing ? closeMenuSmoothly() : openMenuSmoothly())}
            className={`relative z-10 h-10 rounded-full flex items-center justify-center gap-1 transition-colors duration-200 cursor-pointer ${
              isOverflowActive
                ? 'flex-[1.28] px-2.5 text-white'
                : 'flex-1 text-[#1C1D21] dark:text-gray-200 hover:text-[#ee2e65]'
            }`}
          >
            {isOverflowActive && ActiveOverflowIcon && (
              <ActiveOverflowIcon className="w-[17px] h-[17px] stroke-[2.1px] shrink-0" />
            )}
            <ChevronsUpDown
              className={`w-[15px] h-[15px] stroke-[2.1px] shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                menuOpen && !menuClosing ? 'scale-110' : ''
              }`}
            />
          </button>
        </nav>

        {/* Detached Floating Circular Search Button */}
        <button
          type="button"
          aria-label="Cari project, tugas, atau menu"
          onClick={() => {
            closeMenuSmoothly();
            playUiMotionSound('pop');
            setSearchOpen(true);
          }}
          className={`w-12 h-12 shrink-0 rounded-full backdrop-blur-md shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18)] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.75)] border flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer ${
            searchOpen
              ? 'bg-[#ee2e65] text-white border-[#ee2e65]'
              : 'bg-white/95 dark:bg-[#15181E]/95 text-[#1C1D21] dark:text-gray-200 border-black/[0.14] dark:border-white/[0.14] hover:text-[#ee2e65]'
          }`}
        >
          <Search className="w-[18px] h-[18px] stroke-[2px]" />
        </button>
      </div>

      {/* Mobile Search Bottom Sheet (Swipe-to-dismiss with useBottomSheetMotion) */}
      {searchOpen && (
        <div
          ref={searchBackdropRef}
          data-modal-sheet-backdrop="true"
          className="animate-ui-fade fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-end justify-center md:hidden no-print"
          onClick={animateCloseSearch}
        >
          <div
            ref={setSearchSheetEl}
            {...searchGestureProps}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white dark:bg-[#15181E] rounded-t-[28px] p-5 pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] space-y-4 shadow-2xl max-h-[82vh] flex flex-col animate-bottom-sheet"
          >
            <div
              data-sheet-handle="true"
              className="flex justify-center py-2 -mt-3 -mb-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
            >
              <div className="w-10 h-1 bg-black/20 dark:bg-white/25 rounded-full animate-sheet-handle" />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex-1 flex items-center gap-2.5 bg-[#F4F5F8] dark:bg-[#1B1E24] rounded-full px-4 py-2.5 border border-black/[0.12] dark:border-white/[0.12] focus-within:border-[#ee2e65] focus-within:bg-white dark:focus-within:bg-[#181B21] transition-colors">
                <Search className="w-4 h-4 text-[#646772] shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  enterKeyHint="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari project, menu, atau kru..."
                  className="w-full bg-transparent text-[13.5px] text-[#1C1D21] dark:text-gray-100 placeholder:text-[#646772] outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[#8A8D98] hover:text-[#1C1D21] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={animateCloseSearch}
                aria-label="Tutup pencarian"
                className="w-10 h-10 rounded-full bg-[#F4F5F8] dark:bg-[#1B1E24] text-[#4B4E57] dark:text-gray-300 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 overscroll-contain">
              {/* Matched Pages */}
              {searchResults.matchedModules.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8D98] mb-2 px-1">
                    Menu &amp; Alur
                  </div>
                  <div className="space-y-1">
                    {searchResults.matchedModules.map((mod) => {
                      const Icon = mod.icon;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => {
                            setActivePage(mod.id);
                            animateCloseSearch();
                          }}
                          className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-2xl bg-[#FAFBFD] dark:bg-[#181B21] hover:bg-[#FEF1F5] text-left border border-black/[0.06] cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 text-[#ee2e65] shrink-0" />
                            <span className="text-[13px] font-semibold text-[#1C1D21] dark:text-gray-100 truncate">
                              {mod.label}
                            </span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#8A8D98] shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Matched Work Items */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8D98] mb-2 px-1">
                  Project &amp; Tugas
                </div>
                <div className="space-y-1.5">
                  {searchResults.matchedItems.map((item) => {
                    const color = getWorkBarColor(item.category, item.discipline);
                    const crewLabel = formatAssigneeSummary(item, workspace?.crew || []);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedWorkItemId(item.id);
                          animateCloseSearch();
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-2xl bg-[#FAFBFD] dark:bg-[#181B21] hover:bg-[#FEF1F5] border border-black/[0.06] flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-[#1C1D21] dark:text-gray-100 truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[#646772] dark:text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                            <span className="font-mono font-medium">
                              {item.requestNo || item.code}
                            </span>
                            <span>·</span>
                            <span className={color.textClass}>{color.label}</span>
                            <span>·</span>
                            <span className="truncate">{crewLabel}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-[#646772] shrink-0">
                          {item.estimatedHours}j
                        </span>
                      </button>
                    );
                  })}
                  {searchResults.matchedItems.length === 0 && (
                    <div className="py-6 text-center text-xs text-gray-500">
                      Tidak ditemukan hasil untuk &ldquo;{searchQuery}&rdquo;.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
