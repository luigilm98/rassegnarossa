/** Short quotations with primary-text provenance. Italian translations are editorial. */
export const QUOTATIONS = [
  {
    author: "Karl Marx",
    work: "Tesi su Feuerbach, XI",
    year: "1845",
    text: "I filosofi hanno soltanto interpretato il mondo in modi diversi; si tratta di trasformarlo.",
    url: "https://www.marxists.org/archive/marx/works/1845/theses/",
    note: "Traduzione italiana redazionale",
  },
  {
    author: "Antonio Gramsci",
    work: "Democrazia operaia · L’Ordine Nuovo",
    year: "1919",
    text: "Questo scritto vuole essere uno stimolo a pensare e ad operare.",
    url: "https://www.marxists.org/italiano/gramsci/19/democraziaoperaia.htm",
    note: "Testo originale italiano",
  },
  {
    author: "Vladimir Lenin",
    work: "Meglio meno, ma meglio",
    year: "1923",
    text: "Prima di tutto imparare, in secondo luogo imparare e in terzo luogo imparare.",
    url: "https://www.marxists.org/archive/lenin/works/1923/mar/02.htm",
    note: "Estratto · traduzione italiana redazionale",
  },
  {
    author: "Mao Zedong",
    work: "Contro il culto dei libri",
    year: "1930",
    text: "Senza inchiesta, nessun diritto di parola.",
    url: "https://www.marxists.org/reference/archive/mao/selected-works/volume-6/mswv6_11.htm",
    note: "Traduzione italiana redazionale",
  },
];
export function nextQuotation(
  previous: number,
  random = Math.random(),
): number {
  const offset =
    1 +
    Math.min(
      QUOTATIONS.length - 2,
      Math.floor(Math.max(0, random) * (QUOTATIONS.length - 1)),
    );
  const safePrevious =
    Number.isInteger(previous) && previous >= 0 && previous < QUOTATIONS.length
      ? previous
      : -1;
  return (safePrevious + offset + QUOTATIONS.length) % QUOTATIONS.length;
}
