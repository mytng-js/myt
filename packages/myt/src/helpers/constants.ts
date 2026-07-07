export const version: string = __VERSION__

export const EMPTY_OBJECT: { readonly [key: string]: any } = __DEV__ ? Object.freeze({}) : {}

export const EMPTY_ARRAY: readonly never[] = __DEV__ ? Object.freeze([]) : []
