# Contributing

Thanks for contributing to TouchGrass.

## Prerequisites

- Node.js 22.12 or later
- npm 10 or later

## Setup

```sh
npm install
cp .env.example .env
npm run dev
```

## Before opening a pull request

Run the repository checks:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Keep package dependencies declared by the workspace that imports them. Avoid introducing databases, paid infrastructure, or unrelated product features without first discussing the need.
