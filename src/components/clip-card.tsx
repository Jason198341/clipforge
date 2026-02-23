'use client';

import type { Clip } from '@/types/project';

interface ClipCardProps {
  clip: Clip;
  index: number;
  onSelect?: (clip: Clip) => void;
}

export default function ClipCard({ clip, index, onSelect }: ClipCardProps) {
  const duration = clip.endSec - clip.startSec;

  return (
    <div
      onClick={() => onSelect?.(clip)}
      className="bg-surface border border-border rounded-xl p-4 hover:border-primary/40 transition-colors cursor-pointer group"
    >
      {/* Header: index + score */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted font-mono">Clip {index + 1}</span>
        <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
          clip.viralScore >= 8
            ? 'bg-accent-dim text-accent'
            : clip.viralScore >= 6
            ? 'bg-primary-dim text-primary'
            : 'bg-surface-hover text-text-muted'
        }`}>
          {clip.viralScore}/10
        </div>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors line-clamp-2">
        {clip.title}
      </h3>

      {/* Description */}
      <p className="text-xs text-text-muted mb-3 line-clamp-2">
        {clip.description}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="font-mono">
          {formatTime(clip.startSec)} - {formatTime(clip.endSec)}
        </span>
        <span className="text-primary">{duration.toFixed(0)}s</span>
      </div>

      {/* Tags */}
      {clip.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {clip.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-surface-hover rounded text-[10px] text-text-muted">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Reason */}
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-[11px] text-text-muted italic line-clamp-2">
          {clip.reason}
        </p>
      </div>

      {/* Status badge */}
      <div className="mt-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          clip.status === 'rendered' ? 'bg-success/10 text-success' :
          clip.status === 'extracted' ? 'bg-primary-dim text-primary' :
          'bg-surface-hover text-text-muted'
        }`}>
          {clip.status}
        </span>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
