import type { GuidanceMode, GuidanceDuration, RiskLevel, GuidanceScript, PersonalizationHints } from '@/lib/types';
import { getPreset, isAlwaysPreset } from './presets';
import { isLLMConfigured, complete } from '@/lib/llm/client';
import { buildGuidancePrompt } from '@/prompts/guidance';

// ── Style violation checker ────────────────────────────────────────────────────

const STYLE_VIOLATIONS = [
  /\bjust\b/gi,
  /\brelax\b/gi,
  /\blet go\b/gi,
  /\bsurrender\b/gi,
  /\bchakra\b/gi,
  /\benergy\b/gi,
  /\bhealing\b/gi,
  /\buniverse\b/gi,
  /\bsacred\b/gi,
  /\bcosmic\b/gi,
  /\byou should\b/gi,
  /\byou must\b/gi,
  /\btry to\b/gi,
  /\byou'll feel\b/gi,
  /\bthis will help\b/gi,
  /\bwill heal\b/gi,
];

function checkStyleViolations(text: string): string[] {
  return STYLE_VIOLATIONS
    .filter(re => re.test(text))
    .map(re => re.toString().replace(/\/gi$/, '').replace(/^\/\\b/, '').replace(/\\b$/, ''));
}

function fixCommonViolations(text: string): string {
  return text
    .replace(/\bjust\s+/gi, '')
    .replace(/\byou should\b/gi, '')
    .replace(/\byou must\b/gi, '')
    .replace(/\btry to\b/gi, '');
}

// ── Main generator ─────────────────────────────────────────────────────────────

export async function generateGuidance(
  mode: GuidanceMode,
  duration: GuidanceDuration,
  riskLevel: RiskLevel,
  supervisorMessage: string,
  locale = 'en',
  _hints?: PersonalizationHints
): Promise<GuidanceScript> {
  // Always use presets for critical modes (no latency when stopping)
  if (isAlwaysPreset(mode)) {
    return {
      mode,
      duration,
      text: getPreset(mode, duration, locale),
      isPreset: true,
    };
  }

  // Fallback to presets when LLM not configured
  if (!isLLMConfigured()) {
    return {
      mode,
      duration,
      text: getPreset(mode, duration, locale),
      isPreset: true,
    };
  }

  try {
    const prompt = buildGuidancePrompt(mode, duration, riskLevel, supervisorMessage);
    const lang = locale === 'ja' ? 'Japanese' : 'English';
    const raw = await complete(
      `You write short, concrete mindfulness guidance scripts in ${lang}. No spiritual language. No promises.`,
      prompt,
      400
    );

    const violations = checkStyleViolations(raw);
    let text = raw.trim();

    if (violations.length > 0) {
      console.warn('[guidance] Style violations detected:', violations);
      text = fixCommonViolations(text);

      // If violations persist after fix, fall back to preset
      const remaining = checkStyleViolations(text);
      if (remaining.length > 2) {
        console.warn('[guidance] Too many violations after fix, using preset');
        return {
          mode,
          duration,
          text: getPreset(mode, duration, locale),
          isPreset: true,
        };
      }
    }

    return { mode, duration, text, isPreset: false };
  } catch (err) {
    console.error('[guidance] LLM generation failed, using preset:', err);
    return {
      mode,
      duration,
      text: getPreset(mode, duration, locale),
      isPreset: true,
    };
  }
}
