# mindfulness-supervisor

[日本語](README-ja.md)

A supervision-first mindfulness app. Not a teacher — a safety monitor that gradually learns how practice works for you.

Inspired by the 3-agent architecture described in [MindfulAgents: A Multi-Agent Framework for Mindfulness Practice](https://arxiv.org/abs/2603.06926) — implemented as a single local app with a Reflection Agent, Personalization Agent, and Expert Alignment Agent.

## What it does

Before each session, a counselor-style conversational agent asks how you are. Your responses are analyzed to detect when practice is likely to harm rather than help: self-judgment, internal surveillance, forced acceptance, compulsive continuation, performance framing. The supervisor adapts its guidance accordingly and builds a growing picture of what works for you over time.

1. **Conversation** — a 2–3 turn dialogue before the session (Reflection Agent)
2. **Supervisor review** — evaluates risk, recommends mode and duration (Personalization Agent + long-term memory)
3. **Session** — short guided practice (30s / 1min / 3min), personalized to your state (Expert Alignment Agent)
   - "This is making it worse" button always visible
4. **Post-session reflection** — did this help or add pressure?
5. **History** — past sessions; memory updates in the background after each one

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local — add API keys (both optional)
npm run dev
```

Open http://localhost:3000 (or /en, /ja for localized).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | No | LLM-based agents (gpt-5.4). Without this, rule-based detection + preset scripts. |
| `ELEVENLABS_API_KEY` | No | Voice playback. Without this, guidance is text-only. |
| `ELEVENLABS_VOICE_ID` | No | Voice ID. Defaults to a calm English voice. |

The app works fully offline (no API keys). Supervision uses keyword detection, guidance uses preset scripts.

## Architecture

Three agents run in sequence each session:

- **Reflection Agent** — conversational check-in (2–3 turns), extracts a `ReflectionProfile`
- **Personalization Agent** — builds a `SessionPlan` using the profile + long-term `UserMemory` + rule-based pattern detection
- **Expert Alignment Agent** — generates personalized guidance text from the plan

Long-term memory (counselor-style case notes) accumulates across sessions and shapes future recommendations.

See `docs/architecture.md` and `docs/safety-model.md` for details.

## Data

Sessions and user memory stored locally in `data/mindfulness.db` (SQLite via LibSQL).
TTS audio cached in `data/tts-cache/`. Neither is committed to git.
