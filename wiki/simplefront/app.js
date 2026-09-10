/* global Vue, APP_CONFIG, articleApi, CommentsGuide, DeleteArticleGuide, ApiConsole, JungleAmbience */

// Vue runs directly in the browser. Edit this file, save it, then refresh.
const { computed, createApp, ref } = Vue

createApp({
  components: { CommentsGuide, DeleteArticleGuide, ApiConsole, JungleAmbience },
  /**
   * Prepares the state and functions used by index.html.
   */
  setup() {
    // ---------------------------------------------------------------------
    // APPLICATION STATE
    // ref() stores a reactive value. computed() derives a value from state.
    // ---------------------------------------------------------------------
    const features = APP_CONFIG.features
    const page = ref('list')
    const articles = ref([])
    const currentArticle = ref(null)
    const deleteDialog = ref(null)
    const articleToDelete = ref(null)
    const deleting = ref(false)
    const deleteError = ref('')
    const loading = ref(false)
    const saving = ref(false)
    const error = ref('')
    const submitError = ref('')
    const draft = ref('')
    const newArticle = ref({ name: '', content: '' })
    const author = ref('')
    const comments = ref([])
    const commentsUnavailable = ref(false)
    const newComment = ref({ author: '', content: '' })
    const postingComment = ref(false)
    const commentError = ref('')
    const commentSuccess = ref('')

    const otherArticles = computed(() =>
      articles.value.filter(
        (article) => article.articleUrl !== currentArticle.value?.articleUrl,
      ),
    )

    // ---------------------------------------------------------------------
    // HELPERS
    // Small, reusable functions with no network or interface side effects.
    // ---------------------------------------------------------------------
    /**
     * Converts a name to a Wikipedia-style article URL.
     * Example: "My article" becomes "My_article".
     */
    function getArticleUrl(articleName) {
      return articleName.trim().replace(/\s+/g, '_')
    }

    /** Pick a decorative icon and color without adding article metadata. */
    function getArticleStyle(articleUrl) {
      const name = articleUrl.normalize('NFC')
      if (['Singe', 'Chimpanzé', 'Gorille', 'Orang-outan'].includes(name)) {
        return { kind: 'primate', icon: 'monkey' }
      }
      if (name === 'Banane') return { kind: 'fruit', icon: 'banana' }
      if (['Noix_de_coco', 'Cocotier'].includes(name)) {
        return { kind: 'coconut', icon: 'coconut' }
      }
      if (name === 'Safari') return { kind: 'wild', icon: 'safari' }
      return { kind: 'wild', icon: 'leaf' }
    }

    /**
     * Builds the frontend link used to open an article.
     */
    function getArticleLink(articleUrl) {
      return `#/article/${encodeURIComponent(articleUrl)}`
    }

    /**
     * Builds the frontend link used to edit an article.
     */
    function getEditLink(articleUrl) {
      return `${getArticleLink(articleUrl)}/edit`
    }

    /**
     * Converts an unknown JavaScript error to a readable message.
     */
    function getErrorMessage(cause) {
      console.error('[Application]', cause)
      return cause instanceof Error ? cause.message : 'Unknown error'
    }

    // ---------------------------------------------------------------------
    // DATA LOADING
    // These functions check the minimum data required by the interface.
    // ---------------------------------------------------------------------
    /**
     * Fetches and stores the article list.
     */
    async function loadArticles() {
      const data = await articleApi.list()

      const isArticleList =
        Array.isArray(data) &&
        data.every(
          (article) =>
            typeof article.name === 'string' && typeof article.articleUrl === 'string',
        )

      if (!isArticleList) {
        throw new Error('GET /list must return an array of { name, articleUrl }.')
      }

      articles.value = data
    }

    /**
     * Fetches and stores one article.
     */
    async function loadArticle(articleUrl) {
      const data = await articleApi.get(articleUrl)

      if (
        !data ||
        typeof data.name !== 'string' ||
        typeof data.articleUrl !== 'string' ||
        typeof data.content !== 'string'
      ) {
        throw new Error('The article response must contain name, articleUrl, and content.')
      }

      currentArticle.value = data
    }

    /**
     * Refreshes the article list and manages the page-level loading state.
     */
    async function refreshArticles() {
      loading.value = true
      error.value = ''

      try {
        await loadArticles()
      } catch (cause) {
        error.value = getErrorMessage(cause)
      } finally {
        loading.value = false
      }
    }

    // ---------------------------------------------------------------------
    // FORM ACTIONS
    // POST requests are kept separate from page loading.
    // ---------------------------------------------------------------------
    /** Checks the fields needed to display and identify a comment. */
    function isComment(comment) {
      return comment != null &&
        (typeof comment.id === 'string' || typeof comment.id === 'number') &&
        typeof comment.content === 'string'
    }

    /** Loads site-wide comments, independently of the article list. */
    async function loadComments() {
      commentsUnavailable.value = false
      try {
        const data = await articleApi.listComments()
        if (!Array.isArray(data) || !data.every(isComment)) {
          throw new Error('GET /comments must return an array of { id, content, author? }.')
        }
        comments.value = data
      } catch (cause) {
        if (cause.status === 404 || cause.status === 405) {
          commentsUnavailable.value = true
          return
        }
        throw cause
      }
    }

    /** Adds the POST response to the list and clears the form after success. */
    async function postComment() {
      if (postingComment.value) return
      commentError.value = ''
      commentSuccess.value = ''
      const content = newComment.value.content.trim()
      if (!content) {
        commentError.value = 'Please write a comment.'
        return
      }

      postingComment.value = true
      try {
        const comment = await articleApi.createComment({
          author: newComment.value.author.trim(),
          content,
        })
        if (!isComment(comment)) {
          throw new Error('POST /comments must return the stored comment with id and content.')
        }
        comments.value.push(comment)
        newComment.value = { author: '', content: '' }
        commentSuccess.value = 'Your comment has been posted.'
      } catch (cause) {
        commentError.value = getErrorMessage(cause)
        if (cause.status === 404 || cause.status === 405) {
          commentsUnavailable.value = true
        }
      } finally {
        postingComment.value = false
      }
    }

    /**
     * Creates an article and redirects using the POST response.
     */
    async function createArticle() {
      saving.value = true
      submitError.value = ''

      try {
        const createdArticle = await articleApi.create({ ...newArticle.value, author: author.value.trim() })

        if (
          typeof createdArticle?.articleUrl !== 'string' ||
          createdArticle.articleUrl.trim() === ''
        ) {
          throw new Error('POST /create must return the created article with an articleUrl.')
        }

        // Refresh before redirecting so the sidebar contains the new article.
        // If this refresh fails, the article was still created successfully.
        try {
          await loadArticles()
        } catch (cause) {
          articles.value = []
          console.warn(
            '[API] The article was created, but the list could not be refreshed.',
            cause,
          )
        }

        newArticle.value = { name: '', content: '' }
        window.location.hash = getArticleLink(createdArticle.articleUrl)
      } catch (cause) {
        submitError.value = getErrorMessage(cause)
      } finally {
        saving.value = false
      }
    }

    /**
     * Saves the edited Markdown and returns to the article page.
     */
    async function saveArticle() {
      saving.value = true
      submitError.value = ''

      try {
        const articleUrl = currentArticle.value.articleUrl
        await articleApi.update(articleUrl, { content: draft.value, author: author.value.trim() })

        window.location.hash = getArticleLink(articleUrl)
      } catch (cause) {
        submitError.value = getErrorMessage(cause)
      } finally {
        saving.value = false
      }
    }

    // ---------------------------------------------------------------------
    // ROUTING
    // The part after # selects the page. Example: #/article/My_article
    // ---------------------------------------------------------------------
    /** Opens a modal without sending a request. */
    function confirmDelete() {
      if (!currentArticle.value || deleting.value) return
      deleteError.value = ''
      articleToDelete.value = currentArticle.value
      deleteDialog.value.showModal()
    }

    /** Closes the confirmation without deleting anything. */
    function cancelDelete() {
      if (!deleting.value) deleteDialog.value.close()
    }

    /** Deletes the confirmed article, then opens a freshly loaded list. */
    async function deleteArticle() {
      if (deleting.value || !articleToDelete.value) return
      deleting.value = true
      deleteError.value = ''
      try {
        await articleApi.remove(articleToDelete.value.articleUrl)
        articles.value = []
        deleteDialog.value.close()
        window.location.hash = '#/'
      } catch (cause) {
        deleteError.value = getErrorMessage(cause)
      } finally {
        deleting.value = false
      }
    }

    /**
     * Selects the current page from the URL and loads the required data.
     */
    async function loadCurrentPage() {
      if (deleteDialog.value?.open) deleteDialog.value.close()
      deleteError.value = ''
      loading.value = true
      error.value = ''
      submitError.value = ''
      currentArticle.value = null

      try {
        const path = window.location.hash.slice(1) || '/'
        const parts = path.split('/').filter(Boolean)

        if (parts[0] === 'article' && parts[1]) {
          const articleUrl = decodeURIComponent(parts[1])
          const wantsEdit = parts[2] === 'edit'

          page.value = wantsEdit && features.edit ? 'edit' : 'article'
          await loadArticle(articleUrl)

          // Direct links start without a list. Creation already refreshed it.
          if (articles.value.length === 0) {
            await loadArticles()
          }

          if (page.value === 'edit') {
            if (typeof currentArticle.value.source !== 'string') {
              throw new Error('Editing requires the article response to contain source.')
            }

            draft.value = currentArticle.value.source
            author.value = currentArticle.value.author ?? ''
          }
        } else if (parts[0] === 'comments') {
          page.value = 'comments'
          await loadComments()
        } else if (parts[0] === 'create' && features.create) {
          page.value = 'create'
          author.value = ''
        } else {
          page.value = 'list'
          await loadArticles()
        }
      } catch (cause) {
        error.value = getErrorMessage(cause)
      } finally {
        loading.value = false
      }
    }

    // This root application lives as long as the page, so one listener is enough.
    window.addEventListener('hashchange', loadCurrentPage)
    loadCurrentPage()

    // Returned values and functions are available in index.html.
    return {
      features,
      page,
      articles,
      otherArticles,
      currentArticle,
      deleteDialog,
      articleToDelete,
      deleting,
      deleteError,
      confirmDelete,
      cancelDelete,
      deleteArticle,
      loading,
      saving,
      error,
      submitError,
      draft,
      newArticle,
      author,
      comments,
      commentsUnavailable,
      newComment,
      postingComment,
      commentError,
      commentSuccess,
      postComment,
      getArticleStyle,
      getArticleUrl,
      getArticleLink,
      getEditLink,
      refreshArticles,
      createArticle,
      saveArticle,
      loadCurrentPage,
    }
  },
}).mount('#app')
