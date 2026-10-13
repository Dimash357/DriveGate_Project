import { afterEach, it, expect, vi } from 'vitest';
import { NetworkStatusManager } from '../src/network/NetworkStatusManager';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() });

it('detects loss of connectivity and recovery with a reachability probe', async () => {
    vi.useFakeTimers(); const events = new EventTarget(); vi.stubGlobal('window', events); vi.stubGlobal('navigator', { onLine: true }); const fetch = vi.fn(async () => ({ ok: true, text: async () => 'ok' })); vi.stubGlobal('fetch', fetch);
    const manager = NetworkStatusManager.getInstance(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); expect(manager.state).toBe('online');
    const changes: string[] = []; const unsubscribe = manager.subscribe(() => changes.push(manager.state));
    vi.stubGlobal('navigator', { onLine: false }); events.dispatchEvent(new Event('offline')); expect(manager.state).toBe('offline');
    vi.stubGlobal('navigator', { onLine: true }); await manager.check(); expect(manager.state).toBe('online');
    fetch.mockRejectedValueOnce(new TypeError('network unreachable')); await manager.check(); expect(manager.state).toBe('offline');
    await manager.check(); expect(manager.state).toBe('online'); expect(changes).toEqual(['offline', 'online', 'offline', 'online']); unsubscribe();
});
