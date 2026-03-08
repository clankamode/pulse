# Pulse ⚡

Free, open-source streaming overlays that just work. No login. No downloads. No nonsense.

**[→ pulse-stream-668.pages.dev](https://pulse-stream-668.pages.dev)**

---

## What is this?

Pulse is a collection of lightweight stream overlays designed as OBS Browser Sources. Copy a URL, paste it into OBS, and you're done.

Every overlay includes a built-in **heartbeat indicator** — a tiny pulsing dot that tells you the overlay is alive and connected. No more wondering if your overlay froze mid-stream.

## Overlays

| Overlay | What it does | Real data |
|---------|-------------|-----------|
| **Timer** | Count up or count down | Client-side |
| **Viewer Count** | Live concurrent viewers | Twitch, YouTube, Kick |
| **Follower Count** | Follower/subscriber count with optional goal bar | Twitch, YouTube, Kick |
| **Chat Box** | Live chat messages with badges and colors | Twitch IRC (anonymous) |
| **Geo Location** | Current city, weather, and local time | wttr.in |
| **Sub Count** | Subscriber count with goal tracking | Demo (needs OAuth) |
| **Alerts** | Follow, sub, raid, and gift sub notifications | Demo (needs event source) |
| **Combined Stats** | All metrics in one compact HUD | Twitch, YouTube, Kick |

## Quick Start

1. Go to the [Dashboard](https://pulse-stream-668.pages.dev/dashboard/)
2. Pick a tool, enter your channel name, customize colors/fonts
3. Copy the generated URL
4. In OBS: Sources → Add → Browser → paste the URL
5. Set width/height to match your scene (1920×1080 recommended for full overlays, smaller for widgets)

That's it. No account. No OAuth. No install.

## Self-Hosting

Pulse is pure static HTML + a Cloudflare Worker for API proxying. Zero frameworks, zero build step.

### Pages (overlays + dashboard)

```bash
# Clone
git clone https://github.com/clankamode/pulse.git
cd pulse

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name pulse-stream
```

### Worker (API proxy)

```bash
cd worker
npm install
npx wrangler deploy
```

### API Keys (optional)

Without API keys, all platform-specific overlays run in **demo mode** with simulated data. Add keys to get real data:

```bash
# Twitch (free at dev.twitch.tv)
cd worker
npx wrangler secret put TWITCH_CLIENT_ID
npx wrangler secret put TWITCH_CLIENT_SECRET

# YouTube (free at console.cloud.google.com → YouTube Data API v3)
npx wrangler secret put YOUTUBE_API_KEY
```

Kick requires no API key — their public API is used directly.

## Architecture

```
Streamer's OBS
  └→ Cloudflare CDN (static HTML overlays)
       ├→ Browser connects to Twitch IRC (WebSocket, anonymous)
       ├→ Browser calls wttr.in (weather)
       └→ Browser calls Pulse Worker → Twitch Helix / YouTube API / Kick API
```

- **Nothing runs on your server.** Cloudflare serves everything.
- **Pages**: Static HTML, unlimited requests, unlimited bandwidth (free tier)
- **Worker**: API proxy with 60s caching, CORS, demo fallback. 100K requests/day free.
- **No database.** No state. No sessions. Pure edge compute.

## Overlay URL Parameters

All overlays are configured via URL parameters. Common params:

| Param | Values | Default | Description |
|-------|--------|---------|-------------|
| `channel` | string | — | Channel/username |
| `platform` | `twitch` `youtube` `kick` | `twitch` | Streaming platform |
| `font` | `mono` `inter` `russo` | `mono` | Font family |
| `color` | hex (no #) | `e4e4e8` | Text color |
| `size` | number (rem) | varies | Font size |

### Tool-specific params

**Timer**: `mode` (up/down), `hours`, `minutes`, `seconds`, `label`

**Viewer Count**: `format` (compact/full)

**Follower Count**: `goal`, `show_bar` (1/0)

**Chat Box**: `max` (message count), `fade` (seconds), `badges` (1/0)

**Geo Location**: `city`, `units` (metric/imperial)

**Alerts**: `style` (fade/slide/minimal), `duration` (seconds), `alert_color` (hex)

**Combined Stats**: `layout` (horizontal/vertical), `show_viewers`, `show_followers`, `show_uptime` (all 1/0), `divider` (character)

## Health Monitor

Pulse includes an [Overlay Health Dashboard](https://pulse-stream-668.pages.dev/health/) — a streamer-facing diagnostic page that shows the status of your active overlays. Heartbeat age, latency, uptime, and an event log.

Currently runs with simulated data for demo purposes.

## Tech

- **11 HTML files, 160KB total** — no frameworks, no build step, no dependencies
- **Cloudflare Pages** — static hosting on 300+ edge locations
- **Cloudflare Worker** — TypeScript API proxy, ~2KB gzipped
- **Transparent backgrounds** — designed for OBS Browser Source compositing
- **Anonymous Twitch IRC** — read-only chat via `justinfan` WebSocket connection

## Roadmap

- [ ] Kick chat (WebSocket)
- [ ] YouTube Live Chat (OAuth)
- [ ] Sound alerts
- [ ] Custom CSS injection via URL param
- [ ] Real heartbeat monitoring (overlays report to central endpoint)
- [ ] OAuth flow for subscriber/bits/channel points data

## License

MIT — do whatever you want with it.

---

Built by [Clanka](https://github.com/clankamode) ⚡
