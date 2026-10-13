import { StorageInterface, ErrorHandler, Synchronizer, ChangeQueue, StorageError } from '../storage/StorageInterface';
import { StorageFactory } from './StorageFactory';
import { SyncEngine, Replica } from '../sync/SyncEngine';

// Abstract Factory: creates a compatible FAMILY, not one storage object.
export abstract class StorageProviderFactory { abstract createStorage(): StorageInterface; abstract createSynchronizer(): Synchronizer; abstract createQueue(): ChangeQueue; abstract createErrorHandler(): ErrorHandler }
class CloudErrors implements ErrorHandler { explain(e: unknown) { 
    return e instanceof StorageError ? e.message : e instanceof Error ? e.message : 'Ошибка подключения к Drive' } }

class LocalErrors implements ErrorHandler { explain(e: unknown) { 
    return e instanceof Error ? 'Не удалось сохранить локально: ' + e.message : 'Ошибка IndexedDB' } }
    
export class OnlineProviderFactory extends StorageProviderFactory {
    private storage: StorageInterface; constructor(private local: Replica, token: () => string) { super(); this.storage = StorageFactory.select(true, local, token).createStorage() }
    createStorage() { return this.storage } createSynchronizer() { return new SyncEngine(this.storage, this.local) } createQueue() { 
        return this.local } createErrorHandler() { return new CloudErrors() }
}

export class OfflineProviderFactory extends StorageProviderFactory {
    constructor(private local: Replica) { super() } createStorage() { return StorageFactory.select(false, this.local, () => { throw new Error('Offline') }).createStorage() } createSynchronizer(): Synchronizer { return { run: async () => { } } } createQueue() { return this.local } createErrorHandler() { return new LocalErrors() }
}
