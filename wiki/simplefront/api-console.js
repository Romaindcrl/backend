/* global Vue */

// Shared with api.js so requests are recorded even while the panel is closed.
window.apiLog = Vue.reactive({ entries: [], nextId: 1 })

window.ApiConsole = {
  setup() {
    const open = Vue.ref(false)

    /** Pretty-print JSON while keeping plain text and empty bodies readable. */
    function format(body) {
      if (body == null || body === '') return '(empty body)'
      try {
        return JSON.stringify(JSON.parse(body), null, 2)
      } catch {
        return body
      }
    }

    /** Clear the display without canceling requests. */
    function clear() {
      window.apiLog.entries.splice(0)
    }

    return { open, log: window.apiLog, format, clear }
  },
  template: `
    <footer class="api-console" :class="{ 'is-open': open }">
      <div class="api-console-bar">
        <button type="button" :aria-expanded="open" aria-controls="api-console-panel"
          @click="open = !open">Console ({{ log.entries.length }}) {{ open ? '▾' : '▴' }}</button>
        <button v-if="open" type="button" @click="clear">Clear</button>
      </div>
      <section v-show="open" id="api-console-panel" class="api-console-panel" aria-label="API console">
        <p v-if="!log.entries.length">No requests yet.</p>
        <details v-for="entry in log.entries" :key="entry.id" class="api-console-entry">
          <summary>
            <strong>{{ entry.method }}</strong> {{ entry.url }}
            — {{ entry.pending ? 'Pending…' : entry.status || 'Network error' }}
            <span v-if="entry.error"> · Failed</span>
          </summary>
          <h3>Request body</h3>
          <pre>{{ format(entry.requestBody) }}</pre>
          <h3>Response body</h3>
          <pre>{{ entry.pending ? 'Waiting for response…' : format(entry.responseBody) }}</pre>
          <p v-if="entry.error" class="api-console-error">{{ entry.error }}</p>
        </details>
      </section>
    </footer>
  `,
}
