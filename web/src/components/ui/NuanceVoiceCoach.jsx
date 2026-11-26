import { useEffect, useRef, useState } from 'react';
import { useNuanceConversation } from '@nuancelabs/js-sdk/react';
import { supabase } from '../../lib/supabaseClient.js';
import './nuanceVoiceCoach.css';

async function fetchToken() {
  const { data, error } = await supabase.functions.invoke('nuance-session', { body: {} });
  if (error) {
    let message;
    try { message = (await error.context.json()).error; } catch { message = error.message; }
    console.error('nuance-session invoke failed:', error);
    throw new Error(message === 'Failed to fetch' ? 'Could not reach the voice coach. Check your connection and try again.' : (message || 'Voice coach is unavailable right now.'));
  }
  if (!data?.token) throw new Error(data?.error || 'Voice coach is unavailable right now.');
  return data.token;
}

export default function NuanceVoiceCoach({ open, onClose }) {
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState([]);
  const [copied, setCopied] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);
  const [sinkId, setSinkId] = useState('');
  const [muted, setMuted] = useState(false);
  const audioEl = useRef(null);
  const started = useRef(false);
  const { state, error, videoRef, audioRef, start, end, conversation } = useNuanceConversation({ token: fetchToken });

  // Enumerate audio output devices (speaker, earpiece, Bluetooth).
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const load = () => navigator.mediaDevices.enumerateDevices()
      .then((devs) => setAudioDevices(devs.filter((d) => d.kind === 'audiooutput')))
      .catch(() => {});
    load();
    try { navigator.mediaDevices.addEventListener?.('devicechange', load); } catch { /* older browsers */ }
    return () => { try { navigator.mediaDevices.removeEventListener?.('devicechange', load); } catch { /* ok */ } };
  }, []);

  // Route the persona's voice to the chosen output.
  function chooseSink(id) {
    setSinkId(id);
    if (audioEl.current && typeof audioEl.current.setSinkId === 'function') {
      audioEl.current.setSinkId(id).catch(() => {});
    }
  }

  function toggleMute() {
    const avatar = conversation?.avatar;
    if (!avatar) return;
    const next = !muted;
    setMuted(next);
    if (next) avatar.muteAudio?.(); else avatar.unmuteAudio?.();
  }

  function copyError(err) {
    const text = JSON.stringify({ name: err?.name, message: err?.message, status: err?.status, code: err?.code, state, stack: String(err?.stack || '').slice(0, 800) }, null, 2);
    try { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  // Start once when opened.
  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      setCaption(''); setNotes([]);
      start().catch((e) => { console.error('Nuance start failed:', e); });
    }
    if (!open) started.current = false;
  }, [open, start]);

  // Close only when the persona/server ends the session naturally.
  useEffect(() => {
    if (!conversation) return;
    return conversation.onChange((event) => {
      if (event.type === 'session-ended') onClose();
    });
  }, [conversation, onClose]);

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
  const setAudioEl = (el) => { audioEl.current = el; audioRef(el); };

  return (
    <div className="voice-coach" role="dialog" aria-modal="true" aria-label="Video voice coach">
      <div className="voice-coach-stage">
        <video ref={videoRef} autoPlay playsInline className="voice-coach-avatar" />
        <audio ref={setAudioEl} autoPlay />
        <div className="voice-coach-bar">
          <span className="voice-coach-live">● {state === 'connected' ? 'Live' : connecting ? 'Connecting…' : state}</span>
          <button type="button" className="voice-coach-close" onClick={() => { end().catch(() => {}); onClose(); }} aria-label="End call">✕</button>
        </div>
      </div>
      {connecting && !error && <p className="voice-coach-caption">Connecting to your coach…</p>}
      {caption && <p className="voice-coach-caption" aria-live="polite">{caption}</p>}
      {notes.map((n, i) => (
        <div className="voice-coach-note" key={i}>{n.title && <strong>{n.title}</strong>}<span>{n.text}</span></div>
      ))}
      {error && (
        <div className="voice-coach-error" role="alert">
          <strong>{error.name || 'Error'}{error.status != null ? ` · HTTP ${error.status}${error.code ? ' ' + error.code : ''}` : ''} · state "{state}"</strong>
          <p>{error.message}</p>
          <button type="button" className="btn btn-ghost" onClick={() => copyError(error)}>{copied ? 'Copied ✓' : 'Copy error'}</button>
        </div>
      )}
      <div className="voice-coach-settings">
        <label>Audio output
          <select value={sinkId} onChange={(e) => chooseSink(e.target.value)}>
            <option value="">Default</option>
            {audioDevices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Output ${audioDevices.indexOf(d) + 1}`}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-secondary" onClick={toggleMute} disabled={!conversation?.avatar}>{muted ? 'Unmute' : 'Mute'}</button>
      </div>
    </div>
  );
}
