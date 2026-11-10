import { expect, test } from "bun:test";

globalThis.host = { t: (text) => text, language: () => "en", platform: "win32", storage: new Map() };
const { stream, streamWithOpus } = await import("../index.js");

test("native playback, stream copy, and transcoding follow host capabilities", async () => {
  const originalFetch = globalThis.fetch;
  const input = {
    aac: { mimeType: 'audio/mp4; codecs="mp4a.40.2"', url: "https://audio.example/aac", bitrate: 130000, contentLength: "3000000" },
    opus: { mimeType: 'audio/webm; codecs="opus"', url: "https://audio.example/opus", bitrate: 145000 },
  };
  const commands = [];
  const ytdlpRuns = [];
  const finish = [];
  globalThis.host.supportsAudio = (container, codec, delivery) =>
    ["mp4", "adts"].includes(container) && codec === "aac-lc" && delivery === "progressive";
  globalThis.fetch = async (url, options) => {
    if (url.includes("/visitor_id?")) {
      return Response.json({ responseContext: { visitorData: "test" } });
    }
    const { videoId } = JSON.parse(options.body);
    if (videoId === "hls" || videoId === "yt-dlp-direct" || videoId === "yt-dlp-blocked") {
      return Response.json({ playabilityStatus: { status: "OK" } });
    }
    return Response.json({
      playabilityStatus: { status: "OK" },
      streamingData: {
        adaptiveFormats: videoId === "with-aac"
          ? [input.opus, input.aac, { ...input.aac, url: "https://audio.example/drc", bitrate: 200000, isDrc: true }]
          : videoId === "aac-only" ? [input.aac]
          : [input.opus, { mimeType: 'audio/mp4; codecs="mp4a.40.5"', url: "https://audio.example/he-aac", bitrate: 50000 }],
      },
    });
  };
  globalThis.host.spawn = (program, args) => {
    if (program === "yt-dlp") {
      const run = { args, stdin: [] };
      ytdlpRuns.push(run);
      const blocked = args.at(-1).endsWith("yt-dlp-blocked");
      const output = args.at(-1).endsWith("yt-dlp-direct")
        ? { url: "https://audio.example/fallback.m4a", ext: "m4a", protocol: "https", vcodec: "none", filesize: 1200000 }
        : { url: "https://audio.example/list.m3u8", ext: "mp4", protocol: "m3u8_native", vcodec: "avc1" };
      const lines = args.includes("--print") && !blocked
        ? [JSON.stringify({ ...output, acodec: "mp4a.40.2", abr: 130 })] : [];
      return {
        write: (data) => run.stdin.push(data),
        closeStdin() {},
        readLine: async () => lines.shift() ?? null,
        wait: async () => blocked ? 1 : 0,
        kill() {},
        errorOutput: () => blocked ? "ERROR: [youtube] test: Sign in to confirm you're not a bot" : "",
      };
    }
    if (program !== "ffmpeg") throw new Error("program missing");
    const serving = args.includes("-listen");
    const done = serving ? new Promise((resolve) => finish.push(resolve)) : Promise.resolve(0);
    if (serving) commands.push(args);
    return { closeStdin() {}, readLine: async () => null, wait: () => done, errorOutput: () => "Input #0", kill() {} };
  };
  try {
    const direct = await stream({ id: "with-aac", quality: "standard" });
    expect(direct.type).toBe("m4a");
    expect(direct).toMatchObject({ codec: "aac-lc", processing: "direct" });
    expect(direct.url).toBe(input.aac.url);
    expect(direct.fallback).toBe(true);
    expect(direct.byteRanges).toBe(true);
    expect(direct.size).toBe(3000000);
    expect(commands).toHaveLength(0);

    const aac = await stream({ id: "with-aac", quality: "standard", fallback: true });
    expect(aac.type).toBe("aac");
    expect(aac.bitRate).toBe(130000);
    expect(commands[0][commands[0].indexOf("-i") + 1]).toBe(input.aac.url);
    expect(commands[0][commands[0].indexOf("-c:a") + 1]).toBe("copy");
    expect(commands[0][commands[0].indexOf("-f") + 1]).toBe("adts");

    const mp3 = await stream({ id: "opus-only", quality: "standard" });
    expect(mp3.type).toBe("mp3");
    expect(mp3).toMatchObject({ codec: "mp3", processing: "transcode" });
    expect(mp3.bitRate).toBe(128000);
    expect(commands[1][commands[1].indexOf("-i") + 1]).toBe(input.opus.url);
    expect(commands[1][commands[1].indexOf("-c:a") + 1]).toBe("libmp3lame");
    expect(commands[1][commands[1].indexOf("-f") + 1]).toBe("mp3");

    // A host that can decode Ogg Opus only needs FFmpeg to move the packets.
    const supportsAAC = globalThis.host.supportsAudio;
    globalThis.host.supportsAudio = (container, codec, delivery) =>
      supportsAAC(container, codec, delivery) || (container === "ogg" && codec === "opus" && delivery === "progressive");
    const ogg = await stream({ id: "opus-only", quality: "standard" });
    expect(ogg.type).toBe("ogg");
    expect(ogg).toMatchObject({ codec: "opus", processing: "remux" });
    expect(ogg.bitRate).toBe(input.opus.bitrate);
    expect(ogg.byteRanges).toBeUndefined();
    expect(commands[2][commands[2].indexOf("-i") + 1]).toBe(input.opus.url);
    expect(commands[2][commands[2].indexOf("-c:a") + 1]).toBe("copy");
    expect(commands[2][commands[2].indexOf("-f") + 1]).toBe("ogg");

    // Even a signed-in listener resolves fallback audio without account cookies.
    globalThis.host.youtubeAccount = { state: () => ({ active: true }) };
    const hls = await stream({ id: "hls", quality: "standard" });
    expect(hls.type).toBe("aac");
    expect(hls.byteRanges).toBeUndefined();
    expect(commands[3][commands[3].indexOf("-c:a") + 1]).toBe("copy");
    expect(commands[3][commands[3].indexOf("-f") + 1]).toBe("adts");

    const resolved = await stream({ id: "yt-dlp-direct", quality: "standard" });
    expect(resolved.byteRanges).toBe(true);
    expect(resolved.resolver).toBe("anonymous-yt-dlp");
    expect(resolved.size).toBe(1200000);
    expect(commands).toHaveLength(4);
    await expect(stream({ id: "yt-dlp-blocked", quality: "standard" })).rejects.toThrow(
      "YouTube did not allow anonymous playback of this track",
    );
    expect(globalThis.host.youtubeAccount.state().active).toBe(true);
    expect(ytdlpRuns).toHaveLength(4);
    for (const { args, stdin } of ytdlpRuns) {
      expect(args).toEqual(expect.arrayContaining(["--ignore-config", "--no-plugin-dirs", "--no-cookies", "--no-cookies-from-browser"]));
      expect(args).not.toContain("--config-locations");
      expect(args).not.toContain("--add-headers");
      expect(stdin).toEqual([]);
      if (args.includes("--print")) {
        expect(args[args.indexOf("--extractor-args") + 1]).toBe("youtube:skip=hls,dash");
      }
    }

    delete globalThis.host.supportsAudio;
    const legacy = await stream({ id: "with-aac", quality: "standard" });
    expect(legacy.type).toBe("aac");
    expect(commands[4][commands[4].indexOf("-c:a") + 1]).toBe("copy");

    globalThis.host.supportsAudio = (container, codec, delivery) =>
      supportsAAC(container, codec, delivery) || (container === "ogg" && codec === "opus" && delivery === "progressive");
    const preferred = await streamWithOpus({ id: "with-aac", quality: "standard" });
    expect(preferred).toMatchObject({ type: "ogg", codec: "opus", processing: "remux", fallback: true });
    expect(commands[5][commands[5].indexOf("-i") + 1]).toBe(input.opus.url);
    expect(commands[5][commands[5].indexOf("-c:a") + 1]).toBe("copy");
    expect(await stream({ id: "with-aac", quality: "standard" })).toMatchObject({ type: "m4a", codec: "aac-lc" });
    expect(await streamWithOpus({ id: "aac-only", quality: "standard" })).toMatchObject({ type: "m4a", codec: "aac-lc" });
    expect(await streamWithOpus({ id: "with-aac", quality: "standard", fallback: true })).toMatchObject({ type: "m4a", codec: "aac-lc" });
    expect(await streamWithOpus({ id: "yt-dlp-direct", quality: "standard" })).toMatchObject({ type: "m4a", resolver: "anonymous-yt-dlp" });
    const { args: preferredArgs } = ytdlpRuns.at(-1);
    expect(preferredArgs[preferredArgs.indexOf("--format") + 1]).toStartWith("bestaudio[acodec=opus]");
    expect(preferredArgs).toContain("--no-cookies");
  } finally {
    for (const resolve of finish) resolve(0);
    delete globalThis.host.youtubeAccount;
    delete globalThis.host.spawn;
    delete globalThis.host.supportsAudio;
    globalThis.fetch = originalFetch;
  }
});
