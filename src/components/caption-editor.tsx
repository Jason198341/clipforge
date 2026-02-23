'use client';

import type { CaptionEdit } from '@/types/project';

interface CaptionEditorProps {
  captions: CaptionEdit[];
  onChange: (index: number, text: string) => void;
}

export default function CaptionEditor({ captions, onChange }: CaptionEditorProps) {
  if (captions.length === 0) {
    return (
      <div className="text-sm text-text-muted p-4 bg-surface rounded-lg border border-border">
        No captions available. Captions will be auto-generated from transcript.
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-text-muted mb-3">Captions</h3>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {captions.map((caption, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-[10px] text-text-muted font-mono mt-2.5 shrink-0 w-16">
              {formatTime(caption.startSec)}
            </span>
            <input
              type="text"
              value={caption.text}
              onChange={e => onChange(i, e.target.value)}
              className="flex-1 px-3 py-1.5 bg-surface border border-border rounded text-sm focus:outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
