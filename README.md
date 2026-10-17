# Laddu's World v2

React + Vite + Supabase. Watch together, Tamil songs, games, video calls, friends, room management — each on its own page.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_YOUTUBE_API_KEY` (YouTube Data API v3, restrict to your site's referrers) — needed for Tamil song search
   - `VITE_JITSI_DOMAIN` (optional, default `meet.jit.si`)
3. Supabase SQL Editor: run `supabase/schema.sql` (if not already), then **`supabase/upgrade-v2.sql`**.
4. `npm run dev`

## Pages
| Route | What |
|---|---|
| `#/` | Home |
| `#/rooms` | Create / join / manage rooms |
| `#/friends` | Search people, send/accept requests, invite friends to rooms |
| `#/room/<id>/watch` | Watch together (YouTube) + shared queue |
| `#/room/<id>/music` | Tamil song search + curated library + queue |
| `#/room/<id>/games` | Tic-Tac-Toe, Connect Four, Rock Paper Scissors |
| `#/room/<id>/call` | Video / voice call (stays connected while you browse other tabs) |
| `#/room/<id>/chat` | Room chat |
| `#/room/<id>/manage` | Rename, visibility, new code, remove members, delete / leave |

The player lives in the room layout, so music keeps playing (mini player) when you switch pages.

## Adding songs for everyone
Users can't upload local files. Add curated songs in the SQL editor:
```sql
insert into public.song_library (video_id, title, artist, movie)
values ('VIDEO_ID_11_CHARS', 'Song title', 'Singer', 'Movie');
```
Users can also search YouTube (embeddable, 2+ minute results only) and add songs to the room queue.

## Adding another game
Add an entry to `GAMES`, `initGame` and `applyMove` in `src/games/engine.js`, then a board component in `src/pages/room/GamesPage.jsx`.

## v3 changes
- **Chat fixed**: no more `crypto.randomUUID` crash on phones over http, no StrictMode channel race, messages queue + retry, live/offline indicator, delivery ticks, typing indicator, emoji bar.
- **Calls**: own WebRTC voice + video (works on mobile), ring room, mute, camera on/off, flip camera, screen share. Needs **https** (or localhost). Add a TURN server (`VITE_TURN_*`) for mobile data / strict networks.
- **Songs**: JioSaavn-compatible API, Audius, Apple previews — no YouTube key. Run `supabase/upgrade-v3.sql` once. YouTube is used only for "Watch together" videos.
- **Privacy**: end-to-end encrypted chat (+ optional passphrase), Guest mode, join calls muted, wipe chat on leave, `public/_headers` with CSP/permissions policy.
- **New pages**: Discover (`#/discover`) and Privacy & settings (`#/settings`), animated vinyl stage, mood cards, marquee.
- **Security**: your old `.env` had a live YouTube API key and was removed from this package — **rotate that key** in Google Cloud. Copy `.env.example` to `.env`.

## v4 changes
- **Player controls** (music + video): seek bar, play/pause, previous/next, volume/mute (local), fullscreen.
- **Full-length songs**: default search = JioSaavn + YouTube + Audius. 30-second Apple previews are now opt-in ("30s previews").
- **YouTube search** in Watch (one box: paste a link *or* type a name) and in Music ("YouTube (full)"). Set `VITE_YOUTUBE_API_KEY` in `.env` for reliable results; without it public Piped/Invidious mirrors are tried.
- **Daily astrology card**: shows once per day after login; remembers your rasi on the device.
- **Tamil cinema spotlight** on Home (3-D card deck, flip to hear songs).
- **New intro** (particle galaxy -> heart -> shockwave, animated title).
- **Screen share fix**: reusable video slot (no renegotiation), local preview, clean stop (no frozen frame), bitrate caps, ICE restart on drop.
- **Unique usernames**: run `supabase/upgrade-v4.sql` once.

## v5 changes
- **Movie cards** on Home now use the astrology/tarot card style (gold frame, star sky, rotating orb, roman numeral); tap the centre card to flip and hear songs.
- **Mini player** (video + audio) is draggable with finger or mouse, remembers its position, and its controls are always visible on phones.
- **Calls on mobile**: free TURN relay fallback added (set your own `VITE_TURN_*` for production), voice-only fallback if the camera fails, repeated hello handshake, autoplay "tap to hear" prompt, hidden call panel no longer paused by phone browsers. Phone browsers cannot capture the screen, so the share button shares the rear camera and a **Backup call (Jitsi)** button is provided (the Jitsi app can share a phone screen).
- **YouTube embedding**: search results are pre-filtered with YouTube oEmbed; if a video still refuses embedding the app searches for another upload automatically, otherwise shows **Open on YouTube / Skip**.
- **Songs**: JioSaavn mirrors with automatic failover, tolerant parsing, https upgrade, live Audius host, your Supabase `song_library`, a dead audio link falls back to the YouTube version, and built-in tracks as the last resort. Set `VITE_SAAVN_API` to your own deployment for best reliability.
- **Astrology** (`#/astro`): enter name, DOB (+ optional birth time), rasi, natchathiram (or auto-find, approximate). Tabs: **Today** (personal rasipalan), **Partner match** (10 porutham + name bond + 5-year couple outlook), **Future** (12-month chart, life areas, 5-year phases). Stored on the device only. For fun, not real predictions.

## v6 changes
- **Calls**: the Video/Voice buttons now use an embedded Jitsi room (hosted media relay → works on any network/phone). "Not loading?" cycles servers; "Open in new tab" gives the Jitsi app (phone screen share). The old peer-to-peer call remains under "advanced". `public/_headers` now allows the Jitsi frames and camera/mic delegation (redeploy so the headers apply).
- **Messages**: never stored in any database; end-to-end encrypted; wiped on your screen when you leave a room and removed from everyone else's screen too. Settings → Messages adds an optional auto-delete timer.
- **Tamil cinema cards**: newest film first; each film has its exact popular songs (searched by song + film name; unresolved ones link to YouTube).
- **Anime** (`#/anime`): AniList catalogue, trailers, free official episodes from YouTube channels, and links to AnimeRulz Tamil (https://animerulz.co.in/language/tamil), Crunchyroll and Tubi.
- Security note: `wssladdu-*.livekit.cloud.txt` contains LiveKit credentials — delete it from the project/repo and rotate the key if it was ever shared.

## v7 changes — Anime watch-together
- New **Anime** tab inside every room (`#/room/<id>/anime`). Search/browse AniList, open a title, tap an episode or trailer → **plays for everyone in the room**, in sync (play, pause, seek, late joiners catch up). Add episodes to the shared queue with the queue button.
- **Play a video link together**: paste a direct `https://` link to a video file (.mp4, .webm, .m3u8/HLS) you have the right to watch. Uses the same synced player; HLS loads `hls.js` on demand (run `npm install` once).
- Works with the mini player, queue, next/previous and fullscreen like every other item.
- Third-party anime sites (AnimeRulz etc.) block embedding, so they can't be synced inside the room; use their direct video file link if you have the right to, or YouTube official episodes.
- Run `supabase/upgrade-v3.sql` if you haven't (needed for non-YouTube queue items).
- Removed the LiveKit credentials text file from the package — rotate that key if it was ever shared.
