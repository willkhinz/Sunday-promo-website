/* ═══════════════════════════════════════════════════════════════════════════
   Sunday — Landing Page JavaScript
   Complete interactive logic for the demo landing page.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     STATE MANAGEMENT
     ───────────────────────────────────────────── */
  const state = {
    personality: 'sunday',
    thinkingMode: false,
    searchMode: 'hybrid',
    temperature: 0.70,
    maxTokens: 1024,
    accent: 'mono',
    background: 'black',
    isGenerating: false,
    hasTitled: false
  };

  /** Active timeouts so clearChat can cancel every pending timer. */
  const activeTimeouts = [];

  /** Helper — push a setTimeout and return its id. */
  function delay(ms) {
    return new Promise((resolve) => {
      const id = setTimeout(resolve, ms);
      activeTimeouts.push(id);
    });
  }

  /* ─────────────────────────────────────────────
     DOM REFERENCES
     ───────────────────────────────────────────── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const themeToggleBtn   = $('#theme-toggle-btn');
  const themePanel       = $('#theme-panel');
  const personalitySelect = $('#personality-select');
  const thinkingToggle   = $('#thinking-toggle');
  const tempSlider       = $('#temp-slider');
  const tempValue        = $('#temp-value');
  const tokensSlider     = $('#tokens-slider');
  const tokensValue      = $('#tokens-value');
  const searchModeDesc   = $('#search-mode-desc');
  const chatMessages     = $('#chat-messages');
  const chatInput        = $('#chat-input');
  const chatSendBtn      = $('#chat-send-btn');
  const chatBackBtn      = $('#chat-back-btn');
  const chatTitleText    = $('#chat-title-text');
  const thinkingIndicatorBtn = $('#thinking-indicator-btn');
  const chatStopBtn      = $('#chat-stop-btn');
  const suggestionChips  = $('#suggestion-chips');

  /* ─────────────────────────────────────────────
     RESPONSE DATABASE
     ───────────────────────────────────────────── */
  const responses = {
    weather: {
      sunday: 'That\'s a lovely question! ☀️ While I can\'t check live weather from here on your device, Tokyo in summer is typically warm — around 28°C (82°F) with partly cloudy skies and that signature humidity. If you enable web search in settings, I can look up real-time conditions for you!',
      direct: 'I don\'t have live weather access in offline mode. Enable web search for real-time data. Typical Tokyo summer: 25-33°C, humid, chance of afternoon showers.',
      emerson: 'Okay so I\'d love to tell you it\'s a gorgeous 75 and sunny but honestly? I\'m running on your iPhone\'s GPU right now, not connected to any weather API. Turn on web search and I\'ll actually be useful for once.',
      devin: 'Yo, I wish I could tell you but I\'m vibing locally on your phone rn — no internet connection. Flip on that web search toggle and I got you though! Tokyo\'s probably doing its hot & humid summer thing tho 🤙',
      default: 'I\'m currently running offline on your device, so I can\'t fetch live weather data. But you can enable web search in the settings to get real-time information! Tokyo typically has warm, humid summers.'
    },
    photosynthesis: {
      sunday: 'Photosynthesis is one of nature\'s most beautiful processes! 🌿\n\nIt\'s how plants convert sunlight into the energy they need to grow. Here\'s the simple version:\n\n**Step 1:** Plants absorb sunlight through chlorophyll — the green pigment in their leaves.\n\n**Step 2:** They take in carbon dioxide (CO₂) from the air through tiny pores called stomata.\n\n**Step 3:** They absorb water (H₂O) from the soil through their roots.\n\n**Step 4:** Using the sun\'s energy, they combine CO₂ and H₂O to create glucose (C₆H₁₂O₆) — their food — and release oxygen (O₂) as a byproduct.\n\nThe equation: **6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂**\n\nEssentially, plants are nature\'s solar panels — powering themselves with sunlight and giving us breathable oxygen as a gift. 🌱',
      direct: 'Plants convert light energy to chemical energy via chlorophyll.\n\nEquation: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂\n\nTwo stages:\n1. Light-dependent reactions (thylakoid) — water splits, ATP + NADPH produced\n2. Calvin cycle (stroma) — CO₂ fixed into glucose using ATP + NADPH\n\nNet output: glucose + oxygen.',
      default: 'Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen. The chemical equation is 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂. It occurs in the chloroplasts of plant cells, primarily in the leaves.'
    },
    calculator: {
      sunday: 'Let me crunch that for you! 🧮\n\n**847 × 23 = 19,481**\n\nI used my built-in calculator tool for that — no rounding errors, just pure math!',
      direct: '847 × 23 = 19,481',
      default: '847 × 23 = **19,481**. I used the built-in calculator tool to compute this precisely.'
    },
    colosseum: {
      sunday: 'Great topic! The Colosseum is absolutely fascinating. 🏛️\n\nThe **Colosseum** (or Flavian Amphitheatre) is an oval amphitheatre in the centre of Rome, Italy. Built of travertine limestone, tuff, and brick-faced concrete, it is the largest ancient amphitheatre ever built.\n\n**Key facts:**\n• Construction began in AD 72 under Emperor Vespasian\n• Completed in AD 80 by his son Titus\n• Could hold 50,000–80,000 spectators\n• Used for gladiatorial contests, public spectacles, and dramas\n• Measures 189 meters long, 156 meters wide, 48 meters tall\n\nDespite earthquakes and stone-robbers, it remains one of Rome\'s most iconic landmarks and was named one of the New Seven Wonders of the World in 2007. 🌍',
      direct: 'The Colosseum (Flavian Amphitheatre) — oval amphitheatre in Rome.\n\nBuilt: AD 72-80. Capacity: 50,000-80,000. Dimensions: 189m × 156m × 48m.\n\nUsed for gladiatorial combat, animal hunts, executions, and re-enactments. Largest amphitheatre ever built. Named a New Seven Wonder in 2007.',
      default: 'The Colosseum, also known as the Flavian Amphitheatre, is an oval amphitheatre in Rome, Italy. It was built between AD 72-80 and could hold 50,000-80,000 spectators. It was used for gladiatorial contests and public spectacles.'
    },
    default: {
      sunday: 'That\'s a really interesting question! 😊 While I\'m just a demo on this website, the real Sunday app running on your iPhone can give you a much more detailed answer. It uses Google\'s Gemma 4 model with 2.5 billion parameters, all running locally on your device. Download the app to try it!',
      direct: 'This is a web demo with limited responses. The full Sunday app runs Gemma 4 (2.5B params) locally on your iPhone with full conversational AI capabilities. Download to try the complete experience.',
      default: 'Great question! I\'m just a demo here on the website, but the real Sunday app can answer that and so much more — all running privately on your device. Give it a try!'
    }
  };

  /* ─────────────────────────────────────────────
     THINKING MODE DATA
     ───────────────────────────────────────────── */
  const thinkingData = {
    weather: {
      r1: 'The user is asking about weather in Tokyo. I need to check if I have web search capabilities enabled. Since I\'m running on-device, I should clarify my offline status while providing general climate information.',
      r2: 'Verified: I correctly identified that I cannot access live weather data in offline mode and provided helpful context about typical Tokyo weather patterns.'
    },
    photosynthesis: {
      r1: 'The user wants an explanation of photosynthesis. I should cover the core process: light energy conversion, inputs (CO₂, H₂O), outputs (glucose, O₂), and the role of chlorophyll. I\'ll include the chemical equation for precision.',
      r2: 'Verified: The equation 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ is correct. The explanation covers both the simple overview and key molecular details.'
    },
    calculator: {
      r1: 'The user wants to multiply 847 by 23. I should use the calculator tool for precision rather than attempting mental math, as this ensures zero rounding errors.',
      r2: 'Verified: Calculator returned 19,481. Cross-check: 847 × 20 = 16,940, plus 847 × 3 = 2,541, total = 19,481. Confirmed correct.'
    },
    colosseum: {
      r1: 'The user is asking about the Colosseum in Rome. I\'ll search my offline knowledge base for comprehensive information including construction dates, dimensions, capacity, and historical significance.',
      r2: 'Verified: Key facts confirmed — Flavian Amphitheatre, built AD 72-80, capacity 50K-80K, dimensions 189×156×48m. Named New Seven Wonder 2007.'
    },
    default: {
      r1: 'The user has asked a question that falls outside my pre-loaded demo responses. I should acknowledge the limitation while highlighting the full app\'s capabilities.',
      r2: 'Verified: Response accurately represents the demo\'s limitations and directs toward the full app experience.'
    }
  };

  /* ─────────────────────────────────────────────
     KEYWORD → PROMPT-KEY MAPPING
     ───────────────────────────────────────────── */
  function detectPromptKey(text) {
    const lower = text.toLowerCase();
    if (/weather|tokyo/.test(lower)) return 'weather';
    if (/photosynthesis/.test(lower)) return 'photosynthesis';
    if (/847|multiply|×|times|23/.test(lower)) return 'calculator';
    if (/colosseum|coliseum/.test(lower)) return 'colosseum';
    return 'default';
  }

  /** Return the best personality match; fall back through 'default'. */
  function getResponse(promptKey) {
    const bucket = responses[promptKey] || responses.default;
    return bucket[state.personality] || bucket.default;
  }

  function getThinking(promptKey) {
    if (!state.thinkingMode) return null;
    return thinkingData[promptKey] || thinkingData.default;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     THEME SYSTEM
     ═══════════════════════════════════════════════════════════════════════════ */

  /* --- Theme Toggle --- */
  themeToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themePanel.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!themePanel.contains(e.target) && !themeToggleBtn.contains(e.target)) {
      themePanel.classList.remove('active');
    }
  });

  /* --- Accent Colors --- */
  $$('.color-dot[data-accent]').forEach((dot) => {
    dot.addEventListener('click', () => {
      $$('.color-dot').forEach((d) => d.classList.remove('active'));
      dot.classList.add('active');
      state.accent = dot.dataset.accent;
      document.body.dataset.accent = state.accent;
    });
  });

  /* --- Background Colors --- */
  $$('.bg-option[data-bg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.bg-option').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.background = btn.dataset.bg;
      document.body.dataset.bg = state.background;
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     SETTINGS CONTROLS
     ═══════════════════════════════════════════════════════════════════════════ */

  /* --- Personality Select --- */
  personalitySelect.addEventListener('change', () => {
    state.personality = personalitySelect.value;
    syncPersonaCards(state.personality);
  });

  /* --- Thinking Toggle (settings panel + header pill stay in sync, like the app's
     Settings toggle and toolbar brain icon both driving isThinkingModeEnabled) --- */
  function setThinkingMode(on) {
    state.thinkingMode = on;
    thinkingToggle.checked = on;
    thinkingIndicatorBtn.classList.toggle('active', on);
  }

  thinkingToggle.addEventListener('change', () => {
    setThinkingMode(thinkingToggle.checked);
  });

  thinkingIndicatorBtn.addEventListener('click', () => {
    setThinkingMode(!state.thinkingMode);
  });

  /* --- Temperature Slider --- */
  tempSlider.addEventListener('input', () => {
    state.temperature = parseFloat((tempSlider.value / 100).toFixed(2));
    tempValue.textContent = (tempSlider.value / 100).toFixed(2);
  });

  /* --- Max Tokens Slider --- */
  tokensSlider.addEventListener('input', () => {
    state.maxTokens = parseInt(tokensSlider.value, 10);
    tokensValue.textContent = tokensSlider.value;
  });

  /* --- Search Mode Buttons --- */
  const searchModeDescriptions = {
    online: 'Searches the live web for real-time information.',
    hybrid: 'Tries online search first, falls back to the local Wikipedia database when offline.',
    offline: 'Searches the downloaded Wikipedia database. No internet needed.'
  };

  $$('.search-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.search-mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.searchMode = btn.dataset.mode;
      searchModeDesc.textContent = searchModeDescriptions[state.searchMode];
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     MOCK CHAT SYSTEM
     ═══════════════════════════════════════════════════════════════════════════ */

  /** Scroll chat container to the very bottom. */
  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /* --- Get formatted timestamp --- */
  function getTimestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* --- addUserBubble --- */
  function addUserBubble(text) {
    const row = document.createElement('div');
    row.className = 'message-row user';

    const container = document.createElement('div');
    container.className = 'message-container user';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble user';
    bubble.textContent = text;
    container.appendChild(bubble);

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = getTimestamp();
    container.appendChild(meta);

    row.appendChild(container);
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  /* --- addAssistantBubble --- */
  function addAssistantBubble(text, thinking) {
    const row = document.createElement('div');
    row.className = 'message-row assistant';

    // 1. AI Avatar Icon (brain glyph on a translucent circle — matches MessageBubbleView.swift's
    // Circle().fill(white.opacity(0.15)) + Image(systemName: "brain.filled.head.profile"))
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"/>
      </svg>
    `;
    row.appendChild(avatar);

    const container = document.createElement('div');
    container.className = 'message-container assistant';

    // 2. Thinking Process (if active)
    if (thinking) {
      const thinkingContainer = document.createElement('div');
      thinkingContainer.className = 'thinking-container';

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'thinking-toggle-btn';
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px;">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"></path>
        </svg>
        <span>Show thought process</span>
        <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:8px; height:8px; transition: transform 0.2s;">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;
      thinkingContainer.appendChild(toggleBtn);

      const content = document.createElement('div');
      content.className = 'thinking-content';

      // Round 1
      const round1 = document.createElement('div');
      round1.className = 'thinking-round';
      const label1 = document.createElement('div');
      label1.className = 'thinking-round-label';
      label1.textContent = 'ROUND 1: REASONING';
      const text1 = document.createElement('div');
      text1.className = 'thinking-round-text';
      text1.textContent = thinking.r1;
      round1.appendChild(label1);
      round1.appendChild(text1);
      content.appendChild(round1);

      // Divider
      const divider = document.createElement('div');
      divider.className = 'thinking-divider';
      content.appendChild(divider);

      // Round 2
      const round2 = document.createElement('div');
      round2.className = 'thinking-round';
      const label2 = document.createElement('div');
      label2.className = 'thinking-round-label';
      label2.textContent = 'ROUND 2: VERIFICATION';
      const text2 = document.createElement('div');
      text2.className = 'thinking-round-text';
      text2.textContent = thinking.r2;
      round2.appendChild(label2);
      round2.appendChild(text2);
      content.appendChild(round2);

      thinkingContainer.appendChild(content);
      container.appendChild(thinkingContainer);

      toggleBtn.addEventListener('click', () => {
        const isExpanded = content.classList.toggle('expanded');
        toggleBtn.querySelector('span').textContent = isExpanded ? 'Hide thoughts' : 'Show thought process';
        const chevron = toggleBtn.querySelector('.chevron-icon');
        if (chevron) {
          chevron.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        }
        content.style.display = isExpanded ? 'flex' : 'none';
        scrollToBottom();
      });
    }

    // 3. Response Text Bubble
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble assistant';
    const responseSpan = document.createElement('span');
    responseSpan.className = 'response-text';
    bubble.appendChild(responseSpan);
    container.appendChild(bubble);

    // 4. Meta Row with timestamp and speak button
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    
    const timeSpan = document.createElement('span');
    timeSpan.textContent = getTimestamp();
    meta.appendChild(timeSpan);

    const speakBtn = document.createElement('button');
    speakBtn.className = 'speak-btn';
    speakBtn.setAttribute('aria-label', 'Speak message');
    speakBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
    `;
    
    // Wire dummy click to mock speech synthesizer toggle
    speakBtn.addEventListener('click', () => {
      const isSpeaking = speakBtn.classList.toggle('speaking');
      speakBtn.style.color = isSpeaking ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.4)';
    });
    meta.appendChild(speakBtn);
    container.appendChild(meta);

    row.appendChild(container);
    chatMessages.appendChild(row);
    scrollToBottom();

    return streamText(responseSpan, text);
  }

  /* --- streamText --- */
  function streamText(element, text, speed = 20) {
    return new Promise((resolve) => {
      // Add blinking cursor
      const cursor = document.createElement('span');
      cursor.className = 'streaming-cursor';
      cursor.textContent = '▍';
      element.appendChild(cursor);

      let index = 0;
      let buffer = '';
      let inBold = false;

      function tick() {
        if (index >= text.length) {
          // Flush remaining buffer
          if (buffer) {
            element.insertBefore(document.createTextNode(buffer), cursor);
            buffer = '';
          }
          cursor.remove();
          scrollToBottom();
          resolve();
          return;
        }

        const char = text[index];

        // Check for bold markers **...**
        if (char === '*' && text[index + 1] === '*') {
          // Flush buffer first
          if (buffer) {
            if (inBold) {
              // We're inside a <strong>, append to the last one
              const strong = element.querySelector('strong:last-of-type');
              if (strong) {
                strong.appendChild(document.createTextNode(buffer));
              } else {
                element.insertBefore(document.createTextNode(buffer), cursor);
              }
            } else {
              element.insertBefore(document.createTextNode(buffer), cursor);
            }
            buffer = '';
          }

          if (!inBold) {
            // Open bold
            const strong = document.createElement('strong');
            element.insertBefore(strong, cursor);
            inBold = true;
          } else {
            // Close bold
            inBold = false;
          }
          index += 2;
        } else if (char === '\n') {
          // Flush buffer
          if (buffer) {
            if (inBold) {
              const strong = element.querySelector('strong:last-of-type');
              if (strong) strong.appendChild(document.createTextNode(buffer));
            } else {
              element.insertBefore(document.createTextNode(buffer), cursor);
            }
            buffer = '';
          }
          element.insertBefore(document.createElement('br'), cursor);
          index++;
        } else if (char === '•') {
          // Bullet point — flush buffer, add bullet
          if (buffer) {
            if (inBold) {
              const strong = element.querySelector('strong:last-of-type');
              if (strong) strong.appendChild(document.createTextNode(buffer));
            } else {
              element.insertBefore(document.createTextNode(buffer), cursor);
            }
            buffer = '';
          }
          element.insertBefore(document.createTextNode('•'), cursor);
          index++;
        } else {
          buffer += char;
          // Periodically flush the buffer for a natural feel
          if (buffer.length >= 3) {
            if (inBold) {
              const strong = element.querySelector('strong:last-of-type');
              if (strong) strong.appendChild(document.createTextNode(buffer));
            } else {
              element.insertBefore(document.createTextNode(buffer), cursor);
            }
            buffer = '';
          }
          index++;
        }

        scrollToBottom();
        const id = setTimeout(tick, speed);
        activeTimeouts.push(id);
      }

      tick();
    });
  }

  /* --- showTypingIndicator --- */
  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'typing-dot';
      indicator.appendChild(dot);
    }
    chatMessages.appendChild(indicator);
    scrollToBottom();
    return indicator;
  }

  /* --- showStatus --- */
  function showStatus(text) {
    const msg = document.createElement('div');
    msg.className = 'status-message';

    const spinner = document.createElement('span');
    spinner.className = 'status-spinner';
    msg.appendChild(spinner);

    const label = document.createTextNode(text);
    msg.appendChild(label);

    chatMessages.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  /* --- Send-button icon: arrow.up while idle, stop.fill while generating
     (ChatView.swift's inputBar swaps the same button's icon rather than showing a second control) --- */
  function setSendButtonGenerating(isGenerating) {
    chatSendBtn.innerHTML = isGenerating
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    chatSendBtn.classList.toggle('generating', isGenerating);
    chatStopBtn.hidden = !isGenerating;
  }

  /* --- stopGeneration --- (mirrors ChatViewModel.stopGeneration: cancel the in-flight turn,
     leave whatever text already streamed in place, and re-enable input) */
  function stopGeneration() {
    if (!state.isGenerating) return;

    activeTimeouts.forEach((id) => clearTimeout(id));
    activeTimeouts.length = 0;

    const typing = chatMessages.querySelector('.typing-indicator');
    if (typing) typing.remove();
    const status = chatMessages.querySelector('.status-message');
    if (status) status.remove();
    const cursor = chatMessages.querySelector('.streaming-cursor');
    if (cursor) cursor.remove();

    state.isGenerating = false;
    chatInput.disabled = false;
    suggestionChips.style.display = '';
    setSendButtonGenerating(false);
    chatInput.focus();
  }

  /* --- clearChat --- */
  function clearChat() {
    stopGeneration();

    // Rebuild welcome state
    chatMessages.innerHTML = '';
    const welcome = document.createElement('div');
    welcome.className = 'chat-welcome';
    welcome.innerHTML = `
      <div class="welcome-icon">
        <img src="app-icon.png" alt="Sunday Logo" class="welcome-icon-img">
      </div>
      <p>Send a message or tap a suggestion below.</p>
    `;
    chatMessages.appendChild(welcome);

    // Reset title back to a fresh conversation (Conversation(title: "New Chat"))
    state.hasTitled = false;
    chatTitleText.textContent = 'New Chat';

    // Re-enable UI
    chatInput.disabled = false;
    suggestionChips.style.display = '';
    chatInput.value = '';
    chatInput.focus();
  }

  /* --- sendMessage --- */
  async function sendMessage(text) {
    if (!text || !text.trim() || state.isGenerating) return;

    const message = text.trim();
    state.isGenerating = true;

    // Input stays usable; the send button flips to a stop control (matches the app)
    chatInput.value = '';
    setSendButtonGenerating(true);

    // Auto-title the conversation from the first user turn, like ChatViewModel does
    // (conversation.title = String(userText.prefix(40))).
    if (!state.hasTitled) {
      chatTitleText.textContent = message.slice(0, 40);
      state.hasTitled = true;
    }

    // Remove welcome if present
    const welcome = chatMessages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    // Hide chips
    suggestionChips.style.display = 'none';

    // 1. Add user bubble
    addUserBubble(message);

    // 2. Determine prompt key
    const promptKey = detectPromptKey(message);

    // 3. Initial delay
    await delay(300);

    // 4. Status messages for special prompts
    if (promptKey === 'calculator') {
      const status = showStatus('🔧 Calling calculator...');
      await delay(800);
      status.remove();
    } else if (promptKey === 'colosseum') {
      const status = showStatus('📚 Searching offline knowledge base...');
      await delay(1200);
      status.remove();
    } else if (
      (state.searchMode === 'online' || state.searchMode === 'hybrid') &&
      (promptKey === 'weather' || promptKey === 'colosseum')
    ) {
      const status = showStatus('🌐 Searching the web...');
      await delay(1000);
      status.remove();
    }

    // 5. Show typing indicator
    const typing = showTypingIndicator();
    await delay(600);
    typing.remove();

    // 6. Get response and optional thinking
    const responseText = getResponse(promptKey);
    const thinking = getThinking(promptKey);

    // 7. Stream the assistant response
    await addAssistantBubble(responseText, thinking);

    // 8. Turn complete — restore the send button
    suggestionChips.style.display = '';
    state.isGenerating = false;
    setSendButtonGenerating(false);
    chatInput.focus();
  }

  /* ─────────────────────────────────────────────
     INPUT HANDLING
     ───────────────────────────────────────────── */
  chatSendBtn.addEventListener('click', () => {
    // While generating, the send button is a stop button (as in ChatView.swift's inputBar)
    if (state.isGenerating) { stopGeneration(); return; }
    sendMessage(chatInput.value);
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage(chatInput.value);
    }
  });

  $$('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      sendMessage(chip.dataset.prompt);
    });
  });

  // Back chevron returns to a fresh conversation (like popping ChatView off the nav stack)
  chatBackBtn.addEventListener('click', clearChat);
  // Dedicated stop control in the header pill, shown only while generating
  chatStopBtn.addEventListener('click', stopGeneration);

  /* ═══════════════════════════════════════════════════════════════════════════
     PERSONA CARDS
     ═══════════════════════════════════════════════════════════════════════════ */

  /** Sync .selected on persona cards from a personality value. */
  function syncPersonaCards(personality) {
    $$('.persona-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.persona === personality);
    });
  }

  $$('.persona-card').forEach((card) => {
    card.addEventListener('click', () => {
      // Remove selected from siblings
      $$('.persona-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');

      // Sync the personality select dropdown
      const persona = card.dataset.persona;
      state.personality = persona;
      personalitySelect.value = persona;
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     SCROLL ANIMATIONS
     ═══════════════════════════════════════════════════════════════════════════ */
  const fadeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.1 }
  );

  /* Story sections reveal their phone + copy as you scroll into them. Fires a bit before the
     section is centred (rootMargin) so the content is already settling in as it enters view. */
  const storyObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          storyObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25, rootMargin: '0px 0px -10% 0px' }
  );

  /* ═══════════════════════════════════════════════════════════════════════════
     SMOOTH SCROLL — intercept anchor links
     ═══════════════════════════════════════════════════════════════════════════ */
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const targetId = anchor.getAttribute('href');
    if (targetId === '#') return; // bare # (App Store placeholder)

    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     INITIALIZATION
     ═══════════════════════════════════════════════════════════════════════════ */
  function init() {
    // Set initial body data attributes
    document.body.dataset.bg = 'black';
    document.body.dataset.accent = 'mono';

    // Add fade-in-section class and observe
    ['#sandbox', '#personas', '#cta'].forEach((sel) => {
      const section = document.querySelector(sel);
      if (section) {
        section.classList.add('fade-in-section');
        fadeObserver.observe(section);
      }
    });

    // Observe each story section for scroll-triggered reveal
    $$('.story').forEach((section) => storyObserver.observe(section));
  }

  init();
})();
