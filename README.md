# VoidTab

> A free, open-source new tab replacement for Chrome — bookmark boards, a fully customizable background, and a built-in Claude-powered AI coach.

VoidTab turns your new tab page into a personal dashboard. Organize bookmarks across multiple boards, drag groups anywhere on the canvas, style the background and clock however you like, and get real-time focus coaching from an AI that watches your open tabs for distractions.

No subscription. No account. No cloud sync required.

---

## Features

### Multi-Board Workspace
Create multiple named boards — think of them as separate desktops. Switch between them from the tab bar at the top, double-click a tab to rename it, or right-click to delete it. Each board keeps its own groups and card layout.

### Bookmark Groups
Bookmarks are organized into group cards. Each card has a name, a list of bookmarks with favicons (falling back to a colored letter tile if a favicon fails to load), and controls to add or remove items. Double-click a group title to rename it inline.

### Add / Edit Bookmark Dialog
Adding or editing a bookmark opens a proper dialog with a link field, a name field that autofills from the link, a live favicon preview, and a group picker — no browser prompt windows.

### Free-Position Canvas
Groups aren't locked to a grid. In Edit Mode, drag a card by its handle anywhere on the canvas; it snaps to column alignment and stacks neatly above or below other cards with a consistent gap. Bookmarks themselves can be dragged between groups in Edit Mode too.

### Import & Export Bookmarks (.txt)
Export every bookmark as a plain text file: each entry is the bookmark name, then its link, then a blank line. Copy it to the clipboard or download it directly.

Import accepts that same format, or just a plain list of links (names are filled in automatically). You can paste text or load a `.txt` file, choose which board and group to add into (or create a new group on the fly), skip links that are already in the target group, and optionally have Claude sort the imported links into suggested groups before confirming.

### Global Search
Search across every board, group, and bookmark at once — by title or URL. Open it from the sidebar or `Ctrl+K` / `Cmd+K`. Click any result to open it.

### AI Focus Coach
A floating button opens a chat panel powered by Claude. The AI has live context — it knows your boards, your bookmarks, and your currently open tabs. Use it to:
- Ask where a new bookmark should go
- Say "check my tabs" for a distraction audit
- Ask "what should I do now?" for a one-line next action
- Chat about productivity, focus, or task planning

The AI is direct and minimal — no fluff, no generic motivation. It requires your own Anthropic API key (see AI Setup below); without one, everything else in VoidTab still works normally.

### Automatic Distraction Warning
Whenever you open a new tab, VoidTab quietly checks your other open tabs. If two or more known distraction sites (YouTube, Reddit, Twitter/X, TikTok, Instagram, and similar) are open at once, the AI panel opens on its own with a one-line warning, then gets out of the way.

### Backgrounds
Background settings live behind the image icon in the bottom-left corner, across three tabs:

**Scene** — used whenever no wallpaper image is set. Choose from nine built-in scenes (including Daylight, a light default with white base and green/purple glow, plus darker options like Void, Aurora, Sunset, Ocean, Ember, Forest, Dusk, and Mono), or pick Custom and set your own base and glow colors. Toggle the animated drifting glow, film grain, and an optional dot or grid pattern.

**Image** — upload a wallpaper from your device (stored locally in your browser) or paste an image URL. Adjust blur and dimming with sliders, or remove the image to fall back to the scene.

**Cursor effect** — an optional reactive layer that follows your mouse on top of any scene or wallpaper: Spotlight, Particles, Ripples, Trail, or Constellation (a web of dim nodes that lights up in your accent color near the cursor). Adjustable intensity.

An accent color picker (eight presets plus a custom color) is also available in Settings and is used throughout the interface — buttons, the active board tab, glow effects, and more.

### Card Effects
Seven visual styles for group cards, set from Settings → Cards: Transparent, Frosted, Ghost, Neon Glow, Smoke, Aurora, and Matte Dark.

### Clock & Search Customization
Settings → Clock & Search lets you:
- Show or hide the clock, date, and greeting independently
- Switch between 12- and 24-hour time, and toggle seconds
- Set your name for the greeting
- Choose clock size (Small / Medium / Large), font (Sans / Display / Mono / Serif), weight (Light / Regular / Bold), and color (Theme / Accent / Custom)
- Show or hide the search bar, which searches your default engine or opens a typed URL directly
- Drag the clock to any position on screen while Edit Mode is on, with a one-click reset to center

### Theme
Auto (follows your system's dark/light preference), or forced Dark / Light.

### Privacy Blur
One click blurs every bookmark title, URL, and favicon across the page — useful when screen sharing.

### Incognito Support
Open any bookmark in an incognito window from its right-click menu, or open any URL in incognito from the sidebar.

### Multi-Select Mode
Select multiple bookmarks at once to open them all or delete them together.

### Trash Bin
Deleted bookmarks go to the Trash instead of disappearing immediately. Restore an item to its original group (recreated automatically if it was also deleted), or empty the trash permanently.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` / `Cmd+K` | Open global search |
| `/` | Focus the search bar (when visible and no field is already focused) |
| `Escape` | Close the open modal or context menu |

---

## Installation

VoidTab is a Chrome extension loaded in developer mode. It is not on the Chrome Web Store.

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `VoidTab` folder
6. Open a new tab — VoidTab is live

---

## AI Setup

The AI Coach and AI-assisted import sorting require your own Anthropic API key. Without one, VoidTab works fully — only those two AI features are disabled, and bulk import falls back to a simple rule-based group guesser.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Open VoidTab, click the Settings icon in the sidebar
3. Paste your key into the **Anthropic API Key** field

The key is stored locally in your browser via `chrome.storage.local` and is sent only to the Anthropic API, directly from your browser.

---

## Project Structure

```
VoidTab/
├── manifest.json              # Chrome extension manifest (v3)
├── newtab.html                # Page structure, icon sprite, and all modals
├── newtab_files/
│   ├── newtab.css             # Styling, scenes, card effects, and themes
│   ├── newtab.js              # Core logic: boards, groups, bookmarks, backgrounds, clock, dialogs
│   ├── ai.js                  # AI Coach: chat, tab analysis, bulk import suggestions
│   └── css2                   # Google Fonts stylesheet (DM Sans, Syne)
├── js/
│   └── background.js          # Service worker: incognito tab handling
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Permissions

| Permission | Why |
|---|---|
| `tabs` | The AI Coach reads open tab titles and URLs for distraction detection |
| `storage` | Saves your boards, groups, bookmarks, and settings via `chrome.storage.local` |
| `search` | Powers the search bar, which queries your browser's default search engine |
| `tabGroups` | Reserved for future tab-grouping features |
| `bookmarks` | Reserved for future Chrome bookmark import |

---

## Compared to Alternatives

| Feature | VoidTab | Lumi List | Obsidian |
|---|---|---|---|
| Free | ✓ | ✗ (paid tiers) | ✓ (free tier) |
| Browser new tab | ✓ | ✓ | ✗ |
| No account required | ✓ | ✗ | ✓ |
| AI focus coaching | ✓ | ✗ | ✗ |
| Live tab monitoring | ✓ | ✗ | ✗ |
| Bookmark import/export as text | ✓ | ✗ | ✗ |
| Custom wallpapers and scenes | ✓ | Limited | ✗ |
| Cursor effects | ✓ — 5 effects | ✗ | ✗ |
| Card visual effects | ✓ — 7 effects | ✗ | ✗ |
| Open source | ✓ | ✗ | ✗ |

---

## Authors

Built by **Mohid Ahmed** — Software Engineering student at Riphah International University.
Fine-tuned by **Hanan Shafay** — Software Engineering student at Riphah International University.

---

## License

MIT License — free to use, modify, and distribute.
