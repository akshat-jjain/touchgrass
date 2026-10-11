import { useState } from 'react';
import type { Adventure, AdventurePreferences } from '@touchgrass/contracts';
import { AdventureApiError, generateAdventure } from './adventure-client.js';
import {
    loadAdventure,
    loadOutsideMode,
    loadPreferences,
    saveAdventure,
    saveOutsideMode,
    savePreferences
} from './persistence.js';
import { setPreference } from './preference-state.js';
import { transitionScreen, type AppScreen } from './screen-state.js';

type PreferenceField = keyof AdventurePreferences;

const moodOptions = [
    { value: 'relax', label: 'Unwind', detail: 'Make room for a slower moment.' },
    { value: 'explore', label: 'Notice', detail: 'See a familiar place in a new way.' },
    { value: 'move', label: 'Move', detail: 'Take an easy, comfortable walk.' },
    { value: 'connect', label: 'Connect', detail: 'Share a small moment together.' },
    { value: 'create', label: 'Imagine', detail: 'Find a story in what is around you.' }
] as const;

const durationOptions = [
    { value: '15m', label: '15 min' },
    { value: '30m', label: '30 min' },
    { value: '60m', label: '1 hour' },
    { value: '120m', label: '2 hours' }
] as const;

const companyOptions = [
    { value: 'alone', label: 'Just me', detail: 'A little time to yourself.' },
    { value: 'friend', label: 'A friend', detail: 'Bring someone you enjoy.' },
    { value: 'family', label: 'Family', detail: 'A simple outing for all ages.' },
    { value: 'group', label: 'A group', detail: 'Make it a shared moment.' }
] as const;

const energyOptions = [
    { value: 'low', label: 'Gentle', detail: 'Keep it easy and unhurried.' },
    { value: 'medium', label: 'Steady', detail: 'A comfortable bit of movement.' },
    { value: 'high', label: 'Up for more', detail: 'Keep moving at your own pace.' }
] as const;

function getStorage(): Storage | undefined {
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}

const storage = getStorage();

function Brand() {
    return (
        <a className="brand" href="/" aria-label="TouchGrass home">
            <span className="brand-mark" aria-hidden="true">
                tg
            </span>
            <span>touchgrass</span>
        </a>
    );
}

function LeafMark() {
    return (
        <svg className="leaf-mark" viewBox="0 0 88 88" fill="none" aria-hidden="true">
            <path d="M72 15C43 15 21 25 17 48c-3 16 12 27 26 19C64 55 72 15 72 15Z" />
            <path d="M19 73c11-17 23-29 42-42" />
            <path d="M37 53c-1-8-5-14-12-19M50 41c7 0 13 2 18 7" />
        </svg>
    );
}

export function App() {
    const [initial] = useState(() => {
        const adventure = loadAdventure(storage);
        const outside = loadOutsideMode(storage, adventure !== null);
        return {
            adventure,
            screen: (outside ? 'outside' : adventure ? 'result' : 'preferences') as AppScreen
        };
    });
    const [preferences, setPreferences] = useState(() => loadPreferences(storage));
    const [adventure, setAdventure] = useState<Adventure | null>(initial.adventure);
    const [screen, setScreen] = useState<AppScreen>(initial.screen);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stepIndex, setStepIndex] = useState(0);

    function updatePreference<K extends PreferenceField>(field: K, value: AdventurePreferences[K]) {
        const next = setPreference(preferences, field, value);
        setPreferences(next);
        savePreferences(storage, next);
    }

    async function requestAdventure() {
        setLoading(true);
        setError(null);
        try {
            const result = await generateAdventure(preferences);
            setAdventure(result);
            saveAdventure(storage, result);
            saveOutsideMode(storage, false);
            setStepIndex(0);
            setScreen((current) => transitionScreen(current, 'adventure-ready'));
        } catch (caught) {
            setError(
                caught instanceof AdventureApiError
                    ? caught.message
                    : 'Something went wrong. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    }

    function showPreferences() {
        setError(null);
        saveOutsideMode(storage, false);
        setScreen((current) => transitionScreen(current, 'edit'));
    }

    function startAdventure() {
        setStepIndex(0);
        saveOutsideMode(storage, true);
        setScreen((current) => transitionScreen(current, 'start'));
    }

    function finishAdventure() {
        saveOutsideMode(storage, false);
        setScreen((current) => transitionScreen(current, 'finish'));
    }

    if (screen === 'outside' && adventure) {
        const step = adventure.steps[stepIndex];
        return (
            <main className="outside-shell">
                <div className="outside-topline">
                    <span className="outside-label">
                        <span className="sun-dot" /> OUTSIDE MODE
                    </span>
                    <span>{adventure.durationMinutes} minutes</span>
                </div>
                <section className="outside-content" aria-labelledby="outside-title">
                    <p className="eyebrow">A little time outdoors</p>
                    <h1 id="outside-title">{adventure.title}</h1>
                    {step ? (
                        <article className="current-step" aria-live="polite">
                            <p className="step-count">
                                STEP {String(stepIndex + 1).padStart(2, '0')} <span>·</span>{' '}
                                {step.durationMinutes} MIN
                            </p>
                            <h2>{step.title}</h2>
                            <p>{step.instruction}</p>
                        </article>
                    ) : null}
                    <p className="phone-away">
                        You have what you need. Put your phone away and enjoy being here.
                    </p>
                    <div className="outside-actions">
                        {stepIndex < adventure.steps.length - 1 ? (
                            <button
                                className="button button-primary button-large"
                                onClick={() => setStepIndex((index) => index + 1)}
                            >
                                Next step <span aria-hidden="true">→</span>
                            </button>
                        ) : (
                            <button
                                className="button button-primary button-large"
                                onClick={finishAdventure}
                            >
                                Finish adventure
                            </button>
                        )}
                        <button className="button button-quiet" onClick={finishAdventure}>
                            Finish early
                        </button>
                    </div>
                </section>
                <footer className="outside-footer">No need to check back. Take your time.</footer>
            </main>
        );
    }

    return (
        <div className="site-shell">
            <header className="site-header">
                <Brand />
                <span className="header-note">A small invitation to step outside</span>
            </header>

            {screen === 'preferences' || !adventure ? (
                <main className="choose-layout">
                    <section className="intro-panel" aria-labelledby="page-title">
                        <div className="intro-copy">
                            <p className="eyebrow">
                                <span className="sun-dot" /> YOUR DAY, OUTSIDE
                            </p>
                            <h1 id="page-title">
                                A little outside,
                                <br />
                                <em>a little more alive.</em>
                            </h1>
                            <p className="intro-text">
                                Tell us what feels right. We’ll find you a small reason to step out.
                            </p>
                            <div className="promise">
                                <LeafMark />
                                <p>
                                    An AI that wants you
                                    <br />
                                    to stop using it.
                                </p>
                            </div>
                        </div>
                        <div className="landscape-art" aria-hidden="true">
                            <div className="sun-disc" />
                            <div className="hill hill-back" />
                            <div className="hill hill-front" />
                            <div className="art-caption">A softer kind of screen time</div>
                        </div>
                    </section>

                    <section className="form-panel" aria-labelledby="form-title">
                        <div className="form-heading">
                            <div>
                                <p className="eyebrow">MAKE IT YOURS</p>
                                <h2 id="form-title">What sounds good?</h2>
                            </div>
                            <span className="step-badge">
                                01 <i>/ 01</i>
                            </span>
                        </div>
                        <form
                            aria-busy={loading}
                            onSubmit={(event) => {
                                event.preventDefault();
                                void requestAdventure();
                            }}
                        >
                            <PreferenceGroup
                                title="I’d like to…"
                                name="mood"
                                selected={preferences.mood}
                                onChange={(value) =>
                                    updatePreference('mood', value as AdventurePreferences['mood'])
                                }
                                options={moodOptions}
                            />
                            <PreferenceGroup
                                title="I have…"
                                name="duration"
                                selected={preferences.duration}
                                onChange={(value) =>
                                    updatePreference(
                                        'duration',
                                        value as AdventurePreferences['duration']
                                    )
                                }
                                options={durationOptions}
                                compact
                            />
                            <PreferenceGroup
                                title="I’ll be with…"
                                name="company"
                                selected={preferences.company}
                                onChange={(value) =>
                                    updatePreference(
                                        'company',
                                        value as AdventurePreferences['company']
                                    )
                                }
                                options={companyOptions}
                            />
                            <PreferenceGroup
                                title="My energy is…"
                                name="energy"
                                selected={preferences.energy}
                                onChange={(value) =>
                                    updatePreference(
                                        'energy',
                                        value as AdventurePreferences['energy']
                                    )
                                }
                                options={energyOptions}
                                compact
                            />
                            {error ? (
                                <p className="error-message" role="alert">
                                    {error}
                                </p>
                            ) : null}
                            <button
                                className="button button-primary submit-button"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span role="status" aria-live="polite">
                                        <span className="spinner" aria-hidden="true" /> Finding a
                                        little adventure…
                                    </span>
                                ) : (
                                    <>
                                        Find my adventure <span aria-hidden="true">↗</span>
                                    </>
                                )}
                            </button>
                            <p className="form-footnote">
                                Stay in a familiar public place. Skip anything that doesn’t feel
                                right.
                            </p>
                        </form>
                    </section>
                </main>
            ) : (
                <main className="result-layout">
                    <div className="result-overline">
                        <button className="back-link" onClick={showPreferences}>
                            ← Your preferences
                        </button>
                        <span className="duration-pill">
                            ◷ &nbsp;{adventure.durationMinutes} minutes
                        </span>
                    </div>
                    <section className="result-hero" aria-labelledby="adventure-title">
                        <p className="eyebrow">
                            <span className="sun-dot" /> YOUR OUTSIDE MOMENT
                        </p>
                        <h1 id="adventure-title">{adventure.title}</h1>
                        <p className="result-premise">{adventure.premise}</p>
                    </section>
                    <section className="adventure-card" aria-label="Adventure plan">
                        <div className="card-label">
                            <span>THE PLAN</span>
                            <span>{adventure.steps.length} EASY STEPS</span>
                        </div>
                        <ol className="step-list">
                            {adventure.steps.map((item, index) => (
                                <li className="step-row" key={`${item.title}-${index}`}>
                                    <span className="step-number">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <div className="step-copy">
                                        <h2>{item.title}</h2>
                                        <p>{item.instruction}</p>
                                    </div>
                                    <span className="step-duration">
                                        {item.durationMinutes} min
                                    </span>
                                </li>
                            ))}
                        </ol>
                        <div className="safety-box">
                            <span className="safety-icon" aria-hidden="true">
                                ✳
                            </span>
                            <div>
                                <h2>A gentle reminder</h2>
                                <ul>
                                    {adventure.safetyNotes.map((note) => (
                                        <li key={note}>{note}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="reflection">
                            <p className="eyebrow">TAKE THIS WITH YOU</p>
                            <p>{adventure.reflectionPrompt}</p>
                        </div>
                    </section>
                    <div className="result-actions">
                        <button
                            className="button button-primary button-large"
                            onClick={startAdventure}
                        >
                            Start my adventure <span aria-hidden="true">↗</span>
                        </button>
                        <button
                            className="button button-secondary"
                            disabled={loading}
                            onClick={() => void requestAdventure()}
                        >
                            {loading ? 'Finding another…' : 'Find another'}
                        </button>
                    </div>
                    {error ? (
                        <p className="error-message result-error" role="alert">
                            {error}
                        </p>
                    ) : null}
                    <p className="put-away-note">
                        Once you begin, we’ll keep the screen simple. You can put your phone away.
                    </p>
                </main>
            )}
            <footer className="site-footer">
                <span>MADE FOR A MOMENT OUTSIDE</span>
                <span>Take what you need. Then go.</span>
            </footer>
        </div>
    );
}

type Option = { readonly value: string; readonly label: string; readonly detail?: string };

function PreferenceGroup({
    title,
    name,
    selected,
    onChange,
    options,
    compact = false
}: {
    title: string;
    name: string;
    selected: string;
    onChange: (value: string) => void;
    options: readonly Option[];
    compact?: boolean;
}) {
    return (
        <fieldset className={`preference-group${compact ? ' preference-group-compact' : ''}`}>
            <legend>{title}</legend>
            <div className={`option-grid option-count-${options.length}`}>
                {options.map((option) => (
                    <label
                        className={`option-card${selected === option.value ? ' is-selected' : ''}`}
                        key={option.value}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={selected === option.value}
                            onChange={() => onChange(option.value)}
                        />
                        <span className="option-label">{option.label}</span>
                        {option.detail ? (
                            <span className="option-detail">{option.detail}</span>
                        ) : null}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
