# LickABrick.github.io

A lightweight personal technical blog and reference notebook, hosted on [GitHub Pages](https://lickabrick.github.io). Eleventy 3 renders Markdown and Nunjucks; Tailwind CSS 4 supplies the existing dark/green theme, and Prism provides build-time syntax highlighting. There is no frontend framework. Umami analytics is retained.

## Development

Use **Node.js 24 LTS, at least 24.15.0** (required by the maintained `npm-run-all2` script runner) and npm. `.nvmrc` and CI select Node 24; `package.json` enforces the supported major.

```sh
nvm use                 # if using nvm
npm ci
npm start               # http://localhost:8888, template and CSS watch mode
npm run build           # clean production output in _site/
npm run lint
npm run lint:fix
npm test                # production build + Node's built-in test runner
npm run test:site       # validate an already-built _site/
```

Run builds separately from the development server. Tailwind writes only `.cache/tailwind.css`; Eleventy alone owns `_site`, copying compiled CSS along with source assets. Initial CSS is built before watch processes start. Do not edit or commit generated files.

## Writing

Add Markdown to `src/posts/` or `src/notes/`. Use front matter:

```yaml
---
title: A descriptive title
description: A short, unique summary.
layout: post
tags: post
publish_date: 03-10-2023
---
```

Use `tags: note` for notes. Dates are **DD-MM-YYYY** and converted explicitly for machine-readable metadata; filenames determine the permanent `/<posts-or-notes>/<filename>/` URLs. Keep filenames stable. Place images in `src/assets/images/` with meaningful Markdown alt text. External links open in the same tab by default; if adding `target="_blank"`, include `rel="noopener noreferrer"`.

Production identity lives in `src/_data/site.json`, never an environment-derived preview URL. HTML includes canonical, Open Graph and Twitter summary metadata. Posts appear newest-first on the homepage and in `/feed.xml`; `/sitemap.xml` includes all public HTML pages and `/robots.txt` advertises it.

## Deployment and repository settings

One workflow validates PRs targeting `main` and pushes to `main` using `npm ci`, ESLint and `npm test` (including production build and generated-site checks). Only trusted `main` runs upload `_site` and deploy it. PRs have read-only permissions and cannot deploy. Official actions are pinned to full commit SHAs; deployment jobs alone receive Pages/OIDC permissions, and deployments are serialized.

Configure these settings manually in GitHub:

1. **Pages → Build and deployment → Source: GitHub Actions**. Restrict the `github-pages` environment's deployment branches to `main`.
2. Protect `main` with a ruleset/branch protection: require pull requests, require the **`validate`** status check from GitHub Actions, require branches up to date, disallow force pushes/deletion, and do not permit bypasses (including bots/admins). Select the check after the first PR run. Add any future mandatory checks here too.
3. Enable squash merging. Review-approval rules can intentionally block Renovate automerge; either review those PRs manually or use an explicitly scoped policy without bypassing status checks.
4. Install the **Renovate GitHub App** and grant this repository access. Enable the Dependency graph, Dependabot alerts and vulnerability access for the app. Create the `dependencies` label if absent. No paid service or self-hosted bot is required.

## Renovate policy

`.github/renovate.json` extends `config:best-practices`. It already inherits config migration, dependency dashboard, module/test ignores, Docker/action digest pinning and other maintained defaults, so these presets are not duplicated. npm, GitHub Actions and `.nvmrc` updates are enabled; stable releases only, bump ranges and update the committed lockfile.

Normal update creation runs daily **06:00–06:59 Europe/Amsterdam**, with a seven-day release age, strict internal checks, 15 concurrent PRs and two new PRs/hour. This is an eligibility window, not a guarantee that the hosted app will run every day. Daily lockfile maintenance reuses an open PR and does not repeatedly recreate a closed one. Tailwind minor/patch updates are grouped so the CLI/compiler stay aligned.

Minor/patch PRs may squash-automerge **only after every reported check succeeds**, with `ignoreTests: false` and Renovate-managed merging (`platformAutomerge: false`). **The required `validate` check must be enforced in GitHub branch protection to guard against missing/not-yet-started checks**; current Renovate has no supported `requiredStatusChecks` option. Major updates require Dependency Dashboard approval and manual merging; pre-1.0 packages also require manual merging. Security alerts and OSV summaries are enabled; vulnerability PRs bypass the normal release-age/window and require manual merging, never a CI bypass. OSV covers direct dependencies; GitHub alerts cover lockfile advisories.

Validate configuration after editing (downloads tooling temporarily, does not add a project dependency):

```sh
npx --yes --package renovate renovate-config-validator --strict .github/renovate.json
```

## Migration and validation notes

- [Eleventy 3 upgrade guidance](https://www.11ty.dev/blog/eleventy-v3/) was reviewed: Node 18+ is required; the existing CommonJS config remains supported. No Eleventy core plugins are imported with `require`, so no ESM conversion is needed. Syntax highlighting, passthrough paths, layouts and content compile on 3.1.7.
- [Tailwind v4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide): official standalone CLI, explicit Nunjucks/Markdown/HTML/SVG source scanning and CSS-first `@theme` preserve both complete color palettes. Existing `@apply` styles live in the base layer so utilities can override them (notably dark navigation text). PostCSS, autoprefixer and JS Tailwind config are no longer necessary. Tailwind 4 targets modern browsers (Safari 16.4+, Chrome 111+, Firefox 128+).
- Replaced unmaintained `npm-run-all` with `npm-run-all2`; removed `dotenv` because its only consumer was unused global environment data. All dependencies are build/test tools, not deployed server packages. Fonts are served locally instead of relying on Google Fonts.
- Node tests check all generated pages, existing URLs and metadata, highlighted code, local links/fragments/assets, source asset byte preservation, compiled utilities/colors, RSS, sitemap and robots. Markdown posts/notes are unchanged.
- Local validation on Node 24.21.0: clean `npm ci`, ESLint, production build, five Node tests, strict Renovate validation, actionlint, and full/production npm audit (zero advisories). Chromium checked all four HTML pages at 375px/1440px with no viewport overflow; development template/CSS edits were observed through the server. Screenshots were reviewed. Browser tooling is temporary and not a project dependency.
- GitHub-hosted CI/Pages deployment, branch settings, Renovate installation and live Umami event delivery require verification in GitHub/production. Tests preserve the original deferred script URL and website ID; they do not send analytics events.
