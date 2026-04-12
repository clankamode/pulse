# Pulse Architecture Notes

## Design Principles

### Reliability-First Overlays
Stream overlays fail in predictable ways inside OBS Browser Sources:
- **Frozen frames** — JS event loops blocked, no visual feedback that overlay died
- **Desync** — API polling drifts, stale data displayed as current
- **Silent failures** — network errors swallowed, overlay shows last-known state indefinitely

Pulse addresses all three with the **heartbeat pattern**: every overlay includes a pulsing indicator that proves the render loop and data pipeline are alive. If the dot stops, the streamer knows immediately.

### Zero-Auth Where Possible
Most public streaming metrics (viewer count, follower count, live status) are available without OAuth. Pulse uses anonymous/public API paths first and only requests auth for features that genuinely require it (subscriber counts, chat sending, alerts).

### OBS Browser Source Constraints
- Browser sources run Chromium but with limited debugging
- No DevTools access during live stream
- Memory leaks accumulate across hours-long sessions
- `localStorage` persists between OBS restarts — useful for config, dangerous for stale state
- CSS animations are cheaper than JS-driven animations for long-running overlays
- `requestAnimationFrame` loops must be lean; heavy DOM manipulation causes frame drops visible on stream

### Cross-Platform API Patterns
| Platform | Public viewer count | Public follower count | Chat (read) | Chat (write) | Alerts |
|----------|--------------------|-----------------------|-------------|-------------|--------|
| Twitch | Helix (no auth) | Helix (no auth) | IRC (anon) | IRC (auth) | EventSub (auth) |
| YouTube | Data API v3 | Data API v3 | LiveChat API | LiveChat API (auth) | Pub/Sub (auth) |
| Kick | Pusher WS | Public API | Pusher WS | API (auth) | Pusher WS (auth) |

### Health Monitoring
The `/health` endpoint provides:
- Per-overlay liveness status
- API endpoint response times
- WebSocket connection state
- Memory usage trends
- Error rate over rolling window

This is exposed both as a standalone dashboard and as data available to the combined overlay HUD.
