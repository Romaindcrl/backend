// A separate component keeps the backend exercise out of the application template.
window.CommentsGuide = {
  emits: ['retry'],
  template: `
    <section class="form-page backend-guide">
      <p class="eyebrow">Backend exercise</p>
      <h1>Enable site comments</h1>
      <p>Comments are not available yet. Implement the routes below
        in your FastAPI application, then try again.</p>

      <h2>1. Define the data</h2>
      <p>Use a Pydantic request model with a required, non-blank
        <code>content</code> string and an optional <code>author</code> string.
        Generate a unique <code>id</code> on the server.</p>
      <p>Comments belong to the whole site: no article identifier is needed.</p>

      <h2>2. List stored comments</h2>
      <p><code>GET /comments</code> should return a JSON array, oldest first.
        Return an empty array, <code>[]</code>, when there are no comments.</p>
      <pre><code>[
  { "id": 1, "author": "Alex", "content": "Great articles!" }
]</code></pre>

      <h2>3. Create a comment</h2>
      <p><code>POST /comments</code> accepts a JSON body:</p>
      <pre><code>{ "author": "Alex", "content": "Great articles!" }</code></pre>
      <p>Validate the input, store the comment, and return the stored object
        with its generated ID:</p>
      <pre><code>{ "id": 1, "author": "Alex", "content": "Great articles!" }</code></pre>
      <p>The frontend displays this POST response immediately. An empty author
        is displayed as “Anonymous”; content is displayed as plain text.</p>

      <h2>4. Check the complete flow</h2>
      <p>A Python list is enough to start; it resets whenever the server restarts.
        Add file or database storage when persistence is needed.</p>
      <p>Test both routes in <code>/docs</code>: create a comment, then check that
        it appears in the GET response.</p>
      <button class="button" type="button" @click="$emit('retry')">
        Check backend again
      </button>
    </section>
  `,
}
