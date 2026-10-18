import test from "node:test";
import assert from "node:assert/strict";
import { parseSourceHighlights, rankSourceHighlights, highlightLinkKey, highlightSources } from "../app/lib/source-highlights.ts";
const homepage = "https://example.org/";
const html = `
<header><h2><a href="/menu-story">Menu preview</a></h2></header>
<nav><section class="popular-posts"><a href="/navigation">Menu story</a></section></nav>
<main>
 <div class="featured-stories-tier-1"><article><header><h2><a href="/lead?utm_source=homepage">The lead story</a></h2></header></article></div>
 <section><h2>Most read</h2><ol><li><a href="/reader-favourite">Most read first</a></li><li><a href="/another-favourite">Most read second</a></li></ol></section>
 <section><h2>Latest</h2><h3><a href="/latest">Latest article</a></h3></section>
 <div hidden class="popular-posts"><a href="/hidden">Hidden item</a></div>
 <div aria-hidden="true" class="featured"><a href="/hidden-feature">Hidden feature</a></div>
 <section><h2>Most read books in history</h2><a href="/not-a-chart">A title mentioning popular books is not a ranking</a></section>
 <script>"<div class='popular-posts'><a href='/script'>fake</a></div>"</script>
 <aside class="most-read"><a href="javascript:alert(1)">Bad</a><a href="https://outside.org/ad">Advert</a></aside>
</main><footer><a href="/footer">Footer</a></footer>`;

test("publisher selection separates explicit popularity from editorial placement and excludes navigation, hidden content, scripts and external promotions", () => {
 const highlights = parseSourceHighlights(html, homepage);
 assert.deepEqual(highlights.filter(item => item.placement === "popular").map(item => [item.link, item.rank]), [
  ["https://example.org/reader-favourite", 1], ["https://example.org/another-favourite", 2],
 ]);
 assert.equal(highlights.find(item => item.placement === "featured").link, "https://example.org/lead?utm_source=homepage");
 assert.ok(highlights.some(item => item.placement === "opening" && item.link.endsWith("/latest")));
 assert.ok(highlights.every(item => !/hidden|navigation|menu-story|script|outside|not-a-chart/.test(item.link)));
});

test("real publisher container conventions and translated chart headings are recognized without treating trending topics as read counts", () => {
 for (const marker of ["story__featured pb-2", "featured-stories-tier-2"]) {
  const items = parseSourceHighlights(`<article class="${marker}"><h3><a href="/lead">Lead</a></h3></article>`, homepage);
  assert.equal(items[0].placement, "featured");
 }
 for (const heading of ["Più letti", "Más leídos", "Mais lidos", "Les plus lus", "الأكثر قراءة", "阅读排行"]) {
  assert.ok(parseSourceHighlights(`<aside><h2>${heading}</h2><a href="/chart">Chart story</a></aside>`, homepage).some(item => item.placement === "popular"), heading);
 }
 assert.equal(parseSourceHighlights('<div><div class="most_pop"><div class="text-element">Most Popular</div></div><div class="ten_post"><a href="/public-chart">Public chart article</a></div></div>', homepage).filter(item => item.placement === "popular").length, 1);
 assert.ok(!parseSourceHighlights('<section><h2>Trending</h2><a href="/trend">Trend</a></section>', homepage).some(item => item.placement === "popular"));
 assert.ok(parseSourceHighlights('<section class="most-read" aria-hidden="false"><a href="/visible">Visible</a></section>', homepage).length);
});

test("ranking matches actual feed links, keeps every distinct article and preserves source chart order instead of inventing comparable visitor totals", () => {
 const cards = ["latest", "another-favourite", "reader-favourite", "lead", "other"].map(id => ({ id, link: `https://example.org/${id}/` }));
 const items = parseSourceHighlights(html, homepage);
 assert.equal(rankSourceHighlights(cards, items, "featured")[0].id, "lead");
 assert.deepEqual(rankSourceHighlights(cards, items, "popular").map(item => item.id), ["reader-favourite", "another-favourite", "latest", "lead", "other"]);
 assert.deepEqual(rankSourceHighlights(cards, [], "featured"), cards);
 assert.equal(highlightLinkKey("https://www.example.org/lead/?utm_campaign=test#title"), highlightLinkKey("https://example.org/lead"));
 assert.notEqual(highlightLinkKey("https://example.org/article?id=1"), highlightLinkKey("https://example.org/article?id=2"));
});

test("only configured publishers which have supplied articles enter the extra queue, once per homepage", () => {
 const catalog = [
  { id: "one", homepage, kind: "giornale" }, { id: "alias", homepage, kind: "giornale" },
  { id: "unavailable", homepage: "https://offline.example.org", kind: "giornale" },
  { id: "radar", homepage: "https://news.google.com", kind: "radar" },
  { id: "video", homepage: "https://youtube.com/@example", kind: "video" },
 ];
 const records = [ { sourceId: "one", sourceHomepage: homepage }, { sourceId: "radar", sourceHomepage: "https://news.google.com" }, { sourceId: "video", sourceHomepage: "https://youtube.com/@example" }, { sourceId: "visitor", sourceHomepage: "https://unconfigured.example.org" } ];
 assert.deepEqual(highlightSources(catalog, records).map(source => source.id), ["one"]);
 assert.deepEqual(highlightSources(catalog, []), []);
});
