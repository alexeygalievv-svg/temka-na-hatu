-- Фото-карточка на экране открытия
alter table maps
  add column if not exists intro_photo_url text;
