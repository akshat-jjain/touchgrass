import { buildApp } from './app.js';
import { configureAdventureGenerator } from './adventures/generator-config.js';
import { env } from './config/env.js';

const configuredGenerator = configureAdventureGenerator({
    provider: env.AI_PROVIDER,
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL,
    timeoutMs: env.GROQ_TIMEOUT_MS
});
const app = await buildApp({ logger: true, adventureGenerator: configuredGenerator.generator });

try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (error) {
    app.log.error({ err: error }, 'Failed to start the server');
    await app.close();
    process.exitCode = 1;
}
