-- Migration 0013 ran `create extension if not exists pgcrypto;` with no explicit schema,
-- which on Supabase resolves to whatever schema is first in the migrating role's search_path
-- — conventionally `extensions`, not `public`. Both set_player_pin() and verify_and_link_pin()
-- are SECURITY DEFINER with `set search_path = public`, which excludes wherever pgcrypto
-- actually landed. Result: crypt()/gen_salt() aren't visible inside those functions, surfacing
-- as "function gen_salt(unknown) does not exist" the first time anyone tries to set a PIN.
--
-- Fix: look up pgcrypto's actual schema (installing it into `extensions` if it turns out not
-- to be installed at all) and widen both functions' search_path to include it, rather than
-- hardcoding a guess.

do $$
declare
  v_schema name;
begin
  select n.nspname into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if v_schema is null then
    execute 'create extension pgcrypto with schema extensions';
    v_schema := 'extensions';
  end if;

  execute format(
    'alter function set_player_pin(uuid, text) set search_path = public, %I',
    v_schema
  );
  execute format(
    'alter function verify_and_link_pin(uuid, text) set search_path = public, %I',
    v_schema
  );

  raise notice 'pgcrypto found in schema "%"; set_player_pin/verify_and_link_pin search_path updated to public, %', v_schema, v_schema;
end;
$$;
