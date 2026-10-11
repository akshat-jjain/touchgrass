export interface AIProvider<Input, Output> {
    generate(input: Input, options?: { signal?: AbortSignal }): Promise<Output>;
}
