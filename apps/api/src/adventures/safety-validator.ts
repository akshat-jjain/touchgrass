import type { Adventure, AdventurePreferences } from '@touchgrass/contracts';

export type AdventureSafetyViolationCode =
    | 'DURATION_MISMATCH'
    | 'STEP_DURATION_MISMATCH'
    | 'UNSUPPORTED_ACTIVITY'
    | 'MOOD_ACTIVITY_MISMATCH'
    | 'UNSAFE_LOCATION'
    | 'DANGEROUS_CLIMBING'
    | 'ROAD_OR_TRAFFIC'
    | 'UNSAFE_WATERWAY'
    | 'ISOLATED_LOCATION'
    | 'WILDLIFE_HANDLING'
    | 'FORAGING_OR_UNKNOWN_PLANTS'
    | 'DANGEROUS_NIGHTTIME'
    | 'SPECIALIZED_EQUIPMENT'
    | 'RISKY_CHALLENGE'
    | 'MEDICAL_OR_EMERGENCY_CLAIM';

export interface AdventureSafetyViolation {
    code: AdventureSafetyViolationCode;
    message: string;
    stepIndex?: number;
    matchedText?: string;
}

const durationMinutes: Record<AdventurePreferences['duration'], number> = {
    '15m': 15,
    '30m': 30,
    '60m': 60,
    '120m': 120
};

const allowedActivityTypes = new Set([
    'quiet_observation',
    'gentle_walk',
    'shared_noticing',
    'sensory_walk',
    'imaginative_creation'
]);

const activityForMood: Record<AdventurePreferences['mood'], Adventure['activityType']> = {
    relax: 'quiet_observation',
    explore: 'sensory_walk',
    move: 'gentle_walk',
    connect: 'shared_noticing',
    create: 'imaginative_creation'
};

const contentRules: Array<{
    code: AdventureSafetyViolationCode;
    message: string;
    pattern: RegExp;
}> = [
    {
        code: 'UNSAFE_LOCATION',
        message: 'Use public places; private property and trespassing are not allowed.',
        pattern:
            /\b(trespass(?:ing)?|private property|backyard|abandoned building|construction site|railway tracks?)\b/i
    },
    {
        code: 'DANGEROUS_CLIMBING',
        message: 'Climbing, rooftops, cliffs, and ledges are not allowed.',
        pattern: /\b(climb(?:ing)?|cliff(?:s)?|rooftop|roof|ledge|treehouse|steep rocks?)\b/i
    },
    {
        code: 'ROAD_OR_TRAFFIC',
        message: 'Roads and traffic cannot be part of an activity.',
        pattern:
            /\b(?:walk|run|play|cycle|race|cross|stand|wait|follow|travel)\b.{0,40}\b(?:road|street|traffic|highway|intersection|crosswalk|parking lot|car park)\b|\b(?:road|street|traffic|highway|intersection|crosswalk|parking lot|car park)\b.{0,40}\b(?:walk|run|play|cycle|race|cross|stand|wait|follow|travel)\b/i
    },
    {
        code: 'UNSAFE_WATERWAY',
        message: 'Activities at waterways and water hazards are not allowed.',
        pattern:
            /\b(?:swim|wade|enter|cross|play|step|paddle|launch|climb)\b.{0,40}\b(?:river|waterfall|lake|ocean|sea|stream|creek|canal|pond|reservoir|shoreline|riverbank|rapids|dam|dock|pier)\b|\b(?:river|waterfall|lake|ocean|sea|stream|creek|canal|pond|reservoir|shoreline|riverbank|rapids|dam|dock|pier)\b.{0,40}\b(?:swim|wade|enter|cross|play|step|paddle|launch|climb)\b|\b(?:walk|run|cycle|travel)\b.{0,16}\b(?:along|beside|alongside|toward|towards|into|to)\b.{0,16}\b(?:river|waterfall|lake|ocean|sea|stream|creek|canal|pond|reservoir|shoreline|riverbank|rapids|dam|dock|pier)\b|\b(?:walk|run|cycle|travel)\b.{0,16}\b(?:riverbank|shoreline|water edge|bank of (?:a |the )?(?:river|lake|stream|pond))\b/i
    },
    {
        code: 'ISOLATED_LOCATION',
        message: 'Choose a familiar, non-isolated public place.',
        pattern:
            /\b(remote|isolated|secluded|abandoned|deserted|backcountry|unlit|deep woods|no one nearby)\b/i
    },
    {
        code: 'WILDLIFE_HANDLING',
        message: 'Observe wildlife from a distance; do not approach, touch, or feed animals.',
        pattern:
            /\b(?:feed|touch|handle|pick up|approach|disturb)\b.{0,50}\b(?:wildlife|animals?|birds?|nests?|snakes?|squirrels?|insects?)\b|\b(?:wildlife|animals?|birds?|nests?|snakes?|squirrels?|insects?)\b.{0,50}\b(?:feed|touch|handle|pick up|approach|disturb)\b/i
    },
    {
        code: 'FORAGING_OR_UNKNOWN_PLANTS',
        message: 'Do not forage for, pick, taste, or eat unknown plants or fungi.',
        pattern:
            /\b(?:forag\w*|eat\w*|taste|sample|consume|pick)\b.{0,50}\b(?:wild\s+)?(?:plants?|berries|mushrooms?|fungi|herbs?|flowers?)\b|\b(?:unknown|wild)\s+(?:plants?|berries|mushrooms?|fungi)\b.{0,50}\b(?:eat|taste|sample|consume|pick)\b/i
    },
    {
        code: 'DANGEROUS_NIGHTTIME',
        message: 'Activities must take place in daylight, not after dark or in unlit places.',
        pattern:
            /\b(after dark|at night|nighttime|midnight|after sunset|before dawn|nightfall|unlit)\b/i
    },
    {
        code: 'SPECIALIZED_EQUIPMENT',
        message: 'The activity must not require specialized equipment.',
        pattern:
            /\b(?:bring|carry|use|wear|pack|need|requires?)\b.{0,35}\b(?:binoculars?|compass|rope|harness|helmet|knife|pocketknife|skates?|skateboard|bicycles?|bikes?|kayaks?|canoes?|tents?|flashlights?|headlamps?|walking poles|trekking poles|tripod|camera gear|climbing gear)\b|\b(?:binoculars?|compass|rope|harness|helmet|knife|pocketknife|skates?|skateboard|bicycles?|bikes?|kayaks?|canoes?|tents?|flashlights?|headlamps?|walking poles|trekking poles|tripod|camera gear|climbing gear)\b.{0,35}\b(?:bring|carry|use|wear|pack|need|requires?)\b/i
    },
    {
        code: 'RISKY_CHALLENGE',
        message: 'Dares and intentionally risky challenges are not allowed.',
        pattern:
            /\b(dare|push your limits|test your limits|extreme challenge|risky challenge|without looking|blindfold(?:ed)?|jump from|race across)\b/i
    },
    {
        code: 'MEDICAL_OR_EMERGENCY_CLAIM',
        message: 'Adventures must not make medical, treatment, or emergency claims.',
        pattern:
            /\b(cure|treat(?:ment)?|diagnos\w*|prevent(?:ion)?|therap(?:y|eutic)|emergency|first aid|heal(?:ing)?|medical advice|panic attack|depression)\b/i
    }
];

function findNonNegatedMatch(text: string, pattern: RegExp): string | undefined {
    for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
        const before = text.slice(Math.max(0, (match.index ?? 0) - 48), match.index ?? 0);
        if (
            /\b(?:do not|don't|never|avoid|without|no|no need to|not required|not at|not after)\b[^.!?]{0,42}$/i.test(
                before
            )
        ) {
            continue;
        }
        return match[0]?.slice(0, 80);
    }
    return undefined;
}

export function validateAdventureSafety(
    adventure: Adventure,
    preferences: AdventurePreferences
): AdventureSafetyViolation[] {
    const violations: AdventureSafetyViolation[] = [];
    const requestedDuration = durationMinutes[preferences.duration];
    const totalStepMinutes = adventure.steps.reduce(
        (total, step) => total + step.durationMinutes,
        0
    );

    if (adventure.durationMinutes !== requestedDuration) {
        violations.push({
            code: 'DURATION_MISMATCH',
            message: 'Adventure duration must match the requested duration.'
        });
    }

    if (totalStepMinutes !== requestedDuration || totalStepMinutes !== adventure.durationMinutes) {
        violations.push({
            code: 'STEP_DURATION_MISMATCH',
            message: 'Step durations must add up to the requested adventure duration.'
        });
    }

    if (!allowedActivityTypes.has(adventure.activityType)) {
        violations.push({
            code: 'UNSUPPORTED_ACTIVITY',
            message: 'This activity type is not in the safe activity allowlist.'
        });
    }

    if (adventure.activityType !== activityForMood[preferences.mood]) {
        violations.push({
            code: 'MOOD_ACTIVITY_MISMATCH',
            message: 'The activity type must match the requested mood.'
        });
    }

    for (const rule of contentRules) {
        for (const [stepIndex, step] of adventure.steps.entries()) {
            const matchedText = findNonNegatedMatch(
                `${step.title}\n${step.instruction}`,
                rule.pattern
            );
            if (matchedText) {
                violations.push({ code: rule.code, message: rule.message, stepIndex, matchedText });
                break;
            }
        }
    }

    return violations;
}
