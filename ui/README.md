# PolyPersona UI

React + Vite + Tailwind CSS v4 frontend for PolyPersona.

## Stack

- React 19
- React Router 8
- Tailwind CSS v4
- TypeScript
- Vite 8

## Getting started

```bash
cd ui
npm install
npm run dev
```

## Pages

| Route | Page |
|---|---|
| `/` | Landing / hero |
| `/workspace` | Journey dashboard |
| `/populations` | London 100 agent grid |
| `/populations/new` | Create population wizard |
| `/populations/custom` | Custom uploaded agents |
| `/populations/:id` | Individual agent detail + live inspector |
| `/tools` | Test setup → orchestration → journey monitor |
| `/insights` | Population insights |

## Notes

- Agent data is placeholder — wire up your backend to replace the static arrays in each page.
- The agent detail page has a browser viewport placeholder ready to stream live screenshots.
- Screen recording request state is local — wire `recordingRequested` to your API.
