import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

function findRepositoryRoot(moduleUrl: string): string {
    let directory = dirname(fileURLToPath(moduleUrl));
    while (true) {
        const manifestPath = resolve(directory, 'package.json');
        if (existsSync(manifestPath)) {
            try {
                const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
                if (
                    typeof manifest === 'object' &&
                    manifest !== null &&
                    'name' in manifest &&
                    manifest.name === 'touchgrass' &&
                    'workspaces' in manifest
                ) {
                    return directory;
                }
            } catch {
                // Keep walking when an ancestor has an unrelated or invalid manifest.
            }
        }

        const parent = dirname(directory);
        if (parent === directory)
            throw new Error('Could not locate the TouchGrass repository root');
        directory = parent;
    }
}

// Resolve from this module's location so both source and compiled starts work from any CWD.
export const repositoryRoot = findRepositoryRoot(import.meta.url);
dotenv.config({ path: resolve(repositoryRoot, '.env') });

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, production, or test');
}

const aiProvider = process.env.AI_PROVIDER ?? 'stub';
if (aiProvider !== 'stub' && aiProvider !== 'groq') {
    throw new Error('AI_PROVIDER must be stub or groq');
}

const groqTimeoutMs = Number(process.env.GROQ_TIMEOUT_MS ?? 15_000);
if (!Number.isInteger(groqTimeoutMs) || groqTimeoutMs < 1_000 || groqTimeoutMs > 30_000) {
    throw new Error('GROQ_TIMEOUT_MS must be an integer between 1000 and 30000');
}

export const env = Object.freeze({
    PORT: port,
    NODE_ENV: nodeEnv,
    AI_PROVIDER: aiProvider,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b',
    GROQ_TIMEOUT_MS: groqTimeoutMs
});
