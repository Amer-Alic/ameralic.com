# ameralic.com

The source for Amer Alić's personal website. It is a static site built with plain HTML,
CSS, and a small amount of JavaScript.

## Deployment

The site is intended for Cloudflare Pages with Git integration:

- Production branch: `main`
- Framework preset: `None`
- Build command: `exit 0`
- Build output directory: `.`

After the first Pages deployment, add `ameralic.com` under **Custom domains** in the
Cloudflare Pages project. The domain already uses Cloudflare nameservers, so Cloudflare
can create the required DNS record and provision HTTPS automatically.

Do not add the DNS record manually before associating the domain with the Pages project.
