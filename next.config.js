/**
 * Static export so the newsletter can be hosted on GitHub Pages (and, just as
 * well, on Vercel). Feeds are fetched at build time and baked into HTML; a
 * scheduled Actions rebuild refreshes the content.
 *
 * @type {import('next').NextConfig}
 */
const isPages = process.env.GITHUB_PAGES === "true";
const repo = "AlexGouyet";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // GitHub Pages serves a project site under /<repo>/; Vercel serves at root.
  basePath: isPages ? `/${repo}` : "",
  assetPrefix: isPages ? `/${repo}/` : undefined,
};

module.exports = nextConfig;
