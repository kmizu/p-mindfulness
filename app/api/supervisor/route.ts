import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluateCheckin } from '@/lib/supervisor/engine';
import { getPersonalizationHints } from '@/lib/db/queries';
import { detectCrisis } from '@/lib/supervisor/rules';

const scale = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const MidSessionSchema = z.object({
  userReport: z.string().max(500),
  checkin: z.object({
    mood: scale,
    tension: scale,
    selfCritical: z.boolean(),
    intent: z.enum(['calming', 'grounding', 'checkin']),
    lastSessionOutcome: z.enum(['relieving', 'neutral', 'pressuring']).optional(),
    freeText: z.string().max(500).optional(),
  }),
  locale: z.enum(['en', 'ja']).optional().default('en'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userReport, checkin, locale } = MidSessionSchema.parse(body);

    // Crisis check first
    if (detectCrisis(userReport)) {
      return NextResponse.json({
        success: true,
        data: {
          decision: {
            riskLevel: 'crisis',
            patterns: [],
            action: 'crisis',
            recommendedMode: 'abort',
            guidanceDuration: 30,
            message: "This app is not the right support for what you're going through right now. Please reach out to someone you trust, or contact a crisis line. You don't have to handle this alone.",
          },
        },
      });
    }

    const hints = await getPersonalizationHints();
    const decision = await evaluateCheckin(checkin, hints, userReport, locale);

    return NextResponse.json({ success: true, data: { decision } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    console.error('[supervisor] Error:', err);
    return NextResponse.json({ success: false, error: 'Supervisor evaluation failed' }, { status: 500 });
  }
}
