-- ============================================================================
-- Chasse au trésor vidéo - ALSH Parigné-sur-Braye
-- À exécuter dans Supabase : Dashboard > SQL Editor > New query > Run
--
-- Modèle : 8 QR codes physiques PARTAGÉS par toutes les équipes (25 équipes,
-- même parcours). Chaque équipe choisit son nom une seule fois (mémorisé sur
-- son téléphone) puis scanne les mêmes 8 QR codes que tout le monde.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

create table if not exists steps (
  id uuid primary key default gen_random_uuid(),
  order_index int unique not null,
  token text unique not null,
  mission text not null,
  clue_text text not null,
  clue_image_url text,
  created_at timestamptz default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references steps(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
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
-- Les noms d'équipe sont publics (nécessaire pour le sélecteur d'équipe côté
-- site), mais missions/indices (table steps) restent fermés à la lecture
-- directe : sinon n'importe qui pourrait, via la clé publique anon, lire
-- toutes les étapes et voir les indices à l'avance. Tout passe par la
-- fonction RPC get_step_by_token ci-dessous.
-- ----------------------------------------------------------------------------

alter table teams enable row level security;
alter table steps enable row level security;
alter table submissions enable row level security;
alter table admin_config enable row level security;

drop policy if exists "anon can read team names" on teams;
create policy "anon can read team names"
  on teams for select
  to anon
  using (true);

drop policy if exists "anon can insert submissions" on submissions;
create policy "anon can insert submissions"
  on submissions for insert
  to anon
  with check (true);

-- ----------------------------------------------------------------------------
-- RPC : récupérer une étape (mission + indice) à partir de son token public
-- (celui encodé dans le QR code, commun à toutes les équipes).
-- ----------------------------------------------------------------------------

create or replace function get_step_by_token(p_token text)
returns table (
  step_id uuid,
  order_index int,
  mission text,
  clue_text text,
  clue_image_url text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.order_index, s.mission, s.clue_text, s.clue_image_url
  from steps s
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
set search_path = public, extensions
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
    join teams t on t.id = sub.team_id
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
