import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveSession, updatePostOutcome, getSessionById, getUserMemory, saveUserMemory } from '@/lib/db/queries';
import { isLLMConfigured, complete } from '@/lib/llm/client';
import { buildSummaryPrompt } from '@/prompts/guidance';
import { updateUserMemory } from '@/lib/agents/memory';
import type { ReflectionProfile, SessionPlan, PostOutcome } from '@/lib/types';

const scale = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const SaveSessionSchema = z.object({
  checkin: z.object({
    mood: scale,
    tension: scale,
    selfCritical: z.boolean(),
    intent: z.enum(['calming', 'grounding', 'checkin']),
    lastSessionOutcome: z.enum(['relieving', 'neutral', 'pressuring']).optional(),
    freeText: z.string().max(500).optional(),
  }),
  supervisorDecision: z.object({
    riskLevel: z.enum(['none', 'low', 'moderate', 'high', 'crisis']),
    patterns: z.array(z.string()),
    action: z.string(),
    recommendedMode: z.string(),
    message: z.string(),
    guidanceDuration: z.union([z.literal(30), z.literal(60), z.literal(180)]),
  }),
  guidance: z.object({
    mode: z.string(),
    duration: z.union([z.literal(30), z.literal(60), z.literal(180)]),
    text: z.string(),
    isPreset: z.boolean(),
  }),
  reflectionProfile: z.string().optional(),
  reflectionSummary: z.string().optional(),
});

const UpdateSessionSchema = z.object({
  id: z.string().uuid(),
  postOutcome: z.object({
    feltBetter: z.boolean(),
    wouldContinue: z.boolean(),
    notes: z.string().max(500).optional(),
  }),
  locale: z.enum(['en', 'ja']).optional().default('en'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = SaveSessionSchema.parse(body);

    const id = await saveSession(data as Parameters<typeof saveSession>[0]);

    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input', details: err.issues }, { status: 400 });
    }
    console.error('[session] Save error:', err);
    return NextResponse.json({ success: false, error: 'Failed to save session' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, postOutcome, locale } = UpdateSessionSchema.parse(body);

    // Generate summary
    let summary: string | undefined;
    if (isLLMConfigured()) {
      try {
        const session = await getSessionById(id);
        const prompt = buildSummaryPrompt(
          session?.checkin.freeText,
          postOutcome.feltBetter,
          postOutcome.wouldContinue,
          postOutcome.notes
        );
        summary = (await complete('Generate a brief factual session summary.', prompt, 60)).trim();
      } catch (e) {
        console.error('[session] Summary generation failed:', e);
      }
    }

    await updatePostOutcome(id, postOutcome, summary);

    // Update long-term user memory in the background
    updateMemoryAfterSession(id, postOutcome, locale).catch(e =>
      console.error('[session] Memory update failed:', e)
    );

    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    console.error('[session] Update error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update session' }, { status: 500 });
  }
}

async function updateMemoryAfterSession(
  sessionId: string,
  postOutcome: PostOutcome,
  locale: string
): Promise<void> {
  const [session, currentMemory] = await Promise.all([
    getSessionById(sessionId),
    getUserMemory(),
  ]);

  if (!session) return;

  // Reconstruct ReflectionProfile from stored JSON or build from checkin
  let profile: ReflectionProfile;
  if (session.reflectionProfile) {
    try {
      profile = JSON.parse(session.reflectionProfile) as ReflectionProfile;
    } catch {
      profile = checkinToProfile(session);
    }
  } else {
    profile = checkinToProfile(session);
  }

  // Reconstruct SessionPlan from stored session data
  const plan: SessionPlan = {
    riskLevel: session.supervisorDecision.riskLevel,
    patterns: session.supervisorDecision.patterns,
    action: session.supervisorDecision.action,
    recommendedMode: session.supervisorDecision.recommendedMode,
    guidanceDuration: session.supervisorDecision.guidanceDuration,
    message: session.supervisorDecision.message,
    reflectionSummary: session.reflectionSummary ?? '',
    guidanceHints: [],
  };

  const updated = await updateUserMemory(currentMemory, profile, plan, postOutcome, locale);
  await saveUserMemory(updated);
}

function checkinToProfile(session: Awaited<ReturnType<typeof getSessionById>>): ReflectionProfile {
  const c = session!.checkin;
  return {
    mood: c.mood as ReflectionProfile['mood'],
    tension: c.tension as ReflectionProfile['tension'],
    selfCritical: c.selfCritical,
    intent: c.intent as ReflectionProfile['intent'],
    lastSessionOutcome: c.lastSessionOutcome as ReflectionProfile['lastSessionOutcome'],
    freeText: c.freeText ?? '',
    themes: [],
    anchors: [],
    emotionalTone: (c.tension >= 4 ? 'distressed' : c.mood >= 4 ? 'positive' : 'neutral') as ReflectionProfile['emotionalTone'],
  };
}
