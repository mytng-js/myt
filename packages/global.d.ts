// Global compile-time constants
declare var __VERSION__: string
declare var __DEV__: boolean

// Tree-shaking
// is server ==> __SSR__ = true
// is client ==> __SSR__ = false
declare var __SSR__: boolean

declare var __TEST__: boolean
declare var __E2E_TEST__: boolean

declare module '*.myt' {}

declare interface String {
  /**
   * @deprecated Please use String.prototype.slice instead of String.prototype.substring in the repository.
   */
  substring(start: number, end?: number): string
}
