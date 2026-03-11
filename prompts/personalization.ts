import type { ReflectionProfile, UserMemory, GuidanceLevel } from '@/lib/agents/types';
import type { PersonalizationHints, HarmfulPattern, RiskLevel } from '@/lib/types';

const HARMFUL_PATTERNS: HarmfulPattern[] = [
  'perfectionism', 'forced_acceptance', 'overmonitoring', 'performance_framing',
  'should_language', 'compulsive_continuation', 'breath_tension',
  'self_scoring', 'rumination', 'escalating_frustration',
];

// Paper §3.3 — Personalization Agent
// Explicitly assesses 6 dimensions: mood, goal, technique, duration, guidance level, practice history

function buildPracticeHistorySection(
  hints: PersonalizationHints,
  memory: UserMemory | null
): string {
  const lines: string[] = [];

  if (memory && memory.sessionCount > 0) {
    lines.push(`Session count: ${memory.sessionCount}`);
    if (memory.whatHelps.length > 0) lines.push(`What has worked for them: ${memory.whatHelps.join(', ')}`);
    if (memory.whatHurts.length > 0) lines.push(`What has not worked: ${memory.whatHurts.join(', ')}`);
    if (memory.corePatterns.length > 0) lines.push(`Recurring patterns: ${memory.corePatterns.join(', ')}`);
    if (memory.lifeContext.length > 0) lines.push(`Life context: ${memory.lifeContext.join(', ')}`);
    if (memory.languageNotes.length > 0) lines.push(`How to speak with them: ${memory.languageNotes.join(', ')}`);
    if (memory.trajectory) lines.push(`Practice trajectory: ${memory.trajectory}`);
  } else {
    lines.push('First or early session — no long-term history yet.');
  }

  if (hints.recentPatterns.length > 0) lines.push(`Patterns in recent sessions: ${hints.recentPatterns.join(', ')}`);
  if (hints.preferredMode) lines.push(`Anchor that has worked recently: ${hints.preferredMode}`);
  if (hints.avoidMode) lines.push(`Anchor to avoid (correlated with difficulty): ${hints.avoidMode}`);

  return lines.join('\n');
}

export function buildPersonalizationPrompt(
  profile: ReflectionProfile,
  rulePatterns: readonly HarmfulPattern[],
  ruleRiskLevel: RiskLevel,
  hints: PersonalizationHints,
  memory: UserMemory | null,
  locale: string
): string {
  const lang = locale === 'ja' ? 'Japanese' : 'English';
  const practiceHistory = buildPracticeHistorySection(hints, memory);
  const sessionCount = memory?.sessionCount ?? 0;

  // Infer default guidance level as a hint to the LLM
  const defaultGuidanceLevel: GuidanceLevel =
    sessionCount <= 2 ? 'detailed' :
    profile.tension >= 4 ? 'detailed' :
    profile.emotionalTone === 'distressed' ? 'moderate' :
    sessionCount >= 10 ? 'minimal' : 'moderate';

  return `You are the Personalization Agent in the MindfulAgents system (§3.3).
Your role: assess the session across 6 explicit dimensions, detect harmful patterns, and produce a session plan.

═══ REFLECTION DATA ═══
What they shared in conversation:
  Mood: ${profile.mood}/5 | Tension: ${profile.tension}/5
  Self-critical: ${profile.selfCritical} | Emotional tone: ${profile.emotionalTone}
  Intent expressed: ${profile.intent}
  Technique mentioned: ${profile.mentionedTechnique ?? 'none'}
  Last session: ${profile.lastSessionOutcome ?? 'unknown'}
  In their words: "${profile.freeText}"
  Themes: ${profile.themes.join(', ') || 'none'}
  Specific details: ${profile.anchors.join(', ') || 'none'}

═══ SAFETY BASELINE (rule-based) ═══
  Patterns detected: ${rulePatterns.join(', ') || 'none'}
  Risk level floor: ${ruleRiskLevel}

═══ PRACTICE HISTORY (§3.3 dimension 6) ═══
${practiceHistory}

═══ YOUR TASK ═══
Assess these 6 dimensions explicitly, then produce a session plan.

DIMENSION 1 — MOOD (already assessed): ${profile.mood}/5

DIMENSION 2 — GOAL
What does this person actually need from this session? (calming / grounding / gentle-checkin / rest)
Consider their words, not just the declared intent.

DIMENSION 3 — TECHNIQUE
Which anchor is most appropriate? Consider: what they mentioned, what has worked, what to avoid.
Options: breath | body | sound | external | reset | abort

DIMENSION 4 — DURATION
How long is appropriate? Consider tension level and emotional state.
Options: 30 | 60 | 180 (seconds)

DIMENSION 5 — GUIDANCE LEVEL
How much verbal scaffolding do they need?
- detailed: step-by-step, more words, good for high anxiety or new practitioners
- moderate: clear but not overwhelming (default: ${defaultGuidanceLevel})
- minimal: spare, open-ended, for experienced practitioners who prefer space

DIMENSION 6 — PRACTICE HISTORY (already provided above)
Use this to personalize hints and avoid repeating what hasn't worked.

Return ONLY valid JSON:
{
  "riskLevel": "none" | "low" | "moderate" | "high",
  "patterns": string[],
  "goal": "calming" | "grounding" | "checkin",
  "recommendedMode": "breath" | "body" | "sound" | "external" | "reset",
  "guidanceDuration": 30 | 60 | 180,
  "guidanceLevel": "minimal" | "moderate" | "detailed",
  "practiceHistorySummary": "<one sentence describing their practice history context>",
  "reasoning": "<one sentence, internal only>",
  "reflectionSummary": "<one warm sentence in ${lang} summarizing their state for the guidance writer>",
  "guidanceHints": ["<specific, actionable instruction>", ...]
}

Rules:
- Do NOT set riskLevel to "crisis" — keyword detection handles that
- riskLevel must be >= "${ruleRiskLevel}" (never downgrade the safety floor)
- guidanceHints: 2-4 maximum, actionable — e.g. "They mentioned tight shoulders — invite them to notice that", "Avoid breath focus — they expressed tension around breathing", "They're experienced — give space, fewer words"
- reflectionSummary: warm, brief, for the guidance writer — not shown to user
- practiceHistorySummary: for the memory system — factual, brief
- Harmful patterns to watch for: ${HARMFUL_PATTERNS.join(', ')}`;
}
