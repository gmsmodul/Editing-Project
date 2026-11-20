import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Play, Square } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getWorkBarColor } from '../../constants/theme';
import {
  REFERENCE_TODAY,
  addDays,
  daysBetween,
  formatAssigneeSummary,
  formatShortDateId,
  formatShootingSchedule,
  getPerCrewEstimatedHours,
  getWorkItemAssigneeIds,
  isCrewAssignedToItem,
} from '../../utils/formatters';
import { CustomSelect } from '../ui/CustomSelect';
import { DEFAULT_PAGE_SIZE, PaginationBar } from '../ui/PaginationBar';
import type { WorkCategory, WorkItem } from '../../types';

const WINDOW_START = '2026-11-12';
const TOTAL_DAYS = 18; // Nov 12 -> Nov 29, 2026

export const GanttPage: React.FC = () => {
  const {
    workspace,
    crewWorkloads,
    updateWorkItem,
    startTimer,
    stopTimer,
    setSelectedWorkItemId,
  } = useWorkspace();

  const [groupBy, setGroupBy] = useState<'crew' | 'category'>('crew');
  const [categoryFilter, setCategoryFilter] = useState<'all' | WorkCategory>('all');
  const [crewFilter, setCrewFilter] = useState<string>('all');
  const [cellWidth, setCellWidth] = useState<number>(48);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const days = useMemo(() => {
    const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    return Array.from({ length: TOTAL_DAYS }, (_, idx) => {
      const iso = addDays(WINDOW_START, idx);
      const dt = new Date(`${iso}T00:00:00Z`);
      return {
        idx,
        iso,
        dayNum: dt.getUTCDate(),
        weekday: weekdays[dt.getUTCDay()],
        isWeekend: dt.getUTCDay() === 0 || dt.getUTCDay() === 6,
        isToday: iso === REFERENCE_TODAY,
      };
    });
  }, []);

  const todayIdx = days.findIndex((d) => d.isToday);

  const filteredItems = useMemo(() => {
    if (!workspace) return [];
    return workspace.workItems
      .filter((item) => {
        if (item.workflowStage === 'rejected_manager') return false;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (crewFilter !== 'all' && !isCrewAssignedToItem(item, crewFilter)) return false;
        return true;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [workspace, categoryFilter, crewFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [groupBy, categoryFilter, crewFilter, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);

  const groupedRows = useMemo(() => {
    if (!workspace) return [];
    if (groupBy === 'crew') {
      return workspace.crew
        .filter((c) => crewFilter === 'all' || c.id === crewFilter)
        .map((member) => {
          const wl = crewWorkloads.find((w) => w.crew.id === member.id);
          return {
            groupKey: member.id,
            title: member.name,
            subtitle: `${member.role} · ${wl?.totalActiveHours || 0}/${member.maxWeeklyHours} jam${
              wl?.isOverloaded ? ' · OVERLOAD' : ''
            }`,
            isOverloaded: Boolean(wl?.isOverloaded),
            items: paginatedItems.filter((i) => isCrewAssignedToItem(i, member.id)),
          };
        })
        .filter((g) => g.items.length > 0);
    }

    const categories: Array<{ key: WorkCategory; title: string; subtitle: string }> = [
      { key: 'project', title: 'Project Shooting & Editing', subtitle: 'Produksi utama departemen' },
      { key: 'routine', title: 'Tugas Rutin', subtitle: 'Operasional terjadwal non-project' },
      { key: 'flexible', title: 'Tugas Fleksibel', subtitle: 'Dukungan ad-hoc & permintaan lintas divisi' },
    ];
    return categories
      .map((cat) => ({
        groupKey: cat.key,
        title: cat.title,
        subtitle: cat.subtitle,
        isOverloaded: false,
        items: paginatedItems.filter((i) => i.category === cat.key),
      }))
      .filter((g) => g.items.length > 0);
  }, [workspace, groupBy, crewFilter, crewWorkloads, paginatedItems]);

  if (!workspace) return null;

  const shiftItemSchedule = (item: WorkItem, deltaDays: number) => {
    void updateWorkItem(item.id, {
      startDate: addDays(item.startDate, deltaDays),
      dueDate: addDays(item.dueDate, deltaDays),
    });
  };

  const adjustItemDuration = (item: WorkItem, deltaDays: number) => {
    const currentSpan = Math.max(1, daysBetween(item.startDate, item.dueDate) + 1);
    const nextSpan = Math.max(1, currentSpan + deltaDays);
    void updateWorkItem(item.id, {
      dueDate: addDays(item.startDate, nextSpan - 1),
    });
  };

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-4 w-full ui-stagger">
      {/* Legend + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Explicit Color Legend for All Work Types */}
        <div className="flex flex-wrap items-center gap-3.5 text-[12px] text-[#525660]">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1D21]">
            <span className="w-3 h-3 rounded-xs bg-[#ee2e65]" />
            Shooting
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1D21]">
            <span className="w-3 h-3 rounded-xs bg-[#6C5DD3]" />
            Editing
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1D21]">
            <span className="w-3 h-3 rounded-xs bg-[#0284C7]" />
            Installasi
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1D21]">
            <span className="w-3 h-3 rounded-xs bg-[#10B981]" />
            Tugas Rutin
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1D21]">
            <span className="w-3 h-3 rounded-xs bg-[#F59E0B]" />
            Tugas Fleksibel
          </span>
        </div>

        {/* Filters & Group Switch */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100 border border-gray-300">
            <button
              type="button"
              onClick={() => setGroupBy('crew')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                groupBy === 'crew'
                  ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Per Kru (Individu)
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('category')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                groupBy === 'category'
                  ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Per Kategori
            </button>
          </div>

          <CustomSelect
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val as 'all' | WorkCategory)}
            ariaLabel="Filter kategori Gantt"
            size="sm"
            className="min-w-[160px]"
            options={[
              { value: 'all', label: 'Semua Pekerjaan' },
              { value: 'project', label: 'Hanya Project' },
              { value: 'routine', label: 'Hanya Tugas Rutin' },
              { value: 'flexible', label: 'Hanya Tugas Fleksibel' },
            ]}
          />

          <CustomSelect
            value={crewFilter}
            onChange={setCrewFilter}
            ariaLabel="Filter kru Gantt"
            size="sm"
            className="min-w-[145px]"
            options={[
              { value: 'all', label: 'Semua Kru' },
              ...workspace.crew.map((c) => ({ value: c.id, label: c.name, meta: c.division })),
            ]}
          />

          <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-1.5 h-9 bg-white">
            <button
              type="button"
              onClick={() => setCellWidth((w) => Math.max(36, w - 8))}
              title="Perkecil skala hari"
              className="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-600 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono tabular-nums text-gray-600 px-1">Skala</span>
            <button
              type="button"
              onClick={() => setCellWidth((w) => Math.min(72, w + 8))}
              title="Perbesar skala hari"
              className="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Gantt Chart Grid Container (Exact gmsmodul/UI-KIT GanttChartUiKit styling) */}
      <div
        data-no-pull="true"
        className="rounded-2xl border border-black/[0.12] bg-white overflow-hidden"
      >
        <div className="overflow-x-auto ui-scrollbar-violet">
          <div style={{ minWidth: `${188 + TOTAL_DAYS * cellWidth}px` }}>
            {/* Timeline Header Row */}
            <div className="flex border-b border-gray-300 bg-[#FAFBFD] sticky top-0 z-20">
              <div className="sticky left-0 z-30 bg-[#FAFBFD] w-[188px] sm:w-[300px] shrink-0 px-3 sm:px-4 py-2.5 border-r border-gray-300 text-xs font-semibold text-gray-700 truncate">
                Pekerjaan &amp; Kru
              </div>
              <div className="flex flex-1">
                {days.map((d) => (
                  <div
                    key={d.iso}
                    style={{ width: `${cellWidth}px` }}
                    className={`shrink-0 py-2 text-center border-r border-black/[0.05] ${
                      d.isToday
                        ? 'bg-[#FEF1F5] text-[#9D113C] font-bold'
                        : d.isWeekend
                          ? 'bg-[#F4F5F8]/80 text-[#8C9099]'
                          : 'text-[#525660]'
                    }`}
                  >
                    <div className="text-[10px] leading-none">{d.weekday}</div>
                    <div className="text-[12px] font-mono tabular-nums mt-0.5">{d.dayNum}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grouped Rows */}
            {groupedRows.map((group) => (
              <div key={group.groupKey} className="border-b border-black/[0.07] last:border-b-0">
                {/* Group Header */}
                <div
                  className={`px-4 py-2 border-b border-black/[0.06] flex items-center justify-between gap-2 ${
                    group.isOverloaded ? 'bg-[#FFECEB]/60' : 'bg-[#F6F7FA]/75'
                  }`}
                >
                  <div className="text-[12.5px] font-bold text-[#1C1D21]">
                    {group.title}
                    <span
                      className={`ml-2 font-normal text-[11.5px] ${
                        group.isOverloaded ? 'text-[#C11448] font-semibold' : 'text-[#6E717A]'
                      }`}
                    >
                      {group.subtitle}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-[#6E717A]">
                    {group.items.length} item
                  </span>
                </div>

                {/* Task Rows inside Group */}
                {group.items.map((item) => {
                  const bar = getWorkBarColor(item.category, item.discipline);
                  const assigneeIds = getWorkItemAssigneeIds(item);
                  const isMultiCrew = assigneeIds.length > 1;
                  const perCrewHours = getPerCrewEstimatedHours(item);
                  const assigneeLabel = formatAssigneeSummary(item, workspace.crew, { short: true });
                  const rawStartIdx = daysBetween(WINDOW_START, item.startDate);
                  const rawEndIdx = daysBetween(WINDOW_START, item.dueDate);
                  const clampedStart = Math.max(0, Math.min(TOTAL_DAYS - 1, rawStartIdx));
                  const clampedEnd = Math.max(clampedStart, Math.min(TOTAL_DAYS - 1, rawEndIdx));
                  const spanDays = clampedEnd - clampedStart + 1;
                  const rowCrewId = groupBy === 'crew' ? group.groupKey : item.assigneeId;
                  const runningTimer =
                    groupBy === 'crew'
                      ? workspace.activeTimers.find(
                          (t) => t.workItemId === item.id && t.crewId === rowCrewId
                        )
                      : workspace.activeTimers.find((t) => t.workItemId === item.id);

                  return (
                    <div
                      key={`${group.groupKey}-${item.id}`}
                      className="flex items-stretch border-b border-black/[0.04] last:border-b-0 hover:bg-[#FAFBFD] transition-colors"
                    >
                      {/* Left Label Cell — Sticky on mobile horizontal pan */}
                      <div className="sticky left-0 z-20 bg-white w-[188px] sm:w-[300px] shrink-0 px-3 sm:px-4 py-2.5 border-r border-black/[0.08] flex items-center justify-between gap-1.5 sm:gap-2">
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setSelectedWorkItemId(item.id)}
                            className="text-[12.5px] font-semibold text-[#1C1D21] hover:text-[#ee2e65] truncate block max-w-full text-left cursor-pointer"
                          >
                            {item.title}
                          </button>
                          <div className="text-[11px] text-[#6E717A] flex items-center gap-1.5 mt-0.5 truncate font-mono tabular-nums">
                            <span className="font-semibold text-[#1C1D21]">
                              {item.requestNo || item.code}
                            </span>
                            <span>·</span>
                            <span className={`font-sans ${bar.textClass}`}>{bar.label}</span>
                            {groupBy === 'category' ? (
                              <>
                                <span>·</span>
                                <span className="font-sans truncate">{assigneeLabel}</span>
                              </>
                            ) : isMultiCrew ? (
                              <>
                                <span>·</span>
                                <span className="font-sans font-medium text-[#525660]">
                                  {assigneeIds.length} kru
                                </span>
                              </>
                            ) : null}
                            <span>·</span>
                            <span>
                              {groupBy === 'crew' && isMultiCrew
                                ? `${perCrewHours}j/kru`
                                : `${item.estimatedHours}j`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => shiftItemSchedule(item, -1)}
                            title="Geser 1 hari lebih awal"
                            className="w-6 h-6 rounded-md hover:bg-black/5 flex items-center justify-center text-[#6E717A] cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => shiftItemSchedule(item, 1)}
                            title="Geser 1 hari lebih lambat"
                            className="w-6 h-6 rounded-md hover:bg-black/5 flex items-center justify-center text-[#6E717A] cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              runningTimer
                                ? void stopTimer(runningTimer.id)
                                : void startTimer(item.id, rowCrewId)
                            }
                            title={runningTimer ? 'Hentikan Timer' : 'Mulai Timer'}
                            className={`w-6 h-6 rounded-md flex items-center justify-center cursor-pointer ${
                              runningTimer
                                ? 'bg-[#FFECEB] text-[#942922]'
                                : 'hover:bg-[#FEF1F5] text-[#6E717A] hover:text-[#ee2e65]'
                            }`}
                          >
                            {runningTimer ? (
                              <Square className="w-3 h-3 fill-current" />
                            ) : (
                              <Play className="w-3 h-3 fill-current" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Right Timeline Grid Track */}
                      <div className="relative flex flex-1 items-center">
                        {/* Background Grid Columns */}
                        {days.map((d) => (
                          <div
                            key={d.iso}
                            style={{ width: `${cellWidth}px` }}
                            className={`shrink-0 h-full border-r border-black/[0.04] ${
                              d.isToday
                                ? 'bg-[#FEF1F5]/50'
                                : d.isWeekend
                                  ? 'bg-[#F8F9FB]'
                                  : ''
                            }`}
                          />
                        ))}

                        {/* Today Vertical Guide Line */}
                        {todayIdx >= 0 && (
                          <div
                            style={{ left: `${todayIdx * cellWidth + cellWidth / 2}px` }}
                            className="pointer-events-none absolute top-0 bottom-0 w-[1.5px] bg-[#ee2e65]/65 z-10"
                          />
                        )}

                        {/* Gantt Bar */}
                        <div
                          style={{
                            left: `${clampedStart * cellWidth + 4}px`,
                            width: `${Math.max(cellWidth - 8, spanDays * cellWidth - 8)}px`,
                          }}
                          className="absolute z-10 flex items-center group"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedWorkItemId(item.id)}
                            title={`${item.requestNo || item.code} · ${item.title} (${formatShortDateId(item.startDate)} – ${formatShortDateId(item.dueDate)}${
                              formatShootingSchedule(item)
                                ? ` · Shoot ${formatShootingSchedule(item)}`
                                : ''
                            }, ${item.progress}%)`}
                            className={`relative w-full h-7 rounded-lg overflow-hidden text-white text-[11px] font-semibold px-2.5 flex items-center justify-between gap-2 shadow-2xs hover:brightness-95 transition-all cursor-pointer ${bar.barClass}`}
                          >
                            <span
                              aria-hidden="true"
                              style={{ width: `${item.progress}%` }}
                              className="absolute inset-y-0 left-0 bg-black/15 pointer-events-none"
                            />
                            <span className="relative z-10 truncate">
                              {item.requestNo || item.code} ·{' '}
                              {groupBy === 'crew' && isMultiCrew
                                ? `${perCrewHours}j (${assigneeIds.length} kru)`
                                : `${item.estimatedHours}j`}
                            </span>
                            <span className="relative z-10 font-mono tabular-nums text-[10px] opacity-90 shrink-0">
                              {item.progress}%
                            </span>
                          </button>

                          {/* Hover duration adjusters */}
                          <div className="hidden group-hover:flex items-center gap-0.5 ml-1 bg-white border border-black/[0.10] rounded-md shadow-xs px-0.5 py-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => adjustItemDuration(item, -1)}
                              title="Kurangi durasi 1 hari"
                              className="w-4 h-4 rounded hover:bg-black/5 flex items-center justify-center text-[#1C1D21] cursor-pointer"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustItemDuration(item, 1)}
                              title="Tambah durasi 1 hari"
                              className="w-4 h-4 rounded hover:bg-black/5 flex items-center justify-center text-[#1C1D21] cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {groupedRows.length === 0 && (
              <div className="py-12 text-center text-[13px] text-[#6E717A]">
                Tidak ada pekerjaan yang sesuai filter Gantt saat ini.
              </div>
            )}
          </div>
        </div>

        {/* Pagination Footer (mulai dari 10 item) */}
        <PaginationBar
          currentPage={safePage}
          totalItems={filteredItems.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="pekerjaan"
        />
      </div>
    </div>
  );
};
