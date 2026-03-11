import type { GuidanceMode, GuidanceDuration, GuidanceScript } from '@/lib/types';
import type { SessionPlan } from './types';
import { getPreset, isAlwaysPreset } from '@/lib/guidance/presets';
import { isLLMConfigured, complete } from '@/lib/llm/client';
import { buildAlignmentPrompt } from '@/prompts/alignment';

const STYLE_VIOLATIONS = [
  /\bjust\b/gi, /\brelax\b/gi, /\blet go\b/gi, /\bsurrender\b/gi,
  /\bchakra\b/gi, /\benergy\b/gi, /\bhealing\b/gi, /\buniverse\b/gi,
  /\bsacred\b/gi, /\byou should\b/gi, /\byou must\b/gi, /\btry to\b/gi,
  /\byou'll feel\b/gi, /\bthis will help\b/gi,
];

function countViolations(text: string): number {
  return STYLE_VIOLATIONS.filter(re => re.test(text)).length;
}

function fixViolations(text: string): string {
  return text
    .replace(/\bjust\s+/gi, '')
    .replace(/\byou should\b/gi, '')
    .replace(/\byou must\b/gi, '')
    .replace(/\btry to\b/gi, '');
}

export async function generateAlignedGuidance(
  plan: SessionPlan,
  locale: string
): Promise<GuidanceScript> {
  const mode = plan.recommendedMode;
  const duration = plan.guidanceDuration;

  // Always preset for critical stops
  if (isAlwaysPreset(mode)) {
    return { mode, duration, text: getPreset(mode, duration, locale), isPreset: true };
  }

  // No LLM — use preset
  if (!isLLMConfigured()) {
    return { mode, duration, text: getPreset(mode, duration, locale), isPreset: true };
  }

  try {
    const prompt = buildAlignmentPrompt(mode, duration, plan, locale);
    const lang = locale === 'ja' ? 'Japanese' : 'English';
    const raw = await complete(
      `You write short, concrete mindfulness guidance scripts in ${lang}. No spiritual language. No promises. No pressure.`,
      prompt,
      500
    );

    let text = raw.trim();

    if (countViolations(text) > 0) {
      text = fixViolations(text);
      if (countViolations(text) > 2) {
        return { mode, duration, text: getPreset(mode, duration, locale), isPreset: true };
      }
    }

    return { mode, duration, text, isPreset: false };
  } catch (err) {
    console.error('[alignment] LLM failed, using preset:', err);
    return { mode, duration, text: getPreset(mode, duration, locale), isPreset: true };
  }
}
