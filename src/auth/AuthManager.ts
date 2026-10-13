import { StorageError } from '../storage/StorageInterface';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

// Singleton: private constructor excludes independent managers.
export class AuthManager {
    private static instance: AuthManager; private token = ''; private expires = 0; accountId = '';
    
    private constructor() { }

    static getInstance() { return this.instance ??= new AuthManager() }
    get accessToken() { if (!this.token || Date.now() >= this.expires) throw new StorageError(401, 'Войдите через Google для синхронизации'); return this.token }
    get connected() { return !!this.token && Date.now() < this.expires }
    logout() { this.token = ''; this.expires = 0; this.accountId = '' }
    
    async login(clientId: string): Promise<string> {
        if (!navigator.onLine) throw new Error('Вход через Google доступен только онлайн');
        if (!clientId || clientId.startsWith('YOUR_')) throw new Error('Нужен Google OAuth Client ID. См. README проекта.');
        if (!window.google) { await new Promise<void>((resolve, reject) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => resolve(); s.onerror = () => { s.remove(); reject(new Error('Не удалось загрузить Google Identity Services')) }; document.head.append(s) }) }
        return new Promise((resolve, reject) => { const client = window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: (r: any) => { if (r.error) { reject(new Error(r.error_description || r.error)); return } if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) { reject(new Error('Не выдано разрешение на данные приложения в Drive')); return } this.token = r.access_token; this.expires = Date.now() + Number(r.expires_in) * 1000 - 30000; resolve(this.token) }, error_callback: (r: any) => reject(new Error(r.type === 'popup_closed' ? 'Окно входа закрыто' : 'Не удалось открыть окно Google')) }); client.requestAccessToken({ prompt: 'select_account' }) })
    }
    async account(): Promise<{ id: string; name: string }> { const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(permissionId,displayName)', { headers: { Authorization: `Bearer ${this.accessToken}` } }); if (!r.ok) throw new StorageError(r.status, 'Не удалось определить аккаунт Drive'); const d = await r.json(); if (!d.user?.permissionId) throw new Error('Google не вернул идентификатор аккаунта'); this.accountId = d.user.permissionId; return { id: d.user.permissionId, name: d.user.displayName || 'Google user' } }
}
