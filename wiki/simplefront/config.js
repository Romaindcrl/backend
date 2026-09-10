/*
 * Start here when configuring the frontend.
 *
 * 1. apiUrl is the address of the FastAPI backend.
 * 2. Set a feature to true when its API route is ready.
 */
window.APP_CONFIG = {
  apiUrl: 'http://127.0.0.1:8000',

  features: {
    create: true,
    edit: true,
  },
}
