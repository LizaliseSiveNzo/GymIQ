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
  const [avatarReady, setAvatarReady] = useState(false);
  const started = useRef(false);
  const audioCtx = useRef(null);
  const sourceNode = useRef(null);
  const selfVideoRef = useRef(null);
  const selfStream = useRef(null);
  const { state, error, videoRef, audioRef, start, end, conversation } = useNuanceConversation({ token: fetchToken });

  // Enumerate audio output devices and auto-route to the loud speaker.
  useEffect(() => {
    let md;
    try { md = navigator.mediaDevices; } catch { md = null; }
    if (!md?.enumerateDevices) return;
    const load = () => {
      try {
        md.enumerateDevices()
          .then((devs) => {
            const outputs = devs.filter((d) => d.kind === 'audiooutput' && d.deviceId);
            setAudioDevices(outputs);
            // Prefer the loudspeaker over the earpiece/headset.
            const speaker = outputs.find((d) => /speaker/i.test(d.label || '') && !/ear|headset/i.test(d.label || '')) || outputs[0];
            if (speaker) setSinkId(speaker.deviceId);
          })
          .catch(() => {});
      } catch { /* ignore */ }
    };
    load();
    try { md.addEventListener?.('devicechange', load); } catch { /* older browsers */ }
    return () => { try { md.removeEventListener?.('devicechange', load); } catch { /* ok */ } };
  }, []);

  // Apply the chosen output to the persona's audio element once it is live.
  useEffect(() => {
    if (!open || !sinkId) return;
    const el = document.getElementById('nuance-audio');
    if (el && typeof el.setSinkId === 'function') el.setSinkId(sinkId).catch(() => {});
  }, [open, sinkId, avatarReady]);

  // Route the persona's voice to the chosen output.
  function chooseSink(id) {
    setSinkId(id);
    const el = document.getElementById('nuance-audio');
    if (el && typeof el.setSinkId === 'function') {
      el.setSinkId(id).catch(() => {});
    }
  }

  function toggleMute() {
    let avatar;
    try { avatar = conversation?.avatar; } catch { return; }
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

  // Close on session end, and route the persona's voice through Web Audio
  // so it plays on the loud speaker instead of the earpiece.
  useEffect(() => {
    if (!conversation) return;
    return conversation.onChange((event) => {
      if (event.type === 'session-ended') onClose();
      if (event.type === 'tracks-changed') {
        setAvatarReady(true);
        try {
          let avatar;
          try { avatar = conversation.avatar; } catch { return; }
          const track = avatar?.audioTrack?.mediaStreamTrack;
          if (!track) return;
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          if (!audioCtx.current) audioCtx.current = new AC();
          const ctx = audioCtx.current;
          if (ctx.state === 'suspended') { try { ctx.resume(); } catch { /* ignore */ } }
          if (sourceNode.current) { try { sourceNode.current.disconnect(); } catch { /* ignore */ } }
          sourceNode.current = ctx.createMediaStreamSource(new MediaStream([track]));
          sourceNode.current.connect(ctx.destination);
          const el = document.getElementById('nuance-audio');
          if (el) el.muted = true;
        } catch { /* ignore */ }
      }
    });
  }, [conversation, onClose]);

  // Tear down the audio graph when the coach screen unmounts.
  useEffect(() => () => {
    try { sourceNode.current?.disconnect(); } catch { /* ignore */ }
    try { audioCtx.current?.close(); } catch { /* ignore */ }
    sourceNode.current = null;
    audioCtx.current = null;
  }, []);

  // Show the user's own camera in a self-view so they can see what the AI sees.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        selfStream.current = stream;
        if (selfVideoRef.current) selfVideoRef.current.srcObject = stream;
      } catch { /* camera unavailable or denied — no self-view */ }
    })();
    return () => {
      cancelled = true;
      selfStream.current?.getTracks().forEach((t) => t.stop());
      selfStream.current = null;
    };
  }, [open]);

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
      <div className="voice-coach-stage">
        <video ref={videoRef} autoPlay playsInline className="voice-coach-avatar" />
        <video ref={selfVideoRef} autoPlay playsInline muted className="voice-coach-self" />
        <audio ref={audioRef} id="nuance-audio" autoPlay />
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
        <button type="button" className="btn btn-secondary" onClick={toggleMute} disabled={!avatarReady}>{muted ? 'Unmute' : 'Mute'}</button>
      </div>
    </div>
  );
}
