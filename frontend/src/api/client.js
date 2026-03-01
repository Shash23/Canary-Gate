/**
 * Calls POST /interpret_context. Returns {} if no API key or on failure.
 * @param {string} description - Human description of the conversation
 * @returns {Promise<{ category?: string, sensitivity?: string, focus_checks?: string[] }>}
 */
export async function interpretContext(description) {
  try {
    const res = await fetch('/interpret_context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: description || '' }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

/**
 * Calls POST /analyze with conversation, draft, and metadata.
 * @param {string} text - Draft message to analyze
 * @param {object} metadata - Optional: conversation, source, recipients, attachments, user_context_description, interpreted_context
 * @returns {Promise<{ action, risk_level, recoverability, pressure_signals, explanation }>}
 */
export async function analyzeMessage(text, metadata = {}) {
  const payload = {
    conversation: metadata.conversation ?? '',
    draft: text,
    metadata: {
      source: metadata.source || 'web-simulated',
      recipients: metadata.recipients || [],
      attachments: metadata.attachments || [],
      ...(metadata.user_context_description !== undefined && { user_context_description: metadata.user_context_description }),
      ...(metadata.interpreted_context && Object.keys(metadata.interpreted_context).length > 0 && { interpreted_context: metadata.interpreted_context }),
    },
  };
  const res = await fetch('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches all recorded decisions from GET /decisions (newest first).
 * @returns {Promise<Array<{ timestamp, user_identifier, draft, conversation, recipients, detected_action, risk_level, pressure_signals, explanation, user_decision }>>}
 */
export async function fetchDecisions() {
  const res = await fetch('/decisions');
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches risk narratives from GET /risk-feed (newest first).
 * @returns {Promise<Array<{ id, severity, title, description, supporting_metrics, timestamp }>>}
 */
export async function fetchRiskFeed() {
  const res = await fetch('/risk-feed');
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}
