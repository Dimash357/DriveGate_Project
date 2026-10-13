import { openDB } from 'idb';
import { Revision, StorageInterface, ChangeQueue } from './StorageInterface';


// One database per Google account: never upload another user's pending data.
export class LocalStorage implements StorageInterface, ChangeQueue {
    private db;
    constructor(public readonly account: string) { this.db = openDB('drivegate-' + account, 1, { upgrade(db) { db.createObjectStore('revisions', { keyPath: 'id' }); db.createObjectStore('queue', { keyPath: 'id' }) } }) }

    async read(): Promise<Revision[]> { return (await this.db).getAll('revisions') }
    async save(r: Revision) { const db = await this.db; const tx = db.transaction(['revisions', 'queue'], 'readwrite'); await tx.objectStore('revisions').put(r); await tx.objectStore('queue').put(r); await tx.done }
    async merge(revisions: Revision[]) { const tx = (await this.db).transaction('revisions', 'readwrite'); for (const r of revisions) await tx.store.put(r); await tx.done }
    async pending(): Promise<Revision[]> { return (await this.db).getAll('queue') }
    async acknowledge(id: string) { await (await this.db).delete('queue', id) }
}