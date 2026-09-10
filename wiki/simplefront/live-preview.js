// Local preview only: reload completed edits while preserving the current route.
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  const files = ['index.html', 'savanna.css', 'savanna-scene.js', 'savanna-world.js', 'savanna-animals.js', 'savanna-effects.js', 'savanna-simulation.js', 'savanna-herd.js', 'savanna-hunter.js', 'savanna-crocodiles.js', 'savanna-movement.js', 'savanna-collisions.js', 'jungle-synth.js', 'jungle-ambience.js', 'jungle-audio.js']
  let previous = ''
  let checking = false

  /** @returns {Promise<void>} Ignore temporary server errors and active form editing. */
  async function checkForChanges() {
    if (document.hidden || checking) return
    checking = true
    try {
      const versions = []
      // The simple Python preview server handles one request at a time.
      for (const file of files) {
        const response = await fetch(file, { method: 'HEAD', cache: 'no-store' })
        if (!response.ok) throw new Error('Preview temporarily unavailable.')
        versions.push(response.headers.get('last-modified') + response.headers.get('content-length'))
      }
      const current = versions.join('|')
      const editing = document.activeElement?.matches('input, textarea, select')
      if (previous && current !== previous && !editing) { location.reload(); return }
      if (!previous) previous = current
    } catch { /* A disconnected local server must not disturb the current page. */ }
    finally { checking = false }
  }
  void checkForChanges()
  window.setInterval(checkForChanges, 3000)
}
