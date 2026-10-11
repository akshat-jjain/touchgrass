import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Adventure, type AdventurePreferences } from '@touchgrass/contracts';
import { AdventureApiError, generateAdventure } from '../src/adventure-client.js';
import {
    DEFAULT_PREFERENCES,
    loadAdventure,
    loadOutsideMode,
    loadPreferences,
    saveAdventure,
    saveOutsideMode,
    savePreferences,
    type StorageLike
} from '../src/persistence.js';
import { setPreference } from '../src/preference-state.js';
import { transitionScreen } from '../src/screen-state.js';

class MemoryStorage implements StorageLike {
    private readonly values = new Map<string, string>();

    getItem(key: string) {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.values.set(key, value);
    }

    removeItem(key: string) {
        this.values.delete(key);
    }
}

const preferences: AdventurePreferences = {
    mood: 'explore',
    duration: '30m',
    company: 'friend',
    energy: 'medium'
};

const adventure: Adventure = {
    id: 'sample',
    title: 'A familiar place, newly seen',
    premise: 'A gentle invitation to notice what is around you.',
    activityType: 'sensory_walk',
    durationMinutes: 15,
    steps: [{ title: 'Pause', instruction: 'Notice one color nearby.', durationMinutes: 15 }],
    safetyNotes: ['Stay in a familiar public place.'],
    reflectionPrompt: 'What did you notice?'
};

function okResponse(payload: unknown) {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    });
}

describe('frontend preferences and API', () => {
    it('updates a selected preference while preserving API enum values', () => {
        const selected = setPreference(DEFAULT_PREFERENCES, 'mood', 'create');
        assert.deepEqual(selected, { ...DEFAULT_PREFERENCES, mood: 'create' });
        assert.equal(setPreference(selected, 'duration', '120m').duration, '120m');
    });

    it('posts preferences and accepts a contract-valid adventure', async () => {
        let capturedUrl = '';
        let capturedBody = '';
        const result = await generateAdventure(preferences, async (input, init) => {
            capturedUrl = String(input);
            capturedBody = String(init?.body);
            return okResponse({ adventure });
        });

        assert.equal(capturedUrl, '/api/adventures');
        assert.deepEqual(JSON.parse(capturedBody), { preferences });
        assert.deepEqual(result, adventure);
    });

    it('reports API and network failures with a useful safe message', async () => {
        await assert.rejects(
            generateAdventure(
                preferences,
                async () =>
                    new Response(
                        JSON.stringify({
                            error: { code: 'GENERATOR_UNAVAILABLE', message: 'Try again shortly.' }
                        }),
                        {
                            status: 503,
                            headers: { 'content-type': 'application/json' }
                        }
                    )
            ),
            (error: unknown) =>
                error instanceof AdventureApiError && error.message === 'Try again shortly.'
        );
        await assert.rejects(
            generateAdventure(preferences, async () => Promise.reject(new Error('offline'))),
            (error: unknown) =>
                error instanceof AdventureApiError && error.message.includes('connection')
        );
    });

    it('rejects malformed successful API responses', async () => {
        await assert.rejects(
            generateAdventure(preferences, async () =>
                okResponse({ adventure: { title: 'incomplete' } })
            ),
            (error: unknown) =>
                error instanceof AdventureApiError && error.message.includes('invalid adventure')
        );
    });
});

describe('localStorage recovery', () => {
    it('uses defaults when preferences are missing', () => {
        assert.deepEqual(loadPreferences(new MemoryStorage()), DEFAULT_PREFERENCES);
    });

    it('clears malformed and outdated persisted values safely', () => {
        const storage = new MemoryStorage();
        storage.setItem('touchgrass.preferences.v1', '{bad json');
        storage.setItem('touchgrass.adventure.v1', JSON.stringify({ title: 'old shape' }));
        storage.setItem('touchgrass.outside-mode.v1', 'true');

        assert.deepEqual(loadPreferences(storage), DEFAULT_PREFERENCES);
        assert.equal(loadAdventure(storage), null);
        assert.equal(loadOutsideMode(storage, false), false);
        assert.equal(storage.getItem('touchgrass.preferences.v1'), null);
        assert.equal(storage.getItem('touchgrass.adventure.v1'), null);
        assert.equal(storage.getItem('touchgrass.outside-mode.v1'), null);
    });

    it('round-trips valid preferences, adventures, and outside-mode state', () => {
        const storage = new MemoryStorage();
        savePreferences(storage, preferences);
        saveAdventure(storage, adventure);
        saveOutsideMode(storage, true);

        assert.deepEqual(loadPreferences(storage), preferences);
        assert.deepEqual(loadAdventure(storage), adventure);
        assert.equal(loadOutsideMode(storage, true), true);
    });

    it('falls back to memory when storage is unavailable', () => {
        const blockedStorage: StorageLike = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            },
            removeItem: () => {
                throw new Error('blocked');
            }
        };
        savePreferences(blockedStorage, preferences);
        assert.deepEqual(loadPreferences(blockedStorage), DEFAULT_PREFERENCES);
    });
});

describe('outside mode transitions', () => {
    it('moves from preferences to result to outside mode and back when finished', () => {
        const resultScreen = transitionScreen('preferences', 'adventure-ready');
        const outsideScreen = transitionScreen(resultScreen, 'start');
        const finishedScreen = transitionScreen(outsideScreen, 'finish');

        assert.equal(resultScreen, 'result');
        assert.equal(outsideScreen, 'outside');
        assert.equal(finishedScreen, 'result');
    });
});
