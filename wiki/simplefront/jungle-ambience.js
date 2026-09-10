/* global Vue, JungleAudio */

// This component owns the controls; audio and the 3D scene live in separate modules.
window.JungleAmbience = {
  /** @returns {object} Initial controls; audio stays silent until requested. */
  data() {
    return {
      soundEnabled: false,
      starting: false,
      settingsOpen: false,
      rainEnabled: false,
      animalsEnabled: true,
      volume: 35,
      music: 'drums-slow',
      audioError: '',
      // Native audio objects must not be wrapped in reactive proxies.
      audio: Vue.markRaw(new JungleAudio()),
    }
  },
  /** @returns {void} Attach the visual controller after the DOM is ready. */
  mounted() {
    window.addEventListener('savanna-hunt', this.handleHunt)
    window.addEventListener('savanna-splash', this.handleSplash)
    document.addEventListener('visibilitychange', this.handleVisibility)
  },
  /** @returns {void} Release timers, listeners and native audio resources. */
  beforeUnmount() {
    document.removeEventListener('visibilitychange', this.handleVisibility)
    window.removeEventListener('savanna-hunt', this.handleHunt)
    window.removeEventListener('savanna-splash', this.handleSplash)
    void this.audio.dispose()
  },
  watch: {
    /** @param {number} value @returns {void} */
    volume(value) { this.audio.setVolume(value) },
    /** @param {string} value @returns {void} */
    music(value) { this.audio.setMusic(value) },
    /** @param {boolean} enabled @returns {void} */
    rainEnabled(enabled) {
      this.audio.setRain(enabled)
    },
    /** @param {boolean} enabled @returns {void} */
    animalsEnabled(enabled) { this.audio.setAnimals(enabled) },
  },
  methods: {
    /** @param {CustomEvent<{x: number, z: number}>} event @returns {void} */
    handleSplash(event) {
      if (this.soundEnabled && this.animalsEnabled) this.audio.playSplash(event.detail.x)
    },
    /** @returns {void} Play a lion cue only when animal sound is enabled. */
    handleHunt() {
      if (this.soundEnabled && this.animalsEnabled) this.audio.playLion()
    },
    /** @returns {void} Apply the current settings to a running player. */
    applyAudioSettings() {
      this.audio.setVolume(this.volume)
      this.audio.setRain(this.rainEnabled)
      this.audio.setMusic(this.music)
      this.audio.setAnimals(this.animalsEnabled)
    },
    /** @returns {Promise<void>} Never start audio automatically on page load. */
    async toggleSound() {
      if (this.starting) return
      if (this.soundEnabled) {
        this.soundEnabled = false
        await this.audio.stop()
        return
      }
      this.starting = true
      this.audioError = ''
      try {
        await this.audio.start()
        if (document.hidden) { await this.audio.stop(); return }
        this.applyAudioSettings()
        this.soundEnabled = true
      } catch (error) {
        await this.audio.stop()
        this.audioError = 'Sound could not start. Please try again.'
        console.error('[Ambience]', error)
      } finally {
        this.starting = false
      }
    },
    /** @returns {Promise<void>} Pause hidden tabs instead of accumulating sounds. */
    async handleVisibility() {
      if (document.hidden) {
        await this.audio.stop()
        return
      }
      if (!this.soundEnabled) return
      try {
        await this.audio.start()
        if (!this.soundEnabled || document.hidden) { await this.audio.stop(); return }
        this.applyAudioSettings()
      } catch (error) {
        this.soundEnabled = false
        this.audioError = 'Press Sound off to restart the audio.'
      }
    },
  },
  template: `
    <aside class="ambience-controls" aria-label="Savanna ambience">
      <div v-if="settingsOpen" id="ambience-settings" class="ambience-settings">
        <label for="ambience-volume">Volume <span>{{ volume }}%</span></label>
        <input id="ambience-volume" type="range" min="0" max="100" v-model.number="volume" />
        <label for="ambience-music">Drums</label>
        <select id="ambience-music" v-model="music">
          <option value="none">No music</option>
          <option value="drums-slow">Slow rhythm</option>
          <option value="drums-rolling">Rolling rhythm</option>
          <option value="drums-evening">Evening rhythm</option>
        </select>
        <label class="ambience-checkbox"><input type="checkbox" v-model="animalsEnabled" /> Savanna animals</label>
        <label class="ambience-checkbox"><input type="checkbox" v-model="rainEnabled" /> Rain sound</label>
        <a class="sound-credits" href="assets/audio/credits.html" target="_blank" rel="noopener">Sound credits</a>
        <a class="sound-credits" href="assets/models/credits.html" target="_blank" rel="noopener">3D model credits</a>
      </div>
      <p v-if="audioError" class="ambience-error" role="alert">{{ audioError }}</p>
      <div class="ambience-toolbar">
        <button type="button" @click="toggleSound" :aria-pressed="soundEnabled" :disabled="starting">
          {{ starting ? 'Loading…' : soundEnabled ? 'Sound on' : 'Sound off' }}
        </button>
        <button type="button" @click="settingsOpen = !settingsOpen" :aria-expanded="settingsOpen"
          aria-controls="ambience-settings" aria-label="Sound settings">⚙</button>
      </div>
    </aside>
  `,
}
