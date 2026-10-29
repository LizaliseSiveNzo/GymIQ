// Two percussive bell taps, 0.7 seconds total. No media playback/session takeover.
export function createRestBell(environment = globalThis) {
  let context = null;
  let nodes = [];
  let enabled = true;
  let generation = 0;
  const stop = () => {
    generation++;
    for (const node of nodes) { try { node.stop(); node.disconnect(); } catch { /* already ended */ } }
    nodes = [];
    if (context?.state === 'running') void context.suspend().catch(() => {});
  };
  const unlock = async () => {
    if (!enabled) return false;
    try {
      // Supported Safari versions use ambient audio to mix with other apps.
      if (environment.navigator?.audioSession) environment.navigator.audioSession.type = 'ambient';
      const Audio = environment.AudioContext || environment.webkitAudioContext;
      if (!Audio) return false;
      context ||= new Audio({ latencyHint: 'interactive' });
      if (context.state === 'suspended') await context.resume();
      return context.state === 'running';
    } catch { return false; }
  };
  const play = async () => {
    const request = generation;
    if (!enabled || !await unlock() || request !== generation) return false;
    const start = context.currentTime + 0.01;
    for (const offset of [0, 0.32]) {
      for (const [frequency, amplitude] of [[1046.5, 0.13], [2093, 0.035], [2878, 0.012]]) {
        const tone = context.createOscillator();
        const gain = context.createGain();
        tone.type = 'sine'; tone.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(amplitude, start + offset + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.35);
        tone.connect(gain); gain.connect(context.destination);
        tone.onended = () => {
          tone.disconnect(); gain.disconnect();
          nodes = nodes.filter((node) => node !== tone);
          if (!nodes.length && context?.state === 'running') void context.suspend().catch(() => {});
        };
        nodes.push(tone);
        tone.start(start + offset); tone.stop(start + offset + 0.36);
      }
    }
    return true;
  };
  return { unlock, play, stop, setEnabled(value) { enabled = value; if (!value) stop(); },
    dispose() { stop(); if (context && context.state !== 'closed') void context.close().catch(() => {}); context = null; } };
}
