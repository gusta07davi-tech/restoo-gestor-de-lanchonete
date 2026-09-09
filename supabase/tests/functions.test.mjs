// Run: node --experimental-vm-modules --test --test-isolation=none supabase/tests/functions.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

async function invoke(name, scenario = {}, payload = {}) {
  const calls = [];
  let handler;
  const context = createContext({
    Request, Response, Headers,
    Deno: {
      env: { get: (key) => key },
      serve: (callback) => { handler = callback; },
    },
  });
  const client = {
    from: () => ({
      select: (_columns, options) => options?.head
        ? Promise.resolve({ count: 1, error: null, ...scenario.countResult })
        : { eq: () => ({ single: async () => ({
          data: scenario.profile ?? { perfil: 'caixa', ativo: true },
          error: scenario.profileError ?? null,
        }) }) },
    }),
    auth: {
      getUser: async (jwt) => ({
        data: { user: jwt === 'valid-token' ? { id: 'caller-id' } : null },
        error: null,
      }),
      admin: {
        createUser: async (body) => {
          calls.push({ operation: 'create', body });
          return { data: { user: { id: 'new-user-id' } }, error: null };
        },
        updateUserById: async (id, body) => {
          calls.push({ operation: 'reset', id, body });
          return { error: null };
        },
      },
    },
  };
  const sdk = new SyntheticModule(['createClient'], function () {
    this.setExport('createClient', () => client);
  }, { context });
  const modules = new Map();
  async function load(url) {
    if (!modules.has(url)) {
      const source = stripTypeScriptTypes(await readFile(new URL(url), 'utf8'));
      modules.set(url, new SourceTextModule(source, { context, identifier: url }));
    }
    return modules.get(url);
  }
  const entry = await load(new URL(`../functions/${name}/index.ts`, import.meta.url).href);
  await entry.link((specifier, parent) => specifier.startsWith('https://esm.sh/')
    ? sdk : load(new URL(specifier, parent.identifier).href));
  await entry.evaluate();
  const response = await handler(new Request('https://test.invalid/function', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(scenario.authenticated ? { Authorization: 'Bearer valid-token' } : {}),
    },
    body: JSON.stringify(payload),
  }));
  return { response, calls, body: await response.json() };
}

const account = { usuario: 'teste.caixa', nome: 'Teste', senha: 'test-only-password', perfil: 'dev' };

for (const countResult of [{ count: null, error: { message: 'database unavailable' } }, { count: null, error: null }]) {
  test(`count failure never creates a bootstrap admin: ${JSON.stringify(countResult)}`, async () => {
    const result = await invoke('create-user', { countResult }, account);
    assert.equal(result.response.status, 503);
    assert.equal(result.calls.length, 0);
  });
}

test('first account is admin and privileges are sent only as app_metadata', async () => {
  const result = await invoke('create-user', { countResult: { count: 0 } }, account);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.bootstrap, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.calls[0].body.app_metadata)), { perfil: 'admin', bootstrap: true });
  assert.equal(result.calls[0].body.user_metadata.perfil, undefined);
});

for (const name of ['create-user', 'reset-password']) {
  const payload = name === 'create-user' ? account : { userId: 'target-id', novaSenha: 'test-only-password' };
  test(`${name} rejects a caller without a session after setup`, async () => {
    const result = await invoke(name, {}, payload);
    assert.equal(result.response.status, 401);
    assert.equal(result.calls.length, 0);
    assert.equal(result.response.headers.get('Access-Control-Allow-Origin'), '*');
  });
  for (const profile of [{ perfil: 'caixa', ativo: true }, { perfil: 'admin', ativo: false }]) {
    test(`${name} rejects ${JSON.stringify(profile)}`, async () => {
      const result = await invoke(name, { authenticated: true, profile }, payload);
      assert.equal(result.response.status, 403);
      assert.equal(result.calls.length, 0);
    });
  }
  for (const perfil of ['admin', 'dev']) {
    test(`${name} accepts active ${perfil}`, async () => {
      const result = await invoke(name, { authenticated: true, profile: { perfil, ativo: true } }, payload);
      assert.equal(result.response.status, 200);
      assert.equal(result.calls.length, 1);
      if (name === 'create-user') {
        assert.equal(result.calls[0].body.app_metadata.bootstrap, false);
        assert.equal(result.calls[0].body.app_metadata.perfil, account.perfil);
      } else {
        assert.equal(result.calls[0].id, payload.userId);
        assert.equal(result.calls[0].body.password, payload.novaSenha);
      }
    });
  }
}
