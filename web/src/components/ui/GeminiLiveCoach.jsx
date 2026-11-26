import { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { supabase } from '../../lib/supabaseClient.js';
import './geminiLiveCoach.css';

const SYSTEM_PROMPT = `You are "Coach GymIQ", the built-in assistant for GymIQ, a South African fitness app that helps people train, eat and progress. You give practical, encouraging, evidence-based help with workouts, nutrition and habit-building. Keep replies short and spoken-friendly: one to four sentences, then ask what they want to do next. When you see the user on camera, watch their form and give simple, safe cues.`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'show_note',
        description: "Show a short note card on the user's screen. Use it when the user asks you to write something down, or to show a key point, number or short list they should keep.",
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'A few words; empty when none.' },
            text: { type: 'string', description: 'The note itself, up to 280 characters.' },
          },
          required: ['text'],
        },
      },
    ],
  },
];

const SESSION_LIMIT_MS = 110000; // audio+video sessions cap at ~2 min without compression

function toBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function proposalLabel(p) {
  if (p.kind === 'workout') return 'Workout ready to review';
  if (p.kind === 'meal_plan') return 'Daily meal plan ready';
  if (p.kind === 'log_food') return 'Meal ready to log';
  return 'Meal ready to save';
}
function proposalSummary(p) {
  const d = p.payload || {};
  if (p.kind === 'workout') return `${d.name || 'Programme'} · ${d.generated?.daysPerWeek || ''} training days · ${d.generated?.sessionMinutes || ''} min/session`;
  if (p.kind === 'meal_plan') return `Today · ~${Math.round(d.target || 0)} kcal across 4 meals`;
  return `${d.name || 'Meal'} · ${Math.round(d.kcal || 0)} kcal`;
}

export default function GeminiLiveCoach({ open, onClose }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | live | ended
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [muted, setMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState(null);
  const sessionRef = useRef(null);
  const playCtxRef = useRef(null);
  const selfVideoRef = useRef(null);
  const selfStream = useRef(null);
  const micStream = useRef(null);
  const micCtx = useRef(null);
  const cameraTimer = useRef(null);
  const limitTimer = useRef(null);
  const tickRef = useRef(null);
  const masterGain = useRef(null);
  const nextPlayTime = useRef(0);
  const started = useRef(false);

  function endAll() {
    try { cameraTimer.current && clearInterval(cameraTimer.current); } catch { /* ignore */ }
    try { limitTimer.current && clearTimeout(limitTimer.current); } catch { /* ignore */ }
    try { tickRef.current && clearInterval(tickRef.current); } catch { /* ignore */ }
    try { micCtx.current?.close(); } catch { /* ignore */ }
    try { micStream.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { selfStream.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { sessionRef.current?.close(); } catch { /* ignore */ }
    nextPlayTime.current = 0;
    cameraTimer.current = null; limitTimer.current = null; micCtx.current = null; micStream.current = null; selfStream.current = null; sessionRef.current = null;
  }

  function close() { endAll(); onClose(); }

  // Start once when opened.
  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    setCaption(''); setNotes([]); setProposals([]); setError(null); setMuted(false);
    run().catch((e) => { console.error('Gemini live failed:', e); setError(e); setStatus('ended'); });
    return () => { started.current = false; };
  }, [open]);

  async function run() {
    setStatus('connecting');
    const { data, error } = await supabase.functions.invoke('gymiq-live', { body: {} });
    const msg = (error && ((await error.context?.json?.().catch?.(() => null))?.error || error.message)) || data?.error;
    if (!data?.token) throw new Error(msg || 'The voice coach is unavailable right now.');

    const ai = new GoogleGenAI({ httpOptions: { apiVersion: 'v1beta' }, apiKey: data.token });
    const session = await ai.live.connect({
      model: data.model || 'gemini-3.8-live',
      callbacks: {
        onmessage: (m) => handleMessage(m),
        onerror: () => { setStatus('ended'); setError(new Error('The voice coach connection dropped.')); },
        onclose: () => { setStatus('ended'); },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: data.systemInstruction || SYSTEM_PROMPT }] },
        tools: data.tools || TOOLS,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });
    sessionRef.current = session;
    setStatus('live');
    startMic(session);
    startCamera();
    limitTimer.current = setTimeout(() => { setStatus('ended'); endAll(); }, SESSION_LIMIT_MS);
    setTimeLeft(Math.round(SESSION_LIMIT_MS / 1000));
    tickRef.current = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
  }

  function handleMessage(m) {
    const c = m?.serverContent;
    if (c?.interrupted) { setCaption(''); nextPlayTime.current = 0; }
    if (c?.modelTurn?.parts) {
      for (const part of c.modelTurn.parts) {
        if (part.inlineData?.data) playAudio(part.inlineData.data, part.inlineData.mimeType);
      }
    }
    if (c?.outputTranscription?.text) setCaption((prev) => (prev + c.outputTranscription.text).slice(-800));
    if (m?.toolCall?.functionCalls) {
      for (const fc of m.toolCall.functionCalls) handleTool(fc);
    }
  }

  function parseArgs(fc) {
    if (fc.args == null) return {};
    if (typeof fc.args === 'string') { try { return JSON.parse(fc.args || '{}'); } catch { return {}; } }
    return fc.args;
  }

  async function handleTool(fc) {
    const { data, error } = await supabase.functions.invoke('gymiq-coach-tool', { body: { name: fc.name, args: parseArgs(fc) } });
    const msg = (error && error.message) || data?.error;
    if (msg) {
      sessionRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { error: msg } }] });
      setError(new Error(msg));
      return;
    }
    setProposals((p) => [...p, { id: data.id, kind: data.kind, payload: data.payload, status: 'draft' }]);
    sessionRef.current?.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: { status: 'draft_prepared_not_applied', kind: data.kind } }] });
  }

  async function applyProposal(p, discard) {
    const { error } = await supabase.rpc('apply_coach_action', { p_id: p.id, p_discard: discard });
    if (error) { setError(new Error(error.message)); return; }
    setProposals((list) => list.map((x) => x.id === p.id ? { ...x, status: discard ? 'discarded' : 'applied' } : x));
  }

  function startMic(session) {
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      micStream.current = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx({ sampleRate: 16000 });
      micCtx.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const sink = ctx.createGain(); sink.gain.value = 0; // prevent echo
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
        try { session.sendRealtimeInput({ audio: { data: toBase64(int16.buffer), mimeType: 'audio/pcm;rate=16000' } }); } catch { /* ignore */ }
      };
      source.connect(processor); processor.connect(sink); sink.connect(ctx.destination);
    })().catch(() => { /* mic denied — text-only fallback */ });
  }

  function startCamera() {
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      selfStream.current = stream;
      if (selfVideoRef.current) selfVideoRef.current.srcObject = stream;
      const video = document.createElement('video');
      video.srcObject = stream; video.muted = true; video.playsInline = true; await video.play();
      const canvas = document.createElement('canvas');
      cameraTimer.current = setInterval(() => {
        if (!sessionRef.current) return;
        try {
          canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
          sessionRef.current.sendRealtimeInput({ video: { data: b64, mimeType: 'image/jpeg' } });
        } catch { /* ignore */ }
      }, 1000);
    })().catch(() => { /* camera denied — audio-only */ });
  }

  function playAudio(b64, mimeType) {
    try {
      const rate = parseInt((/rate=(\d+)/.exec(mimeType || '') || [])[1] || '24000', 10) || 24000;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!playCtxRef.current) playCtxRef.current = new Ctx({ sampleRate: rate });
      const ctx = playCtxRef.current;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch { /* ignore */ } }
      const buffer = fromBase64(b64);
      const int16 = new Int16Array(buffer);
      const audioBuffer = ctx.createBuffer(1, int16.length, rate);
      const channel = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768;
      if (!masterGain.current) { masterGain.current = ctx.createGain(); masterGain.current.connect(ctx.destination); }
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(masterGain.current);
      const when = Math.max(ctx.currentTime, nextPlayTime.current);
      src.start(when);
      nextPlayTime.current = when + audioBuffer.duration;
    } catch { /* ignore */ }
  }

  function toggleMute() { const next = !muted; setMuted(next); if (masterGain.current) masterGain.current.gain.value = next ? 0 : 1; }

  if (!open) return null;

  const connecting = status === 'connecting';
  const ended = status === 'ended';

  return (
    <div className="voice-coach" role="dialog" aria-modal="true" aria-label="Voice coach">
      <div className="voice-coach-stage">
        <video ref={selfVideoRef} autoPlay playsInline muted className="voice-coach-self-fill" />
        <div className={`voice-coach-orb${connecting || status === 'live' ? ' is-live' : ''}`} />
        <div className="voice-coach-bar">
          <span className="voice-coach-live">● {status === 'live' ? 'Live' : connecting ? 'Connecting…' : status}</span>
          <button type="button" className="voice-coach-close" onClick={close} aria-label="End call">✕</button>
        </div>
      </div>
      {status === 'live' && <p className="voice-coach-timer">{timeLeft}s</p>}
      {connecting && !error && <p className="voice-coach-caption">Connecting to your coach…</p>}
      {caption && <p className="voice-coach-caption" aria-live="polite">{caption}</p>}
      {notes.map((n, i) => (
        <div className="voice-coach-note" key={i}>{n.title && <strong>{n.title}</strong>}<span>{n.text}</span></div>
      ))}
      {proposals.map((p) => (
        <div className="voice-coach-note" key={p.id}>
          <strong>{proposalLabel(p)}</strong>
          <span>{proposalSummary(p)}</span>
          {p.status === 'draft' && (
            <div className="voice-coach-actions">
              <button type="button" className="btn btn-primary" onClick={() => applyProposal(p, false)}>Apply</button>
              <button type="button" className="btn btn-ghost" onClick={() => applyProposal(p, true)}>Discard</button>
            </div>
          )}
          {p.status === 'applied' && <span className="voice-coach-applied">Applied ✓</span>}
          {p.status === 'discarded' && <span className="voice-coach-applied">Discarded</span>}
        </div>
      ))}
      {error && (
        <div className="voice-coach-error" role="alert">
          <strong>{error.name || 'Error'}</strong>
          <p>{error.message}</p>
        </div>
      )}
      <div className="voice-coach-settings">
        <button type="button" className="btn btn-secondary" onClick={toggleMute} disabled={status !== 'live'}>{muted ? 'Unmute' : 'Mute'}</button>
        <button type="button" className="btn btn-primary" onClick={close}>{ended ? 'Close' : 'End call'}</button>
      </div>
    </div>
  );
}
