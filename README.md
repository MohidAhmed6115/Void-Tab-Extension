# VoidTab

> **A free, open-source alternative to Lumi List and Obsidian — built right into your Chrome new tab.**

VoidTab replaces your default new tab with a personal productivity dashboard. Organize bookmarks across multiple boards, drag groups anywhere on the canvas, and get real-time focus coaching from a built-in Claude-powered AI that watches your open tabs for distractions.

No subscription. No account. No cloud sync required.

---

## Features

### Multi-Board Workspace

Create multiple named boards — think of them like separate desktops. Switch between them from the tab bar at the top, or cycle with `[` / `]`. Each board has its own groups, layout, and card positions. Right-click any board tab to delete it.

###  Bookmark Groups

Bookmarks are organized into group cards. Each card has a name, an optional emoji icon, an optional custom accent color, a list of bookmarks with favicons, and controls to add or remove items. Double-click a group title to rename it and edit its icon/accent. Favicons are fetched automatically, with a letter-based placeholder as fallback.

### Group Accent Tint

Give any group card a custom accent color. The color subtly tints the card itself — layered *under* the glass blur via `color-mix()`, so the blur stays exactly as-is, just with a colored wash — plus the add-bookmark button and the selected-item highlight. Purely optional; cards default to the global accent if you don't set one.

### Group Templates

One-click starter groups — Coding, Learning, AI, Socials, News, Design — each prefilled with a few common links you can edit afterward. Available from the "New Group" modal.

###  Free-Position Canvas

Groups are not locked to a grid — drag them anywhere on screen. Cards snap to column alignment and stack neatly above or below each other with a consistent gap, keeping things tidy without forcing a rigid layout.

### Edit Mode

Toggle Edit Mode from the sidebar to unlock drag handles on group cards and enable bookmark reordering. While in Edit Mode, bookmarks become draggable between groups via HTML5 drag-and-drop.

###  Global Search

Search across every board, group, and bookmark at once — by title or URL. Open with the sidebar button or press `Ctrl+K` / `Cmd+K`, or press `/` to focus the search box on the home screen. Click any result to open it immediately.

### Bulk Import with AI

Paste a list of URLs (one per line) and hit **Analyze with AI**. Claude reads the URLs and suggests which group each one belongs to, including creating new group names if needed. You approve each addition individually.

### AI Focus Coach

A floating button opens a chat panel powered by Claude. The AI has live context — it knows your boards, your bookmarks, and your currently open tabs. Use it to:

- Ask where to put a new bookmark
- Say `check my tabs` to get a distraction audit
- Ask `what should I do now?` for a one-line next action
- Chat freely about productivity, focus, or task planning

The AI is direct and minimal — no fluff, no generic motivation.

### Auto Distraction Warning

Every time you open a new tab, VoidTab silently checks your open tabs. If it finds 2 or more distraction sites (YouTube, Reddit, Twitter, TikTok, Instagram, etc.) open at the same time, the AI panel auto-opens with a one-line warning. It says it once and gets out of the way.

### Widgets Panel

A dedicated panel (sidebar icon, or press `W`) with four tabs:

- **To-Do** — a quick task list; check items off, delete them, persists across sessions.
- **Notes** — a free-text scratchpad, autosaved as you type.
- **Recently Closed Tabs** — restore tabs you've closed, powered by `chrome.sessions`.
- **Weather** — current conditions via [Open-Meteo](https://open-meteo.com/) (no API key needed). Search a city or use your location, toggle °C/°F. Only fetches when you actually open the tab, so it never slows down page load.

### 7 Card Effects

Choose how your group cards look from Settings:

| Effect        | Description             |
| ------------- | ------------------------ |
|  Transparent | Clean, minimal glass     |
|  Frosted     | Blurred frosted glass    |
|  Ghost       | Ultra-light ghost panel  |
|  Neon Glow   | Glowing accent borders   |
|  Smoke       | Dark smoked glass        |
|  Aurora      | Gradient aurora tint     |
|  Matte Dark  | Solid dark matte         |

On top of the effect preset, independent **card opacity** and **card blur** sliders let you fine-tune the glass strength further.

### Layout & Typography

- **Density** — Compact, Comfortable, or Spacious spacing across the whole layout.
- **Font** — 5 system font stacks (Default, System UI, Serif, Monospace, Rounded). No external font downloads — everything renders from fonts already on your device.

### Custom Wallpaper

Upload any image from your device or paste an image URL, either globally or **per board**. A board-specific wallpaper overrides the global one only while that board is open, and falls back to the global background/scene otherwise. The image preloads before switching boards, so it never flashes blank mid-switch. Local images are stored in your browser — nothing leaves your machine.

### Scenes

11 built-in animated scenes (Void, Aurora, Sunset, Ocean, Ember, Forest, Dusk, Mono, Glacier, Crimson, Candy) plus a fully custom scene with your own base and accent colors.

### Theme Support

Auto (follows system dark/light preference), forced Dark, or forced Light.

### Cursor Personalization

Reactive effects that follow your cursor, layered on top of scenes and wallpapers:

- **Off, Spotlight, Particles, Ripples, Trail** — the originals
- **Orbit** — small dots circling the cursor
- **Custom sprite** — upload your own image to have it follow the cursor as an effect

Separately, **Custom cursor icon** replaces your actual OS pointer with an uploaded image — distinct from the sprite effect above, which layers *alongside* the normal pointer rather than replacing it.

All motion-based cursor effects automatically respect your system's `prefers-reduced-motion` setting, and particle count scales down on lower-core-count devices to avoid lag.

### Privacy Blur

One click blurs all bookmark titles and URLs across the entire page. Useful when screen sharing or presenting without exposing your bookmarks.

### Incognito Support

Open any bookmark in an incognito window from the right-click context menu, or open any URL in incognito from the sidebar button.

### Multi-Select Mode

Select multiple bookmarks at once for batch actions.

### Trash Bin

Deleted bookmarks go to the Trash instead of being permanently removed. Restore any item back to its original group (the group is recreated if it was also deleted). Or empty the trash permanently.

### Keyboard Shortcuts

| Shortcut            | Action                         |
| -------------------- | ------------------------------- |
| `Ctrl+K` / `Cmd+K`   | Open global search               |
| `/`                  | Focus search on the home screen  |
| `[` / `]`            | Switch to previous/next board    |
| `W`                  | Open the Widgets panel           |
| `Escape`             | Close any open modal             |

---

## Installation

VoidTab is a Chrome extension loaded in developer mode. It is not on the Chrome Web Store.

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `VoidTab Extension` folder
6. Open a new tab — VoidTab is live

---

## AI Setup

The AI Coach requires an Anthropic API key. Without it, VoidTab works fully — only the AI features are disabled.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Open VoidTab → click the ⚙ Settings icon in the sidebar
3. Paste your key in the **Anthropic API Key** field
4. Click **Save**

The key is stored locally in your browser via `chrome.storage.sync`. It is never sent anywhere except directly to the Anthropic API.

---

## Project Structure

```
VoidTab Extension/
├── manifest.json              # Chrome extension manifest (v3)
├── newtab.html                # Main page structure and modals
├── css/
│   └── newtab.css             # All styling, themes, card effects, layout density
├── js/
│   ├── newtab.js              # Core logic: boards, groups, bookmarks, widgets, UI
│   ├── ai.js                  # AI Coach: chat, tab analysis, bulk import
│   └── background.js          # Service worker: incognito tab handling
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Permissions

| Permission  | Why                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `tabs`      | AI Coach reads open tab titles and URLs for distraction detection             |
| `storage`   | Saves your boards, groups, bookmarks, and settings via `chrome.storage.sync`  |
| `tabGroups` | Reserved for future tab grouping features                                     |
| `bookmarks` | Reserved for future Chrome bookmark import                                    |
| `sessions`  | Powers the Recently Closed Tabs widget                                        |

**Host permissions:** `api.open-meteo.com`, `geocoding-api.open-meteo.com` — used only by the Weather widget. No API key required, and nothing is sent beyond the coordinates or city name you search for.

---

## Compared to Alternatives

| Feature             | VoidTab     | Lumi List    | Obsidian      |
| -------------------- | ----------- | ------------ | ------------- |
| Free                 | ✅           | ❌ Paid tiers | ✅ (free tier) |
| Browser new tab       | ✅           | ✅            | ❌             |
| No account required   | ✅           | ❌            | ✅             |
| AI focus coaching     | ✅           | ❌            | ❌             |
| Live tab monitoring   | ✅           | ❌            | ❌             |
| Custom wallpapers     | ✅ Global + per-board | Limited | ❌     |
| Card visual effects   | ✅ 7 effects + accent tint | ❌ | ❌     |
| Built-in widgets       | ✅ To-Do, Notes, Weather, Closed Tabs | ❌ | ❌ |
| Open source           | ✅           | ❌            | ❌             |

---

## Authors

Built by **Mohid Ahmed** — Software Engineering student at Riphah International University.

---

## License

MIT License — free to use, modify, and distribute.
