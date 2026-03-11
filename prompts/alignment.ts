import type { GuidanceMode, GuidanceDuration, RiskLevel } from '@/lib/types';
import type { SessionPlan } from '@/lib/agents/types';

export function buildAlignmentPrompt(
  mode: GuidanceMode,
  duration: GuidanceDuration,
  plan: SessionPlan,
  locale: string
): string {
  const lang = locale === 'ja' ? 'Japanese' : 'English';
  const durationDesc = duration === 30 ? '30 seconds' : duration === 60 ? '1 minute' : '3 minutes';

  const hintsSection = plan.guidanceHints.length > 0
    ? `\nPersonalization context:\n${plan.guidanceHints.map(h => `- ${h}`).join('\n')}\n`
    : '';

  return `Write a ${durationDesc} mindfulness guidance script.

Mode: ${mode} (${getModeDescription(mode)})
Risk level: ${plan.riskLevel}
State summary: ${plan.reflectionSummary}
${hintsSection}
Style rules (non-negotiable):
- Write in ${lang}
- NO "just", "relax", "let go", "accept", "surrender"
- NO spiritual language: "energy", "being", "presence", "healing", "universe"
- NO imperative pressure: "you should", "you must", "try to"
- NO evaluation: "good", "well done", "right", "perfect"
- NO promises: "you'll feel", "this will help", "this will heal"
- Sensory and specific — name actual sensations, sounds, surfaces
- Permissive, not directive: "you could..." not "now you will..."
- If the person mentioned something specific (tight shoulders, a sound, temperature) — weave it in naturally
- Duration-appropriate: 30s = one anchor only; 1min = one anchor with gentle variation; 3min = two anchors with transition

Return ONLY the guidance text. No title, no label, no explanation.`;
}

function getModeDescription(mode: GuidanceMode): string {
  const descriptions: Record<string, string> = {
    breath: 'noticing breath without changing it',
    sound: 'passive listening to environmental sounds',
    body: 'weight, pressure, contact sensations',
    external: 'visual field and surfaces in the room',
    reset: 'brief grounding, short and simple',
    abort: 'safe stop — do not use this function for abort mode',
  };
  return descriptions[mode] ?? mode;
}
