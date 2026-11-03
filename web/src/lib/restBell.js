// Two resonant church-style bell strikes, under 1.8 seconds total.
// Inharmonic partials give the bell its metallic body; summed peaks stay below 1.
const BELL_PARTIALS = [[261.625, 0.10], [523.25, 0.28], [627.9, 0.13], [784.875, 0.085], [1046.5, 0.07], [1444.17, 0.035]];
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
    for (const offset of [0, 0.58]) {
      for (const [frequency, amplitude] of BELL_PARTIALS) {
        const tone = context.createOscillator();
        const gain = context.createGain();
        tone.type = 'sine'; tone.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(amplitude, start + offset + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 1.12);
        tone.connect(gain); gain.connect(context.destination);
        tone.onended = () => {
          tone.disconnect(); gain.disconnect();
          nodes = nodes.filter((node) => node !== tone);
          if (!nodes.length && context?.state === 'running') void context.suspend().catch(() => {});
        };
        nodes.push(tone);
        tone.start(start + offset); tone.stop(start + offset + 1.14);
      }
    }
    return true;
  };
  return { unlock, play, stop, setEnabled(value) { enabled = value; if (!value) stop(); },
    dispose() { stop(); if (context && context.state !== 'closed') void context.close().catch(() => {}); context = null; } };
}
