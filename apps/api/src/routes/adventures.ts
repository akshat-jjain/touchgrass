import {
    AdventureGenerationRequestSchema,
    AdventureGenerationResponseSchema,
    ApiErrorResponseSchema,
    type Adventure,
    type AdventurePreferences
} from '@touchgrass/contracts';
import type { FastifyInstance } from 'fastify';
import { GroqProviderError, type AdventureGenerator } from '../adventures/adventure-generator.js';
import { StubAdventureGenerator } from '../adventures/adventure-generator.js';
import { validateAdventureSafety } from '../adventures/safety-validator.js';

function apiError(code: string, message: string) {
    return ApiErrorResponseSchema.parse({ error: { code, message } });
}

export async function registerAdventureRoutes(
    app: FastifyInstance,
    generator: AdventureGenerator,
    fallback: AdventureGenerator = new StubAdventureGenerator()
): Promise<void> {
    app.post('/api/adventures', async (request, reply) => {
        const requestResult = AdventureGenerationRequestSchema.safeParse(request.body);
        if (!requestResult.success) {
            return reply
                .status(400)
                .send(
                    apiError(
                        'INVALID_REQUEST',
                        'Preferences do not match the adventure request contract.'
                    )
                );
        }

        const preferences: AdventurePreferences = requestResult.data.preferences;
        let primary = await generateSafeAdventure(generator, preferences);
        if (primary.adventure) {
            reply.header('x-adventure-provider', generator.providerName ?? 'custom');
            return reply.status(200).send({ adventure: primary.adventure });
        }

        if (isCorrectableRejection(primary.failure)) {
            request.log.warn(
                { provider: generator.providerName ?? 'custom', ...primary.failure },
                'Primary adventure output rejected; requesting one bounded correction.'
            );
            primary = await generateSafeAdventure(
                generator,
                preferences,
                createRetryGuidance(primary.failure)
            );
            if (primary.adventure) {
                reply.header('x-adventure-provider', generator.providerName ?? 'custom');
                return reply.status(200).send({ adventure: primary.adventure });
            }
        }

        request.log.warn(
            { provider: generator.providerName ?? 'custom', ...primary.failure },
            'Primary adventure generator did not produce safe output; using fallback.'
        );

        const backup = await generateSafeAdventure(fallback, preferences);
        if (backup.adventure) {
            reply.header('x-adventure-provider', fallback.providerName ?? 'custom');
            reply.header('x-adventure-fallback', 'true');
            return reply.status(200).send({ adventure: backup.adventure });
        }

        request.log.error(
            { fallback: fallback.providerName ?? 'custom', ...backup.failure },
            'Adventure fallback failed validation.'
        );
        return reply
            .status(502)
            .send(
                apiError(
                    backup.failure.category === 'safety_rules_rejected'
                        ? 'UNSAFE_ADVENTURE'
                        : 'INVALID_GENERATOR_OUTPUT',
                    'A safe adventure could not be generated. Please try again.'
                )
            );
    });
}

async function generateSafeAdventure(
    generator: AdventureGenerator,
    preferences: AdventurePreferences,
    retryGuidance?: string
): Promise<
    | { adventure: Adventure; failure?: never }
    | {
          adventure?: never;
          failure: {
              stage: string;
              category: string;
              upstreamStatus?: number;
              upstreamCode?: string;
              upstreamType?: string;
              networkCode?: string;
              networkType?: string;
              schemaIssues?: Array<{
                  code: string;
                  path: Array<string | number>;
                  constraintType: string;
              }>;
              safetyRules?: Array<{ code: string; stepIndex?: number; matchedText?: string }>;
          };
      }
> {
    let generated: unknown;
    try {
        generated = await generator.generate(preferences, retryGuidance);
    } catch (error) {
        if (error instanceof GroqProviderError) {
            return {
                failure: {
                    stage: error.details.stage,
                    category: error.category,
                    upstreamStatus: error.details.upstreamStatus,
                    upstreamCode: error.details.upstreamCode,
                    upstreamType: error.details.upstreamType,
                    networkCode: error.details.networkCode,
                    networkType: error.details.networkType
                }
            };
        }
        return {
            failure: {
                stage: 'generator',
                category:
                    error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)
                        ? error.name
                        : 'unknown_error'
            }
        };
    }

    const responseResult = AdventureGenerationResponseSchema.safeParse({ adventure: generated });
    if (!responseResult.success) {
        return {
            failure: {
                stage: 'response_validation',
                category: 'shared_contract_rejected',
                schemaIssues: responseResult.error.issues.slice(0, 8).map((issue) => ({
                    code: issue.code,
                    path: issue.path
                        .slice(0, 8)
                        .map((part) =>
                            typeof part === 'number' ? part : String(part).slice(0, 48)
                        ),
                    constraintType: getConstraintType(issue)
                }))
            }
        };
    }

    const adventure = responseResult.data.adventure;
    const violations = validateAdventureSafety(adventure, preferences);
    if (violations.length > 0) {
        return {
            failure: {
                stage: 'safety_validation',
                category: 'safety_rules_rejected',
                safetyRules: violations.map(({ code, stepIndex, matchedText }) => ({
                    code,
                    stepIndex,
                    matchedText
                }))
            }
        };
    }
    return { adventure };
}

function getConstraintType(issue: { code: string; path: PropertyKey[] }): string {
    if (issue.code === 'custom' && issue.path.at(-1) === 'steps') {
        return 'step_duration_total';
    }
    if (issue.code === 'too_small') return 'minimum';
    if (issue.code === 'too_big') return 'maximum';
    if (issue.code === 'invalid_type') return 'expected_type';
    if (issue.code === 'invalid_value') return 'allowed_value';
    if (issue.code === 'unrecognized_keys') return 'no_extra_fields';
    return 'schema_constraint';
}

function isCorrectableRejection(failure: { stage: string }): boolean {
    return failure.stage === 'response_validation' || failure.stage === 'safety_validation';
}

function createRetryGuidance(failure: {
    stage: string;
    schemaIssues?: Array<{ code: string; path: Array<string | number>; constraintType: string }>;
    safetyRules?: Array<{ code: string; stepIndex?: number }>;
}): string {
    if (failure.stage === 'response_validation') {
        return `Correct these contract violations: ${failure.schemaIssues
            ?.map((issue) => `${issue.constraintType} at ${issue.path.join('.')}`)
            .slice(0, 8)
            .join('; ')}`;
    }
    return `Replace the rejected activity content. These safety rules were violated: ${failure.safetyRules
        ?.map(
            ({ code, stepIndex }) =>
                `${code}${stepIndex === undefined ? '' : ` at step ${stepIndex}`}`
        )
        .slice(0, 8)
        .join('; ')}. Do not include any water-adjacent route or water contact.`;
}
