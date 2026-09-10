/* global Vue, APP_CONFIG, apiLog */

// This file contains every HTTP request sent to the FastAPI backend.
window.articleApi = (() => {
  /**
   * Sends a request to FastAPI and returns its JSON response.
   */
  async function request(path, options = {}) {
    const entry = Vue.reactive({
      id: apiLog.nextId++,
      method: options.method || 'GET',
      url: APP_CONFIG.apiUrl + path,
      requestBody: options.body ?? null,
      responseBody: null,
      status: null,
      pending: true,
      error: '',
    })
    apiLog.entries.unshift(entry)
    // Keep the most recent 50 requests during this page session.
    if (apiLog.entries.length > 50) apiLog.entries.pop()
    try {
      return await sendRequest(path, options, entry)
    } catch (cause) {
      entry.error = cause.message
      throw cause
    } finally {
      entry.pending = false
    }
  }

  /** Read the response once, sharing its body with the app and the console. */
  async function sendRequest(path, options, entry) {
    const url = APP_CONFIG.apiUrl + path
    const method = options.method || 'GET'
    let response

    console.info(`[API] ${method} ${url}`)

    try {
      response = await fetch(url, {
        ...options,
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
      })
    } catch (cause) {
      console.error(
        `[API] The ${method} request to ${url} was blocked or failed.`,
        cause,
      )
      throw new Error(
        `Unable to reach FastAPI at ${APP_CONFIG.apiUrl}. ` +
          'If FastAPI reports status 200, check its CORS configuration.',
      )
    }

    console.info(`[API] Response ${response.status} for ${method} ${url}`)
    entry.status = response.status
    const text = await response.text()
    entry.responseBody = text
    let body = null
    let invalidJson = false
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        invalidJson = true
      }
    }

    if (!response.ok) {
      // FastAPI usually returns errors as { "detail": "..." }.
      const detail = body?.detail
      let message = `HTTP error ${response.status}`

      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail)) {
        message = detail
          .map(({ loc, msg }) => `${loc?.slice(1).join('.') || 'Request'} : ${msg}`)
          .join(' ')
      } else if (detail) {
        message = JSON.stringify(detail)
      }

      console.error(`[API] ${message}`, body)
      const error = new Error(message)
      error.status = response.status
      throw error
    }

    // A 204 response never contains a body.
    if (response.status === 204) return null

    if (invalidJson) {
      throw new Error('FastAPI responded, but its response is not valid JSON.')
    }
    return body
  }

  /**
   * Fetches the article list.
   */
  function list() {
    return request('/list')
  }

  /**
   * Fetches one article from its URL.
   */
  function get(articleUrl) {
    return request(`/article/${encodeURIComponent(articleUrl)}`)
  }

  /**
   * Creates an article from its name and Markdown content.
   */
  function create(article) {
    return request('/create', {
      method: 'POST',
      body: JSON.stringify(article),
    })
  }

  /**
   * Updates the Markdown content and author.
   */
  function update(articleUrl, article) {
    return request(`/article/${encodeURIComponent(articleUrl)}/edit`, {
      method: 'POST',
      body: JSON.stringify(article),
    })
  }

  /** Fetches comments for the whole site. */
  function listComments() {
    return request('/comments')
  }

  /** Publishes a comment and returns the stored comment. */
  function createComment(comment) {
    return request('/comments', {
      method: 'POST',
      body: JSON.stringify(comment),
    })
  }

  /** Calls the course API's GET deletion route. Never cache this request. */
  function remove(articleUrl) {
    return request(`/article/${encodeURIComponent(articleUrl)}/delete`, {
      method: 'GET',
      cache: 'no-store',
    })
  }

  return { list, get, create, update, remove, listComments, createComment }
})()
