import { NextRequest, NextResponse } from 'next/server';
import { generateTitles } from '@/lib/ai-titles';

export async function POST(req: NextRequest) {
  try {
    const { clipDescription, originalTitle, count } = await req.json();

    if (!clipDescription) {
      return NextResponse.json({ error: 'clipDescription required' }, { status: 400 });
    }

    const titles = await generateTitles(
      clipDescription,
      originalTitle || 'Untitled',
      count || 5,
    );

    return NextResponse.json({ success: true, titles });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Title generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
