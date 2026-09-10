# Procedural sound and wildlife recordings

No prerecorded rain, thunder or music loop is used by the application.

- `jungle-noise-worklet.js` produces fresh rain noise on the audio thread.
- `jungle-score.js` creates a new percussion bar with varied timing, accents,
  pitch, velocity, fills and quiet wooden notes.
- `jungle-synth.js` builds individual drum voices and fresh thunder sounds.
- `jungle-audio.js` schedules bars and occasional wildlife calls, with cleanup
  on mute, visibility changes and disposal.
- `jungle-ambience.js` exposes volume, playing style and weather/wildlife controls.

The three WAV files in this directory are wildlife recordings, never looped.
They are played with variable gaps, offsets, fades and stereo positions.
Consecutive calls do not use the same animal. Original sources, authors,
licenses and conversion details are listed in [credits.html](credits.html).

The audio context is created only after a user gesture. The same context is
reused; no background timer or playing voice remains active after sound is stopped.

Run on localhost or HTTPS so the browser can load the audio worklet.
