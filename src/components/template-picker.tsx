'use client';

import { TEMPLATES } from '@/data/templates';
import type { Template } from '@/types/template';

interface TemplatePickerProps {
  selectedId: string;
  onSelect: (template: Template) => void;
}

export default function TemplatePicker({ selectedId, onSelect }: TemplatePickerProps) {
  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-text-muted mb-3">Template</h3>
      <div className="grid grid-cols-5 gap-2">
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={`p-3 rounded-lg border text-center transition-all ${
              selectedId === t.id
                ? 'border-primary bg-primary-dim'
                : 'border-border bg-surface hover:border-primary/30'
            }`}
          >
            <div className={`text-lg font-bold mb-1 ${
              selectedId === t.id ? 'text-primary' : 'text-text-muted'
            }`}>
              {t.preview}
            </div>
            <div className="text-xs font-medium">{t.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
