// Domain types for mindfulness-supervisor
// All types use readonly for immutability

export type RiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'crisis';

export type SupervisorAction =
  | 'proceed'
  | 'soften'
  | 'shorten'
  | 'switch'
  | 'stop'
  | 'crisis';

export type GuidanceMode =
  | 'breath'
  | 'sound'
  | 'body'
  | 'external'
  | 'reset'
  | 'abort';

export type GuidanceDuration = 30 | 60 | 180;

export type SessionIntent = 'calming' | 'grounding' | 'checkin';

export type LastSessionOutcome = 'relieving' | 'neutral' | 'pressuring';

export type HarmfulPattern =
  | 'perfectionism'
  | 'forced_acceptance'
  | 'overmonitoring'
  | 'performance_framing'
  | 'should_language'
  | 'compulsive_continuation'
  | 'breath_tension'
  | 'self_scoring'
  | 'rumination'
  | 'escalating_frustration';

export interface CheckinData {
  readonly mood: 1 | 2 | 3 | 4 | 5;
  readonly tension: 1 | 2 | 3 | 4 | 5;
  readonly selfCritical: boolean;
  readonly intent: SessionIntent;
  readonly lastSessionOutcome?: LastSessionOutcome;
  readonly freeText?: string;
}

export interface SupervisorDecision {
  readonly riskLevel: RiskLevel;
  readonly patterns: readonly HarmfulPattern[];
  readonly action: SupervisorAction;
  readonly recommendedMode: GuidanceMode;
  readonly message: string;
  readonly guidanceDuration: GuidanceDuration;
}

export interface GuidanceScript {
  readonly mode: GuidanceMode;
  readonly duration: GuidanceDuration;
  readonly text: string;
  readonly isPreset: boolean;
}

export interface PostOutcome {
  readonly feltBetter: boolean;
  readonly wouldContinue: boolean;
  readonly notes?: string;
}

export interface SessionRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly checkin: CheckinData;
  readonly supervisorDecision: SupervisorDecision;
  readonly guidance: GuidanceScript;
  readonly postOutcome?: PostOutcome;
  readonly summary?: string;
  readonly reflectionProfile?: string;
  readonly reflectionSummary?: string;
}

export interface PersonalizationHints {
  readonly recentPatterns: readonly HarmfulPattern[];
  readonly preferredMode: GuidanceMode | null;
  readonly avoidMode: GuidanceMode | null;
  readonly avgTension: number;
  readonly sessionCount: number;
  readonly lastRiskLevel: RiskLevel | null;
  readonly notes: readonly string[];
}

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

// Re-export agent types
export type { ConversationMessage, ReflectionProfile, SessionPlan, UserMemory } from '@/lib/agents/types';
export { EMPTY_MEMORY } from '@/lib/agents/types';
