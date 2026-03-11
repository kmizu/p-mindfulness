import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { produceSessionPlan } from '@/lib/agents/personalization';
import { getPersonalizationHints, getUserMemory } from '@/lib/db/queries';
import type { ReflectionProfile } from '@/lib/types';

const scale = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const ProfileSchema = z.object({
  mood: scale,
  tension: scale,
  selfCritical: z.boolean(),
  intent: z.enum(['calming', 'grounding', 'checkin']),
  lastSessionOutcome: z.enum(['relieving', 'neutral', 'pressuring']).optional(),
  freeText: z.string(),
  themes: z.array(z.string()),
  anchors: z.array(z.string()),
  emotionalTone: z.enum(['distressed', 'neutral', 'positive', 'mixed']),
});

const PersonalizeSchema = z.object({
  profile: ProfileSchema,
  locale: z.enum(['en', 'ja']).optional().default('en'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile, locale } = PersonalizeSchema.parse(body);

    const [hints, memory] = await Promise.all([
      getPersonalizationHints(),
      getUserMemory(),
    ]);

    const plan = await produceSessionPlan(profile as ReflectionProfile, hints, memory, locale);

    return NextResponse.json({ success: true, data: { plan } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input', details: err.issues }, { status: 400 });
    }
    console.error('[personalize] Error:', err);
    return NextResponse.json({ success: false, error: 'Personalization failed' }, { status: 500 });
  }
}
