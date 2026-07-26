-- ============================================================================
-- Chasse au trésor vidéo - ALSH Parigné-sur-Braye
-- À exécuter une fois dans Supabase : Dashboard > SQL Editor > New query > Run
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists steps (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  order_index int not null,
  token text unique not null,
  mission text not null,
  clue_text text not null,
  clue_image_url text,
  created_at timestamptz default now(),
  unique (team_id, order_index)
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references steps(id) on delete cascade,
  video_path text not null,
  created_at timestamptz default now()
);

-- Une seule ligne : contient le mot de passe (haché) de la page /admin.
create table if not exists admin_config (
  id boolean primary key default true,
  password_hash text not null,
  constraint admin_config_single_row check (id)
);

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- Par défaut, personne (rôle "anon", celui utilisé par le site) ne peut lire
-- teams/steps/admin_config directement : sinon n'importe qui pourrait, via la
-- clé publique anon, interroger toutes les étapes et voir les indices des
-- autres équipes à l'avance. Tout passe donc par les fonctions RPC ci-dessous,
-- qui ne renvoient que ce qui est nécessaire.
-- ----------------------------------------------------------------------------

alter table teams enable row level security;
alter table steps enable row level security;
alter table submissions enable row level security;
alter table admin_config enable row level security;

-- Le site a seulement besoin d'INSÉRER une soumission après l'envoi d'une vidéo.
drop policy if exists "anon can insert submissions" on submissions;
create policy "anon can insert submissions"
  on submissions for insert
  to anon
  with check (true);

-- ----------------------------------------------------------------------------
-- RPC : récupérer une étape (mission + indice) à partir de son token public
-- (celui encodé dans le QR code). security definer = contourne le RLS
-- ci-dessus juste pour cette requête précise et contrôlée.
-- ----------------------------------------------------------------------------

create or replace function get_step_by_token(p_token text)
returns table (
  step_id uuid,
  team_name text,
  order_index int,
  mission text,
  clue_text text,
  clue_image_url text
)
language sql
security definer
set search_path = public
as $$
  select s.id, t.name, s.order_index, s.mission, s.clue_text, s.clue_image_url
  from steps s
  join teams t on t.id = s.team_id
  where s.token = p_token;
$$;

grant execute on function get_step_by_token(text) to anon;

-- ----------------------------------------------------------------------------
-- RPC : page /admin - liste toutes les vidéos envoyées, protégée par mot de
-- passe (vérifié côté serveur dans la fonction, jamais exposé au client).
-- ----------------------------------------------------------------------------

create or replace function admin_list_submissions(p_password text)
returns table (
  team_name text,
  order_index int,
  mission text,
  video_path text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from admin_config
    where password_hash = crypt(p_password, password_hash)
  ) then
    raise exception 'mot de passe incorrect';
  end if;

  return query
    select t.name, s.order_index, s.mission, sub.video_path, sub.created_at
    from submissions sub
    join steps s on s.id = sub.step_id
    join teams t on t.id = s.team_id
    order by sub.created_at desc;
end;
$$;

grant execute on function admin_list_submissions(text) to anon;

-- ----------------------------------------------------------------------------
-- Stockage : bucket public "videos" (upload par les enfants, lecture par
-- l'admin). Les chemins de fichiers contiennent un uuid, difficile à deviner.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

drop policy if exists "anon can upload videos" on storage.objects;
create policy "anon can upload videos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'videos');

drop policy if exists "public can view videos" on storage.objects;
create policy "public can view videos"
  on storage.objects for select
  to public
  using (bucket_id = 'videos');

-- ----------------------------------------------------------------------------
-- Définir le mot de passe admin : remplacer 'change-me' puis exécuter cette
-- ligne (une seule fois, ou à nouveau pour le changer plus tard).
-- ----------------------------------------------------------------------------

insert into admin_config (id, password_hash)
values (true, crypt('change-me', gen_salt('bf')))
on conflict (id) do update set password_hash = excluded.password_hash;
