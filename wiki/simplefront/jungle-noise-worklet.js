/* global AudioWorkletProcessor, registerProcessor, sampleRate */

// Fresh noise is produced for every audio frame; no recording is repeated.
class JungleRainProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.low = new Float32Array(2)
    this.intensity = 1
    this.target = 1
    this.remaining = 0
  }

  /** @param {Float32Array[][]} inputs @param {Float32Array[][]} outputs @returns {boolean} */
  process(inputs, outputs) {
    const channels = outputs[0]
    if (!channels?.length) return true
    for (let frame = 0; frame < channels[0].length; frame++) {
      if (this.remaining <= 0) {
        this.target = 0.7 + Math.random() * 0.6
        this.remaining = sampleRate * (3 + Math.random() * 5)
      }
      this.remaining--
      this.intensity += (this.target - this.intensity) * 0.00002
      for (let channel = 0; channel < channels.length; channel++) {
        const white = Math.random() * 2 - 1
        this.low[channel] = this.low[channel] * 0.96 + white * 0.04
        channels[channel][frame] = (white * 0.18 + this.low[channel] * 0.5) * this.intensity
      }
    }
    return true
  }
}
registerProcessor('jungle-rain', JungleRainProcessor)
