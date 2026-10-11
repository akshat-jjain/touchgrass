import fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { ApiErrorResponseSchema, HealthResponseSchema } from '@touchgrass/contracts';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    StubAdventureGenerator,
    type AdventureGenerator
} from './adventures/adventure-generator.js';
import { registerAdventureRoutes } from './routes/adventures.js';

export interface AppOptions {
    logger?: boolean;
    webRoot?: string;
    adventureGenerator?: AdventureGenerator;
    fallbackAdventureGenerator?: AdventureGenerator;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
    const app = fastify({ logger: options.logger ?? true });

    app.setErrorHandler((error, request, reply) => {
        request.log.error({ err: error }, 'Request failed');
        const candidateStatusCode =
            typeof error === 'object' && error !== null && 'statusCode' in error
                ? error.statusCode
                : undefined;
        const statusCode =
            typeof candidateStatusCode === 'number' &&
            candidateStatusCode >= 400 &&
            candidateStatusCode < 500
                ? candidateStatusCode
                : 500;

        const response = ApiErrorResponseSchema.parse({
            error: {
                code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
                message:
                    statusCode === 500 ? 'An unexpected error occurred.' : 'The request is invalid.'
            }
        });
        return reply.status(statusCode).send(response);
    });

    app.get('/health', async (_request, reply) => {
        const response = HealthResponseSchema.parse({ status: 'ok', service: 'touchgrass-api' });
        return reply.status(200).send(response);
    });

    await registerAdventureRoutes(
        app,
        options.adventureGenerator ?? new StubAdventureGenerator(),
        options.fallbackAdventureGenerator ?? new StubAdventureGenerator()
    );

    const webRoot = options.webRoot ?? resolve(process.cwd(), 'apps/web/dist');
    if (existsSync(webRoot)) {
        await app.register(fastifyStatic, { root: webRoot, wildcard: false });
        app.setNotFoundHandler((request, reply) => {
            if (request.url.startsWith('/api')) {
                return reply.status(404).send(
                    ApiErrorResponseSchema.parse({
                        error: {
                            code: 'NOT_FOUND',
                            message: 'The requested API route was not found.'
                        }
                    })
                );
            }
            return reply.sendFile('index.html');
        });
    } else {
        app.setNotFoundHandler((_request, reply) =>
            reply.status(404).send(
                ApiErrorResponseSchema.parse({
                    error: { code: 'NOT_FOUND', message: 'The requested route was not found.' }
                })
            )
        );
    }

    return app;
}
