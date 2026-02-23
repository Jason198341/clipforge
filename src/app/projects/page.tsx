'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/stores/projectStore';

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, loadFromStorage, deleteProject } = useProjectStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-bg font-semibold rounded-lg text-sm transition-colors"
        >
          + New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted mb-4">No projects yet</p>
          <button
            onClick={() => router.push('/')}
            className="text-primary hover:underline"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => (
            <div
              key={project.id}
              className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              {/* Thumbnail placeholder */}
              <div className="w-20 h-14 bg-surface-hover rounded-lg shrink-0 flex items-center justify-center text-text-muted text-xs">
                {project.thumbnailUrl ? (
                  <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  'No thumb'
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{project.title}</h3>
                <p className="text-xs text-text-muted truncate">{project.url}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    project.status === 'done' ? 'bg-success/10 text-success' :
                    project.status === 'error' ? 'bg-danger/10 text-danger' :
                    'bg-primary-dim text-primary'
                  }`}>
                    {project.status}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {project.clips.length} clips
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this project?')) {
                    deleteProject(project.id);
                  }
                }}
                className="text-text-muted hover:text-danger text-sm px-2 py-1 shrink-0"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
