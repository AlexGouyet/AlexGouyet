import Parser from "rss-parser";

export type Category = "news" | "shows" | "free";

export interface Source {
  name: string;
  url: string;
  category: Category;
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  category: Category;
  isoDate?: string;
  snippet?: string;
}

export interface Newsletter {
  news: NewsItem[];
  shows: NewsItem[];
  free: NewsItem[];
  sourcesLive: number;
  sourcesTotal: number;
  generatedAt: string;
}

/**
 * Austin-area music sources. Google News RSS queries are the backbone — they
 * aggregate the whole local press, return well-formed RSS, and (critically)
 * are reachable from datacenter IPs where many publisher feeds 403. The direct
 * outlet feeds are best-effort bonuses. Each source has a default bucket;
 * items mentioning "free" get promoted into the Free Shows section. Sources
 * that fail are skipped gracefully.
 */
const gnews = (query: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

export const SOURCES: Source[] = [
  {
    name: "Austin Concerts",
    url: gnews('"Austin" (concert OR "live music" OR "tour date") when:21d'),
    category: "shows",
  },
  {
    name: "Austin Free Shows",
    url: gnews('"Austin" "free" (concert OR show OR "live music") when:21d'),
    category: "free",
  },
  {
    name: "Austin Music News",
    url: gnews('"Austin" music (festival OR venue OR band OR album OR scene) when:14d'),
    category: "news",
  },
  {
    name: "Austin Chronicle — Music",
    url: "https://www.austinchronicle.com/feeds/rss/music/",
    category: "news",
  },
  {
    name: "KUTX 98.9",
    url: "https://www.kutx.org/feed/",
    category: "news",
  },
];

const parser = new Parser({
  headers: { "User-Agent": "AustinAmpNewsletter/1.0 (+https://github.com/AlexGouyet)" },
});

function clean(text?: string): string | undefined {
  if (!text) return undefined;
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSource(source: Source): Promise<NewsItem[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AustinAmpNewsletter/1.0; +https://github.com/AlexGouyet)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      // Default (force-cache) keeps the fetch static-export compatible; it runs
      // at build time and the result is baked in. A scheduled rebuild refreshes.
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[feeds] ${source.name}: HTTP ${res.status}`);
      return null;
    }
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    const items = (feed.items || []).slice(0, 16).map((item) => {
      // Google News titles look like "Headline - Publisher"; split them so the
      // publisher becomes the source label and the headline stays clean.
      let title = clean(item.title) || "Untitled";
      let label = source.name;
      const dash = title.lastIndexOf(" - ");
      if (dash > 20 && dash > title.length - 45) {
        label = title.slice(dash + 3).trim();
        title = title.slice(0, dash).trim();
      }
      const haystack = `${title} ${item.contentSnippet || ""}`.toLowerCase();
      const isFree =
        source.category === "free" ||
        (/\bfree\b/.test(haystack) && source.category === "shows");
      const snippet = clean(item.contentSnippet || (item as { content?: string }).content);
      return {
        title,
        link: item.link || source.url,
        source: label,
        category: isFree ? ("free" as const) : source.category,
        isoDate: item.isoDate,
        snippet: snippet ? snippet.slice(0, 200) : undefined,
      };
    });
    console.log(`[feeds] ${source.name}: ${items.length} items`);
    return items;
  } catch (err) {
    console.warn(`[feeds] ${source.name}: ${(err as Error).message}`);
    return null;
  }
}

function byDateDesc(a: NewsItem, b: NewsItem): number {
  const ta = a.isoDate ? Date.parse(a.isoDate) : 0;
  const tb = b.isoDate ? Date.parse(b.isoDate) : 0;
  return tb - ta;
}

export async function getNewsletter(): Promise<Newsletter> {
  const results = await Promise.all(SOURCES.map(fetchSource));
  const sourcesLive = results.filter((r) => r !== null).length;
  const all = results.filter((r): r is NewsItem[] => r !== null).flat();

  // De-duplicate by link.
  const seen = new Set<string>();
  const unique = all.filter((item) => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  const news = unique.filter((i) => i.category === "news").sort(byDateDesc).slice(0, 18);
  const shows = unique.filter((i) => i.category === "shows").sort(byDateDesc).slice(0, 18);
  const free = unique.filter((i) => i.category === "free").sort(byDateDesc).slice(0, 12);

  return {
    news,
    shows,
    free,
    sourcesLive,
    sourcesTotal: SOURCES.length,
    generatedAt: new Date().toISOString(),
  };
}
