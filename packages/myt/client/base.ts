/**
 * @example
 * const scrollTop = getPageScroll()
 * const scrollLeft = getPageScroll(true)
 */
export function getPageScroll(scrollLeft?: boolean): number {
  const prop = scrollLeft ? 'scrollLeft' : 'scrollTop'
  return document.scrollingElement
    ? document.scrollingElement[prop]
    : document.documentElement[prop] || document.body[prop]
}

/**
 * @example
 * const pageRtl = isRtl()
 * const elRtl = isRtl(el)
 */
export function isRtl(el?: HTMLElement | Element) {
  return getComputedStyle(el || document.documentElement).direction === 'rtl'
}
