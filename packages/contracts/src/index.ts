import { z } from 'zod';

export const HealthResponseSchema = z
    .object({
        status: z.literal('ok'),
        service: z.literal('touchgrass-api')
    })
    .strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const AdventurePreferencesSchema = z
    .object({
        mood: z.enum(['relax', 'explore', 'move', 'connect', 'create']),
        duration: z.enum(['15m', '30m', '60m', '120m']),
        company: z.enum(['alone', 'friend', 'family', 'group']),
        energy: z.enum(['low', 'medium', 'high'])
    })
    .strict();

export type AdventurePreferences = z.infer<typeof AdventurePreferencesSchema>;

export const AdventureActivityTypeSchema = z.enum([
    'quiet_observation',
    'gentle_walk',
    'shared_noticing',
    'sensory_walk',
    'imaginative_creation'
]);

export type AdventureActivityType = z.infer<typeof AdventureActivityTypeSchema>;

export const AdventureDurationMinutesSchema = z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(120)
]);

export const AdventureStepSchema = z
    .object({
        title: z.string().trim().min(1).max(60),
        instruction: z.string().trim().min(1).max(280),
        durationMinutes: z.number().int().min(1).max(120)
    })
    .strict();

export const AdventureSchema = z
    .object({
        id: z.string().min(1).max(120),
        title: z.string().trim().min(1).max(80),
        premise: z.string().trim().min(1).max(240),
        activityType: AdventureActivityTypeSchema,
        durationMinutes: AdventureDurationMinutesSchema,
        steps: z.array(AdventureStepSchema).min(1).max(8),
        safetyNotes: z.array(z.string().trim().min(1).max(200)).min(1).max(4),
        reflectionPrompt: z.string().trim().min(1).max(180)
    })
    .strict()
    .superRefine((adventure, context) => {
        const stepDuration = adventure.steps.reduce(
            (total, step) => total + step.durationMinutes,
            0
        );
        if (stepDuration !== adventure.durationMinutes) {
            context.addIssue({
                code: 'custom',
                path: ['steps'],
                message: 'Step durations must add up to the adventure duration.'
            });
        }
    });

export type AdventureStep = z.infer<typeof AdventureStepSchema>;
export type Adventure = z.infer<typeof AdventureSchema>;

export const AdventureGenerationRequestSchema = z
    .object({ preferences: AdventurePreferencesSchema })
    .strict();

export type AdventureGenerationRequest = z.infer<typeof AdventureGenerationRequestSchema>;

export const AdventureGenerationResponseSchema = z.object({ adventure: AdventureSchema }).strict();

export type AdventureGenerationResponse = z.infer<typeof AdventureGenerationResponseSchema>;

export const ApiErrorCodeSchema = z.enum([
    'INVALID_REQUEST',
    'GENERATOR_UNAVAILABLE',
    'INVALID_GENERATOR_OUTPUT',
    'UNSAFE_ADVENTURE',
    'NOT_FOUND',
    'BAD_REQUEST',
    'INTERNAL_SERVER_ERROR'
]);

export const ApiErrorResponseSchema = z
    .object({
        error: z
            .object({
                code: ApiErrorCodeSchema,
                message: z.string().min(1).max(200)
            })
            .strict()
    })
    .strict();

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
