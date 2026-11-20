import React from 'react';
import { Check, Users } from 'lucide-react';
import type { CrewMember } from '../../types';
import type { CrewWorkloadSummary } from '../../utils/formatters';

interface MultiCrewPickerProps {
  crew: CrewMember[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  crewWorkloads: CrewWorkloadSummary[];
  estimatedHours?: number;
  disabled?: boolean;
  compact?: boolean;
  accent?: 'rose' | 'sky';
}

export const MultiCrewPicker: React.FC<MultiCrewPickerProps> = ({
  crew,
  selectedIds,
  onChange,
  crewWorkloads,
  estimatedHours,
  disabled = false,
  compact = false,
  accent = 'rose',
}) => {
  const safeSelected = selectedIds.length > 0 ? selectedIds : crew[0] ? [crew[0].id] : [];
  const perCrewHours =
    estimatedHours && estimatedHours > 0
      ? Number((estimatedHours / Math.max(1, safeSelected.length)).toFixed(1))
      : null;

  const toggleCrew = (crewId: string) => {
    if (disabled) return;
    if (safeSelected.includes(crewId)) {
      // Keep at least 1 crew member assigned
      if (safeSelected.length <= 1) return;
      onChange(safeSelected.filter((id) => id !== crewId));
    } else {
      onChange([...safeSelected, crewId]);
    }
  };

  const activeBorder =
    accent === 'sky'
      ? 'border-sky-400 bg-sky-50/75 dark:border-sky-500/70 dark:bg-sky-950/35'
      : 'border-rose-400 bg-rose-50/75 dark:border-rose-500/70 dark:bg-rose-950/30';

  const activeCheck =
    accent === 'sky'
      ? 'bg-sky-600 border-sky-600 text-white'
      : 'bg-rose-600 border-rose-600 text-white';

  const picBadge =
    accent === 'sky'
      ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300'
      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          {safeSelected.length} kru dipilih
          {safeSelected.length > 1 && (
            <span className="text-slate-400">· Kru pertama otomatis jadi PIC</span>
          )}
        </span>
        {perCrewHours !== null && safeSelected.length > 1 && (
          <span className="font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            ~{perCrewHours} jam / kru
          </span>
        )}
      </div>

      <div
        className={`grid gap-1.5 ${
          compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {crew.map((member) => {
          const isSelected = safeSelected.includes(member.id);
          const isPic = safeSelected[0] === member.id;
          const wl = crewWorkloads.find((w) => w.crew.id === member.id);
          const currentHours = wl?.totalActiveHours ?? 0;
          const maxHours = member.maxWeeklyHours;
          const isAlreadyOver = currentHours > maxHours;

          return (
            <button
              key={member.id}
              type="button"
              disabled={disabled}
              onClick={() => toggleCrew(member.id)}
              className={`group flex items-center gap-2.5 text-left rounded-xl border transition-all ${
                compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
              } ${
                isSelected
                  ? activeBorder
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
              } ${disabled ? 'opacity-65 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}`}
            >
              <span
                className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? activeCheck
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </span>

              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${member.avatarBg} ${member.avatarText}`}
              >
                {member.initials}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {member.name}
                  </span>
                  {isPic && safeSelected.length > 1 && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wide shrink-0 ${picBadge}`}
                    >
                      PIC
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                  <span className="truncate">{member.division}</span>
                  <span>·</span>
                  <span
                    className={`font-semibold shrink-0 ${
                      isAlreadyOver
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {currentHours}/{maxHours}j
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
