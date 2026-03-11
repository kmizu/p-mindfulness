'use client';

import { useReducer, useCallback } from 'react';
import type {
  CheckinData,
  SupervisorDecision,
  GuidanceScript,
  PostOutcome,
  PersonalizationHints,
} from '@/lib/types';

// ── State machine types ───────────────────────────────────────────────────────

export type SessionStep =
  | { step: 'checkin' }
  | { step: 'review'; checkin: CheckinData; decision: SupervisorDecision; hints: PersonalizationHints }
  | { step: 'session'; checkin: CheckinData; decision: SupervisorDecision; guidance: GuidanceScript; sessionId: string }
  | { step: 'post'; sessionId: string; checkin: CheckinData }
  | { step: 'done' };

type SessionAction =
  | { type: 'CHECKIN_DONE'; checkin: CheckinData; decision: SupervisorDecision; hints: PersonalizationHints }
  | { type: 'SESSION_START'; guidance: GuidanceScript; sessionId: string }
  | { type: 'ESCALATE'; decision: SupervisorDecision; guidance: GuidanceScript }
  | { type: 'SESSION_END' }
  | { type: 'POST_DONE' }
  | { type: 'RESET' };

function reducer(state: SessionStep, action: SessionAction): SessionStep {
  switch (action.type) {
    case 'CHECKIN_DONE':
      if (state.step !== 'checkin') return state;
      return {
        step: 'review',
        checkin: action.checkin,
        decision: action.decision,
        hints: action.hints,
      };

    case 'SESSION_START':
      if (state.step !== 'review') return state;
      return {
        step: 'session',
        checkin: state.checkin,
        decision: state.decision,
        guidance: action.guidance,
        sessionId: action.sessionId,
      };

    case 'ESCALATE':
      if (state.step !== 'session') return state;
      return {
        step: 'session',
        checkin: state.checkin,
        decision: action.decision,
        guidance: action.guidance,
        sessionId: state.sessionId,
      };

    case 'SESSION_END':
      if (state.step !== 'session') return state;
      return { step: 'post', sessionId: state.sessionId, checkin: state.checkin };

    case 'POST_DONE':
      if (state.step !== 'post') return state;
      return { step: 'done' };

    case 'RESET':
      return { step: 'checkin' };

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSessionMachine(locale = 'en') {
  const [state, dispatch] = useReducer(reducer, { step: 'checkin' });

  const submitCheckin = useCallback(async (checkin: CheckinData) => {
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...checkin, locale }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    dispatch({
      type: 'CHECKIN_DONE',
      checkin,
      decision: json.data.decision,
      hints: json.data.hints,
    });
    return json.data.decision as SupervisorDecision;
  }, []);

  const startSession = useCallback(async (
    decision: SupervisorDecision,
    checkin: CheckinData
  ) => {
    // Fetch guidance
    const guidanceRes = await fetch('/api/guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: decision.recommendedMode,
        duration: decision.guidanceDuration,
        riskLevel: decision.riskLevel,
        supervisorMessage: decision.message,
        locale,
      }),
    });
    const guidanceJson = await guidanceRes.json();
    if (!guidanceJson.success) throw new Error(guidanceJson.error);
    const guidance = guidanceJson.data.script as GuidanceScript;

    // Save session
    const sessionRes = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkin, supervisorDecision: decision, guidance }),
    });
    const sessionJson = await sessionRes.json();
    if (!sessionJson.success) throw new Error(sessionJson.error);

    dispatch({
      type: 'SESSION_START',
      guidance,
      sessionId: sessionJson.data.id,
    });

    return { guidance, sessionId: sessionJson.data.id };
  }, []);

  const reportWorse = useCallback(async (
    userReport: string,
    checkin: CheckinData
  ) => {
    const res = await fetch('/api/supervisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userReport, checkin, locale }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const newDecision = json.data.decision as SupervisorDecision;

    // Fetch updated guidance
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
  }, []);

  const endSession = useCallback(() => {
    dispatch({ type: 'SESSION_END' });
  }, []);

  const submitPost = useCallback(async (sessionId: string, postOutcome: PostOutcome) => {
    const res = await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionId, postOutcome }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    dispatch({ type: 'POST_DONE' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    submitCheckin,
    startSession,
    reportWorse,
    endSession,
    submitPost,
    reset,
  };
}
