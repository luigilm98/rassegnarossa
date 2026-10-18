/** Queues belong to the browser. Never share unresolved request promises between Worker invocations. */
type Photo = Pick<HTMLImageElement, "src" | "onload" | "onerror" | "referrerPolicy"> & { decode?: () => Promise<void> };
export function createPhotoLoader(createImage: () => Photo, concurrency = 4, timeoutMs = 15000) {
  let active = 0;
  const queue: (() => void)[] = [];
  const pending = new Map<string, Promise<string | null>>();
  const loaded = new Set<string>();
  const pump = () => { while (active < concurrency && queue.length) { active++; queue.shift()!(); } };
  return (url: string): Promise<string | null> => {
    if (loaded.has(url)) return Promise.resolve(url);
    const existing = pending.get(url); if (existing) return existing;
    const promise = new Promise<string | null>(resolve => {
      queue.push(() => {
        const image = createImage();
        let done = false;
        const finish = (success: boolean) => {
          if (done) return; done = true;
          clearTimeout(timer); image.onload = null; image.onerror = null;
          if (success) { if (loaded.size >= 256) loaded.delete(loaded.values().next().value!); loaded.add(url); }
          active--; resolve(success ? url : null); pump();
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        image.referrerPolicy = "no-referrer";
        image.onerror = () => finish(false);
        image.onload = () => { void (async () => {
          try { await image.decode?.(); finish(true); } catch { finish(false); }
        })(); };
        image.src = url;
      });
      pump();
    }).finally(() => pending.delete(url));
    pending.set(url, promise);
    return promise;
  };
}

/** Race a fast publisher photo against bounded recovery; keep the first decoded result. */
export function resolvePhoto(candidates: string[], recovery: string | null, direct: (url: string) => Promise<string | null>, recover: (url: string) => Promise<string | null>, delayMs = 1200): Promise<string | null> {
  return new Promise(resolve => {
    let settled = false, directDone = false, recoveryDone = !recovery, recoveryStarted = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (url: string | null) => {
      if (settled) return;
      if (url || (directDone && recoveryDone)) { settled = true; clearTimeout(timer); resolve(url); }
    };
    const startRecovery = () => {
      if (!recovery || recoveryStarted || settled) return;
      recoveryStarted = true;
      void recover(recovery).then(url => { recoveryDone = true; finish(url); });
    };
    if (recovery) timer = setTimeout(startRecovery, candidates.length ? delayMs : 0);
    void (async () => {
      for (const candidate of candidates) {
        const url = await direct(candidate);
        if (url) { finish(url); return; }
        startRecovery();
        if (settled) return;
      }
      directDone = true; startRecovery(); finish(null);
    })();
  });
}
