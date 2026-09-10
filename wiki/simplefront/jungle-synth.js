/** @typedef {{gain: GainNode, nodes: AudioNode[], sources: Set<AudioScheduledSourceNode>, start: number, end: number, group: string}} JungleVoice */

// Short-lived voices are disconnected when they end or when their group is stopped.
window.JungleSynth = class JungleSynth {
  /** @param {AudioContext} context @param {GainNode} output */
  constructor(context, output) {
    this.context = context
    this.output = output
    /** @type {Set<JungleVoice>} */
    this.voices = new Set()
  }

  /** @param {string} group @param {number} time @param {number} duration @param {number} level @param {number} pan @returns {JungleVoice} */
  voice(group, time, duration, level, pan) {
    const start = Math.max(time, this.context.currentTime + 0.003)
    const gain = this.context.createGain()
    const panner = this.context.createStereoPanner()
    panner.pan.value = pan
    gain.connect(panner)
    panner.connect(this.output)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(level, start + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    const voice = { gain, nodes: [gain, panner], sources: new Set(), start, end: start + duration, group }
    this.voices.add(voice)
    return voice
  }

  /** @param {JungleVoice} voice @param {AudioScheduledSourceNode} source @returns {void} */
  track(voice, source) {
    voice.sources.add(source)
    source.onended = () => {
      source.disconnect()
      voice.sources.delete(source)
      if (!voice.sources.size) this.release(voice)
    }
  }

  /** @param {JungleVoice} voice @returns {void} */
  release(voice) {
    if (!this.voices.delete(voice)) return
    for (const node of voice.nodes) node.disconnect()
  }

  /** @param {number} duration @param {boolean} brown @returns {AudioBuffer} */
  noise(duration, brown = false) {
    const buffer = this.context.createBuffer(1, Math.ceil(duration * this.context.sampleRate), this.context.sampleRate)
    const samples = buffer.getChannelData(0)
    let low = 0
    for (let index = 0; index < samples.length; index++) {
      const white = Math.random() * 2 - 1
      low = low * 0.98 + white * 0.02
      samples[index] = brown ? low * 3 : white
    }
    return buffer
  }

  /** @param {JungleNote} note @param {number} time @returns {void} */
  playNote(note, time) {
    if (note.kind === 'shaker') { this.playShaker(time, note.strength, note.pan); return }
    const durations = { bass: 0.8, tone: 0.42, slap: 0.22, wood: 0.7 }
    const levels = { bass: 0.24, tone: 0.13, slap: 0.09, wood: 0.035 }
    const voice = this.voice('music', time, durations[note.kind], levels[note.kind] * note.strength, note.pan)
    for (const [ratio, weight] of [[1, 1], [1.51, 0.24], [2.08, 0.08]]) {
      this.addPartial(voice, note.frequency * ratio, weight, note.kind === 'wood')
    }
  }

  /** @param {JungleVoice} voice @param {number} pitch @param {number} weight @param {boolean} wooden @returns {void} */
  addPartial(voice, pitch, weight, wooden) {
    const oscillator = this.context.createOscillator()
    const level = this.context.createGain()
    level.gain.value = weight
    oscillator.frequency.setValueAtTime(pitch * (wooden ? 1 : 1.38), voice.start)
    oscillator.frequency.exponentialRampToValueAtTime(pitch, voice.start + 0.04)
    oscillator.connect(level)
    level.connect(voice.gain)
    voice.nodes.push(level)
    this.track(voice, oscillator)
    oscillator.start(voice.start)
    oscillator.stop(voice.end + 0.02)
  }

  /** @param {number} time @param {number} strength @param {number} pan @returns {void} */
  playShaker(time, strength, pan) {
    const voice = this.voice('music', time, 0.1, 0.035 * strength, pan)
    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 3400
    source.buffer = this.noise(0.13)
    source.connect(filter)
    filter.connect(voice.gain)
    voice.nodes.push(filter)
    this.track(voice, source)
    source.start(voice.start)
    source.stop(voice.end + 0.02)
  }

  /** @param {number} time @returns {void} Each thunderclap has new noise and duration. */
  playThunder(time) {
    const duration = 4 + Math.random() * 3
    const voice = this.voice('thunder', time, duration, 0.5, Math.random() * 1.2 - 0.6)
    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 180 + Math.random() * 250
    source.buffer = this.noise(duration + 0.1, true)
    source.connect(filter)
    filter.connect(voice.gain)
    voice.nodes.push(filter)
    this.track(voice, source)
    source.start(voice.start)
    source.stop(voice.end + 0.02)
  }

  /** @param {number} time @param {number} pan @returns {void} A fresh impact and bubbling tail. */
  playSplash(time, pan) {
    const voice = this.voice('animals', time, 1.25, .5, pan)
    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(4200, voice.start)
    filter.frequency.exponentialRampToValueAtTime(180, voice.end)
    source.buffer = this.noise(1.4)
    source.connect(filter)
    filter.connect(voice.gain)
    voice.nodes.push(filter)
    this.track(voice, source)
    source.start(voice.start)
    source.stop(voice.end + .02)
    this.addPartial(voice, 85 + Math.random() * 25, .35, false)
  }

  /** @param {AudioBuffer} buffer @param {number} time @param {number} offset @param {number} duration @returns {void} */
  playAnimal(buffer, time, offset, duration) {
    const rate = 0.97 + Math.random() * 0.06
    const level = 0.16 + Math.random() * 0.12
    const voice = this.voice('animals', time, duration / rate, level, Math.random() * 1.4 - 0.7)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    voice.gain.gain.cancelScheduledValues(voice.start)
    voice.gain.gain.setValueAtTime(0, voice.start)
    voice.gain.gain.linearRampToValueAtTime(level, voice.start + 0.35)
    voice.gain.gain.setValueAtTime(level, voice.end - 0.65)
    voice.gain.gain.linearRampToValueAtTime(0, voice.end)
    source.connect(voice.gain)
    this.track(voice, source)
    source.start(voice.start, offset, duration)
    source.stop(voice.end + 0.03)
  }

  /** @param {string | null} group @returns {void} Stop scheduled voices as well as audible ones. */
  stop(group = null) {
    for (const voice of this.voices) {
      if (group && voice.group !== group) continue
      for (const source of voice.sources) source.stop()
      this.release(voice)
    }
  }
}
