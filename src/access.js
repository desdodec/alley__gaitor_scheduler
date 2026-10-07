import './styles.css';

const app = document.querySelector('#app');
const ADMIN_TOKEN_KEY = 'alley-gaitor-admin-token';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function shell(inner) {
  return `
    <main class="shell">
      <header class="topbar">
        <p class="eyebrow">ALLEY GAITOR / PRIVATE</p>
        <h1>Manage access</h1>
      </header>
      ${inner}
    </main>
  `;
}

function adminHeaders(extra = {}) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  return {
    authorization: `Bearer ${token}`,
    ...extra,
  };
}

function renderLogin(message = '') {
  app.innerHTML = shell(`
    <a class="back-link" href="/">← Home</a>
    <section class="card form-card">
      <h2 class="section-title">Admin access</h2>
      <p class="subtle">Use the current private admin token to manage session helpers.</p>
      <form id="admin-login-form">
        <label>
          Admin token
          <input name="token" type="password" autocomplete="off" required>
        </label>
        <button class="primary" type="submit">OPEN ACCESS MANAGEMENT</button>
        <div id="admin-login-status" class="status error">${escapeHtml(message)}</div>
      </form>
    </section>
  `);

  document.querySelector('#admin-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = String(new FormData(event.currentTarget).get('token') || '').trim();
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    await renderAccess();
  });
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  Object.entries(adminHeaders(options.body ? { 'content-type': 'application/json' } : {})).forEach(([key, value]) => headers.set(key, value));
  return fetch(path, { ...options, headers });
}

function helperRow(helper) {
  const state = helper.is_active ? 'Active' : 'Disabled';
  return `
    <div class="manage-participant-row" data-helper-id="${escapeHtml(helper.id)}">
      <strong>${escapeHtml(helper.display_name)}</strong>
      <span>${state}</span>
      <span>${helper.last_used_at ? `Last used ${new Date(helper.last_used_at).toLocaleString('en-GB')}` : 'Not used yet'}</span>
      <button class="small-button" data-toggle-helper="${escapeHtml(helper.id)}" data-next-active="${helper.is_active ? 'false' : 'true'}">
        ${helper.is_active ? 'DISABLE' : 'ENABLE'}
      </button>
    </div>
  `;
}

async function renderAccess(message = '') {
  if (!sessionStorage.getItem(ADMIN_TOKEN_KEY)) return renderLogin();

  app.innerHTML = shell('<section class="card"><p>Loading helpers…</p></section>');

  let response;
  try {
    response = await api('/api/admin/session-helpers');
  } catch {
    return renderLogin('Could not reach the admin API.');
  }

  if (response.status === 401 || response.status === 503) {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    return renderLogin(response.status === 401 ? 'That admin token was not accepted.' : 'Admin access is not configured.');
  }
  if (!response.ok) return renderLogin('Could not load helper accounts.');

  const payload = await response.json();
  const helpers = payload.helpers || [];

  app.innerHTML = shell(`
    <div class="operator-tools">
      <a class="back-link" href="/">← Home</a>
      <button id="admin-logout" class="small-button">LOG OUT</button>
    </div>

    <section class="card form-card">
      <h2 class="section-title">Add session helper</h2>
      <p class="subtle">Each helper gets their own revocable access code. The code is only shown once.</p>
      <form id="create-helper-form">
        <label>
          Helper name
          <input name="displayName" maxlength="80" required placeholder="e.g. Jamie">
        </label>
        <button class="primary" type="submit">CREATE ACCESS CODE</button>
        <div id="create-helper-status" class="status" aria-live="polite">${escapeHtml(message)}</div>
      </form>
    </section>

    <section class="card" style="margin-top: 16px;">
      <h2 class="section-title">Session helpers</h2>
      <div class="manage-participants">
        ${helpers.length ? helpers.map(helperRow).join('') : '<p class="subtle">No helper accounts yet.</p>'}
      </div>
    </section>
  `);

  document.querySelector('#admin-logout').addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    renderLogin();
  });

  document.querySelector('#create-helper-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.querySelector('#create-helper-status');
    const button = form.querySelector('button[type="submit"]');
    const displayName = String(new FormData(form).get('displayName') || '').trim();

    button.disabled = true;
    status.textContent = 'Creating helper…';

    try {
      const createResponse = await api('/api/admin/session-helpers', {
        method: 'POST',
        body: JSON.stringify({ displayName }),
      });
      const result = await createResponse.json();
      if (!createResponse.ok) throw new Error('Could not create helper access.');

      app.innerHTML = shell(`
        <section class="card">
          <p class="eyebrow">ACCESS CODE CREATED</p>
          <h2 class="section-title">${escapeHtml(result.helper.display_name)}</h2>
          <p class="subtle">Give this code to the helper now. It cannot be recovered later.</p>
          <div class="code" style="font-size: 32px; margin: 22px 0;">${escapeHtml(result.accessCode)}</div>
          <button id="copy-code" class="primary">COPY CODE</button>
          <button id="back-to-access" class="danger">BACK TO ACCESS MANAGEMENT</button>
        </section>
      `);

      document.querySelector('#copy-code').addEventListener('click', async () => {
        await navigator.clipboard.writeText(result.accessCode);
        document.querySelector('#copy-code').textContent = 'COPIED';
      });
      document.querySelector('#back-to-access').addEventListener('click', () => renderAccess());
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });

  document.querySelectorAll('[data-toggle-helper]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      const id = button.dataset.toggleHelper;
      const isActive = button.dataset.nextActive === 'true';

      try {
        const patchResponse = await api('/api/admin/session-helpers', {
          method: 'PATCH',
          body: JSON.stringify({ id, isActive }),
        });
        if (!patchResponse.ok) throw new Error('Could not update helper.');
        await renderAccess();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    });
  });
}

renderAccess();
