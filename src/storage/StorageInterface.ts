export type Revision = { id: string; parents: string[]; text: string; createdAt: string };
export interface StorageInterface { read(): Promise<Revision[]>; save(revision: Revision): Promise<void> }
export interface ChangeQueue { pending(): Promise<Revision[]>; acknowledge(id: string): Promise<void> }
export interface ErrorHandler { explain(error: unknown): string }
export interface Synchronizer { run(): Promise<void> }
export class StorageError extends Error { constructor(public status: number, message: string) { super(message) } }
export function heads(revisions: Revision[]): Revision[] { const parents = new Set(revisions.flatMap(r => r.parents)); return revisions.filter(r => !parents.has(r.id)); }
export function validate(value: unknown): Revision { const r = value as Revision; if (!r || typeof r.id !== 'string' || !Array.isArray(r.parents) || !r.parents.every(x => typeof x === 'string') || typeof r.text !== 'string' || typeof r.createdAt !== 'string') throw new Error('Неверный формат данных в Drive'); return r; }
