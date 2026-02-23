import { NextRequest, NextResponse } from 'next/server';
import { detectSilence } from '@/lib/silence-detect';
import { getProjectPaths, fileReady } from '@/lib/paths';
import { writeFileSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const paths = getProjectPaths(projectId);

    if (!fileReady(paths.audio)) {
      return NextResponse.json({ error: 'Audio not found. Transcribe first.' }, { status: 400 });
    }

    const gaps = await detectSilence(paths.audio);
    writeFileSync(paths.silence, JSON.stringify(gaps, null, 2));

    return NextResponse.json({
      success: true,
      gapCount: gaps.length,
      totalSilence: gaps.reduce((sum, g) => sum + g.duration, 0).toFixed(1),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Silence detection failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
