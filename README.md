# YouTube Music for MyGo Music

Plays YouTube Music in [MyGo Music](https://github.com/egoist/mygo-music). It isn't affiliated with or endorsed by YouTube or Google, uses YouTube's private API, and may stop working at any time.

## Install

Install [ffmpeg](https://ffmpeg.org), and [yt-dlp](https://github.com/yt-dlp/yt-dlp) as a fallback. On macOS:

```bash
brew install ffmpeg yt-dlp
```

yt-dlp needs a JavaScript runtime (Deno, Node or Bun) to solve YouTube's challenges; Homebrew includes Deno. Keep yt-dlp up to date, as YouTube changes often.

Install with the deeplink:

[mygo-music://install-plugin?repo=egoist/mygo-music-youtube-music](mygo-music://install-plugin?repo=egoist/mygo-music-youtube-music)

Or paste the GitHub URL in Settings > Plugins:

[https://github.com/egoist/mygo-music-youtube-music](https://github.com/egoist/mygo-music-youtube-music)

In Settings > Plugins, allow YouTube Music to start programs. To get your library, click **Sign In** and sign in to Google in the window that opens.

It needs MyGo Music 0.1.22 or later and starts ffmpeg and yt-dlp from the PATH, `/opt/homebrew/bin` or `/usr/local/bin`. If they're somewhere else, link them into one of those.

The plugin follows the language selected in MyGo Music. Traditional Chinese is available in builds of MyGo Music that offer that language.

## Signing in

You sign in on Google's page, in a window of the app. The session is kept unencrypted in the plugin's data on this machine, and is sent to music.youtube.com, s.youtube.com for your history, and to yt-dlp when it fetches audio. Signing out forgets it. To end the session on Google's side, remove the device in your Google account's security settings.

## What works

- Signed out: playing, Home, charts, new releases, search, albums, artists, playlists and timed lyrics.
- Signed in: your library, playlists, liked songs, recently played, liking songs, a personal Home, listening history and radio.
- Not available: editing playlists, saving albums, following artists, podcasts and comments.

## How it plays

The plugin queries MyGo Music for compatible container and codec pairs. It passes a supported progressive stream straight to the player. For AAC-LC that needs repackaging, FFmpeg copies the packets into ADTS without re-encoding. Formats with no supported output container use MP3. With older builds, AAC-LC uses the ADTS relay. The quality setting controls the bitrate of the MP3 output.

The yt-dlp fallback can take up to 15 seconds to start and may require signing in from a VPN or server network. When it resolves a compatible progressive M4A with a known size, MyGo can seek using byte ranges, just like a direct YouTube M4A.

## Lyrics

From [Better Lyrics](https://github.com/better-lyrics/better-lyrics) when available, otherwise from YouTube Music.
