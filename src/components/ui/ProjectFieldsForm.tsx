import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, Clock, HelpCircle } from 'lucide-react';
import type { ProjectDiscipline } from '../../types';
import { formatDisplayDate } from '../../utils/formatters';
import { ToggleSwitch } from './ToggleSwitch';
import { playUiMotionSound } from '../../utils/uiMotionSound';

export interface ProjectFieldsValue {
  title: string;
  requestNo: string;
  coordinatorDepartment: string;
  clientName: string;
  clientPhone: string;
  receivedDate: string;
  requiredDate: string;
  shootingDate: string;
  shootingStartTime: string;
  shootingEndTime: string;
  calendarCoordination: boolean;
  discipline: ProjectDiscipline;
  changeNotes: string;
}

interface ProjectFieldsFormProps {
  value: ProjectFieldsValue;
  onChange: (patch: Partial<ProjectFieldsValue>) => void;
  titleError?: boolean;
  showRoutingHint?: boolean;
  compact?: boolean;
  lockWorkType?: boolean;
}

const WORK_TYPES: ProjectDiscipline[] = ['Shooting', 'Editing', 'Installasi'];

const INPUT_BASE =
  'w-full h-11 px-3.5 rounded-xl border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[13.5px] text-[#1C1D21] dark:text-gray-100 placeholder:text-[#8E93A0] dark:placeholder:text-gray-500 focus:outline-none focus:border-[#0F172A] dark:focus:border-white/40 focus:ring-2 focus:ring-black/[0.05] dark:focus:ring-white/[0.06] transition-all';

const LABEL_BASE =
  'block text-[12.5px] font-medium text-[#4B505C] dark:text-gray-300 mb-1.5';

interface PickerInputProps {
  type: 'date' | 'time';
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  ariaLabel: string;
}

const NativeFormattedPicker: React.FC<PickerInputProps> = ({
  type,
  value,
  onChange,
  placeholder,
  ariaLabel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const display =
    type === 'date' ? (value ? formatDisplayDate(value) : '') : value;

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    try {
      if (typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
        (el as HTMLInputElement & { showPicker: () => void }).showPicker();
      }
    } catch {
      // Fallback: focus/native click handles it
    }
  };

  return (
    <div
      onClick={openPicker}
      className="relative h-11 w-full rounded-xl border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#14171D] hover:border-black/[0.18] dark:hover:border-white/[0.22] focus-within:border-[#0F172A] dark:focus-within:border-white/40 focus-within:ring-2 focus-within:ring-black/[0.05] dark:focus-within:ring-white/[0.06] transition-all flex items-center justify-between px-3.5 cursor-pointer"
    >
      <span
        className={`text-[13.5px] select-none truncate ${
          display
            ? 'text-[#1C1D21] dark:text-gray-100 font-medium'
            : 'text-[#646772] dark:text-gray-400'
        }`}
      >
        {display || placeholder}
      </span>
      {type === 'date' ? (
        <Calendar className="w-4 h-4 text-[#525660] dark:text-gray-400 shrink-0 pointer-events-none" />
      ) : (
        <Clock className="w-4 h-4 text-[#525660] dark:text-gray-400 shrink-0 pointer-events-none" />
      )}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
};

export const ProjectFieldsForm: React.FC<ProjectFieldsFormProps> = ({
  value,
  onChange,
  titleError = false,
  showRoutingHint = true,
  compact = false,
  lockWorkType = false,
}) => {
  const [showCoordInfo, setShowCoordInfo] = useState(false);
  const isShooting = value.discipline === 'Shooting';
  const spaceY = compact ? 'space-y-3.5' : 'space-y-4';

  return (
    <div className={spaceY}>
      {/* 1. Work type * (Top Segmented Tab Bar) */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <label className="block text-[12.5px] font-medium text-[#4B505C] dark:text-gray-300">
            Work type <span className="text-[#ee2e65]">*</span>
          </label>
          {showRoutingHint && (
            <span className="text-[11px] font-medium text-[#646772] dark:text-gray-400">
              → {value.discipline === 'Installasi' ? 'Technical Support Manager' : 'Video Production Manager'}
            </span>
          )}
        </div>
        <div
          role="tablist"
          aria-label="Work type"
          className="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-[#181B22] border border-gray-300 dark:border-white/[0.12] rounded-xl"
        >
          {WORK_TYPES.map((wt) => {
            const active = value.discipline === wt;
            return (
              <button
                key={wt}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={lockWorkType}
                onClick={() => {
                  if (lockWorkType) return;
                  playUiMotionSound('tick');
                  if (wt !== 'Shooting') {
                    onChange({
                      discipline: wt,
                      shootingDate: '',
                      shootingStartTime: '',
                      shootingEndTime: '',
                    });
                  } else {
                    onChange({ discipline: wt });
                  }
                }}
                className={`py-2 px-3 rounded-lg text-[12.5px] sm:text-[13px] transition-all duration-150 ${
                  lockWorkType ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                } ${
                  active
                    ? 'bg-white dark:bg-[#262B36] text-[#1C1D21] dark:text-white font-semibold shadow-2xs'
                    : 'text-[#646772] dark:text-gray-400 hover:text-[#1C1D21] dark:hover:text-gray-200 font-medium'
                }`}
              >
                {wt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Project title */}
      <div>
        <label className={LABEL_BASE}>Project title</label>
        <input
          type="text"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Example: TV Commercial"
          className={`${INPUT_BASE} ${
            titleError
              ? '!border-[#ee2e65] ring-2 ring-[#ee2e65]/12'
              : ''
          }`}
        />
      </div>

      {/* 2. No Request | Coordinator department */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className={LABEL_BASE}>No Request</label>
          <input
            type="text"
            value={value.requestNo}
            onChange={(e) => onChange({ requestNo: e.target.value })}
            placeholder="REQ-001"
            className={INPUT_BASE}
          />
        </div>
        <div>
          <label className={LABEL_BASE}>Coordinator department</label>
          <input
            type="text"
            value={value.coordinatorDepartment}
            onChange={(e) => onChange({ coordinatorDepartment: e.target.value })}
            placeholder="Marketing"
            className={INPUT_BASE}
          />
        </div>
      </div>

      {/* 3. Client | Phone number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className={LABEL_BASE}>Client</label>
          <input
            type="text"
            value={value.clientName}
            onChange={(e) => onChange({ clientName: e.target.value })}
            placeholder="Client name"
            className={INPUT_BASE}
          />
        </div>
        <div>
          <label className={LABEL_BASE}>Phone number</label>
          <input
            type="tel"
            value={value.clientPhone}
            onChange={(e) => onChange({ clientPhone: e.target.value })}
            placeholder="081234567890"
            className={INPUT_BASE}
          />
        </div>
      </div>

      {/* 4. Received date | Required date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className={LABEL_BASE}>Received date</label>
          <NativeFormattedPicker
            type="date"
            value={value.receivedDate}
            onChange={(receivedDate) => onChange({ receivedDate })}
            placeholder="Select date"
            ariaLabel="Received date"
          />
        </div>
        <div>
          <label className={LABEL_BASE}>Required date</label>
          <NativeFormattedPicker
            type="date"
            value={value.requiredDate}
            onChange={(requiredDate) => onChange({ requiredDate })}
            placeholder="Select date"
            ariaLabel="Required date"
          />
        </div>
      </div>

      {/* 5. Conditional Shooting Schedule (Shooting ONLY) */}
      <AnimatePresence initial={false}>
        {isShooting && (
          <motion.div
            key="shooting-schedule-fields"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3.5 pt-0.5">
              <div>
                <label className={LABEL_BASE}>Shooting date</label>
                <NativeFormattedPicker
                  type="date"
                  value={value.shootingDate}
                  onChange={(shootingDate) => onChange({ shootingDate })}
                  placeholder="Select date"
                  ariaLabel="Shooting date"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={LABEL_BASE}>Shooting start time</label>
                  <NativeFormattedPicker
                    type="time"
                    value={value.shootingStartTime}
                    onChange={(shootingStartTime) => onChange({ shootingStartTime })}
                    placeholder="Select time"
                    ariaLabel="Shooting start time"
                  />
                </div>
                <div>
                  <label className={LABEL_BASE}>Shooting end time</label>
                  <NativeFormattedPicker
                    type="time"
                    value={value.shootingEndTime}
                    onChange={(shootingEndTime) => onChange({ shootingEndTime })}
                    placeholder="Select time"
                    ariaLabel="Shooting end time"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Calendar Coordination */}
      <div className="rounded-xl border border-black/[0.09] dark:border-white/[0.11] bg-white dark:bg-[#14171D] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13.5px] font-medium text-[#1C1D21] dark:text-gray-100">
              Calendar Coordination
            </span>
            <button
              type="button"
              onClick={() => setShowCoordInfo((prev) => !prev)}
              aria-label="Info Calendar Coordination"
              className="text-[#8E93A0] hover:text-[#1C1D21] dark:hover:text-gray-200 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          <ToggleSwitch
            checked={value.calendarCoordination}
            onChange={(calendarCoordination) => onChange({ calendarCoordination })}
            color="dark"
            size="md"
            ariaLabel="Calendar Coordination"
          />
        </div>
        {showCoordInfo && (
          <p className="mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] text-[11.5px] text-[#646772] dark:text-gray-400 leading-relaxed">
            Aktifkan untuk menampilkan jadwal project ini pada Kalender Produksi terpadu dan menyertakannya dalam ekspor jadwal tim (.ICS).
          </p>
        )}
      </div>

      {/* 7. Change notes (optional) */}
      <div>
        <label className={LABEL_BASE}>Change notes (optional)</label>
        <textarea
          rows={3}
          value={value.changeNotes}
          onChange={(e) => onChange({ changeNotes: e.target.value })}
          placeholder="Example: Air date revised at the client's request..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#14171D] text-[13.5px] text-[#1C1D21] dark:text-gray-100 placeholder:text-[#8E93A0] dark:placeholder:text-gray-500 focus:outline-none focus:border-[#0F172A] dark:focus:border-white/40 focus:ring-2 focus:ring-black/[0.05] dark:focus:ring-white/[0.06] transition-all resize-y"
        />
      </div>
    </div>
  );
};
