# HSS ALL IN ONE

The Complete Smart Assistant for Higher Secondary School Teachers — Manage students, attendance, exams, marks, progress analytics, and PDF reports.

## GitHub Pages Deployment

This project is configured for automated continuous deployment to **GitHub Pages** using GitHub Actions.

1. **GitHub Pages Source**: In your GitHub repository settings, navigate to **Settings** → **Pages** → **Build and deployment** → **Source**, and select **GitHub Actions**.
2. **Repository**: `gelwin72-ui/HSS-ALL-IN-ONE`
3. **Vite Base Path**: The application is configured with `base: '/HSS-ALL-IN-ONE/'` in `vite.config.ts`.
4. **Build Command**: The automated workflow runs `npm run build`, generating the static bundle and SPA fallback into `dist/`.
5. **Deployment Target**: The `dist` directory is uploaded as a Pages artifact and deployed directly to GitHub Pages.
6. **Expected Live Website URL**:
   ```
   https://gelwin72-ui.github.io/HSS-ALL-IN-ONE/
   ```

### Important: Firebase Authentication with GitHub Pages

If you use Google Sign-In with Firebase Authentication on your GitHub Pages deployment:
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (`hss-all-in-one`).
3. Navigate to **Authentication** → **Settings** → **Authorized domains**.
4. Click **Add domain** and enter:
   ```
   gelwin72-ui.github.io
   ```
This authorizes Firebase Authentication popups and redirects from your GitHub Pages URL.

---

## Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build
```
