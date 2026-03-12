'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { ConversationMessage, ReflectionProfile } from '@/lib/types';
import { CrisisBanner } from './CrisisBanner';
import { useRealtimeSTT } from '@/hooks/useRealtimeSTT';

interface ReflectionChatProps {
  locale: string;
  onDone: (profile: ReflectionProfile) => void;
  loading?: boolean;
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i}
          className={i === 0 ? 'dot-pulse' : i === 1 ? 'dot-pulse-2' : 'dot-pulse-3'}
          style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--sage)', opacity: 0.5 }}
        />
      ))}
    </span>
  );
}

function AgentMessage({ content }: { content: string }) {
  return (
    <div className="animate-fade-up" style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', marginBottom: '1.6rem' }}>
      <div style={{
        flexShrink: 0, marginTop: '0.2rem', width: '28px', height: '28px',
        borderRadius: '50%', background: 'var(--sage-l)', border: '1px solid #c8d9ca',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '10px', color: 'var(--sage)', lineHeight: 1 }}>●</span>
      </div>
      <div style={{ flex: 1, paddingTop: '0.15rem' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.85, fontWeight: 300 }}>
          {content}
        </p>
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.6rem' }}>
      <div style={{
        maxWidth: '78%', padding: '0.7rem 1.1rem',
        background: 'var(--warm-l)', borderRadius: '1.2rem 1.2rem 0.3rem 1.2rem',
        border: '1px solid #e0d8ce',
      }}>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.75, fontWeight: 300 }}>
          {content}
        </p>
      </div>
    </div>
  );
}

// ── Mic toggle button ─────────────────────────────────────────────────────────

function MicToggle({
  listening,
  recording,
  connecting,
  onToggle,
}: {
  listening: boolean;
  recording: boolean;
  connecting: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={connecting}
      title={listening ? (recording ? 'Listening...' : 'Mute') : 'Unmute'}
      style={{
        position: 'relative',
        width: '40px', height: '40px', borderRadius: '50%', border: 'none',
        cursor: connecting ? 'wait' : 'pointer',
        background: listening ? (recording ? '#c97070' : 'var(--sage-l)') : 'var(--cream-d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.25s',
        flexShrink: 0,
      }}
    >
      {/* pulse ring while actively detecting speech */}
      {recording && (
        <span style={{
          position: 'absolute', inset: '-4px', borderRadius: '50%',
          border: '2px solid #c97070', opacity: 0.45,
          animation: 'mic-pulse 1.2s ease-out infinite',
        }} />
      )}

      {/* mic-off strikethrough when muted */}
      {!listening ? (
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
          <rect x="5" y="1" width="6" height="9" rx="3" fill="#b0a89e" />
          <path d="M2 9c0 3.3 2.7 6 6 6s6-2.7 6-6" stroke="#b0a89e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <line x1="8" y1="15" x2="8" y2="17" stroke="#b0a89e" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2" y1="2" x2="14" y2="16" stroke="#b0a89e" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
          <rect x="4" y="1" width="6" height="9" rx="3" fill={recording ? '#fff' : 'var(--sage)'} />
          <path d="M1 8c0 3.3 2.7 6 6 6s6-2.7 6-6" stroke={recording ? '#fff' : 'var(--sage)'} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <line x1="7" y1="14" x2="7" y2="15.5" stroke={recording ? '#fff' : 'var(--sage)'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ReflectionChat({ locale, onDone, loading: externalLoading }: ReflectionChatProps) {
  const t = useTranslations('reflection');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [crisis, setCrisis] = useState(false);
  const [autoListen, setAutoListen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const stt = useRealtimeSTT(locale);

  // Keep a stable ref to sendMessage so auto-start effect doesn't re-run on every render
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const callReflect = useCallback(async (msgs: ConversationMessage[]) => {
    const res = await fetch('/api/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, locale }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'Reflection failed');
    return json.data as { agentMessage: string; done: boolean; crisis: boolean; profile?: ReflectionProfile };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    callReflect([])
      .then(result => { if (!cancelled) setMessages([{ role: 'agent', content: result.agentMessage }]); })
      .catch(() => { if (!cancelled) setError(t('error')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (stt.error) setError(stt.error);
  }, [stt.error]);

  const sendMessage = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading || externalLoading) return;

    const userMsg: ConversationMessage = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const result = await callReflect(updated);
      if (result.crisis) { setCrisis(true); return; }
      setMessages([...updated, { role: 'agent', content: result.agentMessage }]);
      if (result.done && result.profile) onDone(result.profile);
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  }, [input, loading, externalLoading, messages, callReflect, onDone, t]);

  // Keep ref in sync
  useEffect(() => {
    sendMessageRef.current = (text: string) => sendMessage(text);
  }, [sendMessage]);

  // Auto-start mic whenever agent message arrives and autoListen is on
  useEffect(() => {
    if (!autoListen || loading || externalLoading || crisis || stt.status !== 'idle') return;
    if (messages.length === 0) return;
    if (messages[messages.length - 1].role !== 'agent') return;

    const timer = setTimeout(() => {
      stt.start((text) => sendMessageRef.current(text));
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, messages, autoListen, crisis]);

  const toggleListen = useCallback(() => {
    if (stt.status === 'recording' || stt.status === 'connecting') {
      stt.stop();
      setAutoListen(false);
    } else {
      setAutoListen(true);
      if (!loading && messages.length > 0 && messages[messages.length - 1].role === 'agent') {
        stt.start((text) => sendMessageRef.current(text));
      }
    }
  }, [stt, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (crisis) return <CrisisBanner />;

  const busy = loading || (externalLoading ?? false);
  const isRecording = stt.status === 'recording';
  const isConnecting = stt.status === 'connecting';

  const statusHint = isConnecting
    ? (locale === 'ja' ? '接続中...' : 'Connecting...')
    : isRecording
    ? (locale === 'ja' ? '話し終えると自動で送信します' : 'Auto-sends when you stop speaking')
    : !autoListen
    ? (locale === 'ja' ? 'マイクオフ — マイクボタンで再開' : 'Muted — tap mic to resume')
    : (locale === 'ja' ? '準備中...' : 'Waiting...');

  return (
    <div style={{ maxWidth: '36rem', margin: '0 auto' }}>
      {/* Messages */}
      <div style={{ minHeight: '200px', paddingBottom: '0.5rem' }}>
        {messages.map((msg, i) =>
          msg.role === 'agent'
            ? <AgentMessage key={i} content={msg.content} />
            : <UserMessage key={i} content={msg.content} />
        )}

        {loading && (
          <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
            <div style={{
              flexShrink: 0, marginTop: '0.2rem', width: '28px', height: '28px',
              borderRadius: '50%', background: 'var(--sage-l)', border: '1px solid #c8d9ca',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '10px', color: 'var(--sage)', lineHeight: 1 }}>●</span>
            </div>
            <div style={{ paddingTop: '0.4rem' }}><TypingDots /></div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p style={{ fontSize: '0.8rem', color: '#b87070', margin: '0 0 1rem' }}>{error}</p>}

      {/* Interim STT text */}
      {isRecording && stt.interimText && (
        <p className="animate-fade-in" style={{
          fontSize: '0.88rem', color: 'var(--ink-mid)', fontStyle: 'italic',
          margin: '0 0 0.75rem', lineHeight: 1.7, paddingLeft: '0.25rem',
        }}>
          {stt.interimText}
        </p>
      )}

      {/* Input row */}
      <div style={{
        display: 'flex', gap: '0.75rem', alignItems: 'flex-end',
        padding: '0.75rem 1rem', background: '#fff', borderRadius: '1rem',
        border: isRecording ? '1px solid #e0b8b8' : '1px solid #e8e1d8',
        boxShadow: '0 1px 8px rgba(107, 130, 113, 0.06)',
        transition: 'border-color 0.2s',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? '' : t('placeholder')}
          rows={2}
          disabled={busy || isRecording || isConnecting}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            resize: 'none', fontSize: '0.88rem', lineHeight: 1.7,
            color: 'var(--ink)', fontFamily: 'inherit', fontWeight: 300,
            opacity: (busy || isConnecting) ? 0.4 : 1,
          }}
        />

        <MicToggle
          listening={autoListen}
          recording={isRecording}
          connecting={isConnecting}
          onToggle={busy ? () => {} : toggleListen}
        />

        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || busy || isRecording || isConnecting}
          style={{
            flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%',
            background: (!input.trim() || busy || isRecording || isConnecting) ? 'var(--cream-d)' : 'var(--sage)',
            border: 'none',
            cursor: (!input.trim() || busy || isRecording || isConnecting) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7h12M7 1l6 6-6 6"
              stroke={(!input.trim() || busy || isRecording || isConnecting) ? '#b0a89e' : '#fff'}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <p style={{ fontSize: '0.7rem', color: 'var(--ink-soft)', textAlign: 'center', marginTop: '0.75rem', opacity: 0.6 }}>
        {statusHint}
      </p>
    </div>
  );
}
