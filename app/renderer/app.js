/* marked se carga como UMD global desde index.html */

marked.setOptions({ breaks: true, gfm: true });

let config = {};
let messages = [];
let isGenerating = false;
let abortController = null;

// Conversation state
let currentConvId = null;
let conversationList = [];

const DEFAULTS = {
  thinking: 'auto',
  temperature: 1.0,
  maxTokens: 4096,
  topP: 0.95,
  topK: 64,
  repPenalty: 1.0,
  system: ''
};

let settings = { ...DEFAULTS };

const $ = (sel) => document.querySelector(sel);

// Startup
const startupEl = $('#startup');
const startupIdle = $('#startup-idle');
const startupLoading = $('#startup-loading');
const startBtn = $('#start-btn');
const loadingText = $('#loading-text');
const loadingLog = $('#loading-log');

// Chat
const chatApp = $('#chat-app');
const messagesEl = $('#messages');
const inputEl = $('#input');
const sendBtn = $('#send-btn');
const memoryInfo = $('#memory-info');
const settingsToggle = $('#settings-toggle');
const settingsPanel = $('#settings-panel');
const newChatBtn = $('#new-chat-btn');
const stopRow = $('#stop-row');
const stopBtn = $('#stop-btn');
const historyToggle = $('#history-toggle');
const historyPanel = $('#history-panel');
const historyList = $('#history-list');
const historySearch = $('#history-search');

// Settings
const sThinking = $('#s-thinking');
const sTemperature = $('#s-temperature');
const sTemperatureVal = $('#s-temperature-val');
const sMaxTokens = $('#s-max-tokens');
const sMaxTokensVal = $('#s-max-tokens-val');
const sTopP = $('#s-top-p');
const sTopPVal = $('#s-top-p-val');
const sTopK = $('#s-top-k');
const sRepPenalty = $('#s-rep-penalty');
const sRepPenaltyVal = $('#s-rep-penalty-val');
const sSystem = $('#s-system');
const resetBtn = $('#reset-settings');

// =================== STARTUP ===================

// Check if vMLX is installed on launch
(async () => {
  const { installed } = await window.api.checkSetup();
  if (!installed) {
    // Show setup UI
    startBtn.textContent = 'Install & Start';
    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      startupIdle.classList.add('hidden');
      startupLoading.classList.remove('hidden');
      loadingText.textContent = 'Setting up (first time only)...';
      try {
        await window.api.runSetup();
        loadingText.textContent = 'Setup complete. Starting model...';
        window.api.startServer();
      } catch (err) {
        loadingText.textContent = 'Setup failed. Please check you have Python 3 installed.';
      }
    });

    window.api.onSetupProgress((msg) => {
      const lines = msg.split('\n').filter(l => l.trim());
      for (const line of lines) {
        if (line.includes('Installing')) loadingText.textContent = 'Installing vMLX engine...';
        else if (line.includes('Successfully installed')) loadingText.textContent = 'Installation complete!';
        const p = document.createElement('p');
        p.textContent = line.trim().substring(0, 100);
        loadingLog.appendChild(p);
        while (loadingLog.children.length > 30) loadingLog.removeChild(loadingLog.firstChild);
        loadingLog.scrollTop = loadingLog.scrollHeight;
      }
    });
  } else {
    // Already installed — normal flow
    startBtn.addEventListener('click', () => {
      startBtn.disabled = true;
      startupIdle.classList.add('hidden');
      startupLoading.classList.remove('hidden');
      window.api.startServer();
    });
  }
})();

window.api.onServerStatus((data) => {
  if (data.status === 'ready') {
    config.model = data.model;
    if (data.memory) {
      memoryInfo.textContent = `${(data.memory.active_mb / 1024).toFixed(1)} GB RAM`;
    }
    closeSlideshow();
    startupEl.classList.add('hidden');
    chatApp.classList.remove('hidden');
    loadConversationList();
    inputEl.focus();
  } else if (data.status === 'error') {
    loadingText.textContent = `Error: ${data.message}`;
  } else if (data.status === 'stopped') {
    loadingText.textContent = 'Server stopped';
  }
});

const progressBar = $('#progress-bar');
const logToggle = $('#log-toggle');

if (logToggle) {
  logToggle.addEventListener('click', () => {
    loadingLog.classList.toggle('hidden');
    logToggle.textContent = loadingLog.classList.contains('hidden') ? 'Show technical details' : 'Hide technical details';
  });
}

window.api.onServerLog((msg) => {
  const lines = msg.split('\n').filter(l => l.trim());
  for (const line of lines) {
    // User-friendly status messages
    if (line.includes('Fetching') && line.includes('files')) {
      // Parse "Fetching 8 files: 12%|" or similar
      const pctMatch = line.match(/(\d+)%/);
      const pct = pctMatch ? parseInt(pctMatch[1]) : 0;
      if (pct === 0) {
        loadingText.textContent = 'Downloading the AI model (~5 GB). This only happens once...';
      } else {
        loadingText.textContent = `Downloading AI model... ${pct}%`;
      }
      if (progressBar) {
        progressBar.style.animation = 'none';
        progressBar.style.width = `${Math.max(pct, 5)}%`;
        progressBar.style.marginLeft = '0';
      }
    }
    else if (line.includes('HTTP Request: GET') && line.includes('huggingface')) {
      // Don't change the text, just show activity
    }
    else if (line.includes('Loading model') || line.includes('Loading MLLM')) {
      loadingText.textContent = 'Loading AI into memory. Your Mac may slow down for ~10 seconds...';
      if (progressBar) { progressBar.style.animation = 'progressSlide 1.5s ease-in-out infinite'; }
    }
    else if (line.includes('MLLM loaded')) {
      loadingText.textContent = 'Almost ready...';
      if (progressBar) { progressBar.style.animation = 'none'; progressBar.style.width = '90%'; progressBar.style.marginLeft = '0'; }
    }
    else if (line.includes('Uvicorn running')) {
      loadingText.textContent = 'Ready!';
      if (progressBar) { progressBar.style.width = '100%'; }
    }
    else if (line.includes('WARNING') || line.includes('unauthenticated')) {
      // Skip noisy warnings from user view
    }

    // Technical log (collapsed by default)
    const p = document.createElement('p');
    p.textContent = line.trim().substring(0, 120);
    loadingLog.appendChild(p);
    while (loadingLog.children.length > 50) loadingLog.removeChild(loadingLog.firstChild);
    loadingLog.scrollTop = loadingLog.scrollHeight;
  }
});

window.api.getConfig().then(c => { config = c; });

// =================== CONVERSATIONS ===================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function generateTitle(msgs) {
  const firstUser = msgs.find(m => m.role === 'user');
  if (!firstUser) return 'New conversation';
  let title = firstUser.content.replace(/\n/g, ' ').trim();
  return title.length > 60 ? title.substring(0, 57) + '...' : title;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86400000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

async function saveCurrentConversation() {
  if (messages.length === 0) return;

  if (!currentConvId) {
    currentConvId = generateId();
  }

  const conv = {
    id: currentConvId,
    title: generateTitle(messages),
    created: conversationList.find(c => c.id === currentConvId)?.created || new Date().toISOString(),
    updated: new Date().toISOString(),
    settings: { ...settings },
    messages: [...messages]
  };

  await window.api.convSave(conv);
  await loadConversationList();
}

async function loadConversationList() {
  conversationList = await window.api.convList();
  renderHistoryList();
}

async function loadConversation(id) {
  const conv = await window.api.convLoad(id);
  if (!conv) return;

  // Save current if needed
  if (currentConvId && messages.length > 0 && currentConvId !== id) {
    await saveCurrentConversation();
  }

  currentConvId = conv.id;
  messages = conv.messages || [];

  // Restore settings if saved
  if (conv.settings) {
    settings = { ...DEFAULTS, ...conv.settings };
    applySettingsToUI();
  }

  // Render messages
  renderAllMessages();
  renderHistoryList();
  inputEl.focus();
}

async function deleteConversation(id) {
  await window.api.convDelete(id);
  if (currentConvId === id) {
    currentConvId = null;
    messages = [];
    showWelcome();
  }
  await loadConversationList();
}

function renderHistoryList(filter = '') {
  historyList.innerHTML = '';
  const filtered = filter
    ? conversationList.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()))
    : conversationList;

  if (filtered.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No saved conversations</p>';
    return;
  }

  let lastDateGroup = '';

  for (const conv of filtered) {
    const dateGroup = formatDate(conv.updated);
    if (dateGroup !== lastDateGroup) {
      const groupEl = document.createElement('div');
      groupEl.className = 'history-date-group';
      groupEl.textContent = dateGroup;
      historyList.appendChild(groupEl);
      lastDateGroup = dateGroup;
    }

    const item = document.createElement('div');
    item.className = 'history-item' + (conv.id === currentConvId ? ' active' : '');
    item.innerHTML = `
      <div class="history-item-title">${escapeHtml(conv.title)}</div>
      <div class="history-item-meta">
        <span>${conv.messageCount} msgs</span>
        <button class="history-item-delete" title="Delete">Delete</button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.history-item-delete')) return;
      if (!isGenerating) loadConversation(conv.id);
    });

    const delBtn = item.querySelector('.history-item-delete');
    let confirmPending = false;
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirmPending) {
        confirmPending = true;
        delBtn.textContent = 'Confirm';
        delBtn.style.opacity = '1';
        delBtn.style.color = '#f87171';
        setTimeout(() => { confirmPending = false; delBtn.textContent = 'Delete'; delBtn.style.color = ''; delBtn.style.opacity = ''; }, 2500);
      } else {
        deleteConversation(conv.id);
      }
    });

    historyList.appendChild(item);
  }
}

function applySettingsToUI() {
  sThinking.value = settings.thinking;
  sTemperature.value = settings.temperature;
  sTemperatureVal.textContent = settings.temperature.toFixed(1);
  sMaxTokens.value = settings.maxTokens;
  sMaxTokensVal.textContent = settings.maxTokens >= 1000 ? `${(settings.maxTokens / 1024).toFixed(1)}k` : settings.maxTokens;
  sTopP.value = settings.topP;
  sTopPVal.textContent = settings.topP.toFixed(2);
  sTopK.value = settings.topK;
  sRepPenalty.value = settings.repPenalty;
  sRepPenaltyVal.textContent = settings.repPenalty.toFixed(1);
  sSystem.value = settings.system || '';
}

function showWelcome() {
  messagesEl.innerHTML = `
    <div class="welcome">
      <h2>Gemma 4 Local</h2>
      <p>Running 100% on your Mac. Nothing leaves this machine.</p>
    </div>
  `;
}

function renderAllMessages() {
  messagesEl.innerHTML = '';
  if (messages.length === 0) {
    showWelcome();
    return;
  }

  for (const msg of messages) {
    const ts = msg.timestamp ? new Date(msg.timestamp) : null;

    if (msg.role === 'user') {
      const div = document.createElement('div');
      div.className = 'message user';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.innerHTML = escapeHtml(msg.content).replace(/\n/g, '<br>');
      div.appendChild(contentDiv);
      if (ts) addTimestamp(div, ts);
      messagesEl.appendChild(div);
    } else if (msg.role === 'assistant') {
      const div = document.createElement('div');
      div.className = 'message assistant';

      const roleLabel = document.createElement('div');
      roleLabel.className = 'message-role';
      roleLabel.textContent = 'Gemma 4';
      div.appendChild(roleLabel);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.innerHTML = marked.parse(msg.content);
      div.appendChild(contentDiv);

      if (ts) addTimestamp(div, ts);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'message-actions';
      actionsDiv.innerHTML = `<button class="msg-action-btn copy-btn" title="Copy">${ICON_COPY} Copy</button>`;
      div.appendChild(actionsDiv);

      const copyBtn = actionsDiv.querySelector('.copy-btn');
      const content = msg.content;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `${ICON_COPY} Copied!`;
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = `${ICON_COPY} Copy`;
          }, 2000);
        });
      });

      messagesEl.appendChild(div);
    }
  }
  scrollToBottom();
}

// History panel toggle
historyToggle.addEventListener('click', () => {
  historyPanel.classList.toggle('hidden');
  historyToggle.classList.toggle('active');
  // Close settings if open
  if (!historyPanel.classList.contains('hidden')) {
    settingsPanel.classList.add('hidden');
    settingsToggle.classList.remove('active');
  }
});

let searchTimeout = null;
historySearch.addEventListener('input', () => {
  const q = historySearch.value.trim();
  clearTimeout(searchTimeout);
  if (!q) {
    renderHistoryList();
    return;
  }
  // Debounce 250ms, then deep search
  searchTimeout = setTimeout(async () => {
    const results = await window.api.convSearch(q);
    renderHistorySearchResults(results, q);
  }, 250);
});

function renderHistorySearchResults(results, query) {
  historyList.innerHTML = '';
  if (results.length === 0) {
    historyList.innerHTML = `<p class="history-empty">No results for "${escapeHtml(query)}"</p>`;
    return;
  }

  for (const conv of results) {
    const item = document.createElement('div');
    item.className = 'history-item' + (conv.id === currentConvId ? ' active' : '');
    const matchHint = conv.matchType === 'content' ? ' · in messages' : '';
    item.innerHTML = `
      <div class="history-item-title">${escapeHtml(conv.title)}</div>
      <div class="history-item-meta">
        <span>${conv.messageCount} msgs${matchHint}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      if (!isGenerating) loadConversation(conv.id);
    });
    historyList.appendChild(item);
  }
}

// =================== SETTINGS ===================

settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
  settingsToggle.classList.toggle('active');
  // Close history if open
  if (!settingsPanel.classList.contains('hidden')) {
    historyPanel.classList.add('hidden');
    historyToggle.classList.remove('active');
  }
});

function bindSlider(slider, display, key, decimals = 1) {
  slider.addEventListener('input', () => {
    const val = parseFloat(slider.value);
    display.textContent = val.toFixed(decimals);
    settings[key] = val;
  });
}

bindSlider(sTemperature, sTemperatureVal, 'temperature');
bindSlider(sTopP, sTopPVal, 'topP', 2);
bindSlider(sRepPenalty, sRepPenaltyVal, 'repPenalty');

// Sync settings panel → quick bar
sTemperature.addEventListener('input', () => { if (typeof updateQuickTemp === 'function') updateQuickTemp(); });

sMaxTokens.addEventListener('input', () => {
  const val = parseInt(sMaxTokens.value);
  sMaxTokensVal.textContent = val >= 1000 ? `${(val / 1024).toFixed(1)}k` : val;
  settings.maxTokens = val;
  if (typeof updateQuickTokens === 'function') updateQuickTokens();
});

sThinking.addEventListener('change', () => {
  settings.thinking = sThinking.value;
  if (typeof updateQuickThinking === 'function') updateQuickThinking();
});
sTopK.addEventListener('change', () => { settings.topK = parseInt(sTopK.value) || 0; });
sSystem.addEventListener('input', () => { settings.system = sSystem.value; });

resetBtn.addEventListener('click', () => {
  settings = { ...DEFAULTS };
  applySettingsToUI();
});

// =================== HELPERS ===================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Throttled render for streaming (prevents O(n²) marked.parse on every token)
let _renderPending = false;
let _renderTarget = null;
let _renderContent = '';

function scheduleRender(el, content) {
  _renderTarget = el;
  _renderContent = content;
  if (!_renderPending) {
    _renderPending = true;
    requestAnimationFrame(() => {
      _renderTarget.innerHTML = marked.parse(_renderContent);
      scrollToBottom();
      _renderPending = false;
    });
  }
}

function formatTime(date) {
  const d = date || new Date();
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(date) {
  const d = date || new Date();
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + ' ' + time;
}

function addTimestamp(parent, date) {
  const ts = document.createElement('div');
  ts.className = 'message-time';
  ts.textContent = formatDateTime(date);
  parent.appendChild(ts);
}

const ICON_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_REGEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';

// =================== CHAT ===================

function addUserMessage(content) {
  const now = new Date();
  messages.push({ role: 'user', content, timestamp: now.toISOString() });
  const div = document.createElement('div');
  div.className = 'message user';
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
  div.appendChild(contentDiv);
  addTimestamp(div, now);
  messagesEl.appendChild(div);
  scrollToBottom();
}

function createAssistantMessage() {
  const div = document.createElement('div');
  div.className = 'message assistant';

  const roleLabel = document.createElement('div');
  roleLabel.className = 'message-role';
  roleLabel.textContent = 'Gemma 4';
  div.appendChild(roleLabel);

  const thinkingBlock = document.createElement('div');
  thinkingBlock.className = 'thinking-block hidden';
  const thinkingToggle = document.createElement('div');
  thinkingToggle.className = 'thinking-toggle';
  thinkingToggle.innerHTML = '<span class="arrow">&#9660;</span> Thinking';
  thinkingBlock.appendChild(thinkingToggle);
  const thinkingContent = document.createElement('div');
  thinkingContent.className = 'thinking-content message-content';
  thinkingBlock.appendChild(thinkingContent);
  thinkingToggle.addEventListener('click', () => {
    thinkingContent.classList.toggle('collapsed');
    thinkingToggle.querySelector('.arrow').classList.toggle('collapsed');
  });
  div.appendChild(thinkingBlock);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content cursor-blink';
  div.appendChild(contentDiv);

  const statsDiv = document.createElement('div');
  statsDiv.className = 'message-stats';
  div.appendChild(statsDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'message-actions';
  actionsDiv.innerHTML = `
    <button class="msg-action-btn copy-btn" title="Copy">${ICON_COPY} Copy</button>
    <button class="msg-action-btn regen-btn" title="Regenerate">${ICON_REGEN} Regenerate</button>
  `;
  actionsDiv.style.display = 'none';
  div.appendChild(actionsDiv);

  messagesEl.appendChild(div);
  scrollToBottom();

  return { div, contentDiv, thinkingBlock, thinkingContent, statsDiv, actionsDiv };
}

function buildApiMessages() {
  const apiMessages = [];
  if (settings.system.trim()) {
    apiMessages.push({ role: 'system', content: settings.system.trim() });
  }
  for (const m of messages) {
    apiMessages.push({ role: m.role, content: m.content });
  }
  return apiMessages;
}

function showStopButton(show) {
  stopRow.classList.toggle('hidden', !show);
}

async function sendMessage(regenerate = false) {
  let text;

  if (regenerate) {
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      messages.pop();
      const lastAssistant = messagesEl.querySelector('.message.assistant:last-of-type');
      if (lastAssistant) lastAssistant.remove();
    }
    const lastUser = messages.filter(m => m.role === 'user').pop();
    if (!lastUser) return;
    text = null;
  } else {
    text = inputEl.value.trim();
    if (!text || isGenerating) return;
  }

  isGenerating = true;
  sendBtn.disabled = true;
  showStopButton(true);

  // Remove welcome if first message
  const welcome = messagesEl.querySelector('.welcome');
  if (welcome) welcome.remove();

  if (text) {
    inputEl.value = '';
    inputEl.style.height = 'auto';
    addUserMessage(text);
  }

  const { contentDiv, thinkingBlock, thinkingContent, statsDiv, actionsDiv } = createAssistantMessage();

  let fullContent = '';
  let fullThinking = '';
  const startTime = Date.now();
  let tokenCount = 0;

  const body = {
    model: config.model,
    messages: buildApiMessages(),
    max_tokens: settings.maxTokens,
    temperature: settings.temperature,
    top_p: settings.topP,
    stream: true,
    stream_options: { include_usage: true }
  };

  if (settings.topK > 0) body.top_k = settings.topK;
  if (settings.repPenalty > 1.0) body.repetition_penalty = settings.repPenalty;
  if (settings.thinking === 'on') body.enable_thinking = true;
  else if (settings.thinking === 'off') body.enable_thinking = false;

  abortController = new AbortController();

  try {
    const response = await fetch(`http://127.0.0.1:${config.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abortController.signal
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.usage) tokenCount = parsed.usage.completion_tokens || tokenCount;
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.reasoning_content) {
            fullThinking += delta.reasoning_content;
            thinkingBlock.classList.remove('hidden');
            scheduleRender(thinkingContent, fullThinking);
          }

          if (delta.content) {
            fullContent += delta.content;
            scheduleRender(contentDiv, fullContent);
          }
        } catch {}
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      contentDiv.innerHTML += `<br><em style="color:#f44">Error: ${escapeHtml(err.message)}</em>`;
    }
  }

  // Final render completo (el rAF puede no haber ejecutado el último)
  if (fullContent) contentDiv.innerHTML = marked.parse(fullContent);
  if (fullThinking) thinkingContent.innerHTML = marked.parse(fullThinking);
  contentDiv.classList.remove('cursor-blink');
  abortController = null;

  if (fullThinking) {
    thinkingContent.classList.add('collapsed');
    thinkingBlock.querySelector('.arrow').classList.add('collapsed');
  }

  // Fallback: estimar tokens por palabras si el server no envió usage
  if (!tokenCount && fullContent) tokenCount = Math.round(fullContent.split(/\s+/).length * 1.3);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const tokPerSec = tokenCount > 0 ? (tokenCount / ((Date.now() - startTime) / 1000)).toFixed(1) : '?';
  statsDiv.textContent = `${tokenCount} tokens · ${elapsed}s · ${tokPerSec} tok/s`;

  if (fullContent) {
    messages.push({ role: 'assistant', content: fullContent, timestamp: new Date().toISOString() });
  }

  // AUTO-SAVE after every assistant response
  await saveCurrentConversation();

  actionsDiv.style.display = '';

  const copyBtn = actionsDiv.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(fullContent).then(() => {
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `${ICON_COPY} Copied!`;
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = `${ICON_COPY} Copy`;
      }, 2000);
    });
  });

  const regenBtn = actionsDiv.querySelector('.regen-btn');
  regenBtn.addEventListener('click', () => {
    if (!isGenerating) sendMessage(true);
  });

  isGenerating = false;
  sendBtn.disabled = false;
  showStopButton(false);
  inputEl.focus();
}

// =================== EVENTS ===================

sendBtn.addEventListener('click', () => sendMessage());

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
});

stopBtn.addEventListener('click', () => {
  if (abortController) abortController.abort();
});

// New chat — save current first
newChatBtn.addEventListener('click', async () => {
  if (isGenerating) {
    if (abortController) abortController.abort();
  }
  // Save current conversation before starting new
  if (messages.length > 0) {
    await saveCurrentConversation();
  }
  currentConvId = null;
  messages = [];
  showWelcome();
  renderHistoryList();
  inputEl.focus();
});

// Quit
const quitBtn = $('#quit-btn');
quitBtn.addEventListener('click', async () => {
  if (isGenerating && abortController) abortController.abort();
  if (messages.length > 0) await saveCurrentConversation();
  window.api.quitApp();
});

// =================== QUICK CONTROLS ===================

const qThinking = $('#q-thinking');
const qThinkingLabel = $('#q-thinking-label');
const qTemp = $('#q-temp');
const qTempLabel = $('#q-temp-label');
const qTokens = $('#q-tokens');
const qTokensLabel = $('#q-tokens-label');

const THINKING_STATES = ['auto', 'on', 'off'];
const THINKING_LABELS = { auto: 'Think: auto', on: 'Think: on', off: 'Think: off' };

function updateQuickThinking() {
  qThinkingLabel.textContent = THINKING_LABELS[settings.thinking];
  qThinking.classList.remove('think-on', 'think-off');
  if (settings.thinking === 'on') qThinking.classList.add('think-on');
  else if (settings.thinking === 'off') qThinking.classList.add('think-off');
  // Sync settings panel
  sThinking.value = settings.thinking;
}

function updateQuickTemp() {
  qTempLabel.textContent = `Temp ${settings.temperature.toFixed(1)}`;
  sTemperature.value = settings.temperature;
  sTemperatureVal.textContent = settings.temperature.toFixed(1);
}

function updateQuickTokens() {
  const v = settings.maxTokens;
  qTokensLabel.textContent = v >= 1024 ? `${(v / 1024).toFixed(v >= 1024 && v % 1024 === 0 ? 0 : 1)}k tokens` : `${v} tokens`;
  sMaxTokens.value = v;
  sMaxTokensVal.textContent = v >= 1000 ? `${(v / 1024).toFixed(1)}k` : v;
}

// Thinking: click cycles auto → on → off
qThinking.addEventListener('click', () => {
  const idx = THINKING_STATES.indexOf(settings.thinking);
  settings.thinking = THINKING_STATES[(idx + 1) % 3];
  updateQuickThinking();
});

// Temperature: click shows popover
let activePopover = null;

function closePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
  document.removeEventListener('click', onDocClickPopover);
}

function onDocClickPopover(e) {
  if (activePopover && !activePopover.contains(e.target) && e.target !== qTemp && e.target !== qTokens) {
    closePopover();
  }
}

qTemp.addEventListener('click', (e) => {
  e.stopPropagation();
  if (activePopover && activePopover.dataset.type === 'temp') { closePopover(); return; }
  closePopover();

  const pop = document.createElement('div');
  pop.className = 'q-popover';
  pop.dataset.type = 'temp';
  pop.innerHTML = `
    <div class="q-popover-label">Temperature</div>
    <div class="q-popover-row">
      <input type="range" min="0" max="2" step="0.05" value="${settings.temperature}">
      <span class="q-popover-val">${settings.temperature.toFixed(1)}</span>
    </div>
  `;

  qTemp.style.position = 'relative';
  qTemp.appendChild(pop);
  activePopover = pop;

  const slider = pop.querySelector('input');
  const val = pop.querySelector('.q-popover-val');
  slider.addEventListener('input', () => {
    settings.temperature = parseFloat(slider.value);
    val.textContent = settings.temperature.toFixed(1);
    updateQuickTemp();
  });
  slider.addEventListener('click', (e) => e.stopPropagation());

  setTimeout(() => document.addEventListener('click', onDocClickPopover), 0);
});

// Tokens: click shows slider popover
qTokens.addEventListener('click', (e) => {
  e.stopPropagation();
  if (activePopover && activePopover.dataset.type === 'tokens') { closePopover(); return; }
  closePopover();

  const pop = document.createElement('div');
  pop.className = 'q-popover';
  pop.dataset.type = 'tokens';
  pop.innerHTML = `
    <div class="q-popover-label">Max tokens</div>
    <div class="q-popover-row">
      <input type="range" min="256" max="8192" step="256" value="${settings.maxTokens}">
      <span class="q-popover-val">${settings.maxTokens >= 1024 ? (settings.maxTokens / 1024) + 'k' : settings.maxTokens}</span>
    </div>
  `;

  qTokens.style.position = 'relative';
  qTokens.appendChild(pop);
  activePopover = pop;

  const slider = pop.querySelector('input');
  const val = pop.querySelector('.q-popover-val');
  slider.addEventListener('input', () => {
    settings.maxTokens = parseInt(slider.value);
    val.textContent = settings.maxTokens >= 1024 ? (settings.maxTokens / 1024) + 'k' : settings.maxTokens;
    updateQuickTokens();
  });
  slider.addEventListener('click', (e) => e.stopPropagation());

  setTimeout(() => document.addEventListener('click', onDocClickPopover), 0);
});

// Init quick bar state
updateQuickThinking();
updateQuickTemp();
updateQuickTokens();

// =================== BENCHMARK SLIDESHOW ===================

const benchOverlay = document.getElementById('bench-overlay');
const benchToggle = document.getElementById('bench-toggle');
const benchClose = document.getElementById('bench-close');
const slides = document.querySelectorAll('.bench-slide');
const dots = document.querySelectorAll('.slide-dot');
let currentSlide = 0;
let slideInterval = null;

function goToSlide(n) {
  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');
  currentSlide = (n + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
}

function startAutoplay() {
  stopAutoplay();
  slideInterval = setInterval(() => goToSlide(currentSlide + 1), 4000);
}

function stopAutoplay() {
  if (slideInterval) { clearInterval(slideInterval); slideInterval = null; }
}

function openSlideshow() {
  benchOverlay.classList.remove('hidden');
  currentSlide = 0;
  slides.forEach(s => s.classList.remove('active'));
  dots.forEach(d => d.classList.remove('active'));
  slides[0].classList.add('active');
  dots[0].classList.add('active');
  startAutoplay();
}

function closeSlideshow() {
  stopAutoplay();
  benchOverlay.classList.add('hidden');
}

if (benchToggle) benchToggle.addEventListener('click', openSlideshow);
if (benchClose) benchClose.addEventListener('click', closeSlideshow);

// Click overlay bg to close
if (benchOverlay) {
  benchOverlay.addEventListener('click', (e) => {
    if (e.target === benchOverlay) closeSlideshow();
  });
}

// Dots click
dots.forEach((dot, i) => {
  dot.addEventListener('click', () => { goToSlide(i); startAutoplay(); });
});

// Keyboard nav in slideshow
document.addEventListener('keydown', (e) => {
  if (benchOverlay && !benchOverlay.classList.contains('hidden')) {
    if (e.key === 'Escape') closeSlideshow();
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goToSlide(currentSlide + 1); startAutoplay(); }
    if (e.key === 'ArrowLeft') { goToSlide(currentSlide - 1); startAutoplay(); }
  }
});

// =================== KEYBOARD SHORTCUTS ===================

document.addEventListener('keydown', (e) => {
  // Cmd+N: new chat
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault();
    newChatBtn.click();
  }
  // Cmd+T: toggle thinking
  if ((e.metaKey || e.ctrlKey) && e.key === 't') {
    e.preventDefault();
    qThinking.click();
  }
});
