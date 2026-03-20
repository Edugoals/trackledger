export const api = (path, opts = {}) =>
  fetch(path, { ...opts, credentials: 'include' })
