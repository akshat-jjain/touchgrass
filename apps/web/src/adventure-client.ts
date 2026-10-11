import {
    AdventureGenerationRequestSchema,
    AdventureGenerationResponseSchema,
    ApiErrorResponseSchema,
    type Adventure,
    type AdventurePreferences
} from '@touchgrass/contracts';

export class AdventureApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AdventureApiError';
    }
}

export async function generateAdventure(
    preferences: AdventurePreferences,
    fetcher: typeof fetch = fetch
): Promise<Adventure> {
    const request = AdventureGenerationRequestSchema.parse({ preferences });
    let response: Response;

    try {
        response = await fetcher('/api/adventures', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(request)
        });
    } catch {
        throw new AdventureApiError(
            'We could not reach TouchGrass. Check your connection and try again.'
        );
    }

    let body: unknown;
    try {
        body = await response.json();
    } catch {
        throw new AdventureApiError(
            'TouchGrass returned an unreadable response. Please try again.'
        );
    }

    if (!response.ok) {
        const error = ApiErrorResponseSchema.safeParse(body);
        throw new AdventureApiError(
            error.success
                ? error.data.error.message
                : 'We could not make an adventure just now. Please try again.'
        );
    }

    const result = AdventureGenerationResponseSchema.safeParse(body);
    if (!result.success) {
        throw new AdventureApiError('TouchGrass returned an invalid adventure. Please try again.');
    }

    return result.data.adventure;
}
