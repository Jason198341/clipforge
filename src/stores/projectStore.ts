'use client';

import { create } from 'zustand';
import type { Project, Clip, Transcription } from '@/types/project';

const LS_KEY = 'clipforge_projects';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;

  // CRUD
  createProject: (url: string) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string | null) => void;

  // Clip management
  addClips: (projectId: string, clips: Clip[]) => void;
  updateClip: (projectId: string, clipId: string, updates: Partial<Clip>) => void;

  // Transcription
  setTranscription: (projectId: string, transcription: Transcription) => void;

  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,

  createProject: (url: string) => {
    const project: Project = {
      id: generateId(),
      title: 'Processing...',
      url,
      status: 'idle',
      clips: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(state => {
      const projects = [project, ...state.projects];
      return { projects, currentProject: project };
    });
    get().saveToStorage();
    return project;
  },

  updateProject: (id, updates) => {
    set(state => {
      const projects = state.projects.map(p =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      );
      const currentProject = state.currentProject?.id === id
        ? { ...state.currentProject, ...updates, updatedAt: Date.now() }
        : state.currentProject;
      return { projects, currentProject };
    });
    get().saveToStorage();
  },

  deleteProject: (id) => {
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
    get().saveToStorage();
  },

  setCurrentProject: (id) => {
    set(state => ({
      currentProject: id ? state.projects.find(p => p.id === id) ?? null : null,
    }));
  },

  addClips: (projectId, clips) => {
    set(state => {
      const projects = state.projects.map(p =>
        p.id === projectId ? { ...p, clips: [...p.clips, ...clips], updatedAt: Date.now() } : p
      );
      const currentProject = state.currentProject?.id === projectId
        ? { ...state.currentProject, clips: [...state.currentProject.clips, ...clips], updatedAt: Date.now() }
        : state.currentProject;
      return { projects, currentProject };
    });
    get().saveToStorage();
  },

  updateClip: (projectId, clipId, updates) => {
    set(state => {
      const projects = state.projects.map(p => {
        if (p.id !== projectId) return p;
        const clips = p.clips.map(c => c.id === clipId ? { ...c, ...updates } : c);
        return { ...p, clips, updatedAt: Date.now() };
      });
      const currentProject = state.currentProject?.id === projectId
        ? {
          ...state.currentProject,
          clips: state.currentProject.clips.map(c => c.id === clipId ? { ...c, ...updates } : c),
          updatedAt: Date.now(),
        }
        : state.currentProject;
      return { projects, currentProject };
    });
    get().saveToStorage();
  },

  setTranscription: (projectId, transcription) => {
    get().updateProject(projectId, { transcription });
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const projects: Project[] = JSON.parse(raw);
        set({ projects });
      }
    } catch { /* ignore */ }
  },

  saveToStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const { projects } = get();
      localStorage.setItem(LS_KEY, JSON.stringify(projects));
    } catch { /* ignore */ }
  },
}));
