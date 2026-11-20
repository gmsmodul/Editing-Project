import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { playUiMotionSound } from '../../utils/uiMotionSound';

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
  accent?: 'rose' | 'sky';
  pageSizeOptions?: readonly number[];
  className?: string;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'item',
  accent = 'rose',
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItemNum = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItemNum = Math.min(safePage * pageSize, totalItems);

  const visiblePageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  }, [safePage, totalPages]);

  const activeBtnClass =
    accent === 'sky'
      ? 'bg-[#0284C7] text-white shadow-xs'
      : 'bg-[#ee2e65] text-white shadow-xs';

  const hoverBtnClass =
    accent === 'sky'
      ? 'hover:border-[#0284C7] hover:text-[#0284C7]'
      : 'hover:border-[#ee2e65] hover:text-[#ee2e65]';

  return (
    <div
      className={`px-4 sm:px-5 py-3 border-t border-black/[0.08] dark:border-white/[0.08] bg-[#FAFBFD]/70 dark:bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[12px] text-[#6E717A] dark:text-gray-400">
        <span className="tabular-nums">
          Menampilkan{' '}
          <strong className="text-[#1C1D21] dark:text-gray-100">{startItemNum}</strong>–
          <strong className="text-[#1C1D21] dark:text-gray-100">{endItemNum}</strong> dari{' '}
          <strong className="text-[#1C1D21] dark:text-gray-100">{totalItems}</strong> {itemLabel}
        </span>

        <label className="inline-flex items-center gap-1.5 text-[11.5px]">
          <span>Per halaman:</span>
          <select
            value={pageSize}
            aria-label={`Jumlah ${itemLabel} per halaman`}
            onChange={(e) => {
              playUiMotionSound('tick');
              onPageSizeChange(Number(e.target.value));
            }}
            className="h-7 px-2 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-white dark:bg-[#1B1E24] text-[#1C1D21] dark:text-gray-100 text-[11.5px] font-medium font-mono tabular-nums outline-none cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => {
            playUiMotionSound('tick');
            onPageChange(Math.max(1, safePage - 1));
          }}
          aria-label="Halaman sebelumnya"
          className={`h-8 px-2.5 rounded-lg border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#1B1E24] ${hoverBtnClass} disabled:opacity-40 disabled:hover:border-black/[0.10] disabled:hover:text-[#525660] text-[12px] font-medium text-[#525660] dark:text-gray-200 inline-flex items-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {visiblePageNumbers[0] > 1 && (
          <>
            <button
              type="button"
              onClick={() => {
                playUiMotionSound('tick');
                onPageChange(1);
              }}
              className={`min-w-[32px] h-8 px-2 rounded-lg text-[12px] font-semibold tabular-nums transition-colors cursor-pointer border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#1B1E24] text-[#525660] dark:text-gray-200 ${hoverBtnClass}`}
            >
              1
            </button>
            {visiblePageNumbers[0] > 2 && (
              <span className="px-1 text-[11.5px] text-[#8A8D98] select-none">…</span>
            )}
          </>
        )}

        {visiblePageNumbers.map((pageNum) => {
          const active = pageNum === safePage;
          return (
            <button
              key={pageNum}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                playUiMotionSound('tick');
                onPageChange(pageNum);
              }}
              className={`min-w-[32px] h-8 px-2 rounded-lg text-[12px] font-semibold tabular-nums transition-colors cursor-pointer ${
                active
                  ? activeBtnClass
                  : `border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#1B1E24] text-[#525660] dark:text-gray-200 ${hoverBtnClass}`
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        {visiblePageNumbers[visiblePageNumbers.length - 1] < totalPages && (
          <>
            {visiblePageNumbers[visiblePageNumbers.length - 1] < totalPages - 1 && (
              <span className="px-1 text-[11.5px] text-[#8A8D98] select-none">…</span>
            )}
            <button
              type="button"
              onClick={() => {
                playUiMotionSound('tick');
                onPageChange(totalPages);
              }}
              className={`min-w-[32px] h-8 px-2 rounded-lg text-[12px] font-semibold tabular-nums transition-colors cursor-pointer border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#1B1E24] text-[#525660] dark:text-gray-200 ${hoverBtnClass}`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => {
            playUiMotionSound('tick');
            onPageChange(Math.min(totalPages, safePage + 1));
          }}
          aria-label="Halaman berikutnya"
          className={`h-8 px-2.5 rounded-lg border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#1B1E24] ${hoverBtnClass} disabled:opacity-40 disabled:hover:border-black/[0.10] disabled:hover:text-[#525660] text-[12px] font-medium text-[#525660] dark:text-gray-200 inline-flex items-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed`}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
