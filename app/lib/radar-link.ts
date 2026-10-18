import { publicPhotoUrl, readLimited, fetchPublicPhotoResource } from "./article-photo";
/** Only links observed in a configured Google News feed can reach this resolver. */
const resolved = new Map<string, string>();
let unavailableUntil = 0;
export async function resolveRadarLink(link: string, publisher: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<string | null> {
  const publisherUrl = publicPhotoUrl(publisher), input = publicPhotoUrl(link);
  if (!publisherUrl || !input) return null;
  const host = publisherUrl.hostname.replace(/^www\./, "");
  const accept = (value: string) => {
    const url = publicPhotoUrl(value);
    return url && (url.hostname.replace(/^www\./, "") === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  };
  if (input.hostname !== "news.google.com") return accept(link);
  const key = `${link}:${host}`, cached = resolved.get(key); if (cached) return cached;
  const id = input.pathname.match(/\/(?:articles|read)\/([\w-]{5,2500})$/)?.[1];
  if (!id) return null;
  try {
    const base = id.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base.padEnd(Math.ceil(base.length / 4) * 4, "="));
    const embedded = raw.match(/https?:\/\/[^\s\x00-\x20\x7f-\xff]+/)?.[0];
    const old = embedded && accept(embedded); if (old) return old;
  } catch { /* Current opaque IDs require Google's public article page. */ }
  if (Date.now() < unavailableUntil) return null;
  try {
    const headers = { "user-agent": "RassegnaRossa/1.0", accept: "text/html" };
    const page = await fetcher(`https://news.google.com/rss/articles/${id}`, { signal, redirect: "manual", credentials: "omit", headers });
    if ([301,302,303,307,308].includes(page.status)) {
      const destination = page.headers.get("location"); await page.body?.cancel();
      return destination ? accept(new URL(destination, input).href) : null;
    }
    if (!page.ok) { if ([429,503].includes(page.status)) unavailableUntil = Date.now() + 120000; await page.body?.cancel(); return null; }
    const html = new TextDecoder().decode(await readLimited(page, 500000, true));
    const signature = html.match(/data-n-a-sg=["']([^"']+)["']/)?.[1];
    const stamp = Number(html.match(/data-n-a-ts=["'](\d+)["']/)?.[1]);
    if (!signature || !Number.isSafeInteger(stamp)) return null;
    // This optional public RPC is undocumented; errors, consent walls and quotas are terminal.
    const locale = [["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0];
    const inner = JSON.stringify(["garturlreq",locale,id,stamp,signature]);
    const rpc = await fetcher("https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je", {
      method: "POST", signal, redirect: "manual", credentials: "omit",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": headers["user-agent"] },
      body: new URLSearchParams({ "f.req": JSON.stringify([[["Fbv4je",inner]]]) }),
    });
    if (!rpc.ok) { await rpc.body?.cancel(); return null; }
    const text = new TextDecoder().decode(await readLimited(rpc, 100000));
    for (const line of text.split("\n").filter(line => line.startsWith("[["))) {
      const frames = JSON.parse(line);
      for (const frame of frames) if (frame[0] === "wrb.fr" && typeof frame[2] === "string") {
        const data = JSON.parse(frame[2]);
        const url = data[0] === "garturlres" && typeof data[1] === "string" ? accept(data[1]) : null;
        if (url) { if (resolved.size >= 512) resolved.delete(resolved.keys().next().value!); resolved.set(key,url); return url; }
      }
    }
  } catch { /* Missing images never permit an unverified publisher URL. */ }
  return null;
}

/** A blocked aggregator is optional: an exact headline on the publisher's own page can identify its article. */
export async function resolvePublisherHeadline(title: string, publisher: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<string | null> {
 const home=publicPhotoUrl(publisher);if(!home||!title)return null;
 const normalize=(text:string)=>text.replace(/<!\[CDATA\[([^]*?)\]\]>/g,"$1").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/g,"").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,"");
 const target=normalize(title);if(target.length<20)return null;
 const host=home.hostname.replace(/^www\./,"");
 try{
  const response=await fetchPublicPhotoResource(home,AbortSignal.any([signal,AbortSignal.timeout(4500)]),{accept:"text/html","user-agent":"RassegnaRossa/1.0"},fetcher,host);
  if(!response.ok||!response.headers.get("content-type")?.includes("text/html")){await response.body?.cancel();return null;}
  const html=new TextDecoder().decode(await readLimited(response,700000,true));
  for(const a of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^]*?)<\/a>/gi)){
   if(normalize(a[2])!==target)continue;
   const url=publicPhotoUrl(new URL(a[1].replace(/&amp;/g,"&"),home).href);
   if(url&&url.pathname!=="/"&&(url.hostname.replace(/^www\./,"")===host||url.hostname.endsWith(`.${host}`)))return url.href;
  }
  // Prefer the publisher's own public RSS/Atom when an older headline has left the homepage.
  const feedTag=[...html.matchAll(/<link\b[^>]*>/gi)].map(match=>match[0]).find(tag=>/type=["']application\/(?:rss|atom)\+xml["']/i.test(tag));
  const feedHref=feedTag?.match(/href=["']([^"']+)["']/i)?.[1];
  const feed=feedHref&&publicPhotoUrl(new URL(feedHref.replace(/&amp;/g,"&"),home).href);
  if(feed&&feed.hostname.replace(/^www\./,"")===host){
   const rss=await fetchPublicPhotoResource(feed,AbortSignal.any([signal,AbortSignal.timeout(4500)]),{accept:"application/rss+xml, application/atom+xml, text/xml","user-agent":"RassegnaRossa/1.0"},fetcher,host);
   if(rss.ok){const xml=new TextDecoder().decode(await readLimited(rss,1000000,true));
    for(const item of [...xml.matchAll(/<(?:item|entry)\b[^>]*>([^]*?)<\/(?:item|entry)>/gi)].slice(0,80)){
     const headline=item[1].match(/<title\b[^>]*>([^]*?)<\/title>/i)?.[1]??"";if(normalize(headline)!==target)continue;
     const link=item[1].match(/<link\b[^>]*>([^]*?)<\/link>/i)?.[1]??item[1].match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1];
     const article=link&&publicPhotoUrl(new URL(link.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&amp;/g,"&").trim(),home).href);
     if(article&&(article.hostname.replace(/^www\./,"")===host||article.hostname.endsWith(`.${host}`)))return article.href;
    }
   }else await rss.body?.cancel();
  }
 }catch{/* No guessed article or cover when the publisher is unreachable. */}
 return null;
}
