import type { CheckinData, HarmfulPattern, PersonalizationHints, RiskLevel } from '@/lib/types';

export function buildSupervisorPrompt(
  checkin: CheckinData,
  rulePatterns: readonly HarmfulPattern[],
  hints: PersonalizationHints,
  ruleRiskLevel: RiskLevel,
  midSessionText?: string,
  locale = 'en'
): string {
  const langInstruction = locale === 'ja'
    ? 'IMPORTANT: Write the "message" field in Japanese.'
    : 'Write the "message" field in English.';
  const HARMFUL_PATTERNS = [
    'perfectionism', 'forced_acceptance', 'overmonitoring', 'performance_framing',
    'should_language', 'compulsive_continuation', 'breath_tension',
    'self_scoring', 'rumination', 'escalating_frustration',
  ];

  return `You are a mindfulness supervision system. Your role is NOT to teach meditation. Your role is to detect when someone's approach to mindfulness practice is becoming harmful — specifically patterns of meta-suffering, self-monitoring, perfectionism, and compulsive effort.

Current user state:
- Mood level: ${checkin.mood}/5
- Tension level: ${checkin.tension}/5
- Self-critical: ${checkin.selfCritical}
- Intent: ${checkin.intent}
- Last session: ${checkin.lastSessionOutcome ?? 'unknown'}
- What they wrote: "${checkin.freeText ?? '(nothing)'}"
${midSessionText ? `- Mid-session report: "${midSessionText}"` : ''}

Rule-based detection found: [${rulePatterns.join(', ') || 'none'}]
Preliminary risk level: ${ruleRiskLevel}

Personalization context:
- Patterns seen recently: ${hints.recentPatterns.join(', ') || 'none'}
- Mode that helped before: ${hints.preferredMode ?? 'unknown'}
- Mode to avoid: ${hints.avoidMode ?? 'none'}
- Notes: ${hints.notes.join('; ') || 'none'}

Your task: Analyze the user's state and detect harmful patterns. Return ONLY a valid JSON object — no markdown, no explanation.

Harmful patterns to check for: ${HARMFUL_PATTERNS.join(', ')}

JSON format (exact schema, no extras):
{
  "riskLevel": "none" | "low" | "moderate" | "high",
  "patterns": string[],
  "reasoning": "1-2 sentence explanation (internal only, not shown to user)"
}

Rules:
- Do NOT set riskLevel to "crisis" — crisis is handled separately by keyword detection
- "none": user seems genuinely okay, no concerning patterns
- "low": mild pattern, proceed with light guidance
- "moderate": pattern is interfering — recommend shorter session or anchor switch
- "high": clear risk — stop inward practice, use external grounding only
- "reasoning" is for logging only, keep it brief and factual
- Only include patterns you actually detect — don't pad the list`;
}

export function buildMidSessionPrompt(
  userReport: string,
  currentRiskLevel: RiskLevel
): string {
  return `You are a mindfulness safety monitor. The user just sent a mid-session report saying things are getting worse.

Their report: "${userReport}"
Current risk level: ${currentRiskLevel}

Should the session stop or switch to external grounding? Return ONLY valid JSON:
{
  "shouldEscalate": true | false,
  "newRiskLevel": "moderate" | "high",
  "reasoning": "brief"
}`;
}

export function buildSummaryPrompt(
  checkinFreeText: string | undefined,
  postOutcome: { feltBetter: boolean; wouldContinue: boolean; notes?: string }
): string {
  return `Write a 1-sentence session summary for a mindfulness supervision log. Be factual and brief (max 15 words).

Pre-session notes: "${checkinFreeText ?? 'none'}"
Felt better after: ${postOutcome.feltBetter}
Would continue: ${postOutcome.wouldContinue}
Post notes: "${postOutcome.notes ?? 'none'}"

Return ONLY the summary sentence. No quotes, no labels.`;
}
