import { expect, test } from "bun:test";
import traditionalChinese from "../locales/zh-TW.json";

let language = "en";
const storage = new Map();
globalThis.host = {
  language: () => language,
  t: (text) => (language === "zh-TW" ? traditionalChinese[text] ?? text : text),
  platform: "win32",
  storage,
};
const { browse, signIn } = await import("../index.js");
const originalFetch = globalThis.fetch;

test("a language change reaches YouTube and its shelf title reaches the page", async () => {
  const titles = { en: "Top artists", "zh-CN": "热门艺人", "zh-TW": "熱門藝人" };
  const requests = [];
  globalThis.fetch = async (url, options) => {
    expect(new URL(url).origin).toBe("https://music.youtube.com");
    const client = JSON.parse(options.body).context.client;
    requests.push(client.hl);
    return Response.json({
      sectionListRenderer: {
        contents: [{
          musicCarouselShelfRenderer: {
            title: { simpleText: titles[client.hl] },
            contents: [{
              musicTwoRowItemRenderer: {
                title: { simpleText: "Artist Name" },
                navigationEndpoint: {
                  browseEndpoint: {
                    browseId: "artist-id",
                    browseEndpointContextSupportedConfigs: {
                      browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" },
                    },
                  },
                },
              },
            }],
          },
        }],
      },
    });
  };
  try {
    for (const locale of Object.keys(titles)) {
      language = locale;
      const { title, sections } = await browse({ page: "charts" });
      if (locale === "zh-TW") expect(title).toBe("排行榜");
      expect(sections[0].title).toBe(titles[locale]);
      expect(sections[0].artists[0].name).toBe("Artist Name");
    }
    expect(requests).toEqual(["en", "zh-CN", "zh-TW"]);
  } finally {
    language = "en";
    globalThis.fetch = originalFetch;
  }
});

test("the Google sign-in window requests the selected language", async () => {
  language = "zh-TW";
  const cancel = new Error("stop before opening the sign-in window");
  globalThis.host.youtubeAccount = { state: () => ({ active: false }) };
  globalThis.host.webSignIn = async ({ url, cookiesOf }) => {
    const page = new URL(url);
    expect(page.origin).toBe("https://accounts.google.com");
    expect(page.searchParams.get("hl")).toBe("zh-TW");
    expect(cookiesOf).toBe("https://music.youtube.com");
    throw cancel;
  };
  try {
    await expect(signIn()).rejects.toBe(cancel);
    expect(storage.has("cookie")).toBe(false);
  } finally {
    delete globalThis.host.webSignIn;
    delete globalThis.host.youtubeAccount;
    language = "en";
  }
});
