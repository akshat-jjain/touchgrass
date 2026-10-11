export type AppScreen = 'preferences' | 'result' | 'outside';
export type ScreenEvent = 'adventure-ready' | 'start' | 'edit' | 'finish';

export function transitionScreen(screen: AppScreen, event: ScreenEvent): AppScreen {
    if (event === 'adventure-ready' && screen === 'preferences') return 'result';
    if (event === 'start' && screen === 'result') return 'outside';
    if (event === 'edit' && screen !== 'outside') return 'preferences';
    if (event === 'finish' && screen === 'outside') return 'result';
    return screen;
}
