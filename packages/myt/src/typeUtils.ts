export type Primitive = (string & {}) | number | boolean | null | undefined | symbol | bigint

export type DeepReadonly<T> = T extends Function
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T
