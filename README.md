<div align="center">

# node-ts-starter

<p align="center">
A minimal and opinionated starter template for building Node.js applications with TypeScript.
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

![TypeScript](https://img.shields.io/badge/TypeScript-555?style=flat-square&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-555?style=flat-square&logo=node.js)
![ESLint](https://img.shields.io/badge/ESLint-555?style=flat-square&logo=eslint)
![Prettier](https://img.shields.io/badge/Prettier-555?style=flat-square&logo=prettier)

[🐛 Report Bug](https://github.com/akshat-jjain/node-ts-starter/issues)
·
[✨ Request Feature](https://github.com/akshat-jjain/node-ts-starter/issues)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [⚙️ Prerequisites](#️-prerequisites)
- [🚀 Getting Started](#-getting-started)
- [📜 Available Scripts](#-available-scripts)
- [📁 Project Structure](#-project-structure)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [👤 Contact](#-contact)

## ✨ Features

- ⚡ Node.js 22+ ready
- 📘 TypeScript 5
- 🚀 Fast development with `tsx`
- 🧹 ESLint 9 (Flat Config)
- 🎨 Prettier integration
- 🔍 TypeScript type checking
- ⚙️ Environment variable configuration
- 📦 Minimal project structure
- 🐶 Husky Git hooks (Auto installed after npm install)
- 🚦 lint-staged for fast pre-commit checks

---

## ⚙️ Prerequisites

- Node.js **22** or later
- npm (or your preferred package manager)

---

## 🚀 Getting Started

```bash
git clone https://github.com/akshat-jjain/node-ts-starter.git

cd node-ts-starter

npm install

cp .env.example .env

npm run dev
```

Start the development server:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Run the compiled application:

```bash
npm start
```

---

## 📜 Available Scripts

| Script                 | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | Start the application in watch mode using `tsx`.              |
| `npm run build`        | Compile TypeScript to the `dist/` directory.                  |
| `npm run start`        | Run the compiled application.                                 |
| `npm run clean`        | Remove the `dist/` directory.                                 |
| `npm run typecheck`    | Perform TypeScript type checking without emitting JavaScript. |
| `npm run lint`         | Run ESLint.                                                   |
| `npm run lint:fix`     | Automatically fix lint issues where possible.                 |
| `npm run format`       | Format the project using Prettier.                            |
| `npm run format:check` | Check formatting without making changes.                      |

---

## 📁 Project Structure

```text
.
├──.github/
│    └── workflows/
│       └── ci.yml
├──.husky/
│   └── pre-commit
├── src/
│   ├── config/
│   │   └── env.ts
│   └── index.ts
├── .editorconfig
├── .env.example
├── .gitignore
├── .prettierrc
├── eslint.config.mts
├── LICENSE
├── package.json
├── package-lock.json
├── README.md
└── tsconfig.json
```

---

## Continuous Integration

This template includes a GitHub Actions workflow that runs:

- Type checking
- ESLint
- Build

on every push and pull request.

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

This project is licensed under the **MIT License**.

See the [LICENSE](LICENSE) file for details.

---

## 👤 Contact

**Akshat Jain**

- GitHub: https://github.com/akshat-jjain
- Project: https://github.com/akshat-jjain/node-ts-starter

---

<div align="center">

Made with ❤️ by Akshat Jain

</div>
