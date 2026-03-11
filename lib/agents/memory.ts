import type { UserMemory, ReflectionProfile, SessionPlan } from './types';
import type { PostOutcome } from '@/lib/types';
import { isLLMConfigured, complete } from '@/lib/llm/client';
import { buildMemoryUpdatePrompt } from '@/prompts/memory';
import { EMPTY_MEMORY } from './types';

export async function updateUserMemory(
  current: UserMemory | null,
  profile: ReflectionProfile,
  plan: SessionPlan,
  outcome: PostOutcome,
  locale: string
): Promise<UserMemory> {
  const base = current ?? EMPTY_MEMORY;

  if (!isLLMConfigured()) {
    // Rule-based memory update (no LLM)
    return rulesBasedUpdate(base, profile, plan, outcome);
  }

  try {
    const prompt = buildMemoryUpdatePrompt(current, profile, plan, outcome, locale);
    const raw = await complete('You maintain a counselor\'s case notes. Be precise and conservative.', prompt, 600);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in memory update response');

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      version: base.version + 1,
      lastUpdated: new Date().toISOString(),
      sessionCount: base.sessionCount + 1,
      corePatterns: dedup(parsed.corePatterns ?? base.corePatterns),
      whatHelps: dedup(parsed.whatHelps ?? base.whatHelps),
      whatHurts: dedup(parsed.whatHurts ?? base.whatHurts),
      lifeContext: dedup(parsed.lifeContext ?? base.lifeContext),
      languageNotes: dedup(parsed.languageNotes ?? base.languageNotes),
      trajectory: typeof parsed.trajectory === 'string' ? parsed.trajectory : base.trajectory,
    };
  } catch (err) {
    console.error('[memory] LLM update failed, using rule-based:', err);
    return rulesBasedUpdate(base, profile, plan, outcome);
  }
}

function rulesBasedUpdate(
  base: UserMemory,
  profile: ReflectionProfile,
  plan: SessionPlan,
  outcome: PostOutcome
): UserMemory {
  const whatHelps = outcome.feltBetter
    ? dedup([...base.whatHelps, plan.recommendedMode])
    : base.whatHelps;

  const whatHurts = !outcome.feltBetter && plan.recommendedMode === 'breath'
    ? dedup([...base.whatHurts, 'breath focus'])
    : base.whatHurts;

  const corePatterns = plan.patterns.length > 0
    ? dedup([...base.corePatterns, ...plan.patterns.map(p => p.replace(/_/g, ' '))])
    : base.corePatterns;

  const lifeContext = profile.themes.length > 0
    ? dedup([...base.lifeContext, ...profile.themes])
    : base.lifeContext;

  const count = base.sessionCount + 1;

  return {
    ...base,
    version: base.version + 1,
    lastUpdated: new Date().toISOString(),
    sessionCount: count,
    corePatterns: corePatterns.slice(0, 5),
    whatHelps: whatHelps.slice(0, 5),
    whatHurts: whatHurts.slice(0, 5),
    lifeContext: lifeContext.slice(0, 5),
    trajectory: count <= 3 ? 'early sessions' : base.trajectory || 'ongoing practice',
  };
}

function dedup(arr: readonly string[]): readonly string[] {
  return [...new Set(arr)];
}
