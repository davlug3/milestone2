# Local development

`npm run dev` serves the same presentation menu and scene URLs as Vercel at http://localhost:5173/. It prepares the shared photo assets and runs independent Vite servers behind a single origin for cross-scene assets and HMR. Use `npm run dev -- --host 0.0.0.0 --port 5173` for LAN access. The original standalone book workflow remains available via `npm run dev:book`. For an exact production build, use `npm run build:site && npm run preview:site`.
