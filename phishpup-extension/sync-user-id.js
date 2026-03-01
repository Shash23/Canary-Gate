/**
 * Runs on the CanaryGate web app origin. Reads the current employee user id
 * from the page (set by the app when logged in as Employee) and stores it
 * in chrome.storage so the popup can send it with /analyze and the employee
 * sees only their own checks.
 */
(function () {
  var KEY = 'canarygate_user_id'
  var attempts = 0
  var maxAttempts = 20

  function trySync() {
    var id = typeof window.__CANARYGATE_USER_ID__ === 'string' && window.__CANARYGATE_USER_ID__.trim()
      ? window.__CANARYGATE_USER_ID__.trim()
      : null
    if (id) {
      chrome.storage.local.set({ canarygate_user_id: id })
      return
    }
    attempts += 1
    if (attempts < maxAttempts) setTimeout(trySync, 500)
  }

  trySync()
})()
