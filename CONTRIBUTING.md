# Contributing

Thank you for considering contributing to this project!

## Prerequisites

- Node.js 22 or later
- npm

## Getting Started

1. Fork the repository.
2. Clone your fork.

```bash
git clone https://github.com/akshat-jjain/node-ts-starter.git
```

3. Install dependencies.

```bash
npm install
```

4. Copy the environment file.

```bash
cp .env.example .env
```

## Available Scripts

| Command              | Description                  |
| -------------------- | ---------------------------- |
| npm run dev          | Start the development server |
| npm run build        | Compile TypeScript           |
| npm run start        | Run the compiled application |
| npm run typecheck    | Run TypeScript type checking |
| npm run lint         | Run ESLint                   |
| npm run lint:fix     | Fix ESLint issues            |
| npm run format       | Format the project           |
| npm run format:check | Check formatting             |

## Coding Style

- Follow the existing project structure.
- Use TypeScript.
- Run `npm run lint` before committing.
- Run `npm run typecheck` before pushing.

## Commit Messages

This project follows Conventional Commits.

Examples:

```
feat: add authentication
fix: resolve env parsing issue
docs: update README
refactor: simplify config loading
```

## Pull Requests

Before opening a pull request:

- Ensure the project builds successfully.
- Ensure linting passes.
- Ensure type checking passes.
- Update documentation if needed.

Thank you for your contribution!
