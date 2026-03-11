import type {
  CheckinData,
  SupervisorDecision,
  PersonalizationHints,
  HarmfulPattern,
  RiskLevel,
} from '@/lib/types';
import { detectCrisis, detectPatternsFromText, assessRisk } from './rules';
import { applySafetyLayers } from './safety';
import { isLLMConfigured, complete } from '@/lib/llm/client';
import { buildSupervisorPrompt } from '@/prompts/supervisor';

// ── Main evaluator ────────────────────────────────────────────────────────────

export async function evaluateCheckin(
  checkin: CheckinData,
  hints: PersonalizationHints,
  midSessionText?: string,
  locale = 'en'
): Promise<SupervisorDecision> {
  const textToCheck = [checkin.freeText, midSessionText].filter(Boolean).join(' ');

  // SAFETY FIRST: Crisis detection is synchronous, no LLM involved
  if (textToCheck && detectCrisis(textToCheck)) {
    return crisisDecision(locale);
  }

  // Rule-based pattern detection
  const rulePatterns = detectPatternsFromText(textToCheck);

  // Adjust risk from checkin state signals
  const statePatterns: HarmfulPattern[] = [];
  if (checkin.selfCritical && checkin.tension >= 4) statePatterns.push('perfectionism');
  if (checkin.lastSessionOutcome === 'pressuring') statePatterns.push('compulsive_continuation');
  if (checkin.tension >= 5 && checkin.selfCritical) statePatterns.push('escalating_frustration');

  const allRulePatterns = [...new Set([...rulePatterns, ...statePatterns])];
  const ruleRiskLevel = assessRisk(allRulePatterns, checkin.tension);

  // LLM enrichment when we have text or elevated risk
  let finalPatterns = allRulePatterns;
  let finalRiskLevel = ruleRiskLevel;

  const shouldUseLLM =
    isLLMConfigured() &&
    (checkin.freeText && checkin.freeText.length > 20 ||
      ruleRiskLevel !== 'none' ||
      checkin.selfCritical ||
      midSessionText);

  if (shouldUseLLM) {
    try {
      const llmResult = await callLLMSupervisor(checkin, allRulePatterns, hints, ruleRiskLevel, midSessionText, locale);
      // Merge: union patterns, take higher risk level
      finalPatterns = [...new Set([...allRulePatterns, ...llmResult.patterns])];
      finalRiskLevel = maxRisk(ruleRiskLevel, llmResult.riskLevel);
    } catch (err) {
      console.error('[supervisor] LLM failed, using rule-based only:', err);
    }
  }

  // Apply safety layers to get action + mode + message
  const safety = applySafetyLayers(finalRiskLevel, finalPatterns, checkin, hints);

  return {
    riskLevel: finalRiskLevel,
    patterns: finalPatterns,
    action: safety.action,
    recommendedMode: safety.recommendedMode,
    message: safety.message,
    guidanceDuration: safety.guidanceDuration,
  };
}

// ── LLM call ─────────────────────────────────────────────────────────────────

async function callLLMSupervisor(
  checkin: CheckinData,
  rulePatterns: readonly HarmfulPattern[],
  hints: PersonalizationHints,
  ruleRiskLevel: RiskLevel,
  midSessionText?: string,
  locale = 'en'
): Promise<{ riskLevel: RiskLevel; patterns: HarmfulPattern[] }> {
  const prompt = buildSupervisorPrompt(checkin, rulePatterns, hints, ruleRiskLevel, midSessionText, locale);
  const raw = await complete('You are a mindfulness supervision system.', prompt, 512);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in LLM response');

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    riskLevel: (parsed.riskLevel ?? ruleRiskLevel) as RiskLevel,
    patterns: (parsed.patterns ?? []) as HarmfulPattern[],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_ORDER: RiskLevel[] = ['none', 'low', 'moderate', 'high', 'crisis'];

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}

function crisisDecision(locale = 'en'): SupervisorDecision {
  const message = locale === 'ja'
    ? 'このアプリは今あなたが経験していることに対する適切なサポートではありません。信頼できる人や危機相談窓口に連絡してください。一人で抱え込まないでください。'
    : "This app is not the right support for what you're going through right now. Please reach out to someone you trust, or contact a crisis line. You don't have to handle this alone.";
  return {
    riskLevel: 'crisis',
    patterns: [],
    action: 'crisis',
    recommendedMode: 'abort',
    guidanceDuration: 30,
    message,
  };
}
