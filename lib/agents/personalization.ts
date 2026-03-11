import type { ReflectionProfile, SessionPlan, UserMemory, GuidanceLevel } from './types';
import type { PersonalizationHints, HarmfulPattern, RiskLevel, GuidanceMode, GuidanceDuration, SessionIntent } from '@/lib/types';
import { detectCrisis, detectPatternsFromText, assessRisk } from '@/lib/supervisor/rules';
import { applySafetyLayers } from '@/lib/supervisor/safety';
import { isLLMConfigured, complete } from '@/lib/llm/client';
import { buildPersonalizationPrompt } from '@/prompts/personalization';

const RISK_ORDER: RiskLevel[] = ['none', 'low', 'moderate', 'high', 'crisis'];
const maxRisk = (a: RiskLevel, b: RiskLevel): RiskLevel =>
  RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;

const VALID_MODES: GuidanceMode[] = ['breath', 'body', 'sound', 'external', 'reset', 'abort'];
const VALID_DURATIONS: GuidanceDuration[] = [30, 60, 180];
const VALID_INTENTS: SessionIntent[] = ['calming', 'grounding', 'checkin'];
const VALID_GUIDANCE_LEVELS: GuidanceLevel[] = ['minimal', 'moderate', 'detailed'];

function defaultGuidanceLevel(profile: ReflectionProfile, sessionCount: number): GuidanceLevel {
  if (sessionCount <= 2) return 'detailed';
  if (profile.tension >= 4) return 'detailed';
  if (profile.emotionalTone === 'distressed') return 'moderate';
  if (sessionCount >= 10) return 'minimal';
  return 'moderate';
}

export async function produceSessionPlan(
  profile: ReflectionProfile,
  hints: PersonalizationHints,
  memory: UserMemory | null,
  locale: string
): Promise<SessionPlan> {
  const textToCheck = [profile.freeText, ...profile.anchors].filter(Boolean).join(' ');

  // Defense-in-depth crisis check
  if (textToCheck && detectCrisis(textToCheck)) {
    return crisisPlan(profile, locale);
  }

  // Rule-based pattern detection
  const rulePatterns = detectPatternsFromText(textToCheck);
  const statePatterns: HarmfulPattern[] = [];
  if (profile.selfCritical && profile.tension >= 4) statePatterns.push('perfectionism');
  if (profile.lastSessionOutcome === 'pressuring') statePatterns.push('compulsive_continuation');
  if (profile.tension >= 5 && profile.selfCritical) statePatterns.push('escalating_frustration');
  if (profile.themes.some(t => t.includes('breath'))) statePatterns.push('breath_tension');

  const allRulePatterns = [...new Set([...rulePatterns, ...statePatterns])];
  const ruleRiskLevel = assessRisk(allRulePatterns, profile.tension);

  let finalPatterns = allRulePatterns;
  let finalRiskLevel = ruleRiskLevel;
  let reflectionSummary = profile.freeText ? profile.freeText.slice(0, 120) : '';
  let guidanceHints: string[] = [];
  const sessionCount = memory?.sessionCount ?? 0;
  let guidanceLevel: GuidanceLevel = defaultGuidanceLevel(profile, sessionCount);
  let practiceHistorySummary = '';
  // LLM may override safety's recommendedMode / guidanceDuration
  let llmMode: GuidanceMode | undefined;
  let llmDuration: GuidanceDuration | undefined;
  let llmGoal: SessionIntent | undefined;

  const shouldUseLLM =
    isLLMConfigured() &&
    (profile.freeText.length > 10 || ruleRiskLevel !== 'none' || profile.selfCritical || profile.themes.length > 0);

  if (shouldUseLLM) {
    try {
      const prompt = buildPersonalizationPrompt(profile, allRulePatterns, ruleRiskLevel, hints, memory, locale);
      const raw = await complete('You are a mindfulness personalization system.', prompt, 600);

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        finalPatterns = [...new Set([...allRulePatterns, ...(parsed.patterns ?? [])])];
        finalRiskLevel = maxRisk(ruleRiskLevel, parsed.riskLevel ?? ruleRiskLevel);
        reflectionSummary = parsed.reflectionSummary ?? reflectionSummary;
        guidanceHints = parsed.guidanceHints ?? [];
        practiceHistorySummary = parsed.practiceHistorySummary ?? '';
        if (VALID_GUIDANCE_LEVELS.includes(parsed.guidanceLevel)) guidanceLevel = parsed.guidanceLevel;
        if (VALID_MODES.includes(parsed.recommendedMode)) llmMode = parsed.recommendedMode;
        if (VALID_DURATIONS.includes(parsed.guidanceDuration)) llmDuration = parsed.guidanceDuration;
        if (VALID_INTENTS.includes(parsed.goal)) llmGoal = parsed.goal;
      }
    } catch (err) {
      console.error('[personalization] LLM failed, using rule-based:', err);
    }
  }

  // Build guidance hints from profile anchors if LLM didn't provide them
  if (guidanceHints.length === 0 && profile.anchors.length > 0) {
    guidanceHints = [`Person mentioned: ${profile.anchors.join(', ')}`];
  }

  const safety = applySafetyLayers(finalRiskLevel, finalPatterns, profile, hints);

  return {
    riskLevel: finalRiskLevel,
    patterns: finalPatterns,
    action: safety.action,
    // LLM personalization overrides safety defaults when risk permits
    recommendedMode: safety.action === 'proceed' ? (llmMode ?? safety.recommendedMode) : safety.recommendedMode,
    guidanceDuration: safety.action === 'proceed' ? (llmDuration ?? safety.guidanceDuration) : safety.guidanceDuration,
    message: safety.message,
    mood: profile.mood,
    goal: llmGoal ?? profile.intent,
    guidanceLevel,
    practiceHistorySummary,
    reflectionSummary,
    guidanceHints,
  };
}

function crisisPlan(profile: ReflectionProfile, locale: string): SessionPlan {
  const message = locale === 'ja'
    ? 'このアプリは今あなたが経験していることに対する適切なサポートではありません。信頼できる人や危機相談窓口に連絡してください。'
    : "This app is not the right support for what you're going through right now. Please reach out to someone you trust or a crisis line.";
  return {
    riskLevel: 'crisis',
    patterns: [],
    action: 'crisis',
    recommendedMode: 'abort',
    guidanceDuration: 30,
    mood: profile.mood,
    goal: profile.intent,
    guidanceLevel: 'detailed',
    practiceHistorySummary: '',
    message,
    reflectionSummary: '',
    guidanceHints: [],
  };
}
