import type { Transcription, Clip, StoryMeta } from '@/types/project';

const FIREWORKS_URL = 'https://api.fireworks.ai/inference/v1/chat/completions';

interface StoryMetaRaw {
  hook: string;
  context: string;
  payoff_frame: string;
  emotional_arc: 'triumph' | 'surprise' | 'heartbreak' | 'humor' | 'tension';
  share_hook: string;
}

interface HighlightResult {
  clips: Array<{
    title: string;
    description: string;
    start_sec: number;
    end_sec: number;
    viral_score: number;
    reason: string;
    tags: string[];
    story_meta?: StoryMetaRaw;
  }>;
}

/**
 * Use Fireworks AI (DeepSeek) to analyze transcript and find highlight segments.
 * Returns 3-8 clip recommendations scored by viral potential.
 */
export async function analyzeHighlights(
  transcription: Transcription,
  videoTitle: string,
  videoDuration: number,
  projectId: string,
): Promise<Clip[]> {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) throw new Error('FIREWORKS_API_KEY not set');

  // Build condensed transcript with SECONDS timestamps (not M:SS to avoid AI confusion)
  const transcriptText = transcription.segments
    .map(s => `[${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] ${s.text}`)
    .join('\n');

  const systemPrompt = `You are a viral content analyst AND storytelling architect. Analyze the transcript and identify 3-8 compelling short-form clips (30-90 seconds each).

For each clip, evaluate:
- Hook potential: Does it start with something attention-grabbing?
- Emotional arc: Is there tension, surprise, humor, or insight?
- Standalone value: Can it be understood without full context?
- Shareability: Would someone share this?

Rate each clip 1-10 for viral potential.

STORYTELLING DNA — For EACH clip, also generate story_meta:
- hook: One punchy sentence that makes someone STOP scrolling. This will be read aloud as TTS narration over a title card. Write in the video's language.
- context: 2-3 sentences of background/buildup narration. Set the stage — why does this moment matter? Write in the video's language.
- payoff_frame: One sentence describing the climax moment. Write in the video's language.
- emotional_arc: One of "triumph", "surprise", "heartbreak", "humor", "tension"
- share_hook: A short punchy line someone would say sharing this clip (e.g., "이거 꼭 봐" or "you NEED to see this"). Write in the video's language.

CRITICAL RULES:
- Timestamps are in SECONDS (e.g., 42.0 means 42 seconds, NOT 0 minutes 42 seconds)
- start_sec and end_sec must be pure seconds (numbers like 42.0, 125.5, etc.)
- Each clip should be 30-90 seconds long (min 20s, max 120s)
- Avoid overlapping segments
- Prefer segments with clear beginning and end points
- hook and context should be CONCISE — TTS will read them aloud (hook: ~3sec, context: ~6sec)

Respond ONLY with valid JSON:
{
  "clips": [
    {
      "title": "short catchy title",
      "description": "1-sentence description of what happens",
      "start_sec": 42.0,
      "end_sec": 102.5,
      "viral_score": 8,
      "reason": "why this segment is compelling",
      "tags": ["tag1", "tag2"],
      "story_meta": {
        "hook": "한 문장 훅 (TTS용)",
        "context": "배경 설명 2-3문장 (TTS용)",
        "payoff_frame": "클라이맥스 한 문장",
        "emotional_arc": "triumph",
        "share_hook": "공유할 때 한마디"
      }
    }
  ]
}`;

  const userPrompt = `Video: "${videoTitle}" (${videoDuration} seconds total)

Transcript:
${transcriptText}`;

  const res = await fetch(FIREWORKS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'accounts/fireworks/models/deepseek-v3p1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    throw new Error(`Fireworks API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response (may be wrapped in markdown code block)
  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const result: HighlightResult = JSON.parse(jsonStr);

  // Convert to Clip objects
  return result.clips.map((c, i) => {
    const clip: Clip = {
      id: `${projectId}-clip-${i + 1}`,
      projectId,
      title: c.title,
      description: c.description,
      startSec: c.start_sec,
      endSec: c.end_sec,
      viralScore: Math.min(10, Math.max(1, c.viral_score)),
      reason: c.reason,
      tags: c.tags || [],
      templateId: 'sandpaper', // default template
      status: 'pending',
    };

    // Attach story metadata if AI generated it
    if (c.story_meta) {
      clip.storyMeta = {
        hook: c.story_meta.hook,
        context: c.story_meta.context,
        payoffFrame: c.story_meta.payoff_frame,
        emotionalArc: c.story_meta.emotional_arc || 'surprise',
        shareHook: c.story_meta.share_hook,
      };
    }

    return clip;
  });
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
