import { StorageInterface, Revision } from './StorageInterface';

export class OfflineStorage implements StorageInterface { constructor(private local: StorageInterface) { } read() { return this.local.read() } save(r: Revision) { return this.local.save(r) } }