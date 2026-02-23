import { NextRequest, NextResponse } from 'next/server';
import { extractAllClips } from '@/lib/clip-extractor';
import { getProjectPaths, fileReady } from '@/lib/paths';
import { readFileSync, writeFileSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const paths = getProjectPaths(projectId);

    if (!fileReady(paths.analysis)) {
      return NextResponse.json({ error: 'Analysis not found. Analyze first.' }, { status: 400 });
    }

    const clips = JSON.parse(readFileSync(paths.analysis, 'utf-8'));
    const silenceGaps = fileReady(paths.silence)
      ? JSON.parse(readFileSync(paths.silence, 'utf-8'))
      : [];

    const extracted = await extractAllClips(projectId, clips, silenceGaps);

    // Update analysis file with source paths
    writeFileSync(paths.analysis, JSON.stringify(extracted, null, 2));

    return NextResponse.json({
      success: true,
      clips: extracted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
