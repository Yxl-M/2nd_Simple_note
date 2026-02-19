# Simple Notes (Shared)

This version stores notes in **Netlify Blobs** via a **Netlify Function**, so everyone visiting your deployed site can see the same notes.

## Important: how to deploy
Netlify Functions are deployed via **Git continuous deployment** or the **Netlify CLI** (not drag-and-drop of a zip), because functions need to be detected/bundled with their dependencies.

## Deploy with Git (recommended)
1. Create a GitHub repo and put these files at the repo root.
2. In Netlify: **Add new site → Import from Git** and choose your repo.
3. Build settings:
   - Build command: *(leave empty)*
   - Publish directory: `.`
4. Deploy.

## Deploy with Netlify CLI (manual)
```bash
npm install
npx netlify login
npx netlify init
npx netlify deploy --prod --dir .
```

## Local dev (with functions)
```bash
npm install
npx netlify dev
```
Then open the local URL printed by the CLI.

## Editing / deleting notes
To keep the demo simple (no user accounts), each note gets an **edit token** stored in the browser that created it.
Other visitors can **read** the note but cannot edit/delete it from their browser.
