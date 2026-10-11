import {
    AdventureGenerationResponseSchema,
    AdventurePreferencesSchema,
    type Adventure,
    type AdventurePreferences
} from '@touchgrass/contracts';

export const DEFAULT_PREFERENCES: AdventurePreferences = {
    mood: 'relax',
    duration: '15m',
    company: 'alone',
    energy: 'low'
};

const preferenceKey = 'touchgrass.preferences.v1';
const adventureKey = 'touchgrass.adventure.v1';
const outsideModeKey = 'touchgrass.outside-mode.v1';

export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function readJson(storage: StorageLike | undefined, key: string): unknown {
    try {
        const value = storage?.getItem(key);
        return value ? JSON.parse(value) : undefined;
    } catch {
        try {
            storage?.removeItem(key);
        } catch {
            // Storage can be disabled or full; in-memory app state remains usable.
        }
        return undefined;
    }
}

function remove(storage: StorageLike | undefined, key: string): void {
    try {
        storage?.removeItem(key);
    } catch {
        // Storage can be disabled; invalid values are ignored for this session.
    }
}

function write(storage: StorageLike | undefined, key: string, value: unknown): void {
    try {
        storage?.setItem(key, JSON.stringify(value));
    } catch {
        // Storage can be disabled or full; the current session still works.
    }
}

export function loadPreferences(storage: StorageLike | undefined): AdventurePreferences {
    const value = readJson(storage, preferenceKey);
    const parsed = AdventurePreferencesSchema.safeParse(value);
    if (!parsed.success) {
        if (value !== undefined) remove(storage, preferenceKey);
        return DEFAULT_PREFERENCES;
    }
    return parsed.data;
}

export function loadAdventure(storage: StorageLike | undefined): Adventure | null {
    const value = readJson(storage, adventureKey);
    if (value === undefined) return null;

    const parsed = AdventureGenerationResponseSchema.safeParse({ adventure: value });
    if (!parsed.success) {
        remove(storage, adventureKey);
        return null;
    }
    return parsed.data.adventure;
}

export function loadOutsideMode(storage: StorageLike | undefined, hasAdventure: boolean): boolean {
    const value = readJson(storage, outsideModeKey);
    const active = value === true && hasAdventure;
    if (value !== undefined && (!active || typeof value !== 'boolean'))
        remove(storage, outsideModeKey);
    return active;
}

export function savePreferences(
    storage: StorageLike | undefined,
    preferences: AdventurePreferences
) {
    write(storage, preferenceKey, preferences);
}

export function saveAdventure(storage: StorageLike | undefined, adventure: Adventure) {
    write(storage, adventureKey, adventure);
}

export function saveOutsideMode(storage: StorageLike | undefined, active: boolean) {
    write(storage, outsideModeKey, active);
}
