# Deploying to GitHub Pages

From VS Code's terminal in this folder:

0. **First commit** (once):
   ```
   git init -b main
   git add -A
   git commit -m "Where the Money Is: centers of income in the 50 largest US metros"
   ```
1. **Create the GitHub repo** (public, since Pages on a free account requires it):
   ```
   gh repo create brianbalzar/where-the-money-is --public --source . --push
   ```
   Or create an empty repo named `where-the-money-is` on github.com and run:
   ```
   git remote add origin https://github.com/brianbalzar/where-the-money-is.git
   git push -u origin main
   ```
2. **Turn on Pages:** go to the repo's Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. The `Deploy to GitHub Pages` workflow runs on every push to `main`. It runs the tests (including the data invariants), then builds and publishes. The site will be at:
   **https://brianbalzar.github.io/where-the-money-is/**

The base path comes from the repo name. If you rename the repo or move it to `brianbalzar.github.io`, nothing needs to change.

## Updating

- After a code change, commit and push.
- After new IRS data, re-run the pipeline (see README). Commit `public/data/` and `pipeline/imputation_report.csv`, then push.
