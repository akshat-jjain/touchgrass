import {
    GroqAdventureGenerator,
    StubAdventureGenerator,
    type AdventureGenerator
} from './adventure-generator.js';

export interface AdventureGeneratorConfig {
    provider: 'stub' | 'groq';
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
}

export interface ConfiguredAdventureGenerator {
    generator: AdventureGenerator;
}

export function configureAdventureGenerator(
    config: AdventureGeneratorConfig
): ConfiguredAdventureGenerator {
    if (config.provider === 'stub') return { generator: new StubAdventureGenerator() };
    if (!config.apiKey?.trim()) {
        throw new Error('GROQ_API_KEY is required when AI_PROVIDER=groq');
    }

    return {
        generator: new GroqAdventureGenerator(config.apiKey, config.model, config.timeoutMs)
    };
}
