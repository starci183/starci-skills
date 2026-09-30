/** Makes a builder of `T`: a function returning the defaults with `overrides` applied. */
export declare function builder<T extends object>(defaults: T): (overrides?: Partial<T>) => T
