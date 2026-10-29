import { formatSessionTime } from '../../lib/sessionClock.js';

export default function SessionTiming({ clock, soundOn, restComplete, onPause, onResume, onAddRest, onSkipRest, onSoundToggle, onTestBell }) {
  return <section className="session-timing" aria-label="Session timers">
    <div className="session-timing__row">
      <div><span className="session-timing__label">Active time</span><strong aria-label="Active workout time">{formatSessionTime(clock.elapsedMs / 1000)}</strong></div>
      <button className={`btn ${clock.paused ? 'btn-primary' : 'btn-secondary'}`} onClick={clock.paused ? onResume : onPause}>{clock.paused ? 'Resume session' : 'Pause session'}</button>
    </div>
    {clock.paused && <p className="session-paused" role="status">Session paused. Your place is saved. Resume when you’re ready.</p>}
    <p className="session-timing__hint">Leaving this session or switching away pauses both timers.</p>
    {clock.restMs > 0 && <div className="session-timing__row session-rest">
      <div><span className="session-timing__label">{clock.paused ? 'Rest paused' : 'Rest'}</span><strong aria-label="Rest time remaining">{formatSessionTime(Math.ceil(clock.restMs / 1000))}</strong></div>
      <div className="row"><button className="btn btn-ghost" onClick={onAddRest}>+15s</button><button className="btn btn-ghost" onClick={onSkipRest}>Skip rest</button></div>
    </div>}
    {restComplete && <p className="session-rest-done" role="status">Rest complete. Ready for your next set.</p>}
    <div className="session-timing__sound"><button className="btn btn-ghost" aria-pressed={soundOn} onClick={onSoundToggle}>Bell {soundOn ? 'on' : 'off'}</button><button className="btn btn-ghost" onClick={onTestBell} disabled={!soundOn}>Test bell</button><span>Two short taps</span></div>
  </section>;
}
