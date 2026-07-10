/**
 * publicly exported API
 */
export * from './base'
export { nextTick } from './scheduler'

declare global {
  interface Element {
    __click?: VoidFunction
  }
}
