import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
    AdventureGenerationResponseSchema,
    AdventurePreferencesSchema,
    type Adventure,
    type AdventurePreferences
} from '@touchgrass/contracts';
import {
    GroqAdventureGenerator,
    GroqProviderError,
    StubAdventureGenerator,
    type AdventureGenerator
} from '../src/adventures/adventure-generator.js';
import { configureAdventureGenerator } from '../src/adventures/generator-config.js';
import { validateAdventureSafety } from '../src/adventures/safety-validator.js';
import { buildApp } from '../src/app.js';

const basePreferences: AdventurePreferences = {
    mood: 'relax',
    duration: '15m',
    company: 'alone',
    energy: 'low'
};

const validAdventure: Adventure = {
    id: 'test-adventure',
    title: 'A small noticing walk',
    premise: 'Take a gentle pause in a familiar public place.',
    activityType: 'quiet_observation',
    durationMinutes: 15,
    steps: [{ title: 'Pause', instruction: 'Notice the shapes around you.', durationMinutes: 15 }],
    safetyNotes: ['Stay in a familiar public area and leave whenever you like.'],
    reflectionPrompt: 'What caught your attention?'
};

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

async function createApp(adventureGenerator?: AdventureGenerator, fallback?: AdventureGenerator) {
    const app = await buildApp({
        logger: false,
        webRoot: 'missing-web-root',
        adventureGenerator,
        fallbackAdventureGenerator: fallback
    });
    apps.push(app);
    return app;
}

function assertStrictJsonSchema(value: unknown): void {
    if (Array.isArray(value)) {
        value.forEach(assertStrictJsonSchema);
        return;
    }
    if (typeof value !== 'object' || value === null) return;

    const schema = value as Record<string, unknown>;
    if (schema.type === 'object') {
        const properties = schema.properties as Record<string, unknown>;
        assert.equal(schema.additionalProperties, false);
        assert.deepEqual([...(schema.required as string[])].sort(), Object.keys(properties).sort());
        Object.values(properties).forEach(assertStrictJsonSchema);
    }
    if (schema.type === 'array') assertStrictJsonSchema(schema.items);
}

afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('preference-aware stub generator', () => {
    const generator = new StubAdventureGenerator();

    it('accepts valid preferences and rejects invalid preferences', () => {
        assert.equal(AdventurePreferencesSchema.safeParse(basePreferences).success, true);
        assert.equal(
            AdventurePreferencesSchema.safeParse({ ...basePreferences, duration: '45m' }).success,
            false
        );
    });

    it('uses every mood to select a distinct activity and step plan', async () => {
        const moods: AdventurePreferences['mood'][] = [
            'relax',
            'explore',
            'move',
            'connect',
            'create'
        ];
        const adventures = await Promise.all(
            moods.map((mood) => generator.generate({ ...basePreferences, mood }))
        );
        const parsed = adventures.map(
            (adventure) => AdventureGenerationResponseSchema.parse({ adventure }).adventure
        );

        assert.equal(new Set(parsed.map(({ activityType }) => activityType)).size, 5);
        assert.equal(
            new Set(
                parsed.map(({ steps }) => steps.map(({ instruction }) => instruction).join('|'))
            ).size,
            5
        );
        assert.match(
            parsed.find(({ activityType }) => activityType === 'gentle_walk')!.steps[0]!
                .instruction,
            /path|walk/i
        );
        assert.match(
            parsed.find(({ activityType }) => activityType === 'imaginative_creation')!.steps[0]!
                .instruction,
            /imagin/i
        );
    });

    it('produces all four requested durations with exact totals and distinct arcs', async () => {
        const durations: AdventurePreferences['duration'][] = ['15m', '30m', '60m', '120m'];
        const adventures = await Promise.all(
            durations.map((duration) => generator.generate({ ...basePreferences, duration }))
        );

        for (const [index, generated] of adventures.entries()) {
            const adventure = AdventureGenerationResponseSchema.parse({
                adventure: generated
            }).adventure;
            const expected = [15, 30, 60, 120][index];
            assert.equal(adventure.durationMinutes, expected);
            assert.equal(
                adventure.steps.reduce((total, step) => total + step.durationMinutes, 0),
                expected
            );
            assert.equal(
                new Set(adventure.steps.map(({ title }) => title)).size,
                adventure.steps.length
            );
        }
        assert.deepEqual(
            adventures.map((item) => (item as Adventure).steps.length),
            [3, 4, 5, 6]
        );
    });

    it('changes step intensity at low, medium, and high energy', async () => {
        const levels: AdventurePreferences['energy'][] = ['low', 'medium', 'high'];
        const adventures = await Promise.all(
            levels.map((energy) => generator.generate({ ...basePreferences, energy }))
        );
        const instructions = adventures.map((item) => (item as Adventure).steps[0]!.instruction);

        assert.equal(new Set(instructions).size, 3);
        assert.match(instructions[0]!, /seated or standing comfortably/i);
        assert.match(instructions[1]!, /gentle stroll/i);
        assert.match(instructions[2]!, /easy loop/i);
        const lowAdventure = (await generator.generate({
            ...basePreferences,
            duration: '60m'
        })) as Adventure;
        assert.equal(
            lowAdventure.steps.filter(({ instruction }) =>
                /pause whenever you like/i.test(instruction)
            ).length,
            1
        );
        assert.ok(lowAdventure.steps.every(({ instruction }) => !/highenergy/i.test(instruction)));
    });

    it('makes each company option suitable in the step instructions and reflection', async () => {
        const companies: AdventurePreferences['company'][] = ['alone', 'friend', 'family', 'group'];
        const adventures = await Promise.all(
            companies.map((company) => generator.generate({ ...basePreferences, company }))
        );
        const parsed = adventures.map(
            (item) => AdventureGenerationResponseSchema.parse({ adventure: item }).adventure
        );

        assert.equal(new Set(parsed.map(({ steps }) => steps[1]!.instruction)).size, 4);
        assert.equal(new Set(parsed.map(({ reflectionPrompt }) => reflectionPrompt)).size, 4);
        assert.match(parsed[0]!.steps[1]!.instruction, /at your own pace/i);
        assert.match(parsed[1]!.steps[1]!.instruction, /friend/i);
        assert.match(parsed[2]!.steps[1]!.instruction, /family/i);
        assert.match(parsed[3]!.steps[1]!.instruction, /as a group/i);
    });

    it('keeps identical preferences deterministic and changes contrasting combinations', async () => {
        const first = await generator.generate(basePreferences);
        const again = await generator.generate(basePreferences);
        const contrast = await generator.generate({
            mood: 'create',
            duration: '60m',
            company: 'group',
            energy: 'high'
        });

        assert.deepEqual(first, again);
        assert.notDeepEqual(first, contrast);
        assert.notDeepEqual((first as Adventure).steps, (contrast as Adventure).steps);
    });

    it('keeps every generated adventure within the deterministic safety policy', async () => {
        const combinations: AdventurePreferences[] = [];
        for (const mood of ['relax', 'explore', 'move', 'connect', 'create'] as const) {
            for (const duration of ['15m', '30m', '60m', '120m'] as const) {
                for (const company of ['alone', 'friend', 'family', 'group'] as const) {
                    for (const energy of ['low', 'medium', 'high'] as const) {
                        combinations.push({ mood, duration, company, energy });
                    }
                }
            }
        }

        for (const preferences of combinations) {
            const generated = await generator.generate(preferences);
            const adventure = AdventureGenerationResponseSchema.parse({
                adventure: generated
            }).adventure;
            assert.deepEqual(
                validateAdventureSafety(adventure, preferences),
                [],
                JSON.stringify(preferences)
            );
        }
    });

    it('does not flag explicit cautions or hazard references outside step actions', () => {
        const cautiousAdventure = {
            ...validAdventure,
            premise: 'This is not medical advice; simply enjoy a small pause.',
            steps: [
                {
                    ...validAdventure.steps[0]!,
                    instruction:
                        'Do not cross a road or wade into a river; notice the colors from this public path.'
                }
            ],
            safetyNotes: ['Avoid climbing, roads, waterways, and specialized equipment.']
        };

        assert.deepEqual(validateAdventureSafety(cautiousAdventure, basePreferences), []);
    });

    it('allows safe observation of water from a public path while rejecting unsafe waterway use', () => {
        const safeObservation = {
            ...validAdventure,
            steps: [
                {
                    title: 'Notice the view',
                    instruction: 'Walk on the level public path and notice the pond from there.',
                    durationMinutes: 15
                }
            ]
        };
        assert.deepEqual(validateAdventureSafety(safeObservation, basePreferences), []);

        const unsafeWaterActivity = {
            ...validAdventure,
            steps: [
                {
                    title: 'Follow the bank',
                    instruction: 'Walk along the riverbank for a closer view.',
                    durationMinutes: 15
                }
            ]
        };
        const violations = validateAdventureSafety(unsafeWaterActivity, basePreferences);
        assert.equal(violations[0]?.code, 'UNSAFE_WATERWAY');
        assert.equal(violations[0]?.stepIndex, 0);
        assert.match(violations[0]?.matchedText ?? '', /walk along the riverbank/i);
    });

    it('does not let a caution in one step mask a hazard in a later step', () => {
        const mixedAdventure = {
            ...validAdventure,
            steps: [
                { title: 'A reminder', instruction: 'Avoid roads.', durationMinutes: 7 },
                { title: 'Walk', instruction: 'Walk along a road.', durationMinutes: 8 }
            ]
        };
        assert.ok(
            validateAdventureSafety(mixedAdventure, basePreferences).some(
                ({ code }) => code === 'ROAD_OR_TRAFFIC'
            )
        );
    });
});

describe('adventure endpoint validation and fallback', () => {
    it('serves a contract-valid, safe adventure for the posted preferences', async () => {
        const app = await createApp();
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: { ...basePreferences, mood: 'create', company: 'family' } }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-provider'], 'stub');
        const body = AdventureGenerationResponseSchema.parse(response.json());
        assert.match(body.adventure.steps[1]!.instruction, /family/i);
        assert.equal(
            validateAdventureSafety(body.adventure, {
                ...basePreferences,
                mood: 'create',
                company: 'family'
            }).length,
            0
        );
    });

    it('rejects invalid preferences before calling the generator', async () => {
        let called = false;
        const app = await createApp({
            generate: async () => {
                called = true;
                return validAdventure;
            }
        });
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: { ...basePreferences, energy: 'extreme' } }
        });

        assert.equal(response.statusCode, 400);
        assert.equal(response.json().error.code, 'INVALID_REQUEST');
        assert.equal(called, false);
    });

    it('uses the safe stub fallback after a provider failure without leaking details', async () => {
        const app = await createApp({
            providerName: 'test-provider',
            generate: async () => Promise.reject(new Error('private provider detail'))
        });
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: basePreferences }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-provider'], 'stub');
        assert.equal(response.headers['x-adventure-fallback'], 'true');
        assert.equal(response.body.includes('private provider detail'), false);
        assert.equal(validateAdventureSafety(response.json().adventure, basePreferences).length, 0);
    });

    it('replaces unsafe or malformed primary output with a safe fallback', async () => {
        const unsafe = {
            ...validAdventure,
            steps: [{ ...validAdventure.steps[0]!, instruction: 'Walk along a busy road.' }]
        };
        const app = await createApp({ generate: async () => unsafe });
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: basePreferences }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-fallback'], 'true');
        assert.equal(validateAdventureSafety(response.json().adventure, basePreferences).length, 0);
    });

    it('replaces output that fails the shared response schema', async () => {
        const app = await createApp({
            generate: async () => ({ title: 'missing required fields' })
        });
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: basePreferences }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-fallback'], 'true');
        assert.equal(AdventureGenerationResponseSchema.safeParse(response.json()).success, true);
    });

    it('returns a controlled error when both primary and fallback fail', async () => {
        const app = await createApp(
            { generate: async () => Promise.reject(new Error('primary secret')) },
            { generate: async () => ({ unsafe: true }) }
        );
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: basePreferences }
        });

        assert.equal(response.statusCode, 502);
        assert.equal(response.json().error.code, 'INVALID_GENERATOR_OUTPUT');
        assert.equal(response.body.includes('primary secret'), false);
    });
});

describe('Groq provider boundary', () => {
    const modelAdventure = {
        title: 'Notice the afternoon',
        premise: 'A gentle exploration in a familiar public garden.',
        activityType: 'sensory_walk',
        durationMinutes: 15,
        steps: [
            { title: 'Arrive', instruction: 'Notice a color nearby.', durationMinutes: 5 },
            {
                title: 'Look closer',
                instruction: 'Find a shape you had not noticed.',
                durationMinutes: 5
            },
            {
                title: 'Take it with you',
                instruction: 'Choose one detail to remember.',
                durationMinutes: 5
            }
        ],
        safetyNotes: ['Stay on a familiar, accessible public path.'],
        reflectionPrompt: 'What looked new today?'
    };

    it('sends the documented strict JSON Schema request and parses its completion', async () => {
        let requestUrl = '';
        let requestHeaders: HeadersInit | undefined;
        let requestBody: Record<string, unknown> | undefined;
        const generator = new GroqAdventureGenerator(
            'server-only-key',
            undefined,
            1_000,
            async (input, init) => {
                requestUrl = String(input);
                requestHeaders = init?.headers;
                requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
                return new Response(
                    JSON.stringify({
                        choices: [{ message: { content: JSON.stringify(modelAdventure) } }]
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                );
            }
        );
        const generated = await generator.generate(basePreferences);

        assert.equal(requestUrl, 'https://api.groq.com/openai/v1/chat/completions');
        assert.equal(new Headers(requestHeaders).get('authorization'), 'Bearer server-only-key');
        assert.equal(requestBody?.model, 'openai/gpt-oss-20b');
        assert.equal(requestBody?.reasoning_effort, 'low');
        assert.equal(requestBody?.max_completion_tokens, 2_048);
        const responseFormat = requestBody?.response_format as {
            type: string;
            json_schema: { strict: boolean; schema: Record<string, unknown> };
        };
        assert.equal(responseFormat.type, 'json_schema');
        assert.equal(responseFormat.json_schema.strict, true);
        assert.deepEqual(
            (responseFormat.json_schema.schema.properties as Record<string, { enum?: string[] }>)
                .activityType.enum,
            ['quiet_observation']
        );
        assert.deepEqual(
            (responseFormat.json_schema.schema.properties as Record<string, { enum?: number[] }>)
                .durationMinutes.enum,
            [15]
        );
        assertStrictJsonSchema(responseFormat.json_schema.schema);
        const generatedSchema = responseFormat.json_schema.schema;
        const generatedProperties = generatedSchema.properties as Record<string, unknown>;
        assert.equal(
            generatedProperties.title &&
                (generatedProperties.title as { maxLength: number }).maxLength,
            80
        );
        const stepSchema = generatedProperties.steps as {
            minItems: number;
            maxItems: number;
            items: { properties: Record<string, { minimum?: number; maximum?: number }> };
        };
        assert.equal(stepSchema.minItems, 1);
        assert.equal(stepSchema.maxItems, 8);
        assert.equal(stepSchema.items.properties.durationMinutes.minimum, 1);
        assert.equal(stepSchema.items.properties.durationMinutes.maximum, 120);
        assert.equal(
            AdventureGenerationResponseSchema.safeParse({ adventure: generated }).success,
            true
        );
    });

    it('preserves upstream 400, 401, and 429 categories and bounded error identifiers', async () => {
        for (const [status, category, code] of [
            [400, 'invalid_request', 'invalid_request_error'],
            [401, 'unauthorized', 'invalid_api_key'],
            [429, 'rate_or_quota_limit', 'rate_limit_exceeded']
        ] as const) {
            const generator = new GroqAdventureGenerator(
                'key',
                undefined,
                1_000,
                async () =>
                    new Response(
                        JSON.stringify({
                            error: { code, type: 'api_error', message: 'secret response text' }
                        }),
                        { status }
                    )
            );
            await assert.rejects(generator.generate(basePreferences), (error: unknown) => {
                assert.ok(error instanceof GroqProviderError);
                assert.equal(error.category, category);
                assert.equal(error.details.stage, 'upstream_response');
                assert.equal(error.details.upstreamStatus, status);
                assert.equal(error.details.upstreamCode, code);
                assert.equal(error.details.upstreamType, 'api_error');
                assert.equal(error.message.includes('secret response text'), false);
                return true;
            });
        }
    });

    it('distinguishes network errors, timeouts, malformed bodies, and invalid model JSON', async () => {
        const cases: Array<{
            fetcher: typeof fetch;
            category: string;
            stage: string;
        }> = [
            {
                fetcher: async () =>
                    Promise.reject(
                        new TypeError('private network detail', { cause: { code: 'ECONNRESET' } })
                    ),
                category: 'network_error',
                stage: 'http_request'
            },
            {
                fetcher: async () =>
                    Promise.reject(new DOMException('private timeout', 'TimeoutError')),
                category: 'timeout',
                stage: 'http_request'
            },
            {
                fetcher: async () => new Response('not json', { status: 200 }),
                category: 'malformed_http_response',
                stage: 'completion_parse'
            },
            {
                fetcher: async () =>
                    new Response(
                        JSON.stringify({ choices: [{ message: { content: '{bad json' } }] }),
                        { status: 200 }
                    ),
                category: 'invalid_model_json',
                stage: 'model_json_parse'
            },
            {
                fetcher: async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
                category: 'malformed_completion',
                stage: 'completion_parse'
            },
            {
                fetcher: async () =>
                    new Response(
                        JSON.stringify({
                            choices: [{ message: { content: '' }, finish_reason: 'length' }]
                        }),
                        { status: 200 }
                    ),
                category: 'completion_truncated',
                stage: 'completion_parse'
            },
            {
                fetcher: async () =>
                    new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
                        status: 200
                    }),
                category: 'empty_completion',
                stage: 'completion_parse'
            }
        ];

        for (const { fetcher, category, stage } of cases) {
            const generator = new GroqAdventureGenerator('key', undefined, 1_000, fetcher);
            await assert.rejects(generator.generate(basePreferences), (error: unknown) => {
                assert.ok(error instanceof GroqProviderError);
                assert.equal(error.category, category);
                assert.equal(error.details.stage, stage);
                assert.equal(error.message.includes('private'), false);
                if (category === 'network_error') {
                    assert.equal(error.details.networkType, 'TypeError');
                    assert.equal(error.details.networkCode, 'ECONNRESET');
                }
                return true;
            });
        }
    });

    it('uses the safe fallback when an inference request times out', async () => {
        const timeoutGenerator = new GroqAdventureGenerator('key', undefined, 1_000, async () =>
            Promise.reject(new DOMException('timeout detail', 'TimeoutError'))
        );
        const app = await createApp(timeoutGenerator);
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: basePreferences }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-provider'], 'stub');
        assert.equal(response.headers['x-adventure-fallback'], 'true');
        assert.equal(response.body.includes('timeout detail'), false);
    });

    it('reports Groq as the active provider when its generation succeeds', async () => {
        const groqGenerator = new GroqAdventureGenerator(
            'server-only-key',
            undefined,
            1_000,
            async () =>
                new Response(
                    JSON.stringify({
                        choices: [{ message: { content: JSON.stringify(modelAdventure) } }]
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
        );
        const app = await createApp(groqGenerator);
        const preferences = { ...basePreferences, mood: 'explore' as const };
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-provider'], 'groq');
        assert.equal(response.headers['x-adventure-fallback'], undefined);
        assert.equal(response.json().adventure.id.startsWith('stub-'), false);
    });

    it('falls back when valid model JSON fails the shared Zod response contract', async () => {
        const invalidAdventure = { ...modelAdventure, title: '' };
        const groqGenerator = new GroqAdventureGenerator(
            'server-only-key',
            undefined,
            1_000,
            async () =>
                new Response(
                    JSON.stringify({
                        choices: [{ message: { content: JSON.stringify(invalidAdventure) } }]
                    }),
                    { status: 200 }
                )
        );
        const app = await createApp(groqGenerator);
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: { ...basePreferences, mood: 'explore' } }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-provider'], 'stub');
        assert.equal(response.headers['x-adventure-fallback'], 'true');
        assert.equal(AdventureGenerationResponseSchema.safeParse(response.json()).success, true);
    });

    it('retries a schema-rejected generation once and returns the valid Groq result', async () => {
        let calls = 0;
        let retryContent = '';
        const groqGenerator = new GroqAdventureGenerator(
            'server-only-key',
            undefined,
            1_000,
            async (_input, init) => {
                calls += 1;
                const body = JSON.parse(String(init?.body)) as {
                    messages: Array<{ role: string; content: string }>;
                };
                if (calls === 2) retryContent = body.messages[1]!.content;
                const output =
                    calls === 1
                        ? {
                              ...modelAdventure,
                              steps: [
                                  { ...modelAdventure.steps[0], durationMinutes: 4 },
                                  ...modelAdventure.steps.slice(1)
                              ]
                          }
                        : modelAdventure;
                return new Response(
                    JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }),
                    { status: 200 }
                );
            }
        );
        const app = await createApp(groqGenerator);
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: { ...basePreferences, mood: 'explore' } }
        });

        assert.equal(calls, 2);
        assert.match(retryContent, /step_duration_total at adventure\.steps/);
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-provider'], 'groq');
        assert.equal(response.headers['x-adventure-fallback'], undefined);
    });

    it('rejects missing step fields after the one retry and safely falls back', async () => {
        let calls = 0;
        const incomplete = {
            ...modelAdventure,
            steps: [{ title: 'Notice', durationMinutes: 15 }]
        };
        const groqGenerator = new GroqAdventureGenerator('key', undefined, 1_000, async () => {
            calls += 1;
            return new Response(
                JSON.stringify({ choices: [{ message: { content: JSON.stringify(incomplete) } }] }),
                { status: 200 }
            );
        });
        const app = await createApp(groqGenerator);
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: { ...basePreferences, mood: 'explore' } }
        });

        assert.equal(calls, 2);
        assert.equal(response.headers['x-adventure-provider'], 'stub');
        assert.equal(response.headers['x-adventure-fallback'], 'true');
        assert.equal(AdventureGenerationResponseSchema.safeParse(response.json()).success, true);
    });

    it('rejects an activity type that does not match the requested mood', async () => {
        const mismatched = { ...modelAdventure, activityType: 'quiet_observation' };
        const groqGenerator = new GroqAdventureGenerator(
            'key',
            undefined,
            1_000,
            async () =>
                new Response(
                    JSON.stringify({
                        choices: [{ message: { content: JSON.stringify(mismatched) } }]
                    }),
                    { status: 200 }
                )
        );
        const app = await createApp(groqGenerator);
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: { ...basePreferences, mood: 'explore' } }
        });

        assert.equal(response.headers['x-adventure-provider'], 'stub');
        assert.equal(response.headers['x-adventure-fallback'], 'true');
        assert.equal(
            validateAdventureSafety(response.json().adventure, {
                ...basePreferences,
                mood: 'explore'
            }).length,
            0
        );
    });

    it('retries an unsafe result once, then uses the safe stub and accurate headers', async () => {
        let calls = 0;
        const groqGenerator = new GroqAdventureGenerator(
            'server-only-key',
            undefined,
            1_000,
            async (_input, init) => {
                calls += 1;
                const body = JSON.parse(String(init?.body)) as {
                    messages: Array<{ role: string; content: string }>;
                };
                if (calls === 2) assert.match(body.messages[1]!.content, /UNSAFE_WATERWAY/);
                const output = {
                    ...modelAdventure,
                    steps: [
                        {
                            title: 'Walk to the Pond',
                            instruction: 'Walk to the pond along the path.',
                            durationMinutes: 15
                        }
                    ]
                };
                return new Response(
                    JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }),
                    { status: 200 }
                );
            }
        );
        const app = await createApp(groqGenerator);
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: { ...basePreferences, mood: 'explore' } }
        });

        assert.equal(calls, 2);
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-provider'], 'stub');
        assert.equal(response.headers['x-adventure-fallback'], 'true');
        assert.equal(AdventureGenerationResponseSchema.safeParse(response.json()).success, true);
        assert.equal(
            validateAdventureSafety(response.json().adventure, {
                ...basePreferences,
                mood: 'explore'
            }).length,
            0
        );
    });

    it('does not retry upstream provider failures', async () => {
        let calls = 0;
        const groqGenerator = new GroqAdventureGenerator('key', undefined, 1_000, async () => {
            calls += 1;
            return new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded' } }), {
                status: 429
            });
        });
        const app = await createApp(groqGenerator);
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences: basePreferences }
        });
        assert.equal(calls, 1);
        assert.equal(response.headers['x-adventure-provider'], 'stub');
        assert.equal(response.headers['x-adventure-fallback'], 'true');
    });

    it('falls back for a genuinely unsafe model activity and preserves provider headers', async () => {
        const unsafe = {
            ...modelAdventure,
            steps: [
                {
                    title: 'Cross the street',
                    instruction: 'Walk across a busy road.',
                    durationMinutes: 15
                }
            ]
        };
        const groqGenerator = new GroqAdventureGenerator(
            'server-only-key',
            undefined,
            1_000,
            async () =>
                new Response(
                    JSON.stringify({
                        choices: [{ message: { content: JSON.stringify(unsafe) } }]
                    }),
                    { status: 200 }
                )
        );
        const app = await createApp(groqGenerator);
        const preferences = { ...basePreferences, mood: 'explore' as const };
        const response = await app.inject({
            method: 'POST',
            url: '/api/adventures',
            payload: { preferences }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-adventure-provider'], 'stub');
        assert.equal(response.headers['x-adventure-fallback'], 'true');
        assert.equal(validateAdventureSafety(response.json().adventure, preferences).length, 0);
    });

    it('selects stub explicitly and fails clearly if Groq has no key', () => {
        assert.throws(
            () => configureAdventureGenerator({ provider: 'groq' }),
            /GROQ_API_KEY is required when AI_PROVIDER=groq/
        );
        assert.equal(
            configureAdventureGenerator({ provider: 'stub' }).generator.providerName,
            'stub'
        );
        assert.equal(
            configureAdventureGenerator({ provider: 'groq', apiKey: 'server-key' }).generator
                .providerName,
            'groq'
        );
    });
});
