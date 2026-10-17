import assert from "node:assert/strict";
import test from "node:test";
import { parseYouTubeListing } from "../app/lib/youtube.ts";
const wrap = (tabs) =>
  `<script>var ytInitialData = ${JSON.stringify({ contents: { twoColumnBrowseResultsRenderer: { tabs } } })};</script>`;
const video = (id, title) => ({
  lockupViewModel: {
    contentId: id,
    metadata: { lockupMetadataViewModel: { title: { content: title } } },
    contentImage: {
      thumbnailViewModel: {
        image: {
          sources: [{ url: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg" }],
        },
      },
    },
  },
});
test("channel listing extracts real video cards only from the selected tab", () => {
  const html = wrap([
    {
      tabRenderer: {
        selected: false,
        content: [video("Other000001", "Non selezionato")],
      },
    },
    {
      tabRenderer: {
        selected: true,
        content: [
          video("Sample00001", "Titolo sintetico"),
          video("Sample00001", "Titolo sintetico"),
          video("Not-a-video-id", "Playlist"),
        ],
      },
    },
  ]);
  const result = parseYouTubeListing(html);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Titolo sintetico");
  assert.equal(result[0].videoId, "Sample00001");
  assert.match(result[0].image, /i.ytimg.com/);
});
test("channel consent pages, broken JSON and changed markup fail without fabricated videos", () => {
  for (const html of [
    "<html>Consent required</html>",
    "var ytInitialData = {broken};",
    wrap([
      {
        tabRenderer: {
          selected: false,
          content: [video("Sample00001", "Unrelated")],
        },
      },
    ]),
  ])
    assert.deepEqual(parseYouTubeListing(html), []);
});
