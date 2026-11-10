import { expect, test } from "bun:test";

globalThis.host = { t: (text) => text, language: () => "en", storage: new Map() };
const { youtubeTrack } = await import("../index.js");

test("a pasted video ID resolves only its own track, even when the queue contains other songs", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const id = "83uv0HCUGD8";
  const panel = (videoId, title) => ({
    playlistPanelVideoRenderer: { videoId, title: { simpleText: title }, lengthText: { simpleText: "2:06" } },
  });
  globalThis.fetch = async (url, options) => {
    const endpoint = new URL(url).pathname;
    calls.push(endpoint);
    const params = JSON.parse(options.body);
    if (endpoint.endsWith("/get_queue")) {
      expect(params.videoIds).toEqual([id]);
      return Response.json(panel("differentID", "A recommendation"));
    }
    expect(params.videoId).toBe(id);
    return Response.json({ rows: [panel("differentID", "A recommendation"), panel(id, "Exact song")] });
  };
  try {
    expect(await youtubeTrack({ id: "not an ID" })).toBeNull();
    expect(await youtubeTrack({ id })).toMatchObject({ id, name: "Exact song", duration: 126000 });
    expect(calls).toEqual(["/youtubei/v1/music/get_queue", "/youtubei/v1/next"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
