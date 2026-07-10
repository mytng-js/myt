import { NOOP } from '../helpers'

export const raf: typeof requestAnimationFrame = __SSR__ ? NOOP : requestAnimationFrame
export const caf: typeof cancelAnimationFrame = __SSR__ ? NOOP : cancelAnimationFrame

/**
 * @example
 * const scrollTop = getPageScroll()
 * const scrollLeft = getPageScroll(true)
 */
export function getPageScroll(scrollLeft?: boolean): number {
  const prop = scrollLeft ? 'scrollLeft' : 'scrollTop'
  return __SSR__
    ? 0
    : document.scrollingElement
      ? document.scrollingElement[prop]
      : document.documentElement[prop] || document.body[prop]
}

/**
 * @example
 * const pageRtl = isRtl()
 * const elRtl = isRtl(el)
 */
export function isRtl(el?: HTMLElement | Element) {
  return __SSR__ ? false : getComputedStyle(el || document.documentElement).direction === 'rtl'
}
