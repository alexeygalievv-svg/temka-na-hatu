-- Карты воспоминаний.
-- Поля status / paid_at заранее предусмотрены под будущую оплату:
-- сейчас все карты создаются как 'active', позже можно ввести 'draft' → оплата → 'active'.
create table if not exists maps (
  id text primary key,
  owner_tg_id bigint not null,
  author_name text,
  title text not null default 'Карта воспоминаний',
  status text not null default 'active',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Точки на карте.
-- audio_url заранее предусмотрен под будущие голосовые сообщения.
create table if not exists points (
  id uuid primary key default gen_random_uuid(),
  map_id text not null references maps(id) on delete cascade,
  title text not null,
  description text,
  photo_url text,
  audio_url text,
  lat double precision not null,
  lng double precision not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists points_map_id_order_idx on points (map_id, order_index);

-- Доступ идёт только через backend с service-role ключом,
-- поэтому включаем RLS без публичных политик: anon-ключ ничего не увидит.
alter table maps enable row level security;
alter table points enable row level security;

-- Публичный бакет для фотографий точек.
insert into storage.buckets (id, name, public)
values ('memories', 'memories', true)
on conflict (id) do nothing;
