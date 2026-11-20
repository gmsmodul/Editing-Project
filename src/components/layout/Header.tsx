import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  Plus,
  Search,
  X,
  AlertTriangle,
  Clock,
  FileText,
  Zap,
  Sun,
  Moon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ACTION_BTN_PRIMARY } from '../../constants/buttonStyles';
import {
  formatAssigneeSummary,
  formatRelativeTimeId,
  getWorkItemAssigneeIds,
} from '../../utils/formatters';
import { getWorkBarColor } from '../../constants/theme';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { HorizontalSlideTrack } from '../ui/HorizontalSlideTrack';
import { getPageDirection } from '../ui/PageTransition';
import { useIsMobile } from '../../hooks/useIsMobile';
import { NAV_ITEMS } from './Sidebar';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { PageId } from '../../types';

const PAGE_TITLES: Record<PageId, string> = {
  intake: 'Dashboard',
  project_manager: 'Project Manager',
  approval_video: 'Project Manager',
  kanban_video: 'Progress',
  handover_video: 'Project Manager',
  approval_tech: 'Project Manager',
  kanban_tech: 'Progress',
  handover_tech: 'Project Manager',
  overview: 'Dashboard',
  gantt: 'Schedule',
  tasks: 'Task',
  calendar: 'Calendar',
  workload: 'Load',
  analytics: 'Report',
};

type SearchCategory = 'Semua' | 'Menu' | 'Project' | 'Task';

export const Header: React.FC = () => {
  const {
    activePage,
    prevPage,
    setActivePage,
    theme,
    toggleTheme,
    workspace,
    currentCrew,
    isProjectLead,
    unreadNotifCount,
    browserPushEnabled,
    toggleBrowserPush,
    markNotificationRead,
    markAllNotificationsRead,
    openCreateModal,
    setSelectedWorkItemId,
  } = useWorkspace();

  const isMobile = useIsMobile();
  const direction = getPageDirection(prevPage, activePage, isMobile);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'urgent' | 'overload' | 'deadline'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('Semua');

  const [notifCoords, setNotifCoords] = useState({ top: 68, right: 16, isSm: false });
  const [searchCoords, setSearchCoords] = useState({ top: 68, right: 16, isSm: false });

  const notifWrapperRef = useRef<HTMLDivElement>(null);
  const notifPopoverRef = useRef<HTMLDivElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchPopoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeNav = NAV_ITEMS.find((item) => item.id === activePage) || NAV_ITEMS[0];
  const ActiveIcon = activeNav.icon;

  const updateNotifPosition = useCallback(() => {
    const el = notifWrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setNotifCoords({
      top: Math.round(rect.bottom + 8),
      right: Math.max(12, Math.round(window.innerWidth - rect.right)),
      isSm: window.innerWidth >= 640,
    });
  }, []);

  const updateSearchPosition = useCallback(() => {
    const el = searchWrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSearchCoords({
      top: Math.round(rect.bottom + 8),
      right: Math.max(12, Math.round(window.innerWidth - rect.right)),
      isSm: window.innerWidth >= 640,
    });
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    updateNotifPosition();

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        notifWrapperRef.current &&
        !notifWrapperRef.current.contains(target) &&
        notifPopoverRef.current &&
        !notifPopoverRef.current.contains(target)
      ) {
        setNotifOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updateNotifPosition);
    window.addEventListener('scroll', updateNotifPosition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updateNotifPosition);
      window.removeEventListener('scroll', updateNotifPosition, true);
    };
  }, [notifOpen, updateNotifPosition]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery('');
      setSearchCategory('Semua');
      return;
    }
    setNotifOpen(false);
    updateSearchPosition();
    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 60);

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(target) &&
        searchPopoverRef.current &&
        !searchPopoverRef.current.contains(target)
      ) {
        setSearchOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updateSearchPosition);
    window.addEventListener('scroll', updateSearchPosition, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updateSearchPosition);
      window.removeEventListener('scroll', updateSearchPosition, true);
    };
  }, [searchOpen, updateSearchPosition]);

  const filteredNotifications = useMemo(() => {
    if (!workspace) return [];
    return workspace.notifications.filter((n) => {
      if (notifFilter === 'all') return true;
      return n.type === notifFilter;
    });
  }, [workspace, notifFilter]);

  const searchEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const modules =
      searchCategory === 'Semua' || searchCategory === 'Menu'
        ? NAV_ITEMS.filter(
            (m) => !q || m.label.toLowerCase().includes(q) || m.shortLabel.toLowerCase().includes(q)
          ).slice(0, 4)
        : [];

    const crewMap = new Map((workspace?.crew || []).map((c) => [c.id, c.name]));
    const items =
      searchCategory === 'Menu'
        ? []
        : (workspace?.workItems || [])
            .filter((item) => {
              if (searchCategory === 'Project' && item.category !== 'project') return false;
              if (searchCategory === 'Task' && item.category === 'project') return false;
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
                (item.clientName || '').toLowerCase().includes(q) ||
                (item.clientPhone || '').toLowerCase().includes(q) ||
                assigneesText.includes(q) ||
                (item.discipline || '').toLowerCase().includes(q)
              );
            })
            .slice(0, 8);

    return { modules, items };
  }, [workspace, searchQuery, searchCategory]);

  const pageTitle = PAGE_TITLES[activePage];

  return (
    <header className="relative z-30 h-16 px-3 sm:px-4 border-b border-black/[0.12] dark:border-white/[0.08] flex items-center justify-between gap-3 sm:gap-4 shrink-0 bg-white/80 dark:bg-[#121418]/85 backdrop-blur-sm no-print transition-colors duration-200">
      {/* Left: Exact ServoLution-app Mobile Greeting on Overview + Directional Animated Title & Desktop Breadcrumbs */}
      <div className="relative flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        {/* Mobile Header Left */}
        <div className="flex md:hidden items-center min-w-0 flex-1 relative">
          <AnimatePresence mode="popLayout" initial={false}>
            {activePage === 'overview' ? (
              <motion.div
                key="mobile-header-overview"
                initial={{ opacity: 0, x: direction * 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -12 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="flex items-center gap-2.5 min-w-0 w-full"
              >
                <div
                  data-dark-preserve="true"
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold border border-black/[0.08] shadow-xs shrink-0 ${
                    currentCrew?.avatarBg || 'bg-[#ee2e65]'
                  } ${currentCrew?.avatarText || 'text-white'}`}
                >
                  {currentCrew?.initials || 'SM'}
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 leading-tight">
                    Selamat datang
                  </span>
                  <span className="block text-[15px] font-semibold tracking-tight text-[#1C1D21] dark:text-[#F3F4F6] truncate leading-tight">
                    {currentCrew?.name || 'ServoMedia'}
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`mobile-header-${activePage}`}
                initial={{ opacity: 0, x: direction * 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -12 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="flex items-center gap-2 min-w-0 w-full"
              >
                <ActiveIcon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    activePage.endsWith('_tech') ? 'text-[#0284C7]' : 'text-[#ee2e65]'
                  }`}
                />
                <h1 className="text-[16.5px] font-semibold tracking-tight text-[#1C1D21] dark:text-[#F3F4F6] truncate">
                  {pageTitle}
                </h1>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Breadcrumbs (Exact ServoLution-app pattern) */}
        <nav className="hidden md:flex items-center gap-2 text-[13px] min-w-0">
          <span className="text-[#646772] dark:text-gray-400 font-medium shrink-0">ServoMedia</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#8A8D98] shrink-0" />
          <div className="relative flex items-center min-w-0 overflow-hidden py-0.5">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={`desktop-crumb-${activePage}`}
                initial={{ opacity: 0, y: direction * 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: direction * -8 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className="flex items-center gap-1.5 font-semibold text-[#1C1D21] dark:text-[#F3F4F6] min-w-0"
              >
                <ActiveIcon
                  className={`w-4 h-4 shrink-0 ${
                    activePage.endsWith('_tech') ? 'text-[#0284C7]' : 'text-[#ee2e65]'
                  }`}
                />
                <span className="truncate">{pageTitle}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </nav>
      </div>

      {/* Top Right Icons & Primary Action */}
      <div className="flex items-center gap-2 sm:gap-2.5 relative shrink-0">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={() => {
            playUiMotionSound('tick');
            toggleTheme();
          }}
          aria-label={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap Obsidian'}
          title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap Obsidian'}
          className="w-9 h-9 rounded-full border border-black/[0.14] dark:border-white/[0.14] flex items-center justify-center text-[#1C1D21] dark:text-gray-200 hover:bg-[#F4F5F8] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* Desktop Search Button & Portal Popover (Mobile uses detached circular search button on bottom dock) */}
        <div ref={searchWrapperRef} className="hidden md:block relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen(false);
              setSearchOpen((prev) => {
                playUiMotionSound(!prev ? 'pop' : 'tick');
                return !prev;
              });
            }}
            aria-label="Cari project atau kru"
            aria-expanded={searchOpen}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
              searchOpen
                ? 'bg-[#FEF1F5] text-[#9D113C] border-[#FBC2D4]'
                : 'border-black/[0.14] dark:border-white/[0.14] text-[#1C1D21] dark:text-gray-200 hover:bg-[#F4F5F8] dark:hover:bg-white/[0.08]'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          {searchOpen &&
            createPortal(
              <div
                ref={searchPopoverRef}
                data-ui-portal="true"
                data-no-pull="true"
                style={{
                  top: searchCoords.top,
                  right: searchCoords.isSm ? searchCoords.right : 12,
                  left: searchCoords.isSm ? undefined : 12,
                }}
                className="fixed sm:w-[420px] bg-white dark:bg-[#15181E] rounded-[24px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.22)] dark:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.85)] border border-black/[0.14] dark:border-white/[0.14] p-4 z-[9999] space-y-3 animate-ui-pop"
              >
                <div className="flex items-center gap-2 px-3.5 h-10 rounded-full bg-[#F4F5F8] dark:bg-[#1B1E24] border border-black/[0.12] dark:border-white/[0.12] focus-within:border-[#ee2e65] focus-within:bg-white dark:focus-within:bg-[#181B21]">
                  <Search className="w-4 h-4 text-[#646772] shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari kode, project, tugas rutin, atau kru..."
                    className="w-full bg-transparent text-[13px] text-[#1C1D21] dark:text-gray-100 placeholder:text-[#646772] focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <HorizontalSlideTrack
                  accent="primary"
                  activeKey={searchCategory}
                  trackClassName="flex items-center gap-1.5"
                >
                  {(['Semua', 'Menu', 'Project', 'Task'] as SearchCategory[]).map(
                    (cat) => {
                      const active = searchCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          data-slide-active={active ? 'true' : undefined}
                          onClick={() => setSearchCategory(cat)}
                          className={`px-3 py-1 rounded-full text-[11.5px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#ee2e65] text-white'
                              : 'bg-gray-100 dark:bg-[#1B1E24] text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    }
                  )}
                </HorizontalSlideTrack>

                <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5">
                  {searchEntries.modules.map((mod) => {
                    const Icon = mod.icon;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => {
                          playUiMotionSound('tick');
                          setActivePage(mod.id);
                          setSearchOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.06] flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="w-3.5 h-3.5 text-[#ee2e65] shrink-0" />
                          <span className="text-[12.5px] font-semibold text-[#1C1D21] dark:text-gray-100 truncate">
                            {mod.label}
                          </span>
                        </div>
                        <span className="text-[10.5px] text-gray-400">Menu</span>
                      </button>
                    );
                  })}

                  {searchEntries.items.map((item) => {
                    const color = getWorkBarColor(item.category, item.discipline);
                    const crewLabel = formatAssigneeSummary(item, workspace?.crew || []);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          playUiMotionSound('tick');
                          setSelectedWorkItemId(item.id);
                          setSearchOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors flex items-start justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-[#1C1D21] dark:text-gray-100 truncate">
                            {item.title}
                          </div>
                          <div className="text-[11.5px] text-[#646772] dark:text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                            <span className="font-mono font-medium text-[#1C1D21] dark:text-gray-200">
                              {item.requestNo || item.code}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className={color.textClass}>{color.label}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{crewLabel}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-[#646772] dark:text-gray-400 shrink-0">
                          {item.estimatedHours}j
                        </span>
                      </button>
                    );
                  })}

                  {searchEntries.modules.length === 0 && searchEntries.items.length === 0 && (
                    <div className="py-6 text-center text-xs text-gray-500">
                      Tidak ada hasil untuk &ldquo;{searchQuery}&rdquo;.
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}
        </div>

        {/* Notifications Button & Portal Popover (Exact ServoLution-app geometry) */}
        <div ref={notifWrapperRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setNotifOpen((prev) => {
                playUiMotionSound(!prev ? 'pop' : 'tick');
                return !prev;
              });
            }}
            aria-label="Notifikasi"
            aria-expanded={notifOpen}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors relative cursor-pointer ${
              notifOpen
                ? 'bg-[#FEF1F5] text-[#9D113C] border-[#FBC2D4]'
                : 'border-black/[0.14] dark:border-white/[0.14] text-[#1C1D21] dark:text-gray-200 hover:bg-[#F4F5F8] dark:hover:bg-white/[0.08]'
            }`}
          >
            {browserPushEnabled ? (
              <BellRing className="w-4 h-4 text-[#ee2e65]" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            {unreadNotifCount > 0 && (
              <span className="min-w-[17px] h-[17px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center absolute -top-1 -right-1 ring-2 ring-white dark:ring-[#121418] tabular-nums">
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </button>

          {notifOpen &&
            createPortal(
              <div
                ref={notifPopoverRef}
                data-ui-portal="true"
                data-no-pull="true"
                style={{
                  top: notifCoords.top,
                  right: notifCoords.isSm ? notifCoords.right : 12,
                  left: notifCoords.isSm ? undefined : 12,
                }}
                className="fixed sm:w-[400px] bg-white dark:bg-[#15181E] rounded-[24px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.22)] dark:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.85)] border border-black/[0.14] dark:border-white/[0.14] p-4 z-[9999] space-y-3 animate-ui-pop"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[15px] font-semibold text-[#1C1D21] dark:text-gray-100">
                      Notifikasi
                    </span>
                    {unreadNotifCount > 0 && (
                      <span
                        data-dark-preserve="true"
                        className="px-2 py-0.5 rounded-full bg-[#FFECEB] text-[#942922] text-[10.5px] font-bold shrink-0"
                      >
                        {unreadNotifCount} Baru
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playUiMotionSound('success');
                      void markAllNotificationsRead();
                    }}
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#9D113C] dark:text-[#fbc2d4] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Tandai dibaca</span>
                  </button>
                </div>

                {/* Push Notification Toggle */}
                <div className="px-3 py-2 rounded-xl bg-[#FAFBFD] dark:bg-[#181B21] border border-black/[0.08] dark:border-white/[0.08]">
                  <ToggleSwitch
                    checked={browserPushEnabled}
                    onChange={() => void toggleBrowserPush()}
                    size="sm"
                    color="primary"
                    onLabel="ON"
                    offLabel="OFF"
                    label="Push Notifikasi Browser"
                    className="w-full"
                  />
                </div>

                {/* Segmented Filter Control */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1B1E24] p-0.5 rounded-lg">
                  {(
                    [
                      { id: 'all', label: 'Semua' },
                      { id: 'urgent', label: 'Mendesak' },
                      { id: 'overload', label: 'Overload' },
                      { id: 'deadline', label: 'Tenggat' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        playUiMotionSound('tick');
                        setNotifFilter(tab.id);
                      }}
                      className={`flex-1 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        notifFilter === tab.id
                          ? 'bg-white dark:bg-[#121418] text-gray-900 dark:text-white shadow-2xs font-semibold'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Notification List */}
                <div className="max-h-[52vh] sm:max-h-72 overflow-y-auto space-y-2 pr-1 overscroll-contain">
                  {filteredNotifications.map((n) => {
                    const Icon =
                      n.type === 'overload'
                        ? AlertTriangle
                        : n.type === 'urgent'
                          ? Zap
                          : n.type === 'deadline'
                            ? Clock
                            : FileText;
                    const iconColor =
                      n.type === 'overload'
                        ? 'text-[#C11448] bg-[#FEF1F5]'
                        : n.type === 'urgent'
                          ? 'text-[#942922] bg-[#FFECEB]'
                          : n.type === 'deadline'
                            ? 'text-[#8C5811] bg-[#FFF5E6]'
                            : 'text-[#3F3B99] bg-[#F0EFFC]';

                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          playUiMotionSound('tick');
                          void markNotificationRead(n.id);
                          if (n.workItemId) setSelectedWorkItemId(n.workItemId);
                          else if (n.targetPage) setActivePage(n.targetPage);
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                          n.read
                            ? 'bg-gray-50 dark:bg-[#181B21] border-gray-100 dark:border-white/[0.06]'
                            : 'bg-[#FAFBFD] dark:bg-[#1B1E24] border-black/[0.08] dark:border-white/[0.12]'
                        }`}
                      >
                        <div
                          data-dark-preserve="true"
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {n.title}
                            </span>
                            <span className="text-[10.5px] text-gray-500 shrink-0 tabular-nums">
                              {formatRelativeTimeId(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {filteredNotifications.length === 0 && (
                    <div className="py-8 text-center text-xs text-gray-500">
                      Tidak ada notifikasi pada kategori ini.
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}
        </div>

        {/* Crew / Routine & Flexible Quick Action (Project creation lives directly in Project Baru page) */}
        {(activePage === 'tasks' || !isProjectLead) && (
          <button
            type="button"
            onClick={() => {
              playUiMotionSound('pop');
              openCreateModal('routine');
            }}
            className={`${ACTION_BTN_PRIMARY} !h-9 !px-3 sm:!px-4`}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Catat Tugas Mandiri</span>
            <span className="sm:hidden text-[12.5px]">Baru</span>
          </button>
        )}
      </div>
    </header>
  );
};
