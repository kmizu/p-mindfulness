import type { UserMemory, ReflectionProfile, SessionPlan } from '@/lib/agents/types';
import type { PostOutcome } from '@/lib/types';

export function buildMemoryUpdatePrompt(
  current: UserMemory | null,
  profile: ReflectionProfile,
  plan: SessionPlan,
  outcome: PostOutcome,
  locale: string
): string {
  const currentSection = current && current.sessionCount > 0
    ? `Current knowledge (${current.sessionCount} sessions so far):
- Core patterns: ${current.corePatterns.join(', ') || 'none'}
- What helps: ${current.whatHelps.join(', ') || 'none'}
- What hurts: ${current.whatHurts.join(', ') || 'none'}
- Life context: ${current.lifeContext.join(', ') || 'none'}
- Language notes: ${current.languageNotes.join(', ') || 'none'}
- Practice journey: ${current.trajectory || 'early days'}`
    : 'No prior knowledge — this is an early session.';

  return `You are updating a counselor's case notes after a session. Be a careful, thoughtful observer.

${currentSection}

This session:
- What they shared: "${profile.freeText}"
- Themes: ${profile.themes.join(', ') || 'none'}
- Specific details: ${profile.anchors.join(', ') || 'none'}
- Mood: ${profile.mood}/5, Tension: ${profile.tension}/5
- Self-critical: ${profile.selfCritical}
- Emotional tone: ${profile.emotionalTone}
- Patterns detected: ${plan.patterns.join(', ') || 'none'}
- Risk level: ${plan.riskLevel}
- Practice mode used: ${plan.recommendedMode} (${plan.guidanceDuration}s)
- Outcome: ${outcome.feltBetter ? 'felt better' : 'added pressure'}
- Would practice again: ${outcome.wouldContinue}
- Post-session notes: "${outcome.notes ?? 'none'}"

Update the knowledge. Only add genuinely new insights — don't repeat what's already there. Be concise.

Return ONLY valid JSON:
{
  "corePatterns": ["<recurring harmful pattern>", ...],
  "whatHelps": ["<what works for this person>", ...],
  "whatHurts": ["<what makes things worse>", ...],
  "lifeContext": ["<recurring stressor or context>", ...],
  "languageNotes": ["<how to speak with this person>", ...],
  "trajectory": "<1 sentence on their practice journey — update if anything changed>"
}

Rules:
- Maximum 5 items per array
- Only include patterns that have appeared more than once (or are very strong signals)
- trajectory: if this is session 1-3, say "early days". If there's a clear arc, describe it.
- languageNotes: e.g. "responds better to external anchors", "tends to over-explain when anxious", "breath focus increases tension"
- Keep everything factual and grounded — no speculation`;
}
