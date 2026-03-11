import type {
  RiskLevel, HarmfulPattern, SupervisorAction, GuidanceMode, GuidanceDuration,
  SessionIntent, LastSessionOutcome,
} from '@/lib/types';

export interface ConversationMessage {
  readonly role: 'agent' | 'user';
  readonly content: string;
}

export interface ReflectionProfile {
  readonly mood: 1 | 2 | 3 | 4 | 5;
  readonly tension: 1 | 2 | 3 | 4 | 5;
  readonly selfCritical: boolean;
  readonly intent: SessionIntent;
  readonly lastSessionOutcome?: LastSessionOutcome;
  readonly freeText: string;
  readonly themes: readonly string[];             // e.g. ['work_stress', 'sleep_issues']
  readonly anchors: readonly string[];            // concrete details: ['tight shoulders', 'deadline tomorrow']
  readonly emotionalTone: 'distressed' | 'neutral' | 'positive' | 'mixed';
  readonly mentionedTechnique?: string | null;    // paper Turn 3: concept the user mentioned
}

// Paper §3.3 — Personalization Agent 6-parameter output
export type GuidanceLevel = 'minimal' | 'moderate' | 'detailed';

export interface SessionPlan {
  readonly riskLevel: RiskLevel;
  readonly patterns: readonly HarmfulPattern[];
  readonly action: SupervisorAction;
  // ── Paper's 6 personalization dimensions ──────────────────────────────
  readonly mood: 1 | 2 | 3 | 4 | 5;               // 1. Mood
  readonly goal: SessionIntent;                      // 2. User goal
  readonly recommendedMode: GuidanceMode;            // 3. Technique selection
  readonly guidanceDuration: GuidanceDuration;       // 4. Session duration
  readonly guidanceLevel: GuidanceLevel;             // 5. Guidance level
  readonly practiceHistorySummary: string;           // 6. Practice history (from memory)
  // ── Supervision output ────────────────────────────────────────────────
  readonly message: string;
  readonly reflectionSummary: string;
  readonly guidanceHints: readonly string[];
}

export interface UserMemory {
  readonly version: number;
  readonly lastUpdated: string;
  readonly sessionCount: number;
  readonly corePatterns: readonly string[];     // recurring harmful patterns
  readonly whatHelps: readonly string[];        // what consistently works
  readonly whatHurts: readonly string[];        // what consistently makes things worse
  readonly lifeContext: readonly string[];      // recurring stressors / contexts
  readonly languageNotes: readonly string[];    // how to speak with this person
  readonly trajectory: string;                 // brief narrative of practice evolution
}

export const EMPTY_MEMORY: UserMemory = {
  version: 0,
  lastUpdated: '',
  sessionCount: 0,
  corePatterns: [],
  whatHelps: [],
  whatHurts: [],
  lifeContext: [],
  languageNotes: [],
  trajectory: '',
};
