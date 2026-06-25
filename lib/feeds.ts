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
 * Austin-area music RSS sources. Each source has a default bucket; individual
 * items that mention "free" get promoted into the Free Shows section.
 * Sources that fail (404 / blocked / offline) are skipped gracefully.
 */
export const SOURCES: Source[] = [
  {
    name: "Austin Chronicle — Music",
    url: "https://www.austinchronicle.com/feeds/rss/music/",
    category: "news",
  },
  {
    name: "Austin Chronicle — Music Events",
    url: "https://www.austinchronicle.com/feeds/rss/events/music/",
    category: "shows",
  },
  {
    name: "KUTX 98.9",
    url: "https://www.kutx.org/feed/",
    category: "news",
  },
  {
    name: "KUT — Music",
    url: "https://www.kut.org/tags/music.rss",
    category: "news",
  },
  {
    name: "Austin Monitor",
    url: "https://www.austinmonitor.com/feed/",
    category: "news",
  },
  {
    name: "Pitchfork — News",
    url: "https://pitchfork.com/rss/news/",
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
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AustinAmpNewsletter/1.0 (+https://github.com/AlexGouyet)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      // Revalidate at the data layer so each source caches for an hour.
      next: { revalidate: 3600 },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    return (feed.items || []).slice(0, 14).map((item) => {
      const haystack = `${item.title || ""} ${item.contentSnippet || ""}`.toLowerCase();
      const isFree = /\bfree\b/.test(haystack) && source.category !== "news";
      const snippet = clean(item.contentSnippet || (item as { content?: string }).content);
      return {
        title: clean(item.title) || "Untitled",
        link: item.link || source.url,
        source: source.name,
        category: isFree ? "free" : source.category,
        isoDate: item.isoDate,
        snippet: snippet ? snippet.slice(0, 200) : undefined,
      };
    });
  } catch {
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
