import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { playUiMotionSound } from '../../utils/uiMotionSound';

interface LazyLoadSentinelProps {
  remaining: number;
  batchSize?: number;
  onLoadMore: () => void;
  itemLabel?: string;
  autoLoad?: boolean;
  compact?: boolean;
}

export const LazyLoadSentinel: React.FC<LazyLoadSentinelProps> = ({
  remaining,
  batchSize = 10,
  onLoadMore,
  itemLabel = 'item',
  autoLoad = true,
  compact = false,
}) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!autoLoad || remaining <= 0) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: '180px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [autoLoad, remaining]);

  if (remaining <= 0) return null;

  const nextBatch = Math.min(batchSize, remaining);

  return (
    <div ref={sentinelRef} className={compact ? 'pt-1' : 'pt-2 flex justify-center'}>
      <button
        type="button"
        onClick={() => {
          playUiMotionSound('tick');
          onLoadMore();
        }}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.10] dark:border-white/[0.12] bg-white dark:bg-[#1B1E24] hover:border-[#ee2e65] hover:text-[#ee2e65] text-[#525660] dark:text-gray-200 font-medium transition-colors cursor-pointer ${
          compact ? 'w-full py-2 px-3 text-[11.5px]' : 'h-9 px-4 text-[12px]'
        }`}
      >
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        <span>
          Muat {nextBatch} {itemLabel} lagi ({remaining} tersisa)
        </span>
      </button>
    </div>
  );
};
