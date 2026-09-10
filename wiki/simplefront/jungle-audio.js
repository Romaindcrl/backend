/* global JungleScore, JungleSynth */

// One controller owns the continuous rain, generated score and occasional wildlife.
window.JungleAudio = class JungleAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.context = null
    /** @type {GainNode | null} */
    this.master = null
    /** @type {GainNode | null} */
    this.rainGain = null
    /** @type {AudioWorkletNode | null} */
    this.rainNode = null
    /** @type {JungleSynth | null} */
    this.synth = null
    /** @type {Record<string, AudioBuffer>} */
    this.animals = {}
    /** @type {Promise<void> | null} */
    this.loading = null
    /** @type {number | undefined} */
    this.timer = undefined
    this.version = 0
    this.active = false
    this.volume = 35
    this.music = 'none'
    this.rainEnabled = false
    this.animalsEnabled = false
    this.nextBar = 0
    this.nextAnimal = 0
    this.lastAnimal = ''
  }

  /** @returns {void} Audio nodes are created only after the user's click. */
  createGraph() {
    if (!window.AudioContext) throw new Error('Web Audio is unavailable.')
    this.context = new AudioContext()
    this.master = this.context.createGain()
    this.master.gain.value = 0
    this.master.connect(this.context.destination)
    this.rainGain = this.context.createGain()
    this.rainGain.gain.value = 0
    this.rainGain.connect(this.master)
    this.synth = new JungleSynth(this.context, this.master)
  }

  /** @returns {Promise<void>} Initialize the noise processor and local animal recordings once. */
  async loadResources() {
    if (!this.rainNode) {
      await this.context.audioWorklet.addModule('jungle-noise-worklet.js')
      this.rainNode = new AudioWorkletNode(this.context, 'jungle-rain', { outputChannelCount: [2] })
      this.rainNode.connect(this.rainGain)
    }
    await Promise.all(['lion', 'hyena', 'nightjar'].map(async (name) => {
      if (this.animals[name]) return
      const response = await fetch(`assets/audio/${name}.wav`)
      if (!response.ok) throw new Error(`Unable to load ${name}.`)
      this.animals[name] = await this.context.decodeAudioData(await response.arrayBuffer())
    }))
  }

  /** @returns {Promise<void>} Resume the stream without restarting a recorded song. */
  async start() {
    const version = ++this.version
    if (!this.context) this.createGraph()
    const resume = this.context.resume()
    this.loading ||= this.loadResources().catch((error) => { this.loading = null; throw error })
    await Promise.all([resume, this.loading])
    if (version !== this.version) return
    this.active = true
    this.setVolume(this.volume)
    this.setRain(this.rainEnabled)
    this.nextBar = this.context.currentTime + 0.08
    this.nextAnimal = this.context.currentTime + 4 + Math.random() * 3
    window.clearInterval(this.timer)
    this.timer = window.setInterval(() => this.schedule(), 100)
    this.schedule()
  }

  /** @returns {void} Schedule one fresh bar at a time, with no catch-up burst. */
  schedule() {
    if (!this.active || !this.context || !this.synth) return
    const now = this.context.currentTime
    if (this.music !== 'none' && this.nextBar < now + 0.2) {
      const bar = JungleScore.createBar(this.music)
      const start = Math.max(this.nextBar, now + 0.05)
      for (const note of bar.notes) this.synth.playNote(note, start + note.offset)
      this.nextBar = start + bar.duration
    }
    if (this.animalsEnabled && now >= this.nextAnimal) this.playAnimal()
  }

  /** @param {number} percent @returns {void} */
  setVolume(percent) {
    this.volume = Math.max(0, Math.min(100, percent))
    if (!this.context || !this.master) return
    this.master.gain.setTargetAtTime(this.volume / 100 * 0.55, this.context.currentTime, 0.04)
  }

  /** @param {boolean} enabled @returns {void} */
  setRain(enabled) {
    this.rainEnabled = enabled
    if (!this.context || !this.rainGain) return
    this.rainGain.gain.setTargetAtTime(enabled && this.active ? 0.26 : 0, this.context.currentTime, 0.15)
  }

  /** @param {string} mode @returns {void} A style change replaces queued notes. */
  setMusic(mode) {
    if (this.music === mode) return
    this.music = mode
    this.synth?.stop('music')
    this.nextBar = (this.context?.currentTime || 0) + 0.08
  }

  /** @param {boolean} enabled @returns {void} */
  setAnimals(enabled) {
    if (this.animalsEnabled === enabled) return
    this.animalsEnabled = enabled
    if (!enabled) this.synth?.stop('animals')
    this.nextAnimal = (this.context?.currentTime || 0) + 4 + Math.random() * 3
  }

  /** @returns {void} Natural excerpts vary in position, distance and timing. */
  playAnimal() {
    const choices = Object.keys(this.animals).filter(name => name !== this.lastAnimal)
    const name = this.lastAnimal ? choices[Math.floor(Math.random() * choices.length)] : 'nightjar'
    const cues = { lion: [0], hyena: [0, 9, 14, 15, 20], nightjar: [10, 20, 25, 30, 37, 56, 62] }
    const buffer = this.animals[name]
    if (!buffer || !this.synth) return
    const points = cues[name]
    const offset = points[Math.floor(Math.random() * points.length)]
    const duration = Math.min(buffer.duration - offset - 0.05, 6 + Math.random() * 4)
    this.synth.playAnimal(buffer, this.context.currentTime + 0.05, offset, duration)
    this.lastAnimal = name
    this.nextAnimal = this.context.currentTime + duration + 12 + Math.random() * 20
  }

  /** @returns {void} Synchronize a short lion call with the chase. */
  playLion() {
    if (!this.active || !this.animalsEnabled || !this.animals.lion || !this.synth) return
    this.synth.stop('animals')
    this.synth.playAnimal(this.animals.lion, this.context.currentTime + .05, 0, Math.min(4, this.animals.lion.duration))
    this.lastAnimal = 'lion'
    this.nextAnimal = this.context.currentTime + 20
  }

  /** @param {number} x @returns {void} Splash effects follow the animal sound setting. */
  playSplash(x) {
    if (!this.active || !this.animalsEnabled || !this.synth) return
    this.synth.playSplash(this.context.currentTime + .01, Math.max(-.8, Math.min(.8, x / 16)))
  }

  /** @param {number} delay @returns {void} Each lightning strike gets a fresh rumble. */
  playThunder(delay) {
    if (!this.active || !this.context) return
    this.synth?.playThunder(this.context.currentTime + delay)
  }

  /** @returns {void} */
  stopThunder() {
    this.synth?.stop('thunder')
  }

  /** @returns {Promise<void>} Cancel scheduled notes as well as sounds already playing. */
  async stop() {
    this.version++
    this.active = false
    window.clearInterval(this.timer)
    this.synth?.stop()
    if (this.context && this.rainGain) this.rainGain.gain.setValueAtTime(0, this.context.currentTime)
    if (this.context?.state === 'running') await this.context.suspend()
  }

  /** @returns {Promise<void>} Release the worklet and native audio graph. */
  async dispose() {
    await this.stop()
    this.rainNode?.disconnect()
    this.rainNode?.port.close()
    if (this.context && this.context.state !== 'closed') await this.context.close()
    this.context = null
    this.master = null
    this.rainGain = null
    this.rainNode = null
    this.synth = null
    this.animals = {}
    this.loading = null
  }
}
