import { expect, test } from "bun:test";

globalThis.host = { t: (text) => text, language: () => "en", storage: new Map() };
const { lyrics } = await import("../index.js");

test("plain YouTube lyrics are shown only when neither provider has timings", async () => {
  const realFetch = globalThis.fetch;
  const webCalls = [];
  const plain = "First line\nSecond line\n\nAnother verse";
  const betterTTML = '<p begin="1s" end="2s"><span begin="1s" end="2s">Word timing</span></p>';
  globalThis.fetch = async (url, options) => {
    const { pathname, hostname, searchParams } = new URL(url);
    if (hostname === "api.betterlyrics.org") {
      return Response.json({ ttml: searchParams.get("s") === "better" ? betterTTML : "" });
    }
    const { context: { client }, videoId, browseId } = JSON.parse(options.body);
    const web = client.clientName === "WEB_REMIX";
    if (web) webCalls.push([pathname, videoId ?? browseId]);
    if (pathname.endsWith("/next")) {
      return Response.json({
        playlistPanelVideoRenderer: { videoId, title: { simpleText: videoId } },
        browseEndpoint: videoId === "web-only" && !web ? undefined : { browseId: "MPLY-" + videoId },
      });
    }
    if (web) {
      return Response.json(browseId === "MPLY-missing"
        ? { messageRenderer: { text: { simpleText: "No lyrics" } } }
        : { sectionListRenderer: { contents: [{ musicDescriptionShelfRenderer: {
            description: { runs: [{ text: "First line\nSecond line\n" }, { text: "\nAnother verse" }] },
            footer: { simpleText: "Provider credits" },
          } }] } });
    }
    const lines = ["MPLY-timed", "MPLY-better"].includes(browseId)
      ? [{ lyricLine: "Line timing", cueRange: { startTimeMilliseconds: "0", endTimeMilliseconds: "1000" } }]
      : [{ lyricLine: "A line with no cue" }];
    return Response.json({ timedLyricsData: lines });
  };
  try {
    expect((await lyrics({ id: "better" })).lines[0].text).toBe("Word timing");
    expect((await lyrics({ id: "timed" })).lines[0]).toMatchObject({ start: 0, text: "Line timing" });
    expect(webCalls).toEqual([]);
    expect(await lyrics({ id: "plain" })).toEqual({ plain });
    expect(await lyrics({ id: "web-only" })).toEqual({ plain });
    expect(await lyrics({ id: "missing" })).toEqual({ lines: [] });
    expect(webCalls).toEqual([
      ["/youtubei/v1/browse", "MPLY-plain"],
      ["/youtubei/v1/next", "web-only"],
      ["/youtubei/v1/browse", "MPLY-web-only"],
      ["/youtubei/v1/browse", "MPLY-missing"],
    ]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
