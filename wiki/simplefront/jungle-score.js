/** @typedef {{kind: string, offset: number, frequency: number, strength: number, pan: number}} JungleNote */

// These are playing styles, not recorded tracks or a fixed sequence of bars.
window.JungleScore = {
  /** @param {string} mode @returns {{tempo: number, density: number}} */
  settings(mode) {
    if (mode === 'drums-rolling') return { tempo: 98, density: 0.88 }
    if (mode === 'drums-evening') return { tempo: 64, density: 0.42 }
    return { tempo: 76, density: 0.65 }
  },

  /** @param {string} kind @param {number} offset @param {number} frequency @returns {JungleNote} */
  note(kind, offset, frequency) {
    return {
      kind,
      offset: Math.max(0, offset + (Math.random() - 0.5) * 0.012),
      frequency: frequency * (0.97 + Math.random() * 0.06),
      strength: 0.52 + Math.random() * 0.4,
      pan: (Math.random() - 0.5) * 0.7,
    }
  },

  /** @param {number} step @param {number} beat @param {number} density @returns {JungleNote[]} */
  drumStep(step, beat, density) {
    const notes = []
    const downbeat = step === 0 || step === 8
    const offbeat = [3, 6, 7, 10, 11, 14].includes(step)
    if (downbeat && (step === 0 || Math.random() > 0.12)) {
      notes.push(this.note('bass', step * beat, 74))
    } else if (offbeat && Math.random() < density) {
      notes.push(this.note('tone', step * beat, Math.random() < 0.5 ? 142 : 173))
    } else if (step % 2 && Math.random() < density * 0.2) {
      notes.push(this.note('slap', step * beat, 218))
    }
    if (step % 2 === 0 && Math.random() < 0.72) {
      notes.push(this.note('shaker', step * beat, 0))
    }
    return notes
  },

  /** @param {string} mode @returns {{duration: number, notes: JungleNote[]}} */
  createBar(mode) {
    const style = this.settings(mode)
    const beat = 60 / (style.tempo + Math.random() * 2 - 1) / 4
    const notes = []
    for (let step = 0; step < 16; step++) notes.push(...this.drumStep(step, beat, style.density))
    if (Math.random() < 0.28) {
      for (const step of [14.5, 15, 15.5]) notes.push(this.note('tone', step * beat, 130 + Math.random() * 75))
    }
    if (Math.random() < 0.6) {
      const scale = [196, 220, 246.94, 293.66, 329.63]
      const frequency = scale[Math.floor(Math.random() * scale.length)]
      notes.push(this.note('wood', (4 + Math.floor(Math.random() * 8)) * beat, frequency))
    }
    return { duration: beat * 16, notes }
  },
}
