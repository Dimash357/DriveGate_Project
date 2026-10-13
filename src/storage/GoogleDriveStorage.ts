import { StorageInterface, Revision, StorageError, validate } from './StorageInterface';

export class GoogleDriveStorage implements StorageInterface {
    constructor(private token: () => string) { }
    
    private async request(url: string, init: RequestInit = {}) { const r = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${this.token()}` }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new StorageError(r.status, r.status === 401 ? 'Сессия Google истекла. Войдите снова.' : r.status === 403 ? 'Google отклонил доступ. Проверьте разрешения.' : `Ошибка Drive (${r.status})`); return r }
    private async files(query: string) { const all: { id: string }[] = []; let page = ''; do { const params = new URLSearchParams({ spaces: 'appDataFolder', q: query, fields: 'nextPageToken,files(id)', pageSize: '1000' }); if (page) params.set('pageToken', page); const d = await (await this.request('https://www.googleapis.com/drive/v3/files?' + params)).json(); all.push(...d.files); page = d.nextPageToken || '' } while (page); return all }
    async read() { const files = await this.files("trashed = false and appProperties has { key='app' and value='drivegate-v1' }"); const result: Revision[] = []; for (const f of files) { const d = await (await this.request(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json(); result.push(validate(d)) } return [...new Map(result.map(r => [r.id, r])).values()] }
    async save(r: Revision) {
        // Immutable revisions avoid lost updates. Stable ID makes retries idempotent.
        const name = 'drivegate-' + r.id + '.json'; if ((await this.files(`trashed = false and name = '${name}'`)).length) return;
        const boundary = 'drivegate_' + crypto.randomUUID(); const metadata = { name, parents: ['appDataFolder'], appProperties: { app: 'drivegate-v1' } };
        const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(r)}\r\n--${boundary}--`;
        await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    }
}
