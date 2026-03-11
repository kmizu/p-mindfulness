import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluateCheckin } from '@/lib/supervisor/engine';
import { getPersonalizationHints } from '@/lib/db/queries';

const scale = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const CheckinSchema = z.object({
  mood: scale,
  tension: scale,
  selfCritical: z.boolean(),
  intent: z.enum(['calming', 'grounding', 'checkin']),
  lastSessionOutcome: z.enum(['relieving', 'neutral', 'pressuring']).optional(),
  freeText: z.string().max(500).optional(),
  locale: z.enum(['en', 'ja']).optional().default('en'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { locale, ...checkin } = CheckinSchema.parse(body);

    const hints = await getPersonalizationHints();
    const decision = await evaluateCheckin(checkin, hints, undefined, locale);

    return NextResponse.json({ success: true, data: { decision, hints } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input', details: err.issues }, { status: 400 });
    }
    console.error('[checkin] Error:', err);
    return NextResponse.json({ success: false, error: 'Failed to evaluate check-in' }, { status: 500 });
  }
}
