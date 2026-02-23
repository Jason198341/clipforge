import type { Transcription, Clip } from '@/types/project';

const FIREWORKS_URL = 'https://api.fireworks.ai/inference/v1/chat/completions';

interface HighlightResult {
  clips: Array<{
    title: string;
    description: string;
    start_sec: number;
    end_sec: number;
    viral_score: number;
    reason: string;
    tags: string[];
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

  const systemPrompt = `You are a viral content analyst. Analyze the transcript of a YouTube video and identify 3-8 segments that would make compelling short-form clips (30-90 seconds each).

For each clip, evaluate:
- Hook potential: Does it start with something attention-grabbing?
- Emotional arc: Is there tension, surprise, humor, or insight?
- Standalone value: Can it be understood without full context?
- Shareability: Would someone share this?

Rate each clip 1-10 for viral potential.

CRITICAL RULES:
- Timestamps are in SECONDS (e.g., 42.0 means 42 seconds, NOT 0 minutes 42 seconds)
- start_sec and end_sec must be pure seconds (numbers like 42.0, 125.5, etc.)
- Each clip should be 30-90 seconds long (min 20s, max 120s)
- Avoid overlapping segments
- Prefer segments with clear beginning and end points

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
      "tags": ["tag1", "tag2"]
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
  return result.clips.map((c, i) => ({
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
  }));
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
