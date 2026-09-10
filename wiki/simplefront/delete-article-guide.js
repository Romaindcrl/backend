// Keep the backend exercise separate from the article page and its actions.
window.DeleteArticleGuide = {
  props: { error: { type: String, required: true } },
  template: `
    <section class="backend-guide metadata-guide">
      <p role="alert">The deletion request failed: {{ error }}</p>
      <h2>Move articles to trash</h2>
      <ol>
        <li>Add <code>GET /article/{article_url}/delete</code> to FastAPI.</li>
        <li>Use <code>Path</code> to locate the article file and its destination
          in <code>./trash</code>. Assume that the trash directory already exists.</li>
        <li>If a file with the same name is already in trash, delete that old
          copy with <code>unlink()</code>.</li>
        <li>Move the article into trash with <code>rename()</code>.
          The whole file moves, including its metadata.</li>
        <li>Return a JSON confirmation after moving the file, for example
          <code>{"deleted": true}</code>.</li>
      </ol>
      <pre><code>from pathlib import Path

source = Path("./article") / f"{article_url}.md"
destination = Path("./trash") / source.name

if destination.exists():
    destination.unlink()

source.rename(destination)</code></pre>
      <p>Adapt <code>./article</code> to your article directory.
        The old trash copy is replaced by the article you just moved.</p>
      <p>Test with an article: confirm the deletion, then verify that
        its file is preserved in trash and it no longer appears in <code>GET /list</code>.
        Keep the list route limited to the active article directory.</p>
      <p>Use the article's Delete button to try again; confirmation is always required.</p>
    </section>
  `,
}
