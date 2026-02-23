import { NextRequest, NextResponse } from 'next/server';
import { composeStory, composeAllStories } from '@/lib/story-composer';
import { getProjectPaths, fileReady } from '@/lib/paths';
import { readFileSync, writeFileSync } from 'fs';
import type { Clip } from '@/types/project';

/**
 * POST /api/story
 * Body: { projectId, clipId? }
 *
 * If clipId provided: compose story for that single clip.
 * If clipId omitted: compose stories for all clips with storyMeta.
 */
export async function POST(req: NextRequest) {
  try {
    const { projectId, clipId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const paths = getProjectPaths(projectId);
    if (!fileReady(paths.analysis)) {
      return NextResponse.json({ error: 'No analysis found — run pipeline first' }, { status: 400 });
    }

    const clips: Clip[] = JSON.parse(readFileSync(paths.analysis, 'utf-8'));

    if (clipId) {
      // Single clip compose
      const clip = clips.find(c => c.id === clipId);
      if (!clip) {
        return NextResponse.json({ error: `Clip ${clipId} not found` }, { status: 404 });
      }
      if (!clip.storyMeta) {
        return NextResponse.json({ error: `Clip ${clipId} has no storyMeta` }, { status: 400 });
      }

      const storyPath = await composeStory(projectId, clip);

      // Update clip in analysis.json
      const updated = clips.map(c =>
        c.id === clipId ? { ...c, storyPath, status: 'story-composed' as const } : c,
      );
      writeFileSync(paths.analysis, JSON.stringify(updated, null, 2));

      return NextResponse.json({ success: true, storyPath });
    } else {
      // Compose all clips
      const storied = await composeAllStories(projectId, clips);
      writeFileSync(paths.analysis, JSON.stringify(storied, null, 2));

      const composedCount = storied.filter(c => c.storyPath).length;
      return NextResponse.json({ success: true, composedCount });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Story compose failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
