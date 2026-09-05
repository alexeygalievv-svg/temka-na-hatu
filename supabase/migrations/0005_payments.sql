-- Платежи ЮKassa за публикацию карты.
create table if not exists payments (
  id text primary key,
  yookassa_id text unique,
  map_id text references maps(id) on delete set null,
  owner_tg_id bigint,
  method text,
  status text not null default 'pending',
  amount_rub integer not null default 199,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payments_map_id_idx on payments (map_id);
create index if not exists payments_yookassa_id_idx on payments (yookassa_id);

alter table payments enable row level security;
