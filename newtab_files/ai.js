// ============================================================
//  VoidTab — ai.js
//  Handles: AI chat, tab analysis, bulk import suggestions
// ============================================================

const MASTER_PROMPT = `
## IDENTITY
You are a silent productivity guardian embedded in the user's browser new tab page. Your job is to keep the user focused, organized, and moving forward.

## PERSONALITY
- Sharp, minimal, and direct. No fluff.
- You speak like a senior engineer mentor — honest, no sugarcoating.
- You never lecture. You give one clear signal and let the user decide.

## CORE RESPONSIBILITIES

### 1. TAB AWARENESS (Passive Monitoring)
- You have access to the user's currently open tabs.
- If the user has open tabs unrelated to their active bookmark boards or known productive domains, flag it.
- Flagging format: short one-line warning. Example: "You have 4 unrelated tabs open. Close them or they'll cost you focus."
- DO NOT flag as distracting: GitHub, Claude, ChatGPT, Gemini, Udemy, university portals, coding tools, documentation sites.
- DO flag as distracting: YouTube (if not in Socials intentionally), Reddit, Twitter/X, gaming sites, random shopping, news scrolling.

### 2. BOOKMARK BOARD ASSISTANT
- When the user asks, help them decide which board a new bookmark belongs to.
- Suggest a board name if a link doesn't fit any existing group.
- If asked: auto-generate a clean group name from a list of URLs.

### 3. BULK IMPORT HELPER
- When given URLs, identify their purpose and suggest which board each belongs to.
- Output format: URL → Suggested Board

### 4. FOCUS COACH (On Demand)
- When the user says "check my tabs" or "am I focused?": List distraction tabs and give a one-line verdict.
- When the user says "what should I do now?": Give one clear next action.

### 5. PRIVACY BLUR CONTEXT
- When privacy blur is ON, do not display bookmark titles or URLs in responses.

## RULES
- Never give more than 3 sentences unless the user asks for detail.
- Never ask follow-up questions unless something is genuinely ambiguous.
- Never be generically motivational. Be specific and tactical.
- Treat the user's time as the most valuable resource.
- If the user is off-track, say it once. Don't repeat.

## CONTEXT (Live)
Boards and bookmarks:
{{BOARDS_JSON}}

Open tabs:
{{OPEN_TABS_JSON}}
`.trim();

let chatHistory = [];

// ---------- GET LIVE CONTEXT ----------
async function getBoardsJSON() {
  const boards = window._voidtabState?.boards || [];
  return JSON.stringify(boards.map(b => ({
    board: b.name,
    groups: b.groups.map(g => ({ group: g.name, links: g.bookmarks.map(bk => bk.url) }))
  })), null, 2);
}

async function getOpenTabsJSON() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({}, (tabs) => {
        const data = tabs.map(t => ({ title: t.title, url: t.url }));
        resolve(JSON.stringify(data, null, 2));
      });
    } catch {
      resolve('[]');
    }
  });
}

async function buildSystemPrompt() {
  const boards = await getBoardsJSON();
  const tabs = await getOpenTabsJSON();
  return MASTER_PROMPT
    .replace('{{BOARDS_JSON}}', boards)
    .replace('{{OPEN_TABS_JSON}}', tabs);
}

// ---------- CHAT ----------
window.aiChat = async function(userMessage) {
  const apiKey = window._voidtabState?.apiKey;

  if (!apiKey) {
    window.appendAIMsg('assistant', 'No API key set. Open Settings and add your Anthropic API key to enable AI coaching.');
    return;
  }

  const typingEl = window.appendAIMsg('assistant', '...');
  typingEl.classList.add('typing');

  chatHistory.push({ role: 'user', content: userMessage });

  try {
    const systemPrompt = await buildSystemPrompt();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages: chatHistory
      })
    });

    const data = await response.json();

    if (data.error) {
      typingEl.textContent = `Error: ${data.error.message}`;
      typingEl.classList.remove('typing');
      return;
    }

    const reply = data.content?.[0]?.text || 'No response.';
    chatHistory.push({ role: 'assistant', content: reply });

    typingEl.textContent = reply;
    typingEl.classList.remove('typing');

    // Keep history to last 10 turns to avoid token overflow
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  } catch (err) {
    typingEl.textContent = `Connection error: ${err.message}`;
    typingEl.classList.remove('typing');
  }
};

// ---------- BULK IMPORT AI SUGGESTIONS ----------
window.aiSuggestGroups = async function(urls, existingGroups) {
  const apiKey = window._voidtabState?.apiKey;

  if (!apiKey) {
    return urls.map(url => ({ url, group: guessGroupFallback(url) }));
  }

  try {
    const prompt = `You are a bookmark organizer. Given these URLs and existing group names, suggest which group each URL belongs to. If none fit, suggest a new group name (1-2 words, title case).

Existing groups: ${existingGroups.join(', ') || 'none'}

URLs:
${urls.map((u, i) => `${i + 1}. ${u}`).join('\n')}

Respond ONLY with a JSON array like:
[{"url":"https://example.com","group":"Tools"},...]
No preamble, no markdown.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    return JSON.parse(text.replace(/```json|```/g, '').trim());

  } catch {
    return urls.map(url => ({ url, group: guessGroupFallback(url) }));
  }
};

// Fallback group guesser without AI
function guessGroupFallback(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    if (['github.com','gitlab.com','stackoverflow.com','codepen.io'].some(d => host.includes(d))) return 'Coding';
    if (['youtube.com','twitter.com','instagram.com','reddit.com'].some(d => host.includes(d))) return 'Socials';
    if (['claude.ai','chat.openai.com','gemini.google.com','copilot.microsoft.com'].some(d => host.includes(d))) return 'AI';
    if (['udemy.com','coursera.org','khanacademy.org'].some(d => host.includes(d))) return 'Learning';
    return 'Tools';
  } catch { return 'General'; }
}

// ---------- TAB WARNING ON LOAD ----------
async function checkTabsOnLoad() {
  const apiKey = window._voidtabState?.apiKey;
  if (!apiKey) return;

  const tabs = await getOpenTabsJSON();
  const parsed = JSON.parse(tabs);
  const distractions = parsed.filter(t => {
    const u = t.url || '';
    return ['youtube.com','reddit.com','twitter.com','x.com','instagram.com',
            'facebook.com','tiktok.com','9gag.com'].some(d => u.includes(d));
  });

  if (distractions.length >= 2) {
    const msgs = document.getElementById('ai-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'ai-msg assistant';
    div.textContent = `${distractions.length} distraction tab${distractions.length > 1 ? 's' : ''} detected (${distractions.map(t => new URL(t.url).hostname.replace('www.','')).join(', ')}). Close them.`;
    msgs.appendChild(div);
    document.getElementById('ai-panel').classList.remove('hidden');
  }
}

// Expose state reference for AI to access
Object.defineProperty(window, '_voidtabState', {
  get: () => typeof state !== 'undefined' ? state : {}
});

// Run tab check after a short delay to let state load
setTimeout(checkTabsOnLoad, 2000);
