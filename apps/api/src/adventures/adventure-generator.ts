import { randomUUID } from 'node:crypto';
import type {
    AdventureActivityType,
    AdventurePreferences,
    AdventureStep
} from '@touchgrass/contracts';

export interface AdventureGenerator {
    readonly providerName?: string;
    generate(preferences: AdventurePreferences, retryGuidance?: string): Promise<unknown>;
}

interface ActivityCollection {
    activityType: AdventureActivityType;
    title: string;
    premise: string;
    prompts: readonly string[];
    reflections: Record<AdventurePreferences['company'], string>;
}

const durationMinutes: Record<AdventurePreferences['duration'], number> = {
    '15m': 15,
    '30m': 30,
    '60m': 60,
    '120m': 120
};

const durationSteps: Record<AdventurePreferences['duration'], readonly number[]> = {
    '15m': [5, 5, 5],
    '30m': [5, 10, 10, 5],
    '60m': [10, 15, 15, 10, 10],
    '120m': [20, 25, 25, 20, 15, 15]
};

const activityLibrary: Record<AdventurePreferences['mood'], ActivityCollection> = {
    relax: {
        activityType: 'quiet_observation',
        title: 'A Pocket of Stillness',
        premise:
            'Let one comfortable outdoor spot become a place to slow down and notice small things.',
        prompts: [
            'noticing a patch of light and letting your gaze rest there',
            'listening for the softest sound in your surroundings',
            'finding one small detail you had not noticed at first',
            'watching a nearby leaf or branch move in the breeze',
            'noticing the colors closest to where you are',
            'choosing one quiet detail to remember later'
        ],
        reflections: {
            alone: 'Which small detail helped the moment feel calmer?',
            friend: 'Which detail did you and your friend both notice?',
            family: 'Which detail did someone in your family point out?',
            group: 'Which quiet detail did your group notice together?'
        }
    },
    explore: {
        activityType: 'sensory_walk',
        title: 'A Familiar Place, Newly Seen',
        premise:
            'Explore a familiar public place through colors, shapes, and textures you might usually pass by.',
        prompts: [
            'spotting three different shapes in the things around you',
            'finding two shades of the same color nearby',
            'noticing how one surface looks different from another',
            'looking from a comfortable seated or standing height for a new angle',
            'noticing a pattern that repeats in your surroundings',
            'choosing the most surprising detail you found'
        ],
        reflections: {
            alone: 'What looked different once you gave it your attention?',
            friend: 'What did your friend notice that you had missed?',
            family: 'Which discovery did your family enjoy sharing?',
            group: 'Which discovery changed how your group saw the place?'
        }
    },
    move: {
        activityType: 'gentle_walk',
        title: 'An Easy Outdoor Loop',
        premise:
            'Take a comfortable loop on a familiar, accessible public path, with plenty of room to pause.',
        prompts: [
            'choosing a familiar, accessible public path or a comfortable spot to begin',
            'noticing a color along the path or from where you are resting',
            'pausing to listen for a sound before deciding whether to continue',
            'looking for an interesting shape as you take an optional short stroll',
            'pausing to notice what has changed in your surroundings',
            'returning toward your starting place at whatever pace feels right'
        ],
        reflections: {
            alone: 'What pace felt comfortable for you today?',
            friend: 'What part of the easy walk did you enjoy sharing?',
            family: 'What was a favorite moment from the family walk?',
            group: 'What did your group notice along the way?'
        }
    },
    connect: {
        activityType: 'shared_noticing',
        title: 'Notice Something Together',
        premise:
            'Share a low-pressure outdoor moment by taking turns noticing and comparing little details.',
        prompts: [
            'each choosing a color and sharing where you found it',
            'taking turns pointing out a shape that catches your attention',
            'sharing one sound you can hear from where you are',
            'finding two details that look different to each of you',
            'building a shared imaginary postcard from the colors around you',
            'each choosing one detail you would like to remember'
        ],
        reflections: {
            alone: 'What would you tell someone about this little outing?',
            friend: 'What was something new you learned about your friend?',
            family: 'Which shared detail might your family remember later?',
            group: 'What did someone else notice that widened your view?'
        }
    },
    create: {
        activityType: 'imaginative_creation',
        title: 'Make a Story from the Outside',
        premise:
            'Use the shapes and colors around you to invent something in your imagination; nothing needs to be collected.',
        prompts: [
            'imagining a name for a cloud, shape, or pattern you can see',
            'inventing a tiny story about two colors meeting',
            'finding a natural shape and imagining what it could become',
            'making up a title for the scene in front of you',
            'adding one gentle next line to the story you started',
            'choosing the part of your imagined story you like best'
        ],
        reflections: {
            alone: 'Which part of your imagined story would you keep?',
            friend: 'Which part of the story did you build together?',
            family: "What was your family's favorite story detail?",
            group: 'How did your group’s ideas change the story?'
        }
    }
};

const companyInstructions: Record<AdventurePreferences['company'], (prompt: string) => string> = {
    alone: (prompt) => `At your own pace, spend a moment ${prompt}.`,
    friend: (prompt) => `Take turns with a friend ${prompt}.`,
    family: (prompt) => `Invite everyone in your family to join you in ${prompt}.`,
    group: (prompt) => `As a group, compare what you notice while ${prompt}.`
};

const energyGuidance: Record<AdventurePreferences['energy'], string> = {
    low: 'Stay seated or standing comfortably; pause whenever you like.',
    medium: 'A gentle stroll on an accessible public path is optional; pauses are welcome.',
    high: 'Add an easy loop on the same accessible path at a conversational pace; pause anytime.'
};

function getSteps(
    preferences: AdventurePreferences,
    activity: ActivityCollection
): AdventureStep[] {
    return durationSteps[preferences.duration].map((minutes, index) => {
        const prompt = activity.prompts[index];
        if (!prompt) throw new Error('Activity template is missing a duration step.');

        return {
            title: [
                'Arrive and notice',
                'Look a little closer',
                'Find another detail',
                'Keep exploring',
                'Pause and reflect',
                'Bring it with you'
            ][index]!,
            instruction: `${companyInstructions[preferences.company](prompt)}${index === 0 ? ` ${energyGuidance[preferences.energy]}` : ''}`,
            durationMinutes: minutes
        };
    });
}

export class StubAdventureGenerator implements AdventureGenerator {
    readonly providerName = 'stub';

    async generate(preferences: AdventurePreferences) {
        const activity = activityLibrary[preferences.mood];
        return {
            id: `stub-${preferences.mood}-${preferences.duration}-${preferences.company}-${preferences.energy}`,
            title: activity.title,
            premise: `${activity.premise} This ${durationMinutes[preferences.duration]}-minute plan is shaped for ${preferences.company === 'alone' ? 'your own company' : preferences.company === 'friend' ? 'you and a friend' : preferences.company === 'family' ? 'your family' : 'your group'} and a ${preferences.energy} energy day.`,
            activityType: activity.activityType,
            durationMinutes: durationMinutes[preferences.duration],
            steps: getSteps(preferences, activity),
            safetyNotes: [
                'Stay in a familiar public place and use accessible paths or seating.',
                'Keep to a comfortable pace, skip anything that does not feel right, and bring no special equipment.'
            ],
            reflectionPrompt: activity.reflections[preferences.company]
        };
    }
}

export class GroqAdventureGenerator implements AdventureGenerator {
    readonly providerName = 'groq';

    constructor(
        private readonly apiKey: string,
        private readonly model = 'openai/gpt-oss-20b',
        private readonly timeoutMs = 15_000,
        private readonly fetcher: typeof fetch = fetch
    ) {}

    async generate(preferences: AdventurePreferences, retryGuidance?: string): Promise<unknown> {
        let response: Response;
        try {
            response = await this.fetcher('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${this.apiKey}`,
                    'content-type': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeoutMs),
                body: JSON.stringify({
                    model: this.model,
                    temperature: 0.6,
                    reasoning_effort: 'low',
                    max_completion_tokens: 2_048,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'Create one practical outdoor micro-adventure for the exact preferences provided. Use only the requested activity type and total duration. Choose a familiar, public, accessible place. Do not plan activities at, on, beside, near, or along roads, traffic, waterways, ponds, rivers, lakes, shorelines, or docks. Do not include climbing, heights, isolated places, nighttime activities, wildlife contact, foraging, specialized equipment, risky challenges, or medical/emergency claims. Do not mention any of those hazards or activities in the title, premise, or step titles/instructions. Steps must describe safe actions only. Put brief, practical safety guidance only in safetyNotes. Keep movement comfortable and optional. Make every step distinct, and make step durations positive integers that add exactly to the requested total. Every property is required; use 1 to 8 steps and meet all field length limits. Return the structured result only.'
                        },
                        {
                            role: 'user',
                            content: JSON.stringify({
                                preferences,
                                requiredActivityType: activityForMood[preferences.mood],
                                requiredDurationMinutes: durationMinutes[preferences.duration],
                                companyGuidance: {
                                    alone: 'independent, no partner needed',
                                    friend: 'shared with one friend',
                                    family: 'works across ages and offers a simple sit-out option',
                                    group: 'collaborative and easy for several people'
                                }[preferences.company],
                                energyGuidance: energyGuidance[preferences.energy],
                                correction: retryGuidance
                            })
                        }
                    ],
                    response_format: {
                        type: 'json_schema',
                        json_schema: {
                            name: 'touchgrass_adventure',
                            strict: true,
                            schema: makeAdventureJsonSchema(preferences)
                        }
                    }
                })
            });
        } catch (error) {
            const isTimeout =
                error instanceof Error &&
                (error.name === 'TimeoutError' || error.name === 'AbortError');
            const causeCode =
                error instanceof Error && isRecord(error.cause)
                    ? safeDiagnosticIdentifier(error.cause.code)
                    : undefined;
            throw new GroqProviderError(isTimeout ? 'timeout' : 'network_error', {
                stage: 'http_request',
                networkType:
                    error instanceof Error ? safeDiagnosticIdentifier(error.name) : undefined,
                networkCode: causeCode
            });
        }

        if (!response.ok) {
            const details = await readUpstreamError(response);
            const category =
                response.status === 400
                    ? 'invalid_request'
                    : response.status === 401
                      ? 'unauthorized'
                      : response.status === 429
                        ? 'rate_or_quota_limit'
                        : 'upstream_http_error';
            throw new GroqProviderError(category, {
                stage: 'upstream_response',
                upstreamStatus: response.status,
                upstreamCode: details.code,
                upstreamType: details.type
            });
        }

        let payload: unknown;
        try {
            payload = JSON.parse(await response.text()) as unknown;
        } catch {
            throw new GroqProviderError('malformed_http_response', { stage: 'completion_parse' });
        }

        if (!isRecord(payload) || !Array.isArray(payload.choices)) {
            throw new GroqProviderError('malformed_completion', { stage: 'completion_parse' });
        }
        const firstChoice = payload.choices[0];
        if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
            throw new GroqProviderError('malformed_completion', { stage: 'completion_parse' });
        }
        const content = firstChoice.message.content;
        if (firstChoice.finish_reason === 'length') {
            throw new GroqProviderError('completion_truncated', { stage: 'completion_parse' });
        }
        if (typeof content !== 'string' || content.trim().length === 0) {
            const category =
                typeof firstChoice.message.refusal === 'string'
                    ? 'model_refusal'
                    : 'empty_completion';
            throw new GroqProviderError(category, { stage: 'completion_parse' });
        }

        let adventure: unknown;
        try {
            adventure = JSON.parse(content);
        } catch {
            throw new GroqProviderError('invalid_model_json', { stage: 'model_json_parse' });
        }

        if (!isRecord(adventure)) {
            throw new GroqProviderError('invalid_model_json_shape', { stage: 'model_json_parse' });
        }
        return { ...adventure, id: `groq-${randomUUID()}` };
    }
}

export interface GroqProviderErrorDetails {
    stage: 'http_request' | 'upstream_response' | 'completion_parse' | 'model_json_parse';
    upstreamStatus?: number;
    upstreamCode?: string;
    upstreamType?: string;
    networkCode?: string;
    networkType?: string;
}

export class GroqProviderError extends Error {
    constructor(
        readonly category: string,
        readonly details: GroqProviderErrorDetails
    ) {
        super(`Groq request failed: ${category}`);
        this.name = 'GroqProviderError';
    }
}

function makeAdventureJsonSchema(preferences: AdventurePreferences) {
    const duration = durationMinutes[preferences.duration];
    const activityType = activityForMood[preferences.mood];
    return {
        type: 'object',
        properties: {
            title: { type: 'string', minLength: 1, maxLength: 80 },
            premise: { type: 'string', minLength: 1, maxLength: 240 },
            activityType: {
                type: 'string',
                enum: [activityType]
            },
            durationMinutes: { type: 'integer', enum: [duration], minimum: 15, maximum: 120 },
            steps: {
                type: 'array',
                minItems: 1,
                maxItems: 8,
                items: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', minLength: 1, maxLength: 60 },
                        instruction: { type: 'string', minLength: 1, maxLength: 280 },
                        durationMinutes: { type: 'integer', minimum: 1, maximum: 120 }
                    },
                    required: ['title', 'instruction', 'durationMinutes'],
                    additionalProperties: false
                }
            },
            safetyNotes: {
                type: 'array',
                minItems: 1,
                maxItems: 4,
                items: { type: 'string', minLength: 1, maxLength: 200 }
            },
            reflectionPrompt: { type: 'string', minLength: 1, maxLength: 180 }
        },
        required: [
            'title',
            'premise',
            'activityType',
            'durationMinutes',
            'steps',
            'safetyNotes',
            'reflectionPrompt'
        ],
        additionalProperties: false
    } as const;
}

const activityForMood: Record<AdventurePreferences['mood'], AdventureActivityType> = {
    relax: 'quiet_observation',
    explore: 'sensory_walk',
    move: 'gentle_walk',
    connect: 'shared_noticing',
    create: 'imaginative_creation'
};

async function readUpstreamError(response: Response): Promise<{ code?: string; type?: string }> {
    let payload: unknown;
    try {
        payload = JSON.parse((await response.text()).slice(0, 4_096)) as unknown;
    } catch {
        return {};
    }

    if (!isRecord(payload) || !isRecord(payload.error)) return {};
    return {
        code: safeDiagnosticIdentifier(payload.error.code),
        type: safeDiagnosticIdentifier(payload.error.type)
    };
}

function safeDiagnosticIdentifier(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const identifier = value.trim().slice(0, 64);
    return /^[A-Za-z0-9_.-]+$/.test(identifier) ? identifier : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
