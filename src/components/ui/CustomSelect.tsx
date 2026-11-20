import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Lock, Search, X } from 'lucide-react';
import { playUiMotionSound } from '../../utils/uiMotionSound';

export interface CustomSelectOption {
  value: string;
  label: string;
  meta?: string;
  disabled?: boolean;
  disabledReason?: string;
  onClearBlocker?: () => void;
  clearBlockerLabel?: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  size?: 'xs' | 'sm' | 'md';
  rounded?: 'lg' | 'xl' | 'full';
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  ariaLabel,
  size = 'md',
  rounded = 'lg',
  searchable,
  searchPlaceholder = 'Cari opsi...',
  emptyText = 'Tidak ada opsi yang cocok',
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const isSearchable = searchable ?? options.length >= 7;

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.meta && opt.meta.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(150, Math.min(300, openUp ? spaceAbove : spaceBelow));
    const width = Math.max(rect.width, 168);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);

    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.min(rect.left, maxLeft),
      width,
      maxHeight,
      openUp,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }

    if (isSearchable) {
      window.setTimeout(() => searchInputRef.current?.focus(), 30);
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const onScrollOrResize = () => updatePosition();

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, isSearchable, updatePosition]);

  const sizeCls =
    size === 'xs'
      ? 'h-8 px-2.5 text-xs gap-1.5'
      : size === 'sm'
        ? 'h-9 px-3 text-xs gap-2'
        : 'h-9 px-3 text-[12.5px] gap-2';

  const radiusCls =
    rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-lg';

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || selectedOption?.label || placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            playUiMotionSound(!prev ? 'pop' : 'tick');
            return !prev;
          });
        }}
        className={`inline-flex items-center justify-between w-full border transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer select-none focus:outline-none ${radiusCls} ${sizeCls} ${
          disabled
            ? 'bg-gray-100 dark:bg-[#1B1E24] border-gray-300 dark:border-white/10 text-gray-500 cursor-not-allowed'
            : open
              ? 'bg-white dark:bg-[#181B21] border-[#ee2e65] ring-2 ring-[#ee2e65]/15 text-[#1C1D21] dark:text-gray-100'
              : 'bg-white dark:bg-[#181B21] border-gray-300 dark:border-white/[0.14] hover:border-gray-400 dark:hover:border-white/25 text-gray-800 dark:text-gray-100'
        } font-medium ${triggerClassName}`}
      >
        <span className={`truncate ${!selectedOption ? 'text-gray-500' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
            open ? 'rotate-180 text-[#ee2e65]' : 'text-gray-500 dark:text-gray-400'
          }`}
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              minWidth: coords.width,
              maxHeight: coords.maxHeight,
              transform: coords.openUp ? 'translateY(-100%)' : undefined,
            }}
            className={`${
              coords.openUp ? 'animate-ui-pop-up' : 'animate-ui-pop'
            } flex flex-col bg-white/95 dark:bg-[#15181E]/95 backdrop-blur-sm rounded-xl border border-gray-300 dark:border-white/[0.14] shadow-[0_16px_38px_-10px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_42px_-10px_rgba(0,0,0,0.75)] z-[9999] overflow-hidden ${menuClassName}`}
          >
            {isSearchable && (
              <div className="p-1.5 border-b border-gray-200 dark:border-white/[0.08] bg-white/95 dark:bg-[#15181E] shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="w-full h-8 pl-8 pr-7 rounded-lg border border-gray-300 dark:border-white/[0.12] bg-gray-50/70 dark:bg-[#181B21] text-xs text-gray-800 dark:text-gray-100 placeholder:text-gray-500 focus:bg-white dark:focus:bg-[#1B1E24] focus:outline-none focus:border-[#ee2e65]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Hapus filter"
                      className="absolute right-1.5 p-1 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="p-1.5 overflow-y-auto space-y-0.5 flex-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-500">{emptyText}</div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  if (opt.disabled) {
                    const hasBlockerContext = Boolean(opt.disabledReason || opt.onClearBlocker);
                    if (hasBlockerContext) {
                      return (
                        <div
                          key={opt.value}
                          role="option"
                          aria-disabled="true"
                          aria-selected={false}
                          className="w-full px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-[#1B1E24] border border-gray-200/90 dark:border-white/10 flex items-start justify-between gap-2.5 text-xs"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="min-w-0 space-y-0.5">
                              <div className="font-semibold text-gray-700 dark:text-gray-300 truncate">
                                {opt.label}
                              </div>
                              {opt.disabledReason && (
                                <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug">
                                  {opt.disabledReason}
                                </div>
                              )}
                            </div>
                          </div>
                          {opt.onClearBlocker && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playUiMotionSound('success');
                                opt.onClearBlocker?.();
                              }}
                              className="px-2 py-1 rounded-md bg-white hover:bg-[#FEF1F5] text-[#C11448] border border-[#F895B5] text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150"
                            >
                              {opt.clearBlockerLabel || 'Buka blokir'}
                            </button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={false}
                        disabled
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 cursor-not-allowed flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{opt.label}</span>
                        {opt.meta && (
                          <span className="text-[10px] text-gray-500 shrink-0">{opt.meta}</span>
                        )}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        playUiMotionSound('tick');
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 transition-colors duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer ${
                        isSelected
                          ? 'bg-[#FEF1F5] dark:bg-[#ee2e65]/20 text-[#C11448] dark:text-[#fbc2d4]'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.06] hover:text-gray-950 dark:hover:text-white'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.meta && (
                          <span className="text-[10px] font-mono font-medium text-gray-500 dark:text-gray-400">
                            {opt.meta}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#ee2e65] shrink-0 animate-ui-check" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
