var statusBadge = document.getElementById('statusBadge');
var summaryText = document.getElementById('summaryText');
var explanationText = document.getElementById('explanationText');
var contextSection = document.getElementById('contextSection');
var contextSummary = document.getElementById('contextSummary');
var draftBox = document.getElementById('draftBox');
var conversationBox = document.getElementById('conversationBox');
var detailsRaw = document.getElementById('detailsRaw');
var detailsSection = document.getElementById('detailsSection');
var toggleDetailsBtn = document.getElementById('toggleDetails');
var detectedDataSection = document.getElementById('detectedDataSection');
var detectedDataList = document.getElementById('detectedDataList');
var suggestionSection = document.getElementById('suggestionSection');
var suggestionText = document.getElementById('suggestionText');

var STATUS_COPY = {
  SAFE: {
    summary: 'No risky data exposure detected',
    explanation: 'This message appears consistent with normal communication patterns.',
  },
  REVIEW: {
    summary: 'Unusual request detected',
    explanation: 'This action may create unintended obligations or disclose internal information. Confirm the recipient and intent before sending.',
  },
  STOP_VERIFY: {
    summary: 'Sensitive action detected',
    explanation: 'This message transfers protected information or access capability. Verify through an approved channel before sending.',
  },
};

function setBadge(text, riskClass) {
  statusBadge.textContent = text || '';
  statusBadge.className = 'status-badge ' + (riskClass || 'risk-none');
}

var RISK_FLAG_COPY = {
  credential_request: 'This conversation includes a request for login or verification data.',
  urgency_language: 'The message uses urgency pressure.',
  authority_claim: 'The sender claims authority or support role.',
  impersonation_possible: 'The sender may be impersonating a trusted party.',
  payment_request: 'The conversation involves a payment request.',
  link_to_external_site: 'The conversation references an external website.'
};

var SENDER_INTENT_COPY = {
  request_credentials: 'The other party is asking for sensitive authentication information.',
  request_information: 'The other party is requesting information from you.'
};

var RESPONSE_NATURE_COPY = {
  providing_secret: 'Your draft appears to share confidential data.',
  providing_information: 'Your draft appears to provide information to the requester.'
};

function renderContext(context) {
  if (!context || typeof context !== 'object') {
    contextSummary.innerHTML = '';
    return;
  }
  var lines = [];
  var summary = context.conversation_summary && context.conversation_summary.trim();
  if (summary) {
    lines.push(summary);
  }
  if (context.relationship_type === 'external') {
    lines.push('You are communicating with someone outside your organization.');
  }
  if (context.sender_intent && SENDER_INTENT_COPY[context.sender_intent]) {
    lines.push(SENDER_INTENT_COPY[context.sender_intent]);
  }
  if (context.response_nature && RESPONSE_NATURE_COPY[context.response_nature]) {
    lines.push(RESPONSE_NATURE_COPY[context.response_nature]);
  }
  var flags = Array.isArray(context.conversation_risk_flags) ? context.conversation_risk_flags : [];
  flags.forEach(function (flag) {
    if (RISK_FLAG_COPY[flag]) {
      lines.push(RISK_FLAG_COPY[flag]);
    }
  });
  if (lines.length === 0) {
    contextSummary.innerHTML = '';
    return;
  }
  var html = '<ul>';
  lines.forEach(function (line) {
    html += '<li>' + escapeHtml(line) + '</li>';
  });
  html += '</ul>';
  contextSummary.innerHTML = html;
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function clearResult() {
  setBadge('', 'risk-none');
  summaryText.textContent = '';
  explanationText.textContent = '';
  contextSummary.innerHTML = '';
  contextSection.classList.remove('is-visible');
  draftBox.textContent = '';
  conversationBox.textContent = '';
  detailsRaw.textContent = '';
  detectedDataList.innerHTML = '';
  detectedDataSection.classList.remove('is-visible');
  suggestionSection.classList.remove('is-visible');
  suggestionText.textContent = '';
}

toggleDetailsBtn.addEventListener('click', function () {
  var visible = detailsSection.classList.toggle('is-visible');
  toggleDetailsBtn.textContent = visible ? 'Hide Details' : 'Show Details';
});

document.getElementById('check').addEventListener('click', async function () {
  clearResult();

  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || !tabs[0].id) {
      setBadge('No tab. Open Gmail and try again.');
      return;
    }

    var results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['extract.js']
    });

    var raw = results && results[0] && results[0].result != null ? results[0].result : null;
    var result = raw && typeof raw.then === 'function' ? await raw : raw;

    if (!result || typeof result.draft !== 'string' || !result.draft.trim()) {
      setBadge('No email detected');
      return;
    }

    draftBox.textContent = result.draft || '(empty)';
    conversationBox.textContent = result.conversation || '(no conversation found)';

    var source = 'gmail-extension';
    try {
      var stored = await chrome.storage.local.get('canarygate_user_id');
      if (stored && stored.canarygate_user_id) source = stored.canarygate_user_id;
    } catch (e) {}

    var res = await fetch('http://localhost:8000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft: result.draft,
        conversation: result.conversation || '',
        metadata: {
          source: source,
          recipients: result.recipients || []
        }
      })
    });

    if (!res.ok) {
      setBadge('Backend not reachable. Start server.');
      return;
    }

    var analysis = await res.json();
    var riskLevel = (analysis.risk_level || '').toUpperCase();
    var label = riskLevel === 'LOW' ? 'SAFE' : riskLevel === 'MEDIUM' ? 'REVIEW' : riskLevel === 'HIGH' ? 'STOP_VERIFY' : riskLevel;
    var riskClass = riskLevel === 'LOW' ? 'risk-safe' : riskLevel === 'MEDIUM' ? 'risk-check' : riskLevel === 'HIGH' ? 'risk-stop' : 'risk-none';
    var copy = STATUS_COPY[label] || STATUS_COPY.SAFE;

    setBadge(label, riskClass);
    summaryText.textContent = copy.summary;
    explanationText.textContent = analysis.explanation || copy.explanation;

    if (analysis.context) {
      renderContext(analysis.context);
      contextSection.classList.add('is-visible');
    } else {
      contextSection.classList.remove('is-visible');
      contextSummary.innerHTML = '';
    }

    var suggestion = analysis.suggestion_rewrite && analysis.suggestion_rewrite.trim();
    if (suggestion) {
      suggestionText.textContent = suggestion;
      suggestionSection.classList.add('is-visible');
    } else {
      suggestionSection.classList.remove('is-visible');
    }

    var detected = Array.isArray(analysis.detected_data) ? analysis.detected_data : [];
    detectedDataList.innerHTML = '';
    if (detected.length > 0) {
      detected.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item;
        detectedDataList.appendChild(li);
      });
      detectedDataSection.classList.add('is-visible');
    }

    var pressureStr = Array.isArray(analysis.pressure_signals) && analysis.pressure_signals.length
      ? analysis.pressure_signals.join(', ')
      : 'none';
    detailsRaw.textContent = 'Action: ' + (analysis.action || '') + '\nPressure: ' + pressureStr + '\n\n' + (analysis.explanation || '');
  } catch (err) {
    setBadge('Backend not reachable. Start server.');
  }
});
