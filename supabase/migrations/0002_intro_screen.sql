-- Настраиваемый экран приветствия перед открытием карты
alter table maps
  add column if not exists intro_eyebrow text not null default 'Для тебя собрал',
  add column if not exists intro_message text,
  add column if not exists intro_button text not null default 'Открыть карту';
