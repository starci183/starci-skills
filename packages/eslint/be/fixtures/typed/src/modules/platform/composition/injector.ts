/** Fixture stand-in for `platform/composition`: the typed parameter decorator and its factory. */
export type TypedParameterDecorator<T> = ParameterDecorator & { readonly decorated?: T }
/** Builds the decorator for a token. */
export declare function injector<T>(token: unknown): TypedParameterDecorator<T>
