# Contributing to KaniCasino

Thanks for wanting to help. This is a hobby project, so lets keep things simple and have fun with it.

## Getting set up

See the "Getting started" section of the [README](README.md) to run the frontend or the full stack locally. For anything beyond the UI you'll need your own MongoDB.

## Workflow

1. Fork the repo and create a branch off `main`. Use a short prefixed name, e.g. `feat/slots-autoplay` or `fix/crash-cashout`.
2. Make your change. Keep the diff focused on one thing.
3. Make sure the checks pass locally (see below).
4. Open a pull request against `main` and fill in the template.

## Checks

CI runs on every pull request. You can run the same checks yourself:

```bash
# frontend
npm run lint
npm run build
npm run test:unit
npm run test:e2e

# backend
cd backend && npm test
```

Please don't open a PR with failing tests. If you're adding logic with a pure core (game math, parsing), a small unit test alongside it is appreciated.

## Style

There's no formatter enforced, and the codebase mixes older and newer patterns. When you touch an existing file, match what's around you rather than reformatting it.

For new frontend work, follow the split the newer pages use: a thin `index.tsx` entry, a `*.services.ts` hook that holds the state and logic, a presentational `*.view.tsx`, and a `*.types.ts`. `src/pages/Battles/` is the reference implementation. Small presentational components and the existing flat pages can stay as single files.

Keep comments sparse, and only where they explain something the code can't.

## Reporting bugs and ideas

Open an [issue](https://github.com/NovaDrake76/KaniCasino/issues). For bugs, include what you did, what you expected, and what happened. Screenshots help a lot for UI issues.
