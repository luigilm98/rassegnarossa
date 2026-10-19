import LANGUAGES from "./languages.json" with {type:"json"};
import LIBRARY_RESOURCES from "./library-resources.json" with { type: "json" };
import OPEN_BOOKS from "./open-books.json" with { type: "json" };
export type BookEdition = { language: string; url: string; title: string; source: string };
export type TheoryCard = {
  id: string; title: string; author: string; period: string; lane: string; summary: string;
  links: { label: string; url: string }[]; tags: string[];
  level?: string; editions?: BookEdition[];
};
export const THEORY_LIBRARY: TheoryCard[] = [...OPEN_BOOKS.map(book => ({ ...book, links: [{ label: "Archivio originale", url: book.editions.find(edition => edition.language === "it")?.url ?? book.editions[0].url }] })), ...LIBRARY_RESOURCES];
export const BOOK_LANGUAGES: Record<string,string> = LANGUAGES;

export const bookEdition = (bookId: string, language: string) => THEORY_LIBRARY.find(book => book.id === bookId)?.editions?.find(edition => edition.language === language);
