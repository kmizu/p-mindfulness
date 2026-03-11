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
  readonly themes: readonly string[];    // e.g. ['work_stress', 'sleep_issues']
  readonly anchors: readonly string[];   // concrete details: ['tight shoulders', 'deadline tomorrow']
  readonly emotionalTone: 'distressed' | 'neutral' | 'positive' | 'mixed';
}

export interface SessionPlan {
  readonly riskLevel: RiskLevel;
  readonly patterns: readonly HarmfulPattern[];
  readonly action: SupervisorAction;
  readonly recommendedMode: GuidanceMode;
  readonly guidanceDuration: GuidanceDuration;
  readonly message: string;
  readonly reflectionSummary: string;
  readonly guidanceHints: readonly string[];  // context for Expert Alignment Agent
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
