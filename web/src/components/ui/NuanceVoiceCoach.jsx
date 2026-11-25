import { useEffect, useRef, useState } from 'react';
import { useNuanceConversation } from '@nuancelabs/js-sdk/react';
import { supabase } from '../../lib/supabaseClient.js';
import './nuanceVoiceCoach.css';

async function fetchToken() {
  const { data, error } = await supabase.functions.invoke('nuance-session', { body: {} });
  if (error) {
    let message;
    try { message = (await error.context.json()).error; } catch { message = error.message; }
    throw new Error(message || 'Voice coach is unavailable right now.');
  }
  if (!data?.token) throw new Error(data?.error || 'Voice coach is unavailable right now.');
  return data.token;
}

export default function NuanceVoiceCoach({ open, onClose }) {
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState([]);
  const started = useRef(false);
  const { state, error, videoRef, audioRef, start, end, conversation } = useNuanceConversation({ token: fetchToken });

  // Start once when opened, reset when closed.
  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      setCaption(''); setNotes([]);
      start().catch(() => {});
    }
    if (!open) started.current = false;
  }, [open, start]);

  // Auto-close only when a live session ends; a failed start shows its error instead.
  useEffect(() => {
    if (state === 'disconnected' && open) onClose();
  }, [state, open, onClose]);

  // Run the persona's tool calls (show_note).
  useEffect(() => {
    if (!conversation) return;
    return conversation.onToolCall(async (call) => {
      if (call.name === 'show_note') {
        setNotes((n) => [...n, { title: String(call.arguments?.title || ''), text: String(call.arguments?.text || '') }]);
        await conversation.sendToolResult(call.callId, { ok: true });
      } else {
        await conversation.sendToolResult(call.callId, { error: { message: 'Tool not found' } });
      }
    });
  }, [conversation]);

  // Live captions from the persona.
  useEffect(() => {
    if (!conversation) return;
    return conversation.onInterfaceEvent((event) => {
      if (event.type === 'session.output_transcript.delta') {
        setCaption((c) => (c + String(event.delta || '')).slice(-800));
      }
    });
  }, [conversation]);

  if (!open) return null;

  const connecting = state === 'idle' || state === 'queued' || state === 'connecting';

  return (
    <div className="voice-coach" role="dialog" aria-modal="true" aria-label="Video voice coach">
      <video ref={videoRef} autoPlay playsInline className="voice-coach-avatar" />
      <audio ref={audioRef} autoPlay />
      <div className="voice-coach-bar">
        <span className="voice-coach-live">● {state === 'connected' ? 'Live' : connecting ? 'Connecting…' : state}</span>
        <button type="button" className="btn btn-primary" onClick={() => { end().catch(() => {}); onClose(); }}>Close</button>
      </div>
      {connecting && !error && <p className="voice-coach-caption">Connecting to your coach…</p>}
      {caption && <p className="voice-coach-caption" aria-live="polite">{caption}</p>}
      {notes.map((n, i) => (
        <div className="voice-coach-note" key={i}>{n.title && <strong>{n.title}</strong>}<span>{n.text}</span></div>
      ))}
      {error && <p className="voice-coach-error" role="alert">{error.message}</p>}
    </div>
  );
}
