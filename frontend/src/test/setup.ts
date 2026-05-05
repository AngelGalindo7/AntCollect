import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './handlers'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock
}

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
Element.prototype.getBoundingClientRect = function (): DOMRect {
  const rect = originalGetBoundingClientRect.call(this)
  if (rect.width === 0 && rect.height === 0) {
    return { ...rect, width: 1200, height: 800, x: 0, y: 0, top: 0, left: 0, right: 1200, bottom: 800, toJSON: () => ({}) } as DOMRect
  }
  return rect
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())
