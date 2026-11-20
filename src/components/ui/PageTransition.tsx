import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { playUiMotionSound } from '../../utils/uiMotionSound';
import type { PageId } from '../../types';

// Exact gmsmodul/ServoLution-app navigation order:
// Desktop matches Sidebar top-to-bottom; Mobile matches bottom pill dock left-to-right + overflow
const DESKTOP_PAGE_ORDER: PageId[] = [
  'overview',
  'project_manager',
  'intake',
  'approval_video',
  'kanban_video',
  'handover_video',
  'approval_tech',
  'kanban_tech',
  'handover_tech',
  'gantt',
  'tasks',
  'calendar',
  'workload',
  'analytics',
];

const MOBILE_PAGE_ORDER: PageId[] = [
  'overview',
  'kanban_video',
  'kanban_tech',
  'calendar',
  'project_manager',
  'intake',
  'approval_video',
  'handover_video',
  'approval_tech',
  'handover_tech',
  'gantt',
  'tasks',
  'workload',
  'analytics',
];

export function getPageDirection(
  prevPage: PageId,
  activePage: PageId,
  isMobile = false
): 1 | -1 {
  const order = isMobile ? MOBILE_PAGE_ORDER : DESKTOP_PAGE_ORDER;
  const prevIdx = order.indexOf(prevPage);
  const nextIdx = order.indexOf(activePage);
  if (prevIdx === -1 || nextIdx === -1 || prevIdx === nextIdx) return 1;
  return nextIdx > prevIdx ? 1 : -1;
}

interface PageTransitionProps {
  activePage: PageId;
  prevPage: PageId;
  className?: string;
  children: React.ReactNode;
}

interface TransitionCustom {
  direction: 1 | -1;
  isMobile: boolean;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// Exact gmsmodul/ServoLution-app page transition physics:
// Mobile: horizontal slide (24px), scale 0.95, blur 4px, spring 420/28/0.8
// Desktop: vertical slide (14px), scale 0.95, blur 4px, spring 420/28/0.8
const pageVariants = {
  enter: ({ direction, isMobile }: TransitionCustom) =>
    isMobile
      ? {
          opacity: 0,
          x: direction * 24,
          y: 0,
          scale: 0.95,
          filter: 'blur(4px)',
        }
      : {
          opacity: 0,
          x: 0,
          y: direction * 14,
          scale: 0.95,
          filter: 'blur(4px)',
        },
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      x: { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.8 },
      y: { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.8 },
      scale: { type: 'spring' as const, stiffness: 420, damping: 26, mass: 0.8 },
      opacity: { duration: 0.18, ease: EASE_OUT },
      filter: { duration: 0.2, ease: EASE_OUT },
    },
  },
  exit: ({ direction, isMobile }: TransitionCustom) =>
    isMobile
      ? {
          opacity: 0,
          x: direction * -18,
          y: 0,
          scale: 0.95,
          filter: 'blur(4px)',
          pointerEvents: 'none' as const,
          transition: {
            x: { duration: 0.18, ease: EASE_OUT },
            scale: { duration: 0.18, ease: EASE_OUT },
            opacity: { duration: 0.15, ease: EASE_OUT },
            filter: { duration: 0.15, ease: EASE_OUT },
          },
        }
      : {
          opacity: 0,
          x: 0,
          y: direction * -10,
          scale: 0.95,
          filter: 'blur(4px)',
          pointerEvents: 'none' as const,
          transition: {
            y: { duration: 0.18, ease: EASE_OUT },
            scale: { duration: 0.18, ease: EASE_OUT },
            opacity: { duration: 0.15, ease: EASE_OUT },
            filter: { duration: 0.15, ease: EASE_OUT },
          },
        },
};

export const PageTransition: React.FC<PageTransitionProps> = ({
  activePage,
  prevPage,
  className = 'flex-1 min-h-0 flex flex-col w-full',
  children,
}) => {
  const isMobile = useIsMobile();
  const direction = getPageDirection(prevPage, activePage, isMobile);
  const prevKeyRef = useRef<PageId>(activePage);

  useEffect(() => {
    if (isMobile && typeof window !== 'undefined' && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [activePage, isMobile]);

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={{ direction, isMobile }}>
      <motion.div
        key={activePage}
        custom={{ direction, isMobile }}
        variants={pageVariants}
        initial="enter"
        animate="center"
        exit="exit"
        onAnimationComplete={(definition) => {
          if (definition === 'center' && prevKeyRef.current !== activePage) {
            prevKeyRef.current = activePage;
            playUiMotionSound('land', true);
          }
        }}
        style={{ willChange: 'transform, opacity, filter' }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
