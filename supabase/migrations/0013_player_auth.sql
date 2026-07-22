-- Brief 6 Part B: player identity. No accounts, no email — per ARCHITECTURE §2, a player
-- picks their name and sets a 4-digit PIN. Under the hood this rides on Supabase Auth's
-- anonymous sign-in (one real auth.uid() per device, no email/password collected from the
-- player) so RLS can be genuinely identity-aware rather than faked in application code.
--
-- player_auth: one row per player who has set a PIN. pin_hash only, never selectable
-- directly by anon/authenticated — every access goes through the SECURITY DEFINER
-- functions below, which is why this table gets RLS enabled with zero policies.
--
-- player_devices: maps a device's anon auth.uid() to the player it's currently signed in
-- as. auth_user_id is the primary key (one device = one active player identity); a player
-- can have many devices. Only written by verify_and_link_pin() / set_player_pin() below —
-- never directly by the client — so the identity link can't be forged by writing the table.

create extension if not exists pgcrypto;

create table if not exists player_auth (
  player_id uuid primary key references players (id),
  pin_hash text not null,
  created_at timestamptz not null default now()
);

alter table player_auth enable row level security;
-- Intentionally no policies: pin_hash is reachable only via the functions below.

create table if not exists player_devices (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  player_id uuid not null references players (id),
  linked_at timestamptz not null default now()
);

alter table player_devices enable row level security;

create policy "a device can read its own player link"
  on player_devices for select
  to authenticated
  using (auth_user_id = auth.uid());

-- Checks whether a player has ever set a PIN, so the client can offer "set" vs "verify".
-- No hash exposed; safe for anon (called before any session is meaningfully identified).
create or replace function player_has_pin(p_player_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from player_auth where player_id = p_player_id);
$$;

grant execute on function player_has_pin(uuid) to anon, authenticated;

-- First-time PIN set. Refuses to overwrite an existing PIN (use verify_and_link_pin to log
-- in instead) — a minimal guard against casually clobbering a teammate's PIN, though the
-- friendly-pranks threat model this app targets doesn't call for more than that. Requires
-- an authenticated (anonymous-sign-in) session so auth.uid() is available to link.
create or replace function set_player_pin(p_player_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'no active session';
  end if;

  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  if exists (select 1 from player_auth where player_id = p_player_id) then
    return false;
  end if;

  insert into player_auth (player_id, pin_hash)
  values (p_player_id, crypt(p_pin, gen_salt('bf')));

  insert into player_devices (auth_user_id, player_id)
  values (auth.uid(), p_player_id)
  on conflict (auth_user_id) do update set player_id = excluded.player_id, linked_at = now();

  return true;
end;
$$;

grant execute on function set_player_pin(uuid, text) to authenticated;

-- Returning login: verifies the PIN and, on success, links this device's auth.uid() to the
-- player. Wrong PIN just returns false — no lockout complexity for 16 friends.
create or replace function verify_and_link_pin(p_player_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched boolean;
begin
  if auth.uid() is null then
    raise exception 'no active session';
  end if;

  select (pin_hash = crypt(p_pin, pin_hash)) into matched
  from player_auth
  where player_id = p_player_id;

  if not coalesce(matched, false) then
    return false;
  end if;

  insert into player_devices (auth_user_id, player_id)
  values (auth.uid(), p_player_id)
  on conflict (auth_user_id) do update set player_id = excluded.player_id, linked_at = now();

  return true;
end;
$$;

grant execute on function verify_and_link_pin(uuid, text) to authenticated;
