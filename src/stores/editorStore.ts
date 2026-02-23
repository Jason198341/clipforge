'use client';

import { create } from 'zustand';
import type { Clip, CaptionEdit } from '@/types/project';

interface EditorState {
  clip: Clip | null;
  projectId: string | null;
  isDirty: boolean;

  // Editable fields
  title: string;
  description: string;
  startSec: number;
  endSec: number;
  templateId: string;
  captions: CaptionEdit[];

  // Actions
  loadClip: (projectId: string, clip: Clip) => void;
  setTitle: (title: string) => void;
  setDescription: (desc: string) => void;
  setTimeRange: (start: number, end: number) => void;
  setTemplateId: (id: string) => void;
  updateCaption: (index: number, text: string) => void;
  setCaptions: (captions: CaptionEdit[]) => void;
  getUpdatedClip: () => Clip | null;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  clip: null,
  projectId: null,
  isDirty: false,
  title: '',
  description: '',
  startSec: 0,
  endSec: 0,
  templateId: 'sandpaper',
  captions: [],

  loadClip: (projectId, clip) => {
    set({
      clip,
      projectId,
      isDirty: false,
      title: clip.title,
      description: clip.description,
      startSec: clip.startSec,
      endSec: clip.endSec,
      templateId: clip.templateId,
      captions: clip.captionEdits || [],
    });
  },

  setTitle: (title) => set({ title, isDirty: true }),
  setDescription: (description) => set({ description, isDirty: true }),
  setTimeRange: (start, end) => set({ startSec: start, endSec: end, isDirty: true }),
  setTemplateId: (templateId) => set({ templateId, isDirty: true }),

  updateCaption: (index, text) => {
    const { captions } = get();
    const updated = captions.map((c, i) => i === index ? { ...c, text } : c);
    set({ captions: updated, isDirty: true });
  },

  setCaptions: (captions) => set({ captions, isDirty: true }),

  getUpdatedClip: () => {
    const state = get();
    if (!state.clip) return null;
    return {
      ...state.clip,
      title: state.title,
      description: state.description,
      startSec: state.startSec,
      endSec: state.endSec,
      templateId: state.templateId,
      captionEdits: state.captions,
    };
  },

  reset: () => set({
    clip: null,
    projectId: null,
    isDirty: false,
    title: '',
    description: '',
    startSec: 0,
    endSec: 0,
    templateId: 'sandpaper',
    captions: [],
  }),
}));
