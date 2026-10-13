    import { StorageInterface } from '../storage/StorageInterface';
import { GoogleDriveStorage } from '../storage/GoogleDriveStorage';
import { LocalStorage } from '../storage/LocalStorage';
import { OfflineStorage } from '../storage/OfflineStorage';

// Factory Method: subclasses override the creation of ONE product.
export abstract class StorageFactory { 
    abstract createStorage(): StorageInterface; static select(online: boolean, local: StorageInterface, token: () => string): 
    StorageFactory { return online ? new GoogleStorageFactory(token) : new OfflineStorageFactory(local) } }

export class GoogleStorageFactory extends StorageFactory { constructor(private token: () => string) { super() } createStorage() { 
    return new GoogleDriveStorage(this.token) } }

export class LocalStorageFactory extends StorageFactory { constructor(private account: string) { super() } createStorage() { 
    return new LocalStorage(this.account) } }
    
export class OfflineStorageFactory extends StorageFactory { constructor(private local: StorageInterface) { super() } createStorage() { 
    return new OfflineStorage(this.local) } }
