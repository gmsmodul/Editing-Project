import React, { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  ListChecks,
  Timer,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ACTION_BTN_PRIMARY, ACTION_BTN_SECONDARY } from '../../constants/buttonStyles';
import {
  exportMonthlyReportCsv,
  exportMonthlyReportExcel,
  exportMonthlyReportPdf,
} from '../../utils/exporters';
import { getLiveLoggedSeconds } from '../../utils/formatters';
import { CustomSelect } from '../ui/CustomSelect';
import { ToggleSwitch } from '../ui/ToggleSwitch';

export const AnalyticsReportsPage: React.FC = () => {
  const {
    workspace,
    nowMs,
    crewWorkloads,
    updateAutoReportSettings,
    generateMonthlyReportNow,
    triggerToast,
  } = useWorkspace();

  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const activeReport = useMemo(() => {
    if (!workspace || workspace.monthlyReports.length === 0) return null;
    return (
      workspace.monthlyReports.find((r) => r.id === selectedReportId) ||
      workspace.monthlyReports[0]
    );
  }, [workspace, selectedReportId]);

  if (!workspace) return null;

  // Focused operational metrics (no vanity KPIs)
  const totalProjectHrs = workspace.workItems
    .filter((i) => i.category === 'project')
    .reduce((a, b) => a + b.estimatedHours, 0);
  const totalRoutineHrs = workspace.workItems
    .filter((i) => i.category === 'routine')
    .reduce((a, b) => a + b.estimatedHours, 0);
  const totalFlexHrs = workspace.workItems
    .filter((i) => i.category === 'flexible')
    .reduce((a, b) => a + b.estimatedHours, 0);
  const grandTotalHrs = Math.max(1, totalProjectHrs + totalRoutineHrs + totalFlexHrs);

  const accuracyItems = workspace.workItems
    .filter((i) => i.loggedSeconds > 0)
    .slice(0, 7)
    .map((item) => {
      const actualHrs = Number(
        (getLiveLoggedSeconds(item, workspace.activeTimers, nowMs) / 3600).toFixed(1)
      );
      return {
        code: item.code,
        title: item.title,
        estimated: item.estimatedHours,
        actual: actualHrs,
        ratioPct: Math.round((actualHrs / Math.max(0.5, item.estimatedHours)) * 100),
      };
    });

  const maxWeeklyHrs = Math.max(
    ...workspace.weeklyHistory.map((w) => Math.max(w.plannedHours, w.trackedHours)),
    180
  );

  const handleGenerateNow = async () => {
    setGenerating(true);
    try {
      await generateMonthlyReportNow('2026-11');
      setSelectedReportId('');
      triggerToast(
        'Laporan Bulanan Diperbarui',
        'Snapshot laporan bulan November 2026 telah dibuat dan siap diekspor.',
        'success'
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="px-3 py-3.5 sm:px-4 sm:py-4 space-y-4 sm:space-y-5 w-full ui-stagger">
      {/* Row 1: Weekly Productivity & Real-Time Resource Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Weekly Productivity Chart */}
        <section className="lg:col-span-7 rounded-2xl border border-black/[0.12] bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-[#1C1D21]">
              Produktivitas Mingguan
            </h2>
            <div className="flex items-center gap-3 text-[11.5px] text-[#525660]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#D6D4FF]" />
                Rencana
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#ee2e65]" />
                Terlacak
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-48 pt-4">
            {workspace.weeklyHistory.map((pt) => {
              const planH = Math.round((pt.plannedHours / maxWeeklyHrs) * 100);
              const actH = Math.round((pt.trackedHours / maxWeeklyHrs) * 100);
              return (
                <div key={pt.weekLabel} className="flex flex-col items-center h-full justify-end">
                  <div className="text-[10.5px] font-mono tabular-nums text-[#1C1D21] font-semibold">
                    {pt.trackedHours}j
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-[#6E717A] mb-1">
                    {pt.completedProjects + pt.completedNonProject} sls
                  </div>
                  <div className="w-full max-w-[44px] flex items-end justify-center gap-1 h-28">
                    <div
                      style={{ height: `${planH}%` }}
                      className="w-1/2 rounded-t-md bg-[#D6D4FF]"
                      title={`Rencana: ${pt.plannedHours} jam`}
                    />
                    <div
                      style={{ height: `${actH}%` }}
                      className="w-1/2 rounded-t-md bg-[#ee2e65]"
                      title={`Terlacak: ${pt.trackedHours} jam`}
                    />
                  </div>
                  <div className="mt-2 text-[10.5px] text-[#6E717A] text-center truncate w-full">
                    {pt.weekLabel.replace('Minggu ', 'M')}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Real-Time Work Category Allocation & Estimate Accuracy */}
        <section className="lg:col-span-5 rounded-2xl border border-black/[0.12] bg-white p-5 space-y-4">
          <h2 className="text-[15px] font-bold text-[#1C1D21]">
            Proporsi Sumber Daya
          </h2>

          {/* Segmented horizontal bar */}
          <div className="h-4 w-full rounded-full overflow-hidden flex bg-[#F4F5F8]">
            <div
              style={{ width: `${(totalProjectHrs / grandTotalHrs) * 100}%` }}
              className="h-full bg-[#ee2e65]"
            />
            <div
              style={{ width: `${(totalRoutineHrs / grandTotalHrs) * 100}%` }}
              className="h-full bg-[#10B981]"
            />
            <div
              style={{ width: `${(totalFlexHrs / grandTotalHrs) * 100}%` }}
              className="h-full bg-[#F59E0B]"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-[#FEF1F5] border border-[#FBC2D4]/70">
              <div className="text-[11px] font-semibold text-[#9D113C]">Project</div>
              <div className="text-[17px] font-bold font-mono tabular-nums text-[#1C1D21] mt-0.5">
                {Math.round((totalProjectHrs / grandTotalHrs) * 100)}%
              </div>
              <div className="text-[11px] font-mono tabular-nums text-[#6E717A]">
                {totalProjectHrs} jam
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#E6F9F0] border border-[#A3E4C6]/70">
              <div className="text-[11px] font-semibold text-[#146C43]">Tugas Rutin</div>
              <div className="text-[17px] font-bold font-mono tabular-nums text-[#1C1D21] mt-0.5">
                {Math.round((totalRoutineHrs / grandTotalHrs) * 100)}%
              </div>
              <div className="text-[11px] font-mono tabular-nums text-[#6E717A]">
                {totalRoutineHrs} jam
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#FFF5E6] border border-[#FAD7A0]/70">
              <div className="text-[11px] font-semibold text-[#8C5811]">Fleksibel</div>
              <div className="text-[17px] font-bold font-mono tabular-nums text-[#1C1D21] mt-0.5">
                {Math.round((totalFlexHrs / grandTotalHrs) * 100)}%
              </div>
              <div className="text-[11px] font-mono tabular-nums text-[#6E717A]">
                {totalFlexHrs} jam
              </div>
            </div>
          </div>

          {/* Estimation vs Actual Comparison */}
          <div className="pt-2 border-t border-black/[0.07]">
            <div className="text-[12px] font-bold text-[#1C1D21] mb-2">
              Realisasi Estimasi vs Aktual Terlacak
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {accuracyItems.map((row) => (
                <div
                  key={row.code}
                  className="flex items-center justify-between gap-2 text-[12px]"
                >
                  <span className="truncate text-[#525660]">
                    <strong className="font-mono text-[#1C1D21]">{row.code}</strong> · {row.title}
                  </span>
                  <span className="font-mono tabular-nums text-[#1C1D21] shrink-0">
                    {row.actual}j / {row.estimated}j ({row.ratioPct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: Automatic End-of-Month Reporting System */}
      <section className="rounded-2xl border border-black/[0.12] bg-white p-4 sm:p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.07]">
          <h2 className="text-[15px] font-bold text-[#1C1D21]">
            Laporan Otomatis Akhir Bulan
          </h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerateNow()}
              className={`${ACTION_BTN_PRIMARY} w-full sm:w-auto`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Menyusun...' : 'Buat Laporan November'}
            </button>
          </div>
        </div>

        {/* Auto Schedule Config Row (UI-KIT ToggleSwitch + CustomSelect) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-[#FAFBFD] border border-black/[0.10] items-center">
          <div className="flex items-center justify-between md:justify-start gap-3">
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#1C1D21]">
              <CalendarClock className="w-4 h-4 text-[#ee2e65]" />
              Jadwal Otomatis
            </span>
            <ToggleSwitch
              checked={workspace.autoReportSettings.enabled}
              onChange={(checked) => void updateAutoReportSettings({ enabled: checked })}
              size="sm"
              color="emerald"
              onLabel="ON"
              offLabel="OFF"
              ariaLabel="Aktifkan jadwal laporan otomatis akhir bulan"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#646772] mb-1">Tanggal Eksekusi</label>
            <CustomSelect
              value={workspace.autoReportSettings.dayOfMonth}
              onChange={(val) =>
                void updateAutoReportSettings({
                  dayOfMonth: val as 'last_day' | '28' | '1',
                })
              }
              ariaLabel="Tanggal Eksekusi Laporan"
              size="sm"
              className="w-full"
              options={[
                { value: 'last_day', label: 'Hari Terakhir Bulan (Otomatis)' },
                { value: '28', label: 'Setiap Tanggal 28' },
                { value: '1', label: 'Tanggal 1 Bulan Berikutnya' },
              ]}
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#6E717A] mb-0.5">Waktu Kirim</label>
            <input
              type="time"
              value={workspace.autoReportSettings.runTime}
              onChange={(e) => void updateAutoReportSettings({ runTime: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.10] bg-white text-[12.5px] font-mono text-[#1C1D21]"
            />
          </div>

          <div className="text-[11.5px] text-[#525660]">
            <div className="inline-flex items-center gap-1 font-semibold text-[#146C43]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Arsip terakhir siap
            </div>
            <div className="text-[#6E717A] mt-0.5">
              {new Date(workspace.autoReportSettings.lastRunAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Report Selector & Export Buttons */}
        {activeReport && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {workspace.monthlyReports.map((rep) => (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedReportId(rep.id)}
                    className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors cursor-pointer ${
                      activeReport.id === rep.id
                        ? 'bg-[#1C1D21] text-white border-[#1C1D21]'
                        : 'bg-white text-[#1C1D21] border-black/[0.10] hover:bg-[#FAFBFD]'
                    }`}
                  >
                    {rep.monthLabel}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    exportMonthlyReportPdf(activeReport);
                    triggerToast('PDF Diunduh', `Laporan ${activeReport.monthLabel} diekspor ke PDF.`, 'success');
                  }}
                  className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
                >
                  <FileText className="w-3.5 h-3.5 text-[#ee2e65]" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportMonthlyReportExcel(activeReport);
                    triggerToast('Excel Diunduh', `Laporan ${activeReport.monthLabel} diekspor ke .xlsx.`, 'success');
                  }}
                  className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#10B981]" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportMonthlyReportCsv(activeReport);
                    triggerToast('CSV Diunduh', `Laporan ${activeReport.monthLabel} diekspor ke CSV.`, 'success');
                  }}
                  className={`${ACTION_BTN_SECONDARY} w-full sm:w-auto`}
                >
                  <Download className="w-3.5 h-3.5 text-[#3F3B99]" />
                  CSV
                </button>
              </div>
            </div>

            {/* Unified 4-Column Pastel KPI Strip matching ServoLution-app & gmsmodul/UI-KIT */}
            <div className="kpi-container grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-black/[0.08] border border-black/[0.12] rounded-2xl overflow-hidden bg-white">
              <div className="p-4 sm:p-5 bg-[#E6F9F0]/80 text-left">
                <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[#146C43]">
                  <span>Ketepatan Tenggat</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-2">
                  <span className="kpi-value text-[26px] font-bold text-[#1C1D21] tabular-nums">
                    {activeReport.onTimeRate}%
                  </span>
                  <span className="text-[11.5px] font-semibold text-[#146C43] tabular-nums">
                    {activeReport.overloadIncidents} overload
                  </span>
                </div>
                <p className="text-[11.5px] text-[#35684E] mt-1 tabular-nums">
                  Periode {activeReport.monthLabel}
                </p>
              </div>

              <div className="p-4 sm:p-5 bg-[#FEF1F5]/80 text-left border-l border-black/[0.08] sm:border-l-0">
                <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[#9D113C]">
                  <span>Project Selesai</span>
                  <Clapperboard className="w-3.5 h-3.5 text-[#ee2e65] shrink-0" />
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-2">
                  <span className="kpi-value text-[26px] font-bold text-[#1C1D21] tabular-nums">
                    {activeReport.totalProjectsCompleted}
                  </span>
                  <span className="text-[11.5px] font-semibold text-[#9D113C] tabular-nums">
                    Project
                  </span>
                </div>
                <p className="text-[11.5px] text-[#7D3A51] mt-1">
                  Shooting, Editing & Installasi
                </p>
              </div>

              <div className="p-4 sm:p-5 bg-[#F0EFFC]/80 text-left">
                <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[#3F3B99]">
                  <span>Jam Terlacak</span>
                  <Timer className="w-3.5 h-3.5 text-[#6C5DD3] shrink-0" />
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-2">
                  <span className="kpi-value text-[26px] font-bold text-[#1C1D21] tabular-nums">
                    {activeReport.totalTrackedHours}j
                  </span>
                  <span className="text-[11.5px] font-semibold text-[#3F3B99] tabular-nums">
                    Est {activeReport.totalEstimatedHours}j
                  </span>
                </div>
                <p className="text-[11.5px] text-[#5854A8] mt-1 tabular-nums">
                  Akurasi {Math.round((activeReport.totalTrackedHours / Math.max(1, activeReport.totalEstimatedHours)) * 100)}% dari rencana
                </p>
              </div>

              <div className="p-4 sm:p-5 bg-[#FFF5E6]/80 text-left border-l border-black/[0.08] sm:border-l-0">
                <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[#8C5811]">
                  <span>Tugas Mandiri Selesai</span>
                  <ListChecks className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-2">
                  <span className="kpi-value text-[26px] font-bold text-[#1C1D21] tabular-nums">
                    {activeReport.totalRoutineCompleted + activeReport.totalFlexibleCompleted}
                  </span>
                  <span className="text-[11.5px] font-semibold text-[#8C5811] tabular-nums">
                    Tugas
                  </span>
                </div>
                <p className="text-[11.5px] text-[#7A592A] mt-1 tabular-nums">
                  {activeReport.totalRoutineCompleted} rutin · {activeReport.totalFlexibleCompleted} fleksibel
                </p>
              </div>
            </div>

            {/* Crew Performance: Mobile Cards + Desktop Table */}
            <div className="md:hidden rounded-xl border border-black/[0.07] divide-y divide-black/[0.06] overflow-hidden">
              {activeReport.crewBreakdown.map((row) => {
                const liveWl = crewWorkloads.find((w) => w.crew.id === row.crewId);
                return (
                  <div key={`mob-rep-${row.crewId}`} className="p-3.5 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#1C1D21] truncate">
                          {row.crewName}
                        </div>
                        <div className="text-[11px] text-[#6E717A] truncate">{row.role}</div>
                      </div>
                      <span
                        className={`font-mono tabular-nums text-[13px] font-bold shrink-0 ${
                          row.utilizationPct > 100
                            ? 'text-[#C11448]'
                            : liveWl?.isNearLimit
                              ? 'text-[#B45309]'
                              : 'text-[#146C43]'
                        }`}
                      >
                        {row.utilizationPct}%
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-center bg-[#FAFBFD] rounded-lg p-2 font-mono tabular-nums text-[11px]">
                      <div>
                        <div className="text-[10px] text-[#6E717A] font-sans">Project</div>
                        <div className="font-semibold text-[#1C1D21]">{row.projectHours}j</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#6E717A] font-sans">Rutin</div>
                        <div className="font-semibold text-[#1C1D21]">{row.routineHours}j</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#6E717A] font-sans">Fleksibel</div>
                        <div className="font-semibold text-[#1C1D21]">{row.flexibleHours}j</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#6E717A] font-sans">Selesai</div>
                        <div className="font-semibold text-[#1C1D21]">{row.completedCount}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto rounded-xl border border-black/[0.07]">
              <table className="w-full text-left border-collapse min-w-[660px] text-[12.5px]">
                <thead>
                  <tr className="bg-[#FAFBFD] border-b border-black/[0.07] text-[11.5px] text-[#6E717A]">
                    <th className="py-2.5 px-4">Anggota Kru</th>
                    <th className="py-2.5 px-3 text-right">Project (Jam)</th>
                    <th className="py-2.5 px-3 text-right">Rutin (Jam)</th>
                    <th className="py-2.5 px-3 text-right">Fleksibel (Jam)</th>
                    <th className="py-2.5 px-3 text-right">Item Selesai</th>
                    <th className="py-2.5 px-4 text-right">Utilisasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {activeReport.crewBreakdown.map((row) => {
                    const liveWl = crewWorkloads.find((w) => w.crew.id === row.crewId);
                    return (
                      <tr key={row.crewId} className="hover:bg-[#FAFBFD]">
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-[#1C1D21]">{row.crewName}</div>
                          <div className="text-[11px] text-[#6E717A]">{row.role}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.projectHours}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.routineHours}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.flexibleHours}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {row.completedCount}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono tabular-nums font-bold ${
                            row.utilizationPct > 100
                              ? 'text-[#C11448]'
                              : liveWl?.isNearLimit
                                ? 'text-[#B45309]'
                                : 'text-[#146C43]'
                          }`}
                        >
                          {row.utilizationPct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
