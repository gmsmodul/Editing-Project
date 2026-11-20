import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Plus, MapPin, CalendarCheck2, Clock } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ACTION_BTN_PRIMARY, ACTION_BTN_SECONDARY } from '../../constants/buttonStyles';
import { getWorkBarColor } from '../../constants/theme';
import {
  REFERENCE_TODAY,
  addDays,
  formatAssigneeSummary,
  formatFullDateId,
  formatShootingSchedule,
  getWorkItemAssignees,
  isCrewAssignedToItem,
} from '../../utils/formatters';
import { exportCalendarIcs } from '../../utils/exporters';
import { CustomSelect } from '../ui/CustomSelect';
import type { WorkCategory } from '../../types';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const WEEKDAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function toIsoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const CalendarPage: React.FC = () => {
  const {
    workspace,
    isProjectLead,
    setSelectedWorkItemId,
    openCreateModal,
    triggerToast,
  } = useWorkspace();

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [year, setYear] = useState<number>(2026);
  const [monthIndex, setMonthIndex] = useState<number>(10); // November (0-indexed)
  const [weekStartIso, setWeekStartIso] = useState<string>('2026-11-16'); // Monday of current week
  const [selectedDate, setSelectedDate] = useState<string>(REFERENCE_TODAY);
  const [crewFilter, setCrewFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | WorkCategory>('all');
  const [onlyCoordinated, setOnlyCoordinated] = useState<boolean>(false);

  const filteredItems = useMemo(() => {
    if (!workspace) return [];
    return workspace.workItems.filter((item) => {
      if (item.workflowStage === 'rejected_manager') return false;
      if (crewFilter !== 'all' && !isCrewAssignedToItem(item, crewFilter)) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (onlyCoordinated && item.category === 'project' && !item.calendarCoordination) {
        return false;
      }
      return true;
    });
  }, [workspace, crewFilter, categoryFilter, onlyCoordinated]);

  const monthCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, monthIndex, 1));
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    // Monday-based offset (0 = Mon ... 6 = Sun)
    const startOffset = (firstDay.getUTCDay() + 6) % 7;

    const cells: Array<{ iso: string; dayNum: number; inMonth: boolean }> = [];
    const prevMonthLastDate = new Date(Date.UTC(year, monthIndex, 0));
    const prevMonthDays = prevMonthLastDate.getUTCDate();
    const prevYear = prevMonthLastDate.getUTCFullYear();
    const prevMonthIdx = prevMonthLastDate.getUTCMonth();

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      cells.push({ iso: toIsoDate(prevYear, prevMonthIdx, d), dayNum: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ iso: toIsoDate(year, monthIndex, d), dayNum: d, inMonth: true });
    }
    const remaining = (7 - (cells.length % 7)) % 7;
    const nextMonthDate = new Date(Date.UTC(year, monthIndex + 1, 1));
    const nextYear = nextMonthDate.getUTCFullYear();
    const nextMonthIdx = nextMonthDate.getUTCMonth();
    for (let d = 1; d <= remaining; d++) {
      cells.push({ iso: toIsoDate(nextYear, nextMonthIdx, d), dayNum: d, inMonth: false });
    }
    return cells;
  }, [year, monthIndex]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(weekStartIso, i);
      return {
        iso,
        weekday: WEEKDAY_HEADERS[i],
        dayNum: Number(iso.slice(8, 10)),
      };
    });
  }, [weekStartIso]);

  if (!workspace) return null;

  const getItemsForDate = (iso: string) =>
    filteredItems.filter(
      (item) =>
        (item.startDate <= iso && item.dueDate >= iso) ||
        (item.discipline === 'Shooting' && item.shootingDate === iso)
    );

  const selectedDayItems = getItemsForDate(selectedDate);

  const handlePrev = () => {
    if (viewMode === 'month') {
      if (monthIndex === 0) {
        setYear((y) => y - 1);
        setMonthIndex(11);
      } else {
        setMonthIndex((m) => m - 1);
      }
    } else {
      setWeekStartIso((s) => addDays(s, -7));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      if (monthIndex === 11) {
        setYear((y) => y + 1);
        setMonthIndex(0);
      } else {
        setMonthIndex((m) => m + 1);
      }
    } else {
      setWeekStartIso((s) => addDays(s, 7));
    }
  };

  const handleExportIcs = () => {
    exportCalendarIcs(filteredItems, workspace.crew);
    triggerToast(
      'Kalender .ICS Diekspor',
      'File kalender siap diimpor ke Google Calendar, Apple Calendar, atau Outlook.',
      'success'
    );
  };

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-4 w-full ui-stagger">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-1 border border-black/[0.10] rounded-xl bg-white p-1">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Periode sebelumnya"
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg hover:bg-[#F4F5F8] flex items-center justify-center text-[#1C1D21] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-[13px] font-bold text-[#1C1D21] whitespace-nowrap">
                {viewMode === 'month'
                  ? `${MONTH_NAMES[monthIndex]} ${year}`
                  : `${formatFullDateId(weekStartIso)}`}
              </span>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Periode berikutnya"
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg hover:bg-[#F4F5F8] flex items-center justify-center text-[#1C1D21] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-gray-100 border border-gray-300 rounded-xl sm:rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-2.5 py-1.5 sm:py-1 rounded-lg sm:rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  viewMode === 'month'
                    ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Bulan
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1.5 sm:py-1 rounded-lg sm:rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  viewMode === 'week'
                    ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Minggu
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <CustomSelect
              value={crewFilter}
              onChange={setCrewFilter}
              ariaLabel="Filter kru kalender"
              size="sm"
              className="w-full sm:w-auto sm:min-w-[170px]"
              options={[
                { value: 'all', label: 'Seluruh Tim' },
                ...workspace.crew.map((c) => ({ value: c.id, label: c.name, meta: c.division })),
              ]}
            />

            <CustomSelect
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val as 'all' | WorkCategory)}
              ariaLabel="Filter kategori kalender"
              size="sm"
              className="w-full sm:w-auto sm:min-w-[175px]"
              options={[
                { value: 'all', label: 'Semua Kategori' },
                { value: 'project', label: 'Hanya Project' },
                { value: 'routine', label: 'Hanya Rutin' },
                { value: 'flexible', label: 'Hanya Fleksibel' },
              ]}
            />

            <button
              type="button"
              onClick={() => setOnlyCoordinated((v) => !v)}
              className={`col-span-2 sm:col-span-1 h-9 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                onlyCoordinated
                  ? 'bg-[#0F172A] text-white border-[#0F172A]'
                  : 'bg-white text-[#525660] border-gray-300 hover:border-gray-400'
              }`}
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              Koordinasi Kalender
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportIcs}
            className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
          >
            <Download className="w-3.5 h-3.5" />
            Sinkron .ICS
          </button>
          <button
            type="button"
            onClick={() => openCreateModal(isProjectLead ? 'project' : 'routine', selectedDate)}
            className={`${ACTION_BTN_PRIMARY} w-full sm:w-auto`}
          >
            <Plus className="w-4 h-4" />
            {isProjectLead ? 'Jadwalkan' : 'Catat Tugas'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#525660]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#ee2e65]" />
          Shooting
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#6C5DD3]" />
          Editing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#0284C7]" />
          Installasi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981]" />
          Tugas Rutin
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B]" />
          Tugas Fleksibel
        </span>
      </div>

      {/* Calendar Main Grid + Selected Date Side Agenda */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-8 rounded-2xl border border-black/[0.12] bg-white overflow-hidden">
          {viewMode === 'month' ? (
            <>
              <div className="grid grid-cols-7 border-b border-black/[0.07] bg-[#FAFBFD]">
                {WEEKDAY_HEADERS.map((wd) => (
                  <div
                    key={wd}
                    className="py-2.5 text-center text-[11.5px] font-bold text-[#6E717A]"
                  >
                    {wd}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 divide-x divide-y divide-black/[0.06]">
                {monthCells.map((cell) => {
                  const dayItems = getItemsForDate(cell.iso);
                  const isToday = cell.iso === REFERENCE_TODAY;
                  const isSelected = cell.iso === selectedDate;

                  return (
                    <div
                      key={cell.iso}
                      onClick={() => setSelectedDate(cell.iso)}
                      className={`min-w-0 min-h-[60px] sm:min-h-[106px] p-1 sm:p-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#FEF1F5]/55'
                          : cell.inMonth
                            ? 'bg-white hover:bg-[#FAFBFD]'
                            : 'bg-[#F8F9FB] text-[#A0A4AE]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[11.5px] font-mono tabular-nums ${
                            isToday
                              ? 'bg-[#ee2e65] text-white font-bold'
                              : isSelected
                                ? 'bg-[#1C1D21] text-white font-semibold'
                                : 'text-[#1C1D21]'
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                        {dayItems.length > 0 && (
                          <span className="hidden sm:inline text-[10px] font-mono tabular-nums text-[#6E717A]">
                            {dayItems.length}
                          </span>
                        )}
                      </div>

                      {/* Mobile Compact Event Dots (All items) */}
                      {dayItems.length > 0 && (
                        <div className="flex sm:hidden flex-wrap items-center gap-1 px-0.5 pt-0.5">
                          {dayItems.map((item) => {
                            const bar = getWorkBarColor(item.category, item.discipline);
                            return (
                              <span
                                key={`dot-${item.id}`}
                                title={item.title}
                                className={`w-1.5 h-1.5 rounded-full ${bar.barClass}`}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Desktop Event List (All items) */}
                      <div className="hidden sm:block space-y-1 min-w-0">
                        {dayItems.map((item) => {
                          const bar = getWorkBarColor(item.category, item.discipline);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              title={`${item.requestNo || item.code} — ${item.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWorkItemId(item.id);
                              }}
                              className={`w-full text-left px-1.5 py-0.5 rounded-md text-[10.5px] font-medium truncate block cursor-pointer ${bar.softBg} ${bar.textClass} hover:brightness-95`}
                            >
                              {item.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.07]">
              {weekDays.map((day) => {
                const dayItems = getItemsForDate(day.iso);
                const isToday = day.iso === REFERENCE_TODAY;
                return (
                  <div
                    key={day.iso}
                    onClick={() => setSelectedDate(day.iso)}
                    className={`p-2.5 min-h-[340px] cursor-pointer ${
                      isToday ? 'bg-[#FEF1F5]/35' : 'bg-white'
                    }`}
                  >
                    <div className="pb-2 mb-2 border-b border-black/[0.07] flex items-center justify-between">
                      <span className="text-[11.5px] font-semibold text-[#6E717A]">
                        {day.weekday}
                      </span>
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-mono tabular-nums ${
                          isToday ? 'bg-[#ee2e65] text-white font-bold' : 'text-[#1C1D21] font-bold'
                        }`}
                      >
                        {day.dayNum}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {dayItems.map((item) => {
                        const bar = getWorkBarColor(item.category, item.discipline);
                        const assignees = getWorkItemAssignees(item, workspace.crew);
                        const initialsLabel =
                          assignees.length > 0
                            ? assignees.map((c) => c.initials).join('+')
                            : '-';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorkItemId(item.id);
                            }}
                            className={`w-full text-left p-2 rounded-xl border text-[11.5px] cursor-pointer ${bar.softBg} ${bar.borderClass}`}
                          >
                            <div className={`font-semibold leading-snug ${bar.textClass}`}>
                              {item.title}
                            </div>
                            <div className="text-[10.5px] text-[#525660] mt-1 font-mono tabular-nums">
                              {initialsLabel} ·{' '}
                              {item.discipline === 'Shooting' &&
                              item.shootingDate === day.iso &&
                              item.shootingStartTime
                                ? `${item.shootingStartTime}${item.shootingEndTime ? `–${item.shootingEndTime}` : ''}`
                                : item.dueTime || '17:00'}
                            </div>
                          </button>
                        );
                      })}
                      {dayItems.length === 0 && (
                        <div className="text-[11px] text-[#A0A4AE] text-center py-6">Kosong</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Day Agenda Detail */}
        <aside className="xl:col-span-4 rounded-2xl border border-black/[0.12] bg-white p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/[0.07]">
            <div>
              <div className="text-[11.5px] text-[#6E717A]">Agenda Terpadu Tanggal</div>
              <h2 className="text-[15px] font-bold text-[#1C1D21]">
                {formatFullDateId(selectedDate)}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => openCreateModal(isProjectLead ? 'project' : 'routine', selectedDate)}
              className="text-[12px] font-semibold text-[#ee2e65] hover:underline cursor-pointer"
            >
              + Tambah
            </button>
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-0.5">
            {selectedDayItems.map((item) => {
              const bar = getWorkBarColor(item.category, item.discipline);
              const crewSummary = formatAssigneeSummary(item, workspace.crew);
              const shootSched = formatShootingSchedule(item);
              const isShootDay = item.discipline === 'Shooting' && item.shootingDate === selectedDate;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedWorkItemId(item.id)}
                  className="w-full text-left p-3.5 rounded-xl border border-black/[0.08] hover:bg-[#FAFBFD] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-semibold text-[#1C1D21]">
                        {item.requestNo || item.code}
                      </span>
                      <span className={`font-semibold ${bar.textClass}`}>{bar.label}</span>
                    </span>
                    <span className="font-mono tabular-nums text-[#6E717A] shrink-0">
                      {isShootDay && item.shootingStartTime
                        ? `${item.shootingStartTime}${item.shootingEndTime ? `–${item.shootingEndTime}` : ''}`
                        : item.dueTime || '17:00'}
                    </span>
                  </div>
                  <div className="text-[13.5px] font-bold text-[#1C1D21] mt-1 leading-snug">
                    {item.title}
                  </div>
                  {shootSched && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF1F5] text-[#9D113C] text-[10.5px] font-semibold">
                      <Clock className="w-3 h-3 shrink-0" />
                      Shooting: {shootSched}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-[#6E717A]">
                    <span className="truncate">
                      {crewSummary} · {item.estimatedHours} jam
                    </span>
                    {item.coordinatorDepartment ? (
                      <span className="truncate shrink-0">{item.coordinatorDepartment}</span>
                    ) : item.location ? (
                      <span className="inline-flex items-center gap-1 truncate shrink-0">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {item.location}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}

            {selectedDayItems.length === 0 && (
              <div className="py-10 text-center text-[12.5px] text-[#6E717A]">
                Tidak ada jadwal pada tanggal ini. Klik &ldquo;+ Tambah&rdquo; untuk menjadwalkan
                shooting, editing, atau tugas tim.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
