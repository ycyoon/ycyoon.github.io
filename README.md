# Yeo-Chan Yoon — Personal Academic Homepage

Static personal website for **Yeo-Chan Yoon (윤여찬)**, Associate Professor,
Department of Artificial Intelligence, Jeju National University.

Built as a single-page, dependency-free site (HTML + CSS + vanilla JS) and
designed to be hosted on **GitHub Pages**.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page content (hero, research, publications, experience, contact) |
| `style.css` | Minimal academic styling, light + dark themes |
| `script.js` | Theme toggle, publication filtering, footer year |
| `assets/profile.jpg` | Profile photo (extracted from CV) |

## Deploy to GitHub Pages (user site)

This site is published at `https://ycyoon.github.io/` from the **`gh-pages`**
branch. Keep the source changes in **`main`**, then merge them into `gh-pages`
when publishing:

```bash
git switch main
git add index.html README.md script.js style.css assets
git commit -m "Update homepage"
git push origin main

git switch gh-pages
git merge main --no-edit -X theirs
git push origin gh-pages
git switch main
```

In GitHub, confirm **Settings → Pages** is set to **Deploy from a branch →
`gh-pages` / root**. Do not use `git add .` if the local `repo/` directory is
present; it is a separate reference project and is not part of this homepage.
GitHub Pages may take a few minutes to update after the push.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Editing publications

Each publication is an `<li class="pub" data-type="...">` in `index.html`.
The `data-type` value (`conference`, `scie`, `scopus`, `kci`) drives the filter buttons.
Add the `★` `<span class="corr">` marker for first/corresponding-author papers.
