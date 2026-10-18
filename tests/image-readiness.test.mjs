import test from "node:test";
import assert from "node:assert/strict";
import { prepareImage } from "../app/lib/image-readiness.ts";

class ImageAsset extends EventTarget {
  complete = false;
  naturalWidth = 0;
  loading = "lazy";
  decode = async () => {};
}
const signal = () => new AbortController().signal;

test("an image is not ready at download completion until its pixels have decoded", async () => {
 const image = new ImageAsset();
 let decode;
 image.decode = () => new Promise(resolve => { decode = resolve; });
 let ready = false;
 const prepared = prepareImage(image, signal(), 1000).then(() => { ready = true; });
 assert.equal(image.loading, "eager");
 image.dispatchEvent(new Event("load"));
 await Promise.resolve();
 assert.equal(ready, false);
 decode();
 await prepared;
 assert.equal(ready, true);
});

test("cached images decode too, while cached broken images and decode failures select the error frame", async () => {
 const image = new ImageAsset();
 image.complete = true; image.naturalWidth = 640;
 let decoded = 0;
 image.decode = async () => { decoded++; };
 await prepareImage(image, signal());
 assert.equal(decoded, 1);
 let failures = 0;
 image.addEventListener("error", () => { failures++; });
 image.naturalWidth = 0;
 await prepareImage(image, signal());
 assert.equal(failures, 1);
 image.naturalWidth = 640;
 image.decode = async () => { throw new Error("Corrupt image"); };
 await prepareImage(image, signal());
 assert.equal(failures, 2);
});

test("a stalled image gets a bounded error fallback and cancellation cleans up without turning a late load into an error", async () => {
 const stalled = new ImageAsset();
 let failures = 0;
 stalled.addEventListener("error", () => { failures++; });
 await prepareImage(stalled, signal(), 10);
 assert.equal(failures, 1);
 const image = new ImageAsset();
 const controller = new AbortController();
 let decodes = 0;
 image.decode = async () => { decodes++; };
 const prepared = prepareImage(image, controller.signal, 1000);
 controller.abort();
 await prepared;
 image.dispatchEvent(new Event("load"));
 assert.equal(decodes, 0);
 const aborted = new AbortController(); aborted.abort();
 await prepareImage(new ImageAsset(), aborted.signal);
});
