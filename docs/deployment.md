# Deploying Kubelab

Current public target: **https://kubelab.librecollab.org**

The deployed app is the static SPA. It works fully client-side; the Go API is
not part of this deployment yet. Auth, progress sync, and Postgres arrive with
the Hetzner stack later.

## GitHub Pages

The org site (`LibreCollab/librecollab.org`) is already a GitHub Pages site
with the apex custom domain `librecollab.org`. Kubelab is a **separate Pages
site** with its own subdomain.

1. Push to `develop` (or run the **Deploy to GitHub Pages** workflow manually).
   The workflow builds `apps/web/dist`, copies `index.html` to `404.html` for
   SPA client routes, and deploys it.
2. In this repository: **Settings → Pages → Build and deployment → Source:
   GitHub Actions**.
3. Set **Custom domain** to `kubelab.librecollab.org` and save.
4. Add the DNS record at the provider that manages `librecollab.org`:
   - Type: `CNAME`
   - Name: `kubelab`
   - Target: `librecollab.github.io`
   - Proxy: **DNS only** if using Cloudflare (grey cloud), not proxied.
5. Wait for GitHub to verify the DNS, then enable **Enforce HTTPS**.

Do not change the apex records used by `librecollab.org`; the org site keeps its
own Pages custom domain and `CNAME` file.

## Verify

```bash
dig +short CNAME kubelab.librecollab.org   # librecollab.github.io.
curl -I https://kubelab.librecollab.org
curl -I https://kubelab.librecollab.org/lesson/pods-101
```

The second URL is served through the generated `404.html` fallback while the
SPA router renders the lesson.

## Branch and future backend

The Pages workflow deploys from `develop`. When `main` becomes the production
branch, update the workflow trigger. When the Go API lands, move the public
deployment to the Hetzner VPS behind Envoy (or keep the static frontend on
Pages and add an API subdomain with CORS; the self-hosted architecture prefers
serving both from the Go binary behind Envoy).
