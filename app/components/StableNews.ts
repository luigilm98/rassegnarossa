"use client";
import { useEffect, useMemo, useRef } from "react";
import { retainArticleOrder } from "@/app/lib/stable-news";
export function useStableNews<T extends { id: string }>(ranked: T[], resetKey: string): T[] {
  const snapshot = useRef({ key: "", ids: [] as string[] });
  const ordered = useMemo(() => retainArticleOrder(snapshot.current.key === resetKey ? snapshot.current.ids : [], ranked), [ranked, resetKey]);
  useEffect(() => { snapshot.current = { key: resetKey, ids: ordered.map(article => article.id) }; }, [ordered, resetKey]);
  return ordered;
}
