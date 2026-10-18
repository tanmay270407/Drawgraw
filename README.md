# Drawgraw

Drawgraw is a hand-drawn canvas for diagrams, notes, and visual ideas. It includes shape and text tools, drawing and editing controls, collaboration, image export, local file import/export, account sign-in, and per-user cloud drawings.

The canvas engine is based on the open-source [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) project. Its MIT license and required notices are preserved in [LICENSE](./LICENSE).

## Run locally

Install dependencies with Yarn, then start the app from the `excalidraw-app` folder:

```sh
yarn install
cd excalidraw-app
yarn vite --host 0.0.0.0
```

For local account and cloud-save support, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the repository's ignored `.env.local` file. Run the SQL script in [supabase/setup.sql](./supabase/setup.sql) in the Supabase SQL Editor to create the profile and drawing tables and their row-level security policies.

## Build

```sh
yarn --cwd excalidraw-app build:app
```

## Cloud data

Supabase Auth manages account credentials. The `profiles` table stores display names and phone numbers. The `drawings` table stores each user's scene, including embedded image data. Row-level security limits reads and writes to the authenticated owner.
