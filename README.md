# DriveGate

Одна адаптивная страница: вход через Google, статус сети, состояние Drive и небольшое поле данных после входа. Реальная Drive API v3, IndexedDB и PWA. React + TypeScript + Vite; обычный CSS, без Tailwind. Нет backend, Client Secret и refresh token.

## Быстрый запуск

Нужен Node.js 22+ (или совместимый Node 20.19+).

```bash
npm install
cp .env.example .env.local
# Windows PowerShell: Copy-Item .env.example .env.local
# Укажите VITE_GOOGLE_CLIENT_ID в .env.local
npm run dev
```

Откройте http://localhost:5173. Команды проверки:

```bash
npm test
npm run build
npx vite preview --host 0.0.0.0
```

Service Worker регистрируется только в production build. Проверяйте офлайн-режим через `vite preview` на localhost:4173 или на HTTPS. В production обслуживайте `dist/`, отдавайте `/sw.js` с Cache-Control: no-cache. Изменяйте версию CACHE при обновлении shell. Первый запуск и установка PWA требуют интернета. Закешированная страница загружается без сети после успешной установки Service Worker.

## Google Cloud Console и OAuth

1. Создайте проект в https://console.cloud.google.com/.
2. APIs & Services → Library → Google Drive API → Enable.
3. Google Auth Platform → Branding: имя приложения, контактный email. Audience: External (или Internal для организации). При Testing добавьте свои Google-аккаунты в Test users.
4. Data Access: добавьте только `https://www.googleapis.com/auth/drive.appdata`.
5. Clients → Create client → Web application. Authorized JavaScript origins: `http://localhost:5173`, `http://localhost:4173`, точный HTTPS origin опубликованной страницы. Origin без пути и конечного слеша. Popup token model не требует redirect URI.
6. Скопируйте **Client ID** в `VITE_GOOGLE_CLIENT_ID` в `.env.local` и перезапустите Vite. Для опубликованной версии пересоберите проект с этой переменной и повторно разверните dist. Vite встраивает публичный Client ID при сборке; установка runtime-переменной без пересборки статическую страницу не изменяет.
7. Нажмите «Войти через Google» и подтвердите разрешение. Без Client ID страница явно показывает необходимость настройки, а кнопка сообщает ошибку. Интеграция не имитируется.

Client ID — публичный идентификатор. **Не добавляйте Client Secret в VITE_* или браузерный код.** Google Identity Services получает access token через официальный browser token model. Токен хранится только в памяти, не в localStorage/IndexedDB/Service Worker. Автоматическое обновление в фоне не реализовано: по истечении токена нужен явный повторный вход. При действующем токене синхронизация после восстановления сети автоматическая. Offline Mode не означает OAuth offline access.

Авторизация Drive подтверждается реальным `about.get`; permissionId задаёт локальное пространство аккаунта. Это клиентское приложение без собственной серверной сессии: локальный сохранённый аккаунт не является подтверждением актуальной авторизации. После перезагрузки можно работать с уже сохранёнными данными, для облака нужен вход. Данные IndexedDB не зашифрованы; на общем компьютере учитывайте доступ через профиль браузера. Выход очищает токен и текущий аккаунт, но сохраняет офлайн-данные, чтобы не потерять очередь. Смена аккаунта не отправляет очередь предыдущего аккаунта.

## Хранение и синхронизация

Drive используется как хранилище **данных приложения**, а не произвольных пользовательских файлов. JSON-файлы создаются в скрытой `appDataFolder`; это минимальное разрешение, остальные файлы недоступны. UI не обещает доступ ко всему Drive.

Каждое сохранение создаёт неизменяемую Revision `{id, parents, text, createdAt}`. Сначала ревизия и очередь атомарно записываются одной транзакцией IndexedDB. Далее SyncEngine читает облачные ревизии, загружает очередь и повторно читает облако. Элемент удаляется из очереди только после успешного ответа Drive. Сообщение «сохранено на устройстве» отличается от «Drive подтвердил синхронизацию».

На восстановлении сети и раз в 30 секунд при открытой странице с действующим токеном выполняется синхронизация. При ошибке очередь сохраняется. 401 требует повторного входа; 403 сообщает ошибку доступа; ограничения/сетевые ошибки повторяются на следующем цикле без потери локальной записи. Закрытая PWA не выполняет фоновые загрузки. При следующем запуске синхронизация возобновится после входа.

Retry использует стабильное имя с UUID и проверяет существование перед upload. При потере ответа или одновременной записи вкладок возможны дубли файлов с одним UUID: при чтении они дедуплицируются. Облако хранит историю, накопление файлов не ограничено; для большого объёма нужен отдельный механизм архивирования/очистки. Это осознанный компромисс компактного учебного проекта.

**Конфликты:** две ревизии от одного родителя не перезаписываются. `heads()` показывает несколько версий, пользователь выбирает или объединяет текст. Новое сохранение ссылается на все известные головы. При новой конкурентной записи конфликт появится снова. Часы устройства используются только для отображения, победитель по времени не выбирается. Неизменяемые файлы исключают гонку «прочитать версию → безусловно перезаписать». 

NetworkStatusManager реагирует на browser online/offline и проверяет доступность собственного origin каждые 15 секунд с timeout. Online означает доступность приложения, не гарантирует доступность Google: Drive API отдельно обрабатывает ошибки. Корпоративный firewall может разрешать origin и блокировать Google. Syncing означает текущий сетевой обмен, а не успешное сохранение.

## Структура

```text
src/
  auth/AuthManager.ts                 Singleton, GIS, токен, аккаунт
  network/NetworkStatusManager.ts      Singleton, индикатор сети
  storage/StorageInterface.ts          абстракции, Revision, heads
  storage/GoogleDriveStorage.ts        реальные REST list/read/upload
  storage/LocalStorage.ts              IndexedDB, транзакция, очередь
  storage/OfflineStorage.ts            адаптер локального StorageInterface
  factories/StorageFactory.ts          Factory Method, отдельный продукт
  factories/StorageProviderFactory.ts  Abstract Factory, семейство
  sync/SyncEngine.ts                   синхронизация через абстракции
  ui/App.tsx                          единственная страница
  ui/styles.css                       адаптивный интерфейс
  main.tsx                            composition root
public/
  sw.js                               кеш shell, без OAuth/Drive responses
  health.txt                          проверка собственного origin
  manifest.webmanifest                PWA
  icon.svg
 tests/core.test.ts + tests/network.test.ts
 .env.example
```

## Паттерны и SOLID

- Singleton: private constructor и статический getInstance возвращают единый AuthManager / NetworkStatusManager. В пределах одной вкладки; разные вкладки имеют собственную JS-память.
- Factory Method: абстрактный `StorageFactory.createStorage()` переопределён в GoogleStorageFactory, LocalStorageFactory и OfflineStorageFactory. `select()` выбирает concrete creator. Factory Method создаёт один продукт, а не семейство.
- Abstract Factory: StorageProviderFactory задаёт createStorage/createSynchronizer/createQueue/createErrorHandler. OnlineProviderFactory создаёт Drive + SyncEngine + очередь + cloud errors. OfflineProviderFactory создаёт OfflineStorage + отложенную очередь + no-op sync + local errors. Offline sync ничего не подтверждает в облаке.
- SRP: авторизация, транспорт, persistence, сеть и sync разделены. OCP/LSP: добавление хранилища через StorageInterface. ISP: StorageInterface, ChangeQueue, ErrorHandler, Synchronizer — небольшие интерфейсы. DIP: SyncEngine получает абстракции через конструктор; UI получает компоненты фабрик. Небольшой composition root в UI связывает зависимости, а не реализует Drive API.

## Проверки

`npm test`: Singleton, конкретные фабрики и семейства, повторное открытие IndexedDB, очередь при потере связи, retry после восстановления, одно выполнение при одновременных вызовах, изоляция аккаунтов, конфликт и merge, новая запись во время sync. Fake IndexedDB и fake remote используются **только в тестах**.

Ручной интеграционный сценарий (реальный Google):

1. Соберите приложение, запустите preview, настройте origin 4173, войдите. В Application → Service Workers дождитесь активации, перезагрузите страницу.
2. Сохраните заметку. Дождитесь сообщения подтверждения Drive и пустой очереди.
3. DevTools Network → Offline. Дождитесь Offline, измените заметку и сохраните: очередь больше нуля, только локальное подтверждение.
4. Перезагрузите офлайн: shell и заметка доступны. Восстановите сеть: после перезагрузки требуется Google login, поскольку токен в памяти утрачен.
5. Повторите без перезагрузки: при действующем токене очередь отправляется автоматически, индикатор Syncing, затем Online.
6. Запретите Google API или отзовите доступ: показывается ошибка, очередь не очищается. Повторный вход и разрешения восстанавливают sync.
7. Два браузера одного аккаунта: сохраните разные изменения офлайн от общей версии, восстановите сеть. После чтения обеих версий виден конфликт. Объедините текст и сохраните.
8. Смените аккаунт при наличии очереди: изменения первого аккаунта не загружаются во второй.

OAuth и реальный Google Drive нельзя проверить без вашего Client ID и согласия аккаунта. Автотесты проверяют локальную логику; не заменяют интеграционный сценарий. Нет лишних страниц, demo-логинов или скрытой подмены облачного API.

## Официальная документация

- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/appdata
- https://developers.google.com/workspace/drive/api/guides/manage-uploads

## Авторы

- [Dimash](https://github.com/Dimash357)
- [Parviz](https://github.com/SatoSinhem)