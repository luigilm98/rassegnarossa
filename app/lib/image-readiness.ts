/** Resolve only after decoding, failure, timeout, or cancellation; never block on a broken publisher image. */
export function prepareImage(image: HTMLImageElement, signal: AbortSignal, timeoutMs = 12000): Promise<void> {
  return new Promise(resolve => {
    let done = false;
    let decoding = false;
    // An expired preparation budget is not a failed download. Let late photos paint normally.
    const timer = setTimeout(finish, timeoutMs);
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", onError);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    function failed() {
      if (done) return;
      // React's existing image error handler retains the frame and hides the failed asset.
      image.dispatchEvent(new Event("error"));
      finish();
    }
    async function loaded() {
      if (done || decoding) return;
      decoding = true;
      try { if (typeof image.decode === "function") await image.decode(); }
      catch { failed(); return; }
      finish();
    }
    // Do not recursively handle the error event dispatched by failed().
    function onError() { finish(); }
    image.addEventListener("load", loaded);
    image.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", finish, { once: true });
    image.loading = "eager";
    if (signal.aborted) finish();
    else if (image.complete) {
      if (image.naturalWidth > 0) void loaded();
      else failed();
    }
  });
}
