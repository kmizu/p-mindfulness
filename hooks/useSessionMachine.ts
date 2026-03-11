'use client';

import { useReducer, useCallback } from 'react';
import type {
  SupervisorDecision,
  GuidanceScript,
  PostOutcome,
  PersonalizationHints,
  ReflectionProfile,
} from '@/lib/types';

// ── State machine types ───────────────────────────────────────────────────────

export type SessionStep =
  | { step: 'reflecting' }
  | {
      step: 'review';
      profile: ReflectionProfile;
      decision: SupervisorDecision;
      hints: PersonalizationHints;
    }
  | {
      step: 'session';
      profile: ReflectionProfile;
      decision: SupervisorDecision;
      guidance: GuidanceScript;
      sessionId: string;
    }
  | { step: 'post'; sessionId: string; profile: ReflectionProfile; decision: SupervisorDecision }
  | { step: 'done' };

type SessionAction =
  | {
      type: 'REFLECTION_DONE';
      profile: ReflectionProfile;
      decision: SupervisorDecision;
      hints: PersonalizationHints;
    }
  | { type: 'SESSION_START'; guidance: GuidanceScript; sessionId: string }
  | { type: 'ESCALATE'; decision: SupervisorDecision; guidance: GuidanceScript }
  | { type: 'SESSION_END' }
  | { type: 'POST_DONE' }
  | { type: 'RESET' };

function reducer(state: SessionStep, action: SessionAction): SessionStep {
  switch (action.type) {
    case 'REFLECTION_DONE':
      if (state.step !== 'reflecting') return state;
      return {
        step: 'review',
        profile: action.profile,
        decision: action.decision,
        hints: action.hints,
      };

    case 'SESSION_START':
      if (state.step !== 'review') return state;
      return {
        step: 'session',
        profile: state.profile,
        decision: state.decision,
        guidance: action.guidance,
        sessionId: action.sessionId,
      };

    case 'ESCALATE':
      if (state.step !== 'session') return state;
      return {
        step: 'session',
        profile: state.profile,
        decision: action.decision,
        guidance: action.guidance,
        sessionId: state.sessionId,
      };

    case 'SESSION_END':
      if (state.step !== 'session') return state;
      return {
        step: 'post',
        sessionId: state.sessionId,
        profile: state.profile,
        decision: state.decision,
      };

    case 'POST_DONE':
      if (state.step !== 'post') return state;
      return { step: 'done' };

    case 'RESET':
      return { step: 'reflecting' };

    default:
      return state;
  }
}

// ── Helper: map SessionPlan → SupervisorDecision ─────────────────────────────

function planToDecision(plan: {
  riskLevel: string;
  patterns: string[];
  action: string;
  recommendedMode: string;
  message: string;
  guidanceDuration: 30 | 60 | 180;
}): SupervisorDecision {
  return {
    riskLevel: plan.riskLevel as SupervisorDecision['riskLevel'],
    patterns: plan.patterns as SupervisorDecision['patterns'],
    action: plan.action as SupervisorDecision['action'],
    recommendedMode: plan.recommendedMode as SupervisorDecision['recommendedMode'],
    message: plan.message,
    guidanceDuration: plan.guidanceDuration,
  };
}

// ── Empty hints constant ──────────────────────────────────────────────────────

const EMPTY_HINTS: PersonalizationHints = {
  recentPatterns: [],
  preferredMode: null,
  avoidMode: null,
  avgTension: 3,
  sessionCount: 0,
  lastRiskLevel: null,
  notes: [],
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSessionMachine(locale = 'en') {
  const [state, dispatch] = useReducer(reducer, { step: 'reflecting' });

  // Called when reflection chat completes with a profile
  const personalize = useCallback(async (profile: ReflectionProfile) => {
    const res = await fetch('/api/personalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, locale }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const plan = json.data.plan;
    dispatch({
      type: 'REFLECTION_DONE',
      profile,
      decision: planToDecision(plan),
      hints: EMPTY_HINTS,
    });
    return planToDecision(plan) as SupervisorDecision;
  }, [locale]);

  const startSession = useCallback(async (
    decision: SupervisorDecision,
    profile: ReflectionProfile
  ) => {
    // Build a minimal plan object for the guidance API
    const plan = {
      riskLevel: decision.riskLevel,
      patterns: [...decision.patterns],
      action: decision.action,
      recommendedMode: decision.recommendedMode,
      guidanceDuration: decision.guidanceDuration,
      message: decision.message,
      reflectionSummary: '',
      guidanceHints: [] as string[],
    };

    // Fetch guidance using the Expert Alignment Agent
    const guidanceRes = await fetch('/api/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: decision.recommendedMode,
        duration: decision.guidanceDuration,
        riskLevel: decision.riskLevel,
        supervisorMessage: decision.message,
        locale,
        plan,
      }),
    });
    const guidanceJson = await guidanceRes.json();
    if (!guidanceJson.success) throw new Error(guidanceJson.error);
    const guidance = guidanceJson.data.script as GuidanceScript;

    // Save session with reflection data
    const sessionRes = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkin: {
          mood: profile.mood,
          tension: profile.tension,
          selfCritical: profile.selfCritical,
          intent: profile.intent,
          lastSessionOutcome: profile.lastSessionOutcome,
          freeText: profile.freeText,
        },
        supervisorDecision: decision,
        guidance,
        reflectionProfile: JSON.stringify(profile),
        reflectionSummary: plan.reflectionSummary,
      }),
    });
    const sessionJson = await sessionRes.json();
    if (!sessionJson.success) throw new Error(sessionJson.error);

    dispatch({
      type: 'SESSION_START',
      guidance,
      sessionId: sessionJson.data.id,
    });

    return { guidance, sessionId: sessionJson.data.id as string };
  }, [locale]);

  const reportWorse = useCallback(async (
    userReport: string,
    profile: ReflectionProfile
  ) => {
    const res = await fetch('/api/supervisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userReport,
        checkin: {
          mood: profile.mood,
          tension: profile.tension,
          selfCritical: profile.selfCritical,
          intent: profile.intent,
          lastSessionOutcome: profile.lastSessionOutcome,
          freeText: profile.freeText,
        },
        locale,
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const newDecision = json.data.decision as SupervisorDecision;

    const guidanceRes = await fetch('/api/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: newDecision.recommendedMode,
        duration: 30,
        riskLevel: newDecision.riskLevel,
        supervisorMessage: newDecision.message,
        locale,
      }),
    });
    const guidanceJson = await guidanceRes.json();
    const newGuidance = guidanceJson.data?.script as GuidanceScript;

    dispatch({ type: 'ESCALATE', decision: newDecision, guidance: newGuidance });
    return newDecision;
  }, [locale]);

  const endSession = useCallback(() => {
    dispatch({ type: 'SESSION_END' });
  }, []);

  const submitPost = useCallback(async (sessionId: string, postOutcome: PostOutcome) => {
    const res = await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionId, postOutcome, locale }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    dispatch({ type: 'POST_DONE' });
  }, [locale]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    personalize,
    startSession,
    reportWorse,
    endSession,
    submitPost,
    reset,
  };
}
