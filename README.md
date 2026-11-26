# Personal introduction page

A responsive, static introduction and portfolio page built with plain HTML, CSS, and JavaScript. No build step or package installation is required.

## Make it yours

1. Open `index.html` and replace the example name, role, introduction, about text, project details, and contact email.
2. Update the page title and description in the `<head>`.
3. Replace the example projects with your own. The project cards are currently illustrative and do not link to external projects.
4. Adjust colors, typography, and layouts in `styles.css`.
5. Open `index.html` in a browser to preview the page.

The page uses Google Fonts when a network connection is available and falls back to sans-serif fonts otherwise. The photo gallery uses selected images from `assets/izzy`. The hero includes an original animated flower GIF with a static SVG alternative for reduced-motion preferences.

## Publish on GitHub Pages

1. Create an empty GitHub repository and push this project to its `main` branch.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` deploys the site after each push to `main`. Check the **Actions** tab for deployment status and the published URL.

## Publish on another static host

Connect the repository to your preferred static hosting provider and use the repository root as the site directory. There is no build command; publish the files as-is. The site works on hosts such as Netlify, Cloudflare Pages, and Vercel.

## Start a local Git repository

After you have chosen a GitHub repository name and created the empty repository:

```bash
git init
git add .
git commit -m "Create personal introduction page"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the remote URL with the one from your GitHub repository. These commands create the first local commit and push it; no GitHub repository or push is created by this project setup.
