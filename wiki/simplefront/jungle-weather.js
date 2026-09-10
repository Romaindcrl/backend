/* Background-only weather. The callback keeps visual effects independent of sound. */
window.JungleWeather = class JungleWeather {
  /** @param {(delay: number) => void} onThunder */
  constructor(onThunder) {
    /** @type {HTMLDivElement | null} */
    this.background = document.querySelector('.jungle-background')
    this.onThunder = onThunder
    this.lightningEnabled = true
    /** @type {number | undefined} */
    this.nextStrike = undefined
    /** @type {number | undefined} */
    this.endFlash = undefined
  }

  /** @param {boolean} enabled @returns {void} */
  setRain(enabled) {
    this.background?.classList.toggle('is-raining', enabled)
  }

  /** @param {boolean} enabled @returns {void} */
  setLightning(enabled) {
    this.lightningEnabled = enabled
    this.clearStrike()
    if (enabled && !document.hidden) this.scheduleStrike(6000 + Math.random() * 4000)
  }

  /** @param {number} delay @returns {void} Only one strike timer exists. */
  scheduleStrike(delay) {
    window.clearTimeout(this.nextStrike)
    this.nextStrike = window.setTimeout(() => this.flash(), delay)
  }

  /** @returns {void} A single soft flash, with at least 16 seconds between strikes. */
  flash() {
    if (!this.background || !this.lightningEnabled || document.hidden) return
    const fromLeft = Math.random() < 0.5
    this.background.style.setProperty('--lightning-x', fromLeft ? '2%' : '85%')
    this.background.style.setProperty('--lightning-direction', fromLeft ? '1' : '-1')
    this.background.classList.add('is-flashing')
    this.onThunder(0.55 + Math.random() * 0.8)
    this.endFlash = window.setTimeout(() => this.background.classList.remove('is-flashing'), 900)
    this.scheduleStrike(16000 + Math.random() * 14000)
  }

  /** @returns {void} Stop timers and remove any active flash. */
  clearStrike() {
    window.clearTimeout(this.nextStrike)
    window.clearTimeout(this.endFlash)
    this.background?.classList.remove('is-flashing')
  }

  /** @returns {void} */
  pause() {
    this.clearStrike()
    this.background?.classList.add('weather-paused')
  }

  /** @returns {void} */
  start() {
    this.background?.classList.remove('weather-paused')
    this.setLightning(this.lightningEnabled)
  }

  /** @returns {void} */
  dispose() {
    this.pause()
    this.setRain(false)
  }
}
