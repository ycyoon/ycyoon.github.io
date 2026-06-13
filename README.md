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

For a personal site served at `https://<username>.github.io`:

1. Create a repository named exactly **`<username>.github.io`** on GitHub.
2. Push the contents of this folder to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Add personal homepage"
   git branch -M main
   git remote add origin git@github.com:<username>/<username>.github.io.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages** and confirm the source is
   **Deploy from a branch → `main` / root**.
4. The site goes live at `https://<username>.github.io` within a minute or two.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Editing publications

Each publication is an `<li class="pub" data-type="...">` in `index.html`.
The `data-type` value (`scie`, `scopus`, `kci`) drives the filter buttons.
Add the `★` `<span class="corr">` marker for first/corresponding-author papers.
