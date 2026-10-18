import LIBRARY_RESOURCES from "./library-resources.json" with { type: "json" };
import OPEN_BOOKS from "./open-books.json" with { type: "json" };
export type BookEdition = { language: string; url: string; title: string; source: string };
export type TheoryCard = {
  id: string; title: string; author: string; period: string; lane: string; summary: string;
  links: { label: string; url: string }[]; tags: string[];
  level?: string; editions?: BookEdition[];
};
export const THEORY_LIBRARY: TheoryCard[] = [...OPEN_BOOKS.map(book => ({ ...book, links: [{ label: "Archivio originale", url: book.editions.find(edition => edition.language === "it")?.url ?? book.editions[0].url }] })), ...LIBRARY_RESOURCES];
export const BOOK_LANGUAGES: Record<string, string> = {
 it:"Italiano",en:"English",fr:"Français",de:"Deutsch",es:"Español",pt:"Português",nl:"Nederlands",pl:"Polski",el:"Ελληνικά",ro:"Română",cs:"Čeština",sk:"Slovenčina",sl:"Slovenščina",sv:"Svenska",da:"Dansk",no:"Norsk",fi:"Suomi",hu:"Magyar",bg:"Български",ru:"Русский",uk:"Українська",ca:"Català",eu:"Euskara",lt:"Lietuvių",sr:"Srpski / Hrvatski",mk:"Македонски",ar:"العربية",zh:"中文",id:"Bahasa Indonesia",ko:"한국어",vi:"Tiếng Việt",th:"ไทย",ka:"ქართული",bn:"বাংলা",fa:"فارسی",he:"עברית",tr:"Türkçe",ur:"اردو",eo:"Esperanto"
};
export const bookEdition = (bookId: string, language: string) => THEORY_LIBRARY.find(book => book.id === bookId)?.editions?.find(edition => edition.language === language);
