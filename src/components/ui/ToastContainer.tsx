import React from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const ToastContainer: React.FC = () => {
  const { toasts } = useWorkspace();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-5 inset-x-3 sm:inset-x-auto sm:right-4 z-[9999] space-y-2 flex flex-col items-end pointer-events-none no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto w-full sm:w-auto sm:max-w-[360px] sm:min-w-[260px] bg-[#1C1D21]/95 dark:bg-[#1B1E24]/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-[0_18px_40px_-10px_rgba(15,23,42,0.35)] dark:shadow-[0_20px_48px_-10px_rgba(0,0,0,0.75)] border border-white/10 dark:border-white/[0.14] flex items-center gap-3 text-[12.5px] animate-ui-toast"
        >
          {t.type === 'error' ? (
            <XCircle className="w-4 h-4 text-[#EF4444] shrink-0 animate-ui-check" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 animate-ui-check" />
          ) : t.type === 'info' ? (
            <Info className="w-4 h-4 text-[#ee2e65] shrink-0 animate-ui-check" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 animate-ui-check" />
          )}
          <div className="min-w-0">
            <div className="font-semibold leading-snug">{t.title}</div>
            <div className="text-white/75 text-[11.5px] mt-0.5 leading-snug">{t.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
