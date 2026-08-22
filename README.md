# Карта воспоминаний — Telegram Mini App

Подарочная карта мест: отправитель отмечает точки с фото и историями,
получатель открывает ссылку и «пролетает» по ним в анимированной
последовательности.

## Структура

- `frontend/` — React + TypeScript + Vite, Framer Motion, Яндекс.Карты JS API 3.0, `@telegram-apps/sdk`
- `backend/` — Fastify + Supabase (Postgres + Storage), проверка подписи Telegram initData
- `supabase/migrations/` — SQL-схема базы и Storage-бакет

## Запуск

### 1. Supabase

Создайте проект на [supabase.com](https://supabase.com) и выполните
`supabase/migrations/0001_init.sql` в SQL Editor (создаст таблицы `maps`,
`points` и публичный бакет `memories`).

### 2. Backend

```bash
cd backend
cp .env.example .env   # заполните SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
                       # TELEGRAM_BOT_TOKEN, BOT_USERNAME
npm install
npm run dev            # http://localhost:8080
```

Для разработки вне Telegram поставьте `ALLOW_DEV_AUTH=true` — тогда
принимается заголовок `Authorization: dev` (фронтенд шлёт его сам в dev-режиме).

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL и VITE_YANDEX_MAPS_API_KEY
npm install
npm run dev            # http://localhost:5173
```

Ключ Яндекс.Карт (JS API 3.0) выдаётся в
[кабинете разработчика Яндекса](https://developer.tech.yandex.ru/services).

### 4. Telegram

1. Создайте бота у [@BotFather](https://t.me/BotFather), включите Mini App
   (`/newapp`) и укажите URL фронтенда (для разработки — https-туннель,
   например `cloudflared tunnel --url http://localhost:5173`).
2. Впишите токен бота в `backend/.env`, username — в `BOT_USERNAME`.
3. Ссылки для получателей имеют вид `t.me/<bot>?startapp=map_<id>` —
   приложение само определяет режим просмотра по параметру `startapp`.

## API

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/maps` | Создать карту (нужен initData) |
| POST | `/api/maps/:id/points` | Добавить точку (только владелец) |
| POST | `/api/maps/:id/photos` | Загрузить фото (multipart, только владелец) |
| GET | `/api/maps/:id` | Получить карту с точками (публично) |

## Задел на будущее

- **Оплата**: у `maps` уже есть поля `status` и `paid_at` — достаточно
  создавать карты в статусе `draft` и открывать доступ после оплаты.
- **Голосовые сообщения**: у `points` есть поле `audio_url`; загрузку можно
  сделать по аналогии с фото, не меняя схему.
