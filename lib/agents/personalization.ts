import type { ReflectionProfile, SessionPlan, UserMemory } from './types';
import type { PersonalizationHints, HarmfulPattern, RiskLevel } from '@/lib/types';
import { detectCrisis, detectPatternsFromText, assessRisk } from '@/lib/supervisor/rules';
import { applySafetyLayers } from '@/lib/supervisor/safety';
import { isLLMConfigured, complete } from '@/lib/llm/client';
import { buildPersonalizationPrompt } from '@/prompts/personalization';

const RISK_ORDER: RiskLevel[] = ['none', 'low', 'moderate', 'high', 'crisis'];
const maxRisk = (a: RiskLevel, b: RiskLevel): RiskLevel =>
  RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;

export async function produceSessionPlan(
  profile: ReflectionProfile,
  hints: PersonalizationHints,
  memory: UserMemory | null,
  locale: string
): Promise<SessionPlan> {
  const textToCheck = [profile.freeText, ...profile.anchors].filter(Boolean).join(' ');

  // Defense-in-depth crisis check
  if (textToCheck && detectCrisis(textToCheck)) {
    return crisisPlan(locale);
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
    recommendedMode: safety.recommendedMode,
    message: safety.message,
    guidanceDuration: safety.guidanceDuration,
    reflectionSummary,
    guidanceHints,
  };
}

function crisisPlan(locale: string): SessionPlan {
  const message = locale === 'ja'
    ? 'このアプリは今あなたが経験していることに対する適切なサポートではありません。信頼できる人や危機相談窓口に連絡してください。'
    : "This app is not the right support for what you're going through right now. Please reach out to someone you trust or a crisis line.";
  return {
    riskLevel: 'crisis',
    patterns: [],
    action: 'crisis',
    recommendedMode: 'abort',
    guidanceDuration: 30,
    message,
    reflectionSummary: '',
    guidanceHints: [],
  };
}
