/** Accept only publisher-provided web images; old saved articles may have no fallback metadata. */
export function articleImages(image: unknown, fallbacks: unknown = []): string[] {
  const values = [image, ...(Array.isArray(fallbacks) ? fallbacks.slice(0, 4) : [])];
  return [...new Set(values.flatMap(value => {
    if (typeof value !== "string" || !value.trim()) return [];
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? [url.href] : [];
    } catch { return []; }
  }))];
}
