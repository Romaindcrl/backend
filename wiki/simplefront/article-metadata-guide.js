// Show only the exercises relevant to the metadata missing from this article.
window.ArticleMetadataGuide = {
  props: {
    article: { type: Object, required: true },
  },
  emits: ['retry'],
  computed: {
    /** An omitted, null or blank author has no displayable value. */
    missingAuthor() {
      return typeof this.article.author !== 'string' || !this.article.author.trim()
    },
    /** Tags are provided by the API as an array of non-blank strings. */
    missingTags() {
      return !Array.isArray(this.article.tags) ||
        !this.article.tags.some((tag) => typeof tag === 'string' && tag.trim())
    },
  },
  template: `
    <section v-if="missingAuthor || missingTags" class="backend-guide metadata-guide">
      <p class="eyebrow">Backend exercise</p>
      <h2>Extend article metadata</h2>
      <p>This article has no value for the fields below. They are optional:
        an empty value does not necessarily mean the backend is unfinished.</p>

      <section v-if="missingAuthor">
        <h3>Add an author</h3>
        <ol>
          <li>Add an optional <code>author</code> string to the article request
            and response models. Existing articles must still load without it.</li>
          <li>Accept it in <code>POST /create</code> and
            <code>POST /article/{article_url}/edit</code>.</li>
          <li>Store it alongside the article and return it from
            <code>GET /article/{article_url}</code>, for example
            <code>"author": "Alex"</code>.</li>
        </ol>
      </section>

      <section v-if="missingTags">
        <h3>Add tags</h3>
        <ol>
          <li>Add an optional <code>tags</code> field containing a list of strings.
            With Pydantic, use <code>Field(default_factory=list)</code> for its default.</li>
          <li>Accept the list in the creation and editing routes. The frontend
            already converts comma-separated input into a JSON array.</li>
          <li>Store and return that list, for example
            <code>"tags": ["Python", "Web"]</code>. Keep the same type in every response.</li>
        </ol>
      </section>

      <h3>Store metadata on the first line</h3>
      <p>Write one JSON object on the first line of the article file.
        The remaining lines contain the Markdown body:</p>
      <pre><code>{"author": "Alex", "tags": ["Python", "Web"], "category": "Programming"}

# My article

Article content.</code></pre>
      <ol>
        <li>On reading, parse the first line as JSON. Convert only the remaining
          Markdown to HTML for <code>content</code>, and return that same
          Markdown body in <code>source</code>, without the JSON line.</li>
        <li>On creation or editing, write the metadata as a single JSON line,
          followed by a newline and the Markdown body.</li>
        <li>Keep older files readable: if the first line is not a JSON object,
          treat the whole file as Markdown with empty metadata.</li>
      </ol>
      <h3>Verify editing</h3>
      <p>In <code>/docs</code>, create an article with metadata, read it back,
        then edit it. An empty author string or an empty tags array should clear
        the saved value; an omitted field on edit should keep its existing value.</p>
      <p>Refresh this article to check the result. Each exercise disappears once
        the corresponding field contains a value.</p>
      <button class="button button-secondary" type="button" @click="$emit('retry')">
        Refresh article
      </button>
    </section>
  `,
}
