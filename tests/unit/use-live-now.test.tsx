import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLiveNow } from "@/lib/hooks/use-live-now";

describe("useLiveNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("vraća inicijalni Date.now() na mount-u", () => {
    vi.setSystemTime(new Date("2026-05-24T12:00:00.000Z"));
    const { result } = renderHook(() => useLiveNow());
    expect(result.current).toBe(new Date("2026-05-24T12:00:00.000Z").getTime());
  });

  it("re-render-uje sa novim Date.now() svake `intervalMs` (default 60_000)", () => {
    vi.setSystemTime(new Date("2026-05-24T12:00:00.000Z"));
    const { result } = renderHook(() => useLiveNow());

    const initial = result.current;
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(initial + 60_000);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(initial + 120_000);
  });

  it("podržava custom interval", () => {
    vi.setSystemTime(new Date("2026-05-24T12:00:00.000Z"));
    const { result } = renderHook(() => useLiveNow(1000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(initial + 1000);
  });

  it("čisti interval na unmount-u (no leaks)", () => {
    const { unmount } = renderHook(() => useLiveNow());
    // vi.useFakeTimers tracks active timers; clear before unmount,
    // then assert no callbacks fire after.
    const beforeUnmountCount = vi.getTimerCount();
    expect(beforeUnmountCount).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
