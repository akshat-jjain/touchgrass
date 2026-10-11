import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HealthResponseSchema } from '@touchgrass/contracts';
import { buildApp } from '../src/app.js';
import { repositoryRoot } from '../src/config/env.js';

test('environment loading resolves the repository root independently of the working directory', () => {
    assert.equal(repositoryRoot, resolve(dirname(fileURLToPath(import.meta.url)), '../../../'));
});

test('GET /health returns the shared health response contract', async () => {
    const app = await buildApp({ logger: false });

    try {
        const response = await app.inject({ method: 'GET', url: '/health' });
        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.json(), { status: 'ok', service: 'touchgrass-api' });
        assert.deepEqual(HealthResponseSchema.parse(response.json()), {
            status: 'ok',
            service: 'touchgrass-api'
        });
    } finally {
        await app.close();
    }
});

test('health contract rejects an unexpected service status', () => {
    assert.equal(
        HealthResponseSchema.safeParse({ status: 'down', service: 'touchgrass-api' }).success,
        false
    );
});
