import { getNewsletter, type NewsItem } from "@/lib/feeds";

// Re-fetch sources at most once an hour; render on the server.
export const revalidate = 3600;

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

function Item({ item }: { item: NewsItem }) {
  const date = formatDate(item.isoDate);
  return (
    <a className="item" href={item.link} target="_blank" rel="noopener noreferrer">
      <h3>{item.title}</h3>
      <div className="meta">
        <span className="src">{item.source}</span>
        {date && <span>{date}</span>}
      </div>
      {item.snippet && <p className="snippet">{item.snippet}…</p>}
    </a>
  );
}

function Section({
  id,
  title,
  badge,
  items,
  emptyNote,
}: {
  id: string;
  title: string;
  badge: string;
  items: NewsItem[];
  emptyNote: string;
}) {
  return (
    <section className={`section ${id}`}>
      <div className="section-head">
        <h2>{title}</h2>
        <span className="badge">{badge}</span>
      </div>
      {items.length > 0 ? (
        items.map((item, i) => <Item key={`${id}-${i}`} item={item} />)
      ) : (
        <div className="notice">{emptyNote}</div>
      )}
    </section>
  );
}

export default async function Page() {
  const data = await getNewsletter();
  const issueDate = new Date(data.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });

  const totalStories = data.news.length + data.shows.length + data.free.length;

  return (
    <main className="wrap">
      <header className="masthead">
        <div className="kicker">Austin, Texas · Live Music Capital of the World</div>
        <h1 className="title">
          The Austin <span className="bolt">Amp</span>
        </h1>
        <div className="dateline">
          <span>{issueDate} Edition</span>
          <span className="dot">◆</span>
          <span>{totalStories} stories</span>
          <span className="dot">◆</span>
          <span>
            {data.sourcesLive}/{data.sourcesTotal} feeds live
          </span>
        </div>
      </header>

      <p className="lede">
        Everything happening in Austin music this week — <em>news, new releases,
        concerts, and free shows</em> — amalgamated from the city&apos;s best
        sources into one read.
      </p>

      {totalStories === 0 && (
        <div className="notice">
          The feeds couldn&apos;t be reached right now (the host network may be
          blocking outbound requests). Once deployed to Vercel, the page will
          pull live stories from {data.sourcesTotal} Austin music sources and
          refresh every hour.
        </div>
      )}

      <Section
        id="shows"
        title="Concerts & Shows"
        badge="On Stage"
        items={data.shows}
        emptyNote="No upcoming shows in the feed right now — check back after the next refresh."
      />

      <Section
        id="free"
        title="Free Shows"
        badge="$0 Cover"
        items={data.free}
        emptyNote="No free shows surfaced this hour. We scan every listing for free admission and pull them here automatically."
      />

      <Section
        id="news"
        title="News & Articles"
        badge="The Beat"
        items={data.news}
        emptyNote="No music news in the feed right now — check back after the next refresh."
      />

      <div className="signup">
        <h3>Get The Austin Amp in your inbox</h3>
        <p>One email a week. Every show, every byline, zero spam.</p>
        <form className="row" action="#" method="post">
          <input type="email" name="email" placeholder="you@email.com" aria-label="Email address" />
          <button type="submit">Subscribe</button>
        </form>
      </div>

      <footer className="foot">
        <div>
          <strong>The Austin Amp</strong> · Auto-amalgamated from public RSS feeds ·
          Refreshes hourly
        </div>
        <div className="sources">
          Sources: Austin Chronicle · KUTX · KUT · Austin Monitor · Pitchfork
        </div>
      </footer>
    </main>
  );
}
