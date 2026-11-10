# YouTube Music Premium playback signatures

The plugin starts with its anonymous player lookup. Only an explicit Music
Premium restriction triggers a second lookup with the existing MyGo account.
MyGo adds the credentials inside its Go transport for the YouTube Music player
endpoint.

The authenticated response for the test track offered signature-ciphered AAC
and Opus formats. The host reads the public player script and uses its
signature timestamp in the account request. It sends the public script and the
selected format's `s` and `n` values to the pinned EJS solver running in a
Deno subprocess. Deno receives an empty environment and runs with network,
file, subprocess, environment and FFI permissions denied. The host assembles
the HTTPS Google media URL from the results and gives the player only the
media address and User-Agent. The yt-dlp path still uses its anonymous flags.

The upstream EJS provider describes the challenge protocol and its Deno
configuration. The assets are embedded from release 0.8.0 and checked against
the published SHA3-512 digests. MyGo discovers the public player revision from
the YouTube IFrame bootstrap, so the player revision is independent of the
bundled solver version.

- [EJS 0.8.0 release](https://github.com/yt-dlp/ejs/releases/tag/0.8.0)
- [Upstream solver protocol](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/jsc/_builtin/ejs.py)
- [Upstream Deno runner](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/jsc/_builtin/deno.py)
- [Upstream asset digests](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/jsc/_builtin/vendor/_info.py)

## Windows verification

On 2026-11-11, a read-only test session used MyGo's existing account to
resolve the [reported track](https://music.youtube.com/watch?v=83uv0HCUGD8).
The account requests went to the YouTube Music player endpoint. Eight
cookie-free CDN Range requests downloaded both complete renditions. MyGo's
AAC-LC and WebM / Opus decoders each produced 125.50 seconds of PCM and
decoded samples after a midpoint seek. This path uses an available Deno
installation. It was tested with Deno 2.9.8 on Windows x64.
