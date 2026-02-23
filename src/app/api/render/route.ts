import { NextRequest, NextResponse } from 'next/server';
import { renderAllClips, renderClip } from '@/lib/template-renderer';
import { getProjectPaths, fileReady } from '@/lib/paths';
import { readFileSync, writeFileSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { projectId, clipId, templateId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const paths = getProjectPaths(projectId);

    if (!fileReady(paths.analysis)) {
      return NextResponse.json({ error: 'No clips found. Run analysis first.' }, { status: 400 });
    }

    if (!fileReady(paths.transcript)) {
      return NextResponse.json({ error: 'Transcript not found.' }, { status: 400 });
    }

    let clips = JSON.parse(readFileSync(paths.analysis, 'utf-8'));

    if (clipId) {
      // Render single clip
      const clip = clips.find((c: { id: string }) => c.id === clipId);
      if (!clip) {
        return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
      }

      if (templateId) clip.templateId = templateId;
      const renderedPath = await renderClip(projectId, clip);

      // Update clip in analysis
      clips = clips.map((c: { id: string }) =>
        c.id === clipId ? { ...c, renderedPath, status: 'rendered', templateId: clip.templateId } : c
      );
      writeFileSync(paths.analysis, JSON.stringify(clips, null, 2));

      return NextResponse.json({ success: true, renderedPath });
    }

    // Render all clips
    if (templateId) {
      clips = clips.map((c: { templateId: string }) => ({ ...c, templateId }));
    }

    const rendered = await renderAllClips(projectId, clips);
    writeFileSync(paths.analysis, JSON.stringify(rendered, null, 2));

    return NextResponse.json({
      success: true,
      renderedCount: rendered.length,
      clips: rendered,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Render failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
