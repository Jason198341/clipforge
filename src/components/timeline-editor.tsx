'use client';

import { useRef, useState, useCallback } from 'react';

interface TimelineEditorProps {
  startSec: number;
  endSec: number;
  totalDuration: number;
  onChange: (start: number, end: number) => void;
}

export default function TimelineEditor({ startSec, endSec, totalDuration, onChange }: TimelineEditorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const startPct = (startSec / totalDuration) * 100;
  const endPct = (endSec / totalDuration) * 100;

  const handleMouseDown = useCallback((handle: 'start' | 'end') => {
    setDragging(handle);

    const onMove = (e: MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const sec = (pct / 100) * totalDuration;

      if (handle === 'start') {
        onChange(Math.min(sec, endSec - 5), endSec); // min 5s clip
      } else {
        onChange(startSec, Math.max(sec, startSec + 5));
      }
    };

    const onUp = () => {
      setDragging(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [startSec, endSec, totalDuration, onChange]);

  const duration = endSec - startSec;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-muted">Timeline</h3>
        <span className="text-xs text-primary font-mono">{duration.toFixed(1)}s</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-10 bg-surface-hover rounded-lg cursor-crosshair"
      >
        {/* Selected range */}
        <div
          className="absolute top-0 h-full bg-primary/20 border-y border-primary/40"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {/* Start handle */}
        <div
          className={`absolute top-0 h-full w-3 bg-primary rounded-l cursor-col-resize hover:bg-primary-hover transition-colors ${dragging === 'start' ? 'bg-primary-hover' : ''}`}
          style={{ left: `${startPct}%` }}
          onMouseDown={() => handleMouseDown('start')}
        />

        {/* End handle */}
        <div
          className={`absolute top-0 h-full w-3 bg-primary rounded-r cursor-col-resize hover:bg-primary-hover transition-colors ${dragging === 'end' ? 'bg-primary-hover' : ''}`}
          style={{ left: `calc(${endPct}% - 12px)` }}
          onMouseDown={() => handleMouseDown('end')}
        />
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-1 text-[10px] text-text-muted font-mono">
        <span>{formatTime(startSec)}</span>
        <span>{formatTime(endSec)}</span>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
