export type TheoryCard = {
  id: string;
  title: string;
  author: string;
  period: string;
  lane: string;
  summary: string;
  links: { label: string; url: string }[];
  tags: string[];
};

export const THEORY_LIBRARY: TheoryCard[] = [
  {
    id: "manifesto",
    title: "Manifesto del Partito Comunista",
    author: "Karl Marx, Friedrich Engels",
    period: "1848",
    lane: "Fondamenti",
    summary:
      "Il testo breve che condensa lotta di classe, internazionalismo e critica del capitalismo moderno.",
    links: [
      {
        label: "Marxists Internet Archive",
        url: "https://www.marxists.org/italiano/marx-engels/1848/manifesto/index.htm",
      },
    ],
    tags: ["marx", "engels", "classe", "partito"],
  },
  {
    id: "capitale",
    title: "Il Capitale, Libro I",
    author: "Karl Marx",
    period: "1867",
    lane: "Economia politica",
    summary:
      "Merce, valore, plusvalore, accumulazione: la cassetta degli attrezzi per leggere produzione e sfruttamento.",
    links: [
      {
        label: "Marxists Internet Archive",
        url: "https://www.marxists.org/italiano/marx-engels/1867/capitale/index.htm",
      },
    ],
    tags: ["valore", "plusvalore", "accumulazione"],
  },
  {
    id: "stato-rivoluzione",
    title: "Stato e rivoluzione",
    author: "Vladimir I. Lenin",
    period: "1917",
    lane: "Stato e potere",
    summary:
      "Una lettura serrata del rapporto tra Stato, classe, democrazia, rivoluzione e transizione socialista.",
    links: [
      {
        label: "Marxists Internet Archive",
        url: "https://www.marxists.org/italiano/lenin/1917/statoriv/index.htm",
      },
    ],
    tags: ["lenin", "stato", "rivoluzione"],
  },
  {
    id: "imperialismo",
    title: "L'imperialismo fase suprema del capitalismo",
    author: "Vladimir I. Lenin",
    period: "1916",
    lane: "Imperialismo",
    summary:
      "Monopoli, capitale finanziario, esportazione di capitali e spartizione del mondo come struttura del capitalismo maturo.",
    links: [
      {
        label: "Marxists Internet Archive",
        url: "https://www.marxists.org/italiano/lenin/1916/imp-cap/index.htm",
      },
    ],
    tags: ["imperialismo", "finanza", "monopoli"],
  },
  {
    id: "riforma-rivoluzione",
    title: "Riforma sociale o rivoluzione?",
    author: "Rosa Luxemburg",
    period: "1899",
    lane: "Strategia",
    summary:
      "Il nodo tra conquiste immediate, organizzazione politica e trasformazione socialista del potere.",
    links: [
      {
        label: "Marxists Internet Archive",
        url: "https://www.marxists.org/italiano/luxembur/1899/riforma/index.htm",
      },
    ],
    tags: ["luxemburg", "riforme", "strategia"],
  },
  {
    id: "socialismo-utopico-scientifico",
    title: "Socialismo utopistico e socialismo scientifico",
    author: "Friedrich Engels",
    period: "1880",
    lane: "Fondamenti",
    summary:
      "Dalla critica morale del capitalismo alla lettura materialista dei rapporti sociali.",
    links: [
      {
        label: "Marxists Internet Archive",
        url: "https://www.marxists.org/italiano/marx-engels/1880/soc-utop/index.htm",
      },
    ],
    tags: ["engels", "materialismo", "socialismo"],
  },
  {
    id: "gramsciana",
    title: "Quaderni del carcere",
    author: "Antonio Gramsci",
    period: "1929-1935",
    lane: "Egemonia",
    summary:
      "Egemonia, blocco storico, intellettuali, guerra di posizione: lessico indispensabile per capire politica e cultura.",
    links: [
      {
        label: "Fondazione Gramsci",
        url: "https://www.fondazionegramsci.org/",
      },
    ],
    tags: ["gramsci", "egemonia", "cultura"],
  },
  {
    id: "comune-parigi",
    title: "La guerra civile in Francia",
    author: "Karl Marx",
    period: "1871",
    lane: "Storia",
    summary:
      "La Comune di Parigi come laboratorio storico del potere operaio, con i suoi limiti e le sue invenzioni.",
    links: [
      {
        label: "Marxists Internet Archive",
        url: "https://www.marxists.org/italiano/marx-engels/1871/guerra-civile/index.htm",
      },
    ],
    tags: ["comune", "parigi", "storia"],
  },
  {
    id: "dipendenza",
    title: "Teoria della dipendenza",
    author: "Ruy Mauro Marini e scuola latinoamericana",
    period: "anni 1960-1970",
    lane: "Sud globale",
    summary:
      "Per leggere centro, periferia, scambio ineguale, sovrasfruttamento e sviluppo dipendente.",
    links: [
      { label: "Monthly Review", url: "https://monthlyreview.org/" },
      { label: "Tricontinental", url: "https://thetricontinental.org/" },
    ],
    tags: ["dipendenza", "america latina", "imperialismo"],
  },
  {
    id: "femminismo-marxista",
    title: "Riproduzione sociale",
    author: "Tradizione femminista marxista",
    period: "anni 1970-oggi",
    lane: "Femminismi",
    summary:
      "Lavoro salariato, lavoro domestico, cura, genere e accumulazione letti come un unico campo di conflitto.",
    links: [
      { label: "Viewpoint Magazine", url: "https://viewpointmag.com/" },
      {
        label: "Historical Materialism",
        url: "https://www.historicalmaterialism.org/",
      },
    ],
    tags: ["femminismo", "riproduzione", "cura"],
  },
];
