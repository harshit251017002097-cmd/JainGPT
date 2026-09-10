/**
 * JainGPT — Frontend Script
 *
 * Handles: session management, message rendering, API calls,
 * quick actions, copy/regenerate, thumbs up/down, input UX.
 *
 * Security: API key NEVER present here. All Gemini calls go
 * through the backend at /api/chat.
 */

'use strict';

/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '8080'
  ? 'http://127.0.0.1:5000'
  : '';
const CHAT_ENDPOINT = `${API_BASE}/api/chat`;
const MAX_CHARS = 2000;

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */

let conversationId = generateSessionId();
let isLoading = false;
let lastBotMessageRow = null;       // For regenerate
let lastBotMessageText = '';        // For regenerate
let lastUserMessage = '';           // For regenerate

/* ═══════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════ */

const messagesEl    = document.getElementById('messages');
const chatScrollEl  = document.getElementById('chat-scroll');
const emptyStateEl  = document.getElementById('empty-state');
const userInputEl   = document.getElementById('user-input');
const sendBtnEl     = document.getElementById('send-btn');
const charCounterEl = document.getElementById('char-counter');
const toastEl       = document.getElementById('toast');

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Light markdown-like formatting for bot responses.
 * Handles: **bold**, *italic*, newlines → <br>.
 * Does NOT use innerHTML from API directly — we escape first, then apply formatting.
 */
function formatBotText(rawText) {
  let escaped = escapeHtml(rawText);

  // Bold: **text**
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* (but not **)
  escaped = escaped.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Newlines
  escaped = escaped.replace(/\n/g, '<br>');

  return escaped;
}

function scrollToBottom(smooth = true) {
  chatScrollEl.scrollTo({
    top: chatScrollEl.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant'
  });
}

function showEmptyState(show) {
  emptyStateEl.style.display = show ? 'flex' : 'none';
}

function showToast(message, duration = 2200) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

function setLoading(loading) {
  isLoading = loading;
  sendBtnEl.disabled = loading || userInputEl.value.trim().length === 0;
  userInputEl.disabled = loading;
}

function autoResizeTextarea() {
  userInputEl.style.height = 'auto';
  userInputEl.style.height = Math.min(userInputEl.scrollHeight, 140) + 'px';
}

/* ═══════════════════════════════════════════
   MESSAGE RENDERING
═══════════════════════════════════════════ */

function appendUserMessage(text) {
  showEmptyState(false);
  const row = document.createElement('li');
  row.className = 'message-row user-row';
  row.setAttribute('role', 'listitem');

  const bubble = document.createElement('div');
  bubble.className = 'user-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
  return row;
}

function appendTypingIndicator() {
  const row = document.createElement('li');
  row.className = 'message-row bot-row';
  row.id = 'typing-row';
  row.setAttribute('role', 'listitem');
  row.setAttribute('aria-label', 'JainGPT is thinking');

  const header = buildBotHeader();
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';

  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('span');
    d.className = 'typing-dot';
    d.setAttribute('aria-hidden', 'true');
    dots.appendChild(d);
  }

  const label = document.createElement('span');
  label.className = 'typing-label';
  label.textContent = 'JainGPT soch raha hai...';

  indicator.appendChild(dots);
  indicator.appendChild(label);
  row.appendChild(header);
  row.appendChild(indicator);
  messagesEl.appendChild(row);
  scrollToBottom();
  return row;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-row');
  if (el) el.remove();
}

function buildBotHeader(langCode) {
  const header = document.createElement('div');
  header.className = 'bot-header';

  const avatar = document.createElement('div');
  avatar.className = 'bot-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = '🪷';

  const name = document.createElement('span');
  name.className = 'bot-name';
  name.textContent = 'JainGPT';

  header.appendChild(avatar);
  header.appendChild(name);

  if (langCode) {
    const badge = document.createElement('span');
    badge.className = 'lang-badge';
    const labelMap = { 'en': '🇬🇧 EN', 'hi': '🇮🇳 HI', 'hi-en': '🔀 Hinglish' };
    badge.textContent = labelMap[langCode] || langCode;
    badge.setAttribute('aria-label', `Detected language: ${langCode}`);
    header.appendChild(badge);
  }

  return header;
}

function appendBotMessage(text, langCode, quickActions = []) {
  const row = document.createElement('li');
  row.className = 'message-row bot-row';
  row.setAttribute('role', 'listitem');

  const header = buildBotHeader(langCode);
  row.appendChild(header);

  const bubble = document.createElement('div');
  bubble.className = 'bot-bubble';
  bubble.innerHTML = formatBotText(text);
  row.appendChild(bubble);

  // Quick action chips
  if (quickActions.length > 0) {
    const qa = buildQuickActions(quickActions, text);
    row.appendChild(qa);
  }

  // Message action bar (copy, regenerate, thumbs)
  const actions = buildMessageActions(text, row);
  row.appendChild(actions);

  messagesEl.appendChild(row);
  scrollToBottom();
  return row;
}

function appendErrorMessage(message) {
  const row = document.createElement('li');
  row.className = 'message-row bot-row';
  row.setAttribute('role', 'listitem');

  const header = buildBotHeader();
  row.appendChild(header);

  const bubble = document.createElement('div');
  bubble.className = 'error-bubble';
  bubble.setAttribute('role', 'alert');

  const icon = document.createElement('span');
  icon.className = 'error-bubble-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⚠️';

  const text = document.createElement('span');
  text.textContent = message;

  bubble.appendChild(icon);
  bubble.appendChild(text);
  row.appendChild(bubble);

  messagesEl.appendChild(row);
  scrollToBottom();
  return row;
}

/* ═══════════════════════════════════════════
   QUICK ACTIONS
═══════════════════════════════════════════ */

const QUICK_ACTION_CONFIG = {
  simple:     { icon: '🧒', label: 'Simple mein' },
  example:    { icon: '💡', label: 'Example do' },
  detail:     { icon: '📚', label: 'Detail mein' },
  source:     { icon: '📖', label: 'Source batao' },
  traditions: { icon: '⚖️', label: 'Traditions ka view' },
};

function buildQuickActions(actions, contextText) {
  const container = document.createElement('div');
  container.className = 'quick-actions';

  actions.forEach(actionKey => {
    const config = QUICK_ACTION_CONFIG[actionKey];
    if (!config) return;

    const btn = document.createElement('button');
    btn.className = 'quick-action-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', `${config.label} — quick action`);

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = config.icon;

    const label = document.createElement('span');
    label.textContent = config.label;

    btn.appendChild(icon);
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      const promptMap = {
        simple:     'Simple mein samjhao.',
        example:    'Ek example do.',
        detail:     'Thoda aur detail mein batao.',
        source:     'Iska source kya hai?',
        traditions: 'Digambara aur Śvētāmbara traditions ka is par kya view hai?',
      };
      const promptText = promptMap[actionKey] || config.label;
      sendMessage(promptText);
    });

    container.appendChild(btn);
  });

  return container;
}

/* ═══════════════════════════════════════════
   MESSAGE ACTIONS (copy / regenerate / thumbs)
═══════════════════════════════════════════ */

function buildMessageActions(text, row) {
  const bar = document.createElement('div');
  bar.className = 'message-actions';
  bar.setAttribute('aria-label', 'Message actions');

  // Copy
  const copyBtn = document.createElement('button');
  copyBtn.className = 'msg-action-btn';
  copyBtn.type = 'button';
  copyBtn.setAttribute('aria-label', 'Copy response');
  copyBtn.innerHTML = '📋 Copy';
  copyBtn.id = `copy-btn-${Date.now()}`;

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.innerHTML = '✅ Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
    }).catch(() => showToast('Copy failed. Try manually.'));
  });

  // Regenerate
  const regenBtn = document.createElement('button');
  regenBtn.className = 'msg-action-btn';
  regenBtn.type = 'button';
  regenBtn.setAttribute('aria-label', 'Regenerate response');
  regenBtn.innerHTML = '🔄 Regenerate';

  regenBtn.addEventListener('click', () => {
    if (isLoading || !lastUserMessage) return;
    // Remove this row and re-send last user message
    row.remove();
    sendMessage(lastUserMessage, true);
  });

  // Helpful
  const helpBtn = document.createElement('button');
  helpBtn.className = 'msg-action-btn';
  helpBtn.type = 'button';
  helpBtn.setAttribute('aria-label', 'Mark as helpful');
  helpBtn.innerHTML = '👍';
  helpBtn.title = 'Helpful';

  helpBtn.addEventListener('click', () => {
    helpBtn.classList.toggle('helpful-active');
    nothelpBtn.classList.remove('nothelpful-active');
    showToast(helpBtn.classList.contains('helpful-active') ? 'Thanks for the feedback! 🙏' : 'Feedback removed');
  });

  // Not helpful
  const nothelpBtn = document.createElement('button');
  nothelpBtn.className = 'msg-action-btn';
  nothelpBtn.type = 'button';
  nothelpBtn.setAttribute('aria-label', 'Mark as not helpful');
  nothelpBtn.innerHTML = '👎';
  nothelpBtn.title = 'Not helpful';

  nothelpBtn.addEventListener('click', () => {
    nothelpBtn.classList.toggle('nothelpful-active');
    helpBtn.classList.remove('helpful-active');
    showToast(nothelpBtn.classList.contains('nothelpful-active') ? 'Thanks — we\'ll try to improve!' : 'Feedback removed');
  });

  bar.appendChild(copyBtn);
  bar.appendChild(regenBtn);
  bar.appendChild(helpBtn);
  bar.appendChild(nothelpBtn);

  return bar;
}

/* ═══════════════════════════════════════════
   API CALL
═══════════════════════════════════════════ */

async function callChatAPI(message) {
  const response = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: conversationId,
      message: message,
    }),
  });

  if (!response.ok) {
    // Try to extract API error message
    let errMsg = 'Sorry, abhi response generate nahi ho pa raha. Please thodi der baad try karo.';
    try {
      const err = await response.json();
      if (err && err.message) errMsg = err.message;
    } catch (_) {}

    if (response.status === 429) {
      errMsg = 'Bahut zyada requests ho gayi hain. Thodi der baad try karo.';
    }
    throw new Error(errMsg);
  }

  return response.json();
}

/* ═══════════════════════════════════════════
   SEND MESSAGE
═══════════════════════════════════════════ */

async function sendMessage(text, isRegenerate = false) {
  const trimmed = text.trim();
  if (!trimmed || isLoading) return;

  if (!isRegenerate) {
    lastUserMessage = trimmed;
    appendUserMessage(trimmed);
    userInputEl.value = '';
    autoResizeTextarea();
    charCounterEl.textContent = '0';
    updateSendBtnState();
  }

  setLoading(true);
  const typingRow = appendTypingIndicator();

  try {
    const data = await callChatAPI(trimmed);
    removeTypingIndicator();

    const botText = data.response || 'Koi response nahi mila.';
    const langCode = data.detected_language || 'en';
    const quickActions = data.quick_actions || [];

    lastBotMessageText = botText;
    lastBotMessageRow = appendBotMessage(botText, langCode, quickActions);

  } catch (err) {
    removeTypingIndicator();
    const errMsg = err.message || 'Network error. Please check your connection.';
    appendErrorMessage(errMsg);
  } finally {
    setLoading(false);
    userInputEl.focus();
  }
}

/* ═══════════════════════════════════════════
   INPUT HANDLERS
═══════════════════════════════════════════ */

function updateSendBtnState() {
  const hasText = userInputEl.value.trim().length > 0;
  sendBtnEl.disabled = !hasText || isLoading;
}

userInputEl.addEventListener('input', () => {
  autoResizeTextarea();
  const len = userInputEl.value.length;
  charCounterEl.textContent = len;
  if (len > MAX_CHARS * 0.9) {
    charCounterEl.style.color = len >= MAX_CHARS ? '#f87171' : '#f59e0b';
  } else {
    charCounterEl.style.color = '';
  }
  updateSendBtnState();
});

userInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtnEl.disabled) {
      sendMessage(userInputEl.value);
    }
  }
});

sendBtnEl.addEventListener('click', () => {
  sendMessage(userInputEl.value);
});

/* ═══════════════════════════════════════════
   SUGGESTION CHIPS
═══════════════════════════════════════════ */

document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const prompt = chip.dataset.prompt;
    if (prompt) sendMessage(prompt);
  });
});

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */

// Show empty state on load
showEmptyState(true);

// Auto-focus input
userInputEl.focus();

console.log(
  '%c🪷 JainGPT%c loaded — session: ' + conversationId,
  'color: #d4a843; font-weight: bold; font-size: 14px;',
  'color: #a89ec4; font-size: 11px;'
);
