import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { AuthManager } from '../src/auth/AuthManager';
import { LocalStorage } from '../src/storage/LocalStorage';
import { GoogleDriveStorage } from '../src/storage/GoogleDriveStorage';
import { OfflineStorage } from '../src/storage/OfflineStorage';
import { StorageFactory, LocalStorageFactory } from '../src/factories/StorageFactory';
import { OnlineProviderFactory, OfflineProviderFactory } from '../src/factories/StorageProviderFactory';
import { Revision, heads } from '../src/storage/StorageInterface';
import { SyncEngine } from '../src/sync/SyncEngine';

const rev = (text = 'a', parents: string[] = []): Revision => ({ id: crypto.randomUUID(), text, parents, createdAt: new Date().toISOString() });
const local = () => new LocalStorage(crypto.randomUUID());

describe('patterns', () => {
    it('Singleton returns one manager', () => expect(AuthManager.getInstance()).toBe(AuthManager.getInstance()));
    it('Factory Method creates one product', () => { expect(StorageFactory.select(true, local(), () => 'token').createStorage()).toBeInstanceOf(GoogleDriveStorage); expect(StorageFactory.select(false, local(), () => '').createStorage()).toBeInstanceOf(OfflineStorage); expect(new LocalStorageFactory('x').createStorage()).toBeInstanceOf(LocalStorage) });
    it('offline family queues but never acknowledges', async () => { const f = new OfflineProviderFactory(local()); await f.createStorage().save(rev()); await f.createSynchronizer().run(); expect(await f.createQueue().pending()).toHaveLength(1) });
    it('online family supplies cloud synchronizer', () => { const f = new OnlineProviderFactory(local(), () => 'token'); expect(f.createStorage()).toBeInstanceOf(GoogleDriveStorage); expect(f.createSynchronizer()).toBeInstanceOf(SyncEngine) })
});

describe('offline recovery', () => {
    it('persists revisions and queue on reopening', async () => { const db = local(), r = rev(); await new OfflineStorage(db).save(r); const again = new LocalStorage(db.account); expect(await again.pending()).toEqual([r]); expect(await again.read()).toEqual([r]) });
    it('keeps failed uploads and retries after reconnection', async () => { const db = local(), r = rev(); await db.save(r); const remote = { read: vi.fn(async () => [] as Revision[]), save: vi.fn(async (_: Revision) => { }) }; remote.save.mockRejectedValueOnce(new TypeError('Failed to fetch')); const sync = new SyncEngine(remote, db); await expect(sync.run()).rejects.toThrow(); expect(await db.pending()).toEqual([r]); await sync.run(); expect(await db.pending()).toEqual([]); expect(remote.save).toHaveBeenCalledTimes(2) });
    it('coalesces concurrent sync requests', async () => { const db = local(); await db.save(rev()); const save = vi.fn(async () => { }), sync = new SyncEngine({ read: async () => [], save }, db); await Promise.all([sync.run(), sync.run()]); expect(save).toHaveBeenCalledTimes(1) });
    it('isolates accounts', async () => { const a = local(), b = local(); await a.save(rev()); expect(await b.pending()).toEqual([]) });
    it('preserves conflicting heads until explicit merge', () => { const root = rev(), a = rev('a', [root.id]), b = rev('b', [root.id]); expect(heads([root, a, b])).toEqual([a, b]); const merge = rev('merged', [a.id, b.id]); expect(heads([root, a, b, merge])).toEqual([merge]) });
    it('does not erase a new write during upload', async () => { const db = local(), a = rev(), b = rev(); await db.save(a); const sync = new SyncEngine({ read: async () => [], save: async () => { await db.save(b) } }, db); await sync.run(); expect(await db.pending()).toEqual([b]) });
});
