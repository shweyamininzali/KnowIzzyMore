# Personal introduction page

A responsive, static introduction and portfolio page built with plain HTML, CSS, and JavaScript. No build step or package installation is required.

## Make it yours

1. Open `index.html` and replace the example name, role, introduction, about text, project details, and contact email.
2. Update the page title and description in the `<head>`.
3. Replace the example projects with your own. The project cards are currently illustrative and do not link to external projects.
4. Adjust colors, typography, and layouts in `styles.css`.
5. Open `index.html` in a browser to preview the page.

The page uses Google Fonts when a network connection is available and falls back to sans-serif fonts otherwise. The photo gallery uses selected images from `assets/izzy`. The hero includes an original animated flower GIF with a static SVG alternative for reduced-motion preferences.

## Supabase sign-in and message board

The sign-in dialog and message board use Supabase from the browser; this static site does not use Next.js server helpers. The Supabase project URL and publishable key are configured in `auth.js`. A publishable key is intended for public clients; never put a service-role key in this site.

Before using signup on the live site:

1. Enable the **Email** provider in Supabase Authentication settings.
2. In **Authentication → URL Configuration**, set the Site URL to `https://shweyamininzali.github.io/KnowIzzyMore/` and add that same URL to the allowed redirect URLs. Add your local preview URL there too if you test signup locally.
3. Keep Row Level Security enabled. Public posts are readable by anyone; private posts are readable only by their author and the site owner.
4. In the same Supabase project, run [`supabase/message-board-access.sql`](supabase/message-board-access.sql) in the SQL Editor. It creates and backfills private profiles, preserves existing messages as public, replaces the board/profile policies, and enables signed-in users to post under their own account.
5. Add the owner's existing Supabase Auth account to the private owner list by running this once in the SQL Editor, replacing the placeholder with the owner's sign-in email. Keep the actual email out of committed public files:

   ```sql
   insert into public.message_board_owner (user_id)
   select id from auth.users where lower(email) = lower('<owner sign-in email>')
   on conflict (user_id) do nothing;
   ```

The Supabase JavaScript client is loaded from `esm.sh`, so no build step or npm install is needed. Signup displays an email-confirmation prompt when Supabase requires confirmation. Supabase Auth stores passwords as secure hashes; this site never stores or reads password values after sign-in. Profile data is private to each user. Public post names and messages are visible to everyone; private messages are visible only to the author and owner. Email is shown read-only on the profile page and cannot be changed there.

The original [messageboard_db](https://github.com/shweyamininzali/messageboard_db) Express server is not used by GitHub Pages. Do not deploy its current anonymous API publicly: it uses a server secret that bypasses RLS, and its endpoints do not require a signed-in user.

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
