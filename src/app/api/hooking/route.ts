import { NextRequest, NextResponse } from 'next/server';
import { prependHookToClip } from '@/lib/hooking-tts';

export async function POST(req: NextRequest) {
  try {
    const { projectId, clipId, hookText } = await req.json();

    if (!projectId || !clipId || !hookText) {
      return NextResponse.json(
        { error: 'projectId, clipId, and hookText required' },
        { status: 400 },
      );
    }

    const outputPath = await prependHookToClip(projectId, clipId, hookText);

    return NextResponse.json({
      success: true,
      hookingPath: outputPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hooking failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
