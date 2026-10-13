export type NetworkState = 'online' | 'offline' | 'syncing';

export class NetworkStatusManager {
    private static instance: NetworkStatusManager; state: NetworkState = navigator.onLine ? 'online' : 'offline'; private listeners = new Set<() => void>(); private checking = false;
    private constructor() { window.addEventListener('offline', () => this.set('offline')); window.addEventListener('online', () => void this.check()); setInterval(() => void this.check(), 15000); void this.check() }
    static getInstance() { return this.instance ??= new NetworkStatusManager() }
    subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } };
    snapshot = () => this.state;
    set(state: NetworkState) { if (state !== this.state) { this.state = state; this.listeners.forEach(f => f()) } }
    async check() { if (this.checking || this.state === 'syncing') return; this.checking = true; try { if (!navigator.onLine) throw new Error(); const r = await fetch('/health.txt?t=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(5000) }); if (!r.ok || !(await r.text()).startsWith('ok')) throw new Error(); this.set('online') } catch { this.set('offline') } finally { this.checking = false } }
}
