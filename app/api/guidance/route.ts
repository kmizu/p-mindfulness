import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateGuidance } from '@/lib/guidance/generator';
import { generateAlignedGuidance } from '@/lib/agents/alignment';
import type { SessionPlan } from '@/lib/types';

const PlanSchema = z.object({
  riskLevel: z.string(),
  patterns: z.array(z.string()),
  action: z.string(),
  recommendedMode: z.string(),
  guidanceDuration: z.union([z.literal(30), z.literal(60), z.literal(180)]),
  message: z.string(),
  reflectionSummary: z.string(),
  guidanceHints: z.array(z.string()),
});

const GuidanceSchema = z.object({
  mode: z.enum(['breath', 'sound', 'body', 'external', 'reset', 'abort']),
  duration: z.union([z.literal(30), z.literal(60), z.literal(180)]),
  riskLevel: z.enum(['none', 'low', 'moderate', 'high', 'crisis']),
  supervisorMessage: z.string().max(300).optional().default(''),
  locale: z.enum(['en', 'ja']).optional().default('en'),
  plan: PlanSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, duration, riskLevel, supervisorMessage, locale, plan } = GuidanceSchema.parse(body);

    const script = plan
      ? await generateAlignedGuidance(plan as SessionPlan, locale)
      : await generateGuidance(mode, duration, riskLevel, supervisorMessage, locale);

    return NextResponse.json({ success: true, data: { script } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    console.error('[guidance] Error:', err);
    return NextResponse.json({ success: false, error: 'Guidance generation failed' }, { status: 500 });
  }
}
