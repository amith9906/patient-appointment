import React from 'react';
import { useLoading } from '../context/LoadingContext';

export default function GlobalLoader() {
  const { isLoading, requestCount } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/25 backdrop-blur-[2px] transition-all">
      {/* Top Animated Progress Line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-blue-100 overflow-hidden shadow-sm">
        <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-500 w-full animate-pulse" />
      </div>

      {/* Centered Loading Card */}
      <div className="flex flex-col items-center justify-center bg-slate-900/95 text-white px-7 py-5 rounded-2xl shadow-2xl border border-slate-700/80 max-w-xs text-center transform transition-all">
        <div className="relative mb-3 flex items-center justify-center">
          <svg
            className="animate-spin h-10 w-10 text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-20"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="absolute text-sm" aria-label="Hospital">🏥</span>
        </div>
        <div className="text-sm font-semibold tracking-wide text-slate-100">
          Loading... {requestCount > 1 ? `(${requestCount})` : ''}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 font-normal">
          Please wait while processing
        </div>
      </div>
    </div>
  );
}
