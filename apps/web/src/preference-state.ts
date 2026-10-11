import { AdventurePreferencesSchema, type AdventurePreferences } from '@touchgrass/contracts';

export function setPreference<K extends keyof AdventurePreferences>(
    current: AdventurePreferences,
    field: K,
    value: AdventurePreferences[K]
): AdventurePreferences {
    return AdventurePreferencesSchema.parse({ ...current, [field]: value });
}
