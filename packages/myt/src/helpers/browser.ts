import { NOOP } from './base'

export const raf: typeof requestAnimationFrame = __SSR__ ? NOOP : requestAnimationFrame
export const caf: typeof cancelAnimationFrame = __SSR__ ? NOOP : cancelAnimationFrame
