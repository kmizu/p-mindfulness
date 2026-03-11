import type { ReflectionProfile, UserMemory } from '@/lib/agents/types';
import type { PersonalizationHints, HarmfulPattern, RiskLevel } from '@/lib/types';

const HARMFUL_PATTERNS: HarmfulPattern[] = [
  'perfectionism', 'forced_acceptance', 'overmonitoring', 'performance_framing',
  'should_language', 'compulsive_continuation', 'breath_tension',
  'self_scoring', 'rumination', 'escalating_frustration',
];

export function buildPersonalizationPrompt(
  profile: ReflectionProfile,
  rulePatterns: readonly HarmfulPattern[],
  ruleRiskLevel: RiskLevel,
  hints: PersonalizationHints,
  memory: UserMemory | null,
  locale: string
): string {
  const lang = locale === 'ja' ? 'Japanese' : 'English';

  const memorySection = memory && memory.sessionCount > 0 ? `
Long-term knowledge about this person (${memory.sessionCount} sessions):
- Core patterns: ${memory.corePatterns.join(', ') || 'none yet'}
- What helps them: ${memory.whatHelps.join(', ') || 'unknown'}
- What hurts them: ${memory.whatHurts.join(', ') || 'unknown'}
- Life context: ${memory.lifeContext.join(', ') || 'unknown'}
- Language notes: ${memory.languageNotes.join(', ') || 'none'}
- Practice journey: ${memory.trajectory || 'early days'}` : '\nFirst or early session — no long-term data yet.';

  return `You are the Personalization Agent in a mindfulness supervision system. Your role is to produce a session plan that is both safe AND genuinely tailored to this specific person.

What they shared in reflection:
- Mood: ${profile.mood}/5, Tension: ${profile.tension}/5
- Self-critical: ${profile.selfCritical}
- Intent: ${profile.intent}
- Emotional tone: ${profile.emotionalTone}
- What they said: "${profile.freeText}"
- Themes: ${profile.themes.join(', ') || 'none detected'}
- Specific details: ${profile.anchors.join(', ') || 'none'}
- Last session: ${profile.lastSessionOutcome ?? 'unknown'}

Rule-based detection: patterns=[${rulePatterns.join(', ') || 'none'}], risk=${ruleRiskLevel}

Recent session context:
- Preferred anchor: ${hints.preferredMode ?? 'unknown'}
- Anchor to avoid: ${hints.avoidMode ?? 'none'}
- Average tension: ${hints.avgTension.toFixed(1)}/5
- Recent patterns: ${hints.recentPatterns.join(', ') || 'none'}
${memorySection}

Your task: Decide the session plan AND write personalized guidance hints.

Return ONLY valid JSON:
{
  "riskLevel": "none" | "low" | "moderate" | "high",
  "patterns": string[],
  "reasoning": "<1 sentence, internal only>",
  "reflectionSummary": "<1 sentence in ${lang} summarizing their state for display>",
  "guidanceHints": ["<specific instruction for the guidance writer>", ...]
}

Rules:
- Do NOT set riskLevel to "crisis" — that is handled by keyword detection
- guidanceHints should be actionable: e.g. "User mentioned tight shoulders — have them notice that specifically", "Avoid breath focus — they expressed tension about breathing", "They want to quiet work noise — anchor to external sounds"
- 2-4 guidanceHints maximum
- reflectionSummary: warm, brief, in ${lang} — what you'd tell the guidance writer about this person right now
- Harmful patterns: ${HARMFUL_PATTERNS.join(', ')}`;
}
