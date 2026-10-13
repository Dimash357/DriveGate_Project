import { StorageInterface, ChangeQueue, Synchronizer, Revision } from '../storage/StorageInterface';

export interface Replica extends StorageInterface, ChangeQueue { merge(r: Revision[]): Promise<void> }

export class SyncEngine implements Synchronizer {
    private running: Promise<void> | null = null;

    constructor(private remote: StorageInterface, private local: Replica) { }
    run() { return this.running ??= this.execute().finally(() => { this.running = null }) }
    private async execute() { await this.local.merge(await this.remote.read()); for (const r of await this.local.pending()) { await this.remote.save(r); await this.local.acknowledge(r.id) } await this.local.merge(await this.remote.read()) }
}
