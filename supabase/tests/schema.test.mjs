import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Test-only dependency installed in the OS temp directory; see SETUP.md.
const require = createRequire(join(tmpdir(), 'gestor-supabase-check', 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const db = new PGlite({ extensions: { pgcrypto } });

try {
  // Reproduce Supabase identity helpers and permissive legacy table grants.
  // The policies must remain effective even when API roles have CRUD grants.
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb,
      raw_app_meta_data jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '');
    $$;
    grant usage on schema auth, public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    create publication supabase_realtime;
  `);
  await db.exec(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  const { rows } = await db.query(`
    select relname, relrowsecurity from pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r';
  `);
  assert.equal(rows.length, 28);
  assert.ok(rows.every((row) => row.relrowsecurity));
  const policies = await db.query("select count(*)::int as count from pg_policies where schemaname = 'public'");
  assert.equal(policies.rows[0].count, 51);
  const realtime = await db.query("select count(*)::int as count from pg_publication_tables where pubname = 'supabase_realtime'");
  assert.equal(realtime.rows[0].count, 7);

  await db.exec(`
    begin;
    insert into auth.users (id, email, raw_app_meta_data)
      values (gen_random_uuid(), 'bootstrap@example.invalid', '{"bootstrap":true,"perfil":"dev"}');
    do $$ begin
      if (select perfil from public.profiles limit 1) <> 'admin' then
        raise exception 'FAIL: database did not force bootstrap to admin';
      end if;
    end $$;
    rollback;
  `);
  const result = await db.exec(await readFile(new URL('security.sql', import.meta.url), 'utf8'));
  console.log('PASS: schema executes; 28 RLS tables, 51 policies, 7 publication tables; first account forced to admin');
  console.log(result.at(-1).rows[0].result);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
