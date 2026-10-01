// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDynamicBanner } from '@/features/actualizaciones/useDynamicBanner';

const service = vi.hoisted(() => ({ resolveCached: vi.fn(), resolve: vi.fn() }));
vi.mock('@/features/actualizaciones/BannerService', () => ({
  BannerService: class {
    resolveCached = service.resolveCached;
    resolve = service.resolve;
  },
}));
const ready = {
  status: 'ready',
  config: {
    activeBannerId: 'first',
    banners: [
      { id: 'first', duration: 1, background: { type: 'image', image: '/first.png' } },
      { id: 'second', duration: 1, background: { type: 'image', image: '/second.png' } },
    ],
  },
};

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  service.resolveCached.mockResolvedValue(null);
  service.resolve.mockResolvedValue(ready);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('dashboard banner loading', () => {
  it('publishes the active banner without waiting for image downloads', async () => {
    const image = vi.fn(class {});
    vi.stubGlobal('Image', image);
    const { result } = renderHook(() => useDynamicBanner());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.banner?.id).toBe('first');
    expect(image).not.toHaveBeenCalled();
  });

  it('pauses automatic slide changes while the page is hidden and resumes on return', async () => {
    const { result } = renderHook(() => useDynamicBanner());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    vi.useFakeTimers();
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(result.current.currentIndex).toBe(0);
    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(result.current.currentIndex).toBe(1);
  });

  it('does not start revalidation when unmounted during cache lookup', async () => {
    let finish!: (value: null) => void;
    service.resolveCached.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { unmount } = renderHook(() => useDynamicBanner());
    unmount();
    await act(async () => { finish(null); });
    expect(service.resolve).not.toHaveBeenCalled();
  });
});
