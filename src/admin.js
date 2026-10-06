const app = document.querySelector('#app');
const TOKEN_KEY = 'alley-gaitor-operator-token';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY) || '';
  return { authorization: `Bearer ${token}` };
}

function renderManageLogin(message = '') {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <p class="eyebrow">ALLEY GAITOR / PRIVATE</p>
        <h1>Manage bookings</h1>
      </header>
      <a class="back-link" href="/">← Home</a>
      <section class="card form-card">
        <h2 class="section-title">Private access</h2>
        <p class="subtle">Use the same private token as Session control.</p>
        <form id="manage-login">
          <label>Private token<input name="token" type="password" autocomplete="off" required></label>
          <button class="primary" type="submit">OPEN BOOKINGS</button>
          <div class="status error">${escapeHtml(message)}</div>
        </form>
      </section>
    </main>`;

  document.querySelector('#manage-login').addEventListener('submit', (event) => {
    event.preventDefault();
    const token = new FormData(event.currentTarget).get('token').trim();
    sessionStorage.setItem(TOKEN_KEY, token);
    renderManage();
  });
}

async function renderManage() {
  if (!sessionStorage.getItem(TOKEN_KEY)) return renderManageLogin();

  app.innerHTML = `
    <main class="shell">
      <header class="topbar"><p class="eyebrow">ALLEY GAITOR / PRIVATE</p><h1>Manage bookings</h1></header>
      <section class="card"><p>Loading bookings…</p></section>
    </main>`;

  let response;
  try {
    response = await fetch('/api/admin/bookings', { headers: authHeaders() });
  } catch {
    return renderManageLogin('Could not reach the booking API.');
  }

  if (response.status === 401 || response.status === 503) {
    sessionStorage.removeItem(TOKEN_KEY);
    return renderManageLogin(response.status === 401 ? 'That token was not accepted.' : 'Private access is not configured.');
  }
  if (!response.ok) return renderManageLogin('Could not load bookings.');

  const payload = await response.json();
  const bookings = payload.bookings || [];

  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <p class="eyebrow">ALLEY GAITOR / PRIVATE</p>
        <h1>Manage bookings</h1>
        <p class="subtle">Contact and delivery details are kept here, away from Session control.</p>
      </header>
      <div class="operator-tools">
        <a class="back-link" href="/">← Home</a>
        <button id="manage-logout" class="small-button">LOG OUT</button>
      </div>
      <section class="manage-list">
        ${bookings.length ? bookings.map((booking) => `
          <article class="card manage-card">
            <div class="manage-head">
              <div>
                <p class="eyebrow">${escapeHtml(booking.public_reference)}</p>
                <h2>${escapeHtml(booking.lead_name)}</h2>
                <p class="subtle">${formatDateTime(booking.starts_at)} · ${booking.duration_minutes} min · ${escapeHtml(booking.status)}</p>
              </div>
              <span class="mode-badge">${escapeHtml(booking.relationship)}</span>
            </div>

            <div class="manage-grid">
              <section>
                <h3 class="manage-section-title">Contact</h3>
                <p>${escapeHtml(booking.lead_email)}</p>
                ${booking.lead_phone ? `<p>${escapeHtml(booking.lead_phone)}</p>` : ''}
              </section>
              <section>
                <h3 class="manage-section-title">Delivery</h3>
                <address>
                  ${escapeHtml(booking.address_line_1)}<br>
                  ${booking.address_line_2 ? `${escapeHtml(booking.address_line_2)}<br>` : ''}
                  ${escapeHtml(booking.town_city)}<br>
                  ${booking.county ? `${escapeHtml(booking.county)}<br>` : ''}
                  ${escapeHtml(booking.postcode)}
                </address>
              </section>
            </div>

            <section class="manage-participants">
              <h3 class="manage-section-title">Participants</h3>
              ${(booking.participants || []).map((participant) => `
                <div class="manage-participant-row">
                  <strong>${escapeHtml(participant.artworkName)}</strong>
                  <span>${escapeHtml(participant.tShirtSize || 'size later')}</span>
                  <span>${escapeHtml(participant.visualisationId || 'visualisation later')}</span>
                  <code>${escapeHtml(participant.recordingCode)}</code>
                </div>
              `).join('')}
            </section>
          </article>
        `).join('') : '<section class="card"><p>No bookings found.</p></section>'}
      </section>
    </main>`;

  document.querySelector('#manage-logout').addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    renderManageLogin();
  });
}

function relabelUi() {
  if (location.pathname === '/operator') {
    document.querySelectorAll('.eyebrow').forEach((node) => {
      if (node.textContent.includes('OPERATOR')) node.textContent = 'ALLEY GAITOR / SESSION CONTROL';
    });
  }

  if (location.pathname === '/') {
    const operatorLink = [...document.querySelectorAll('a')].find((link) => link.getAttribute('href') === '/operator');
    if (operatorLink) {
      operatorLink.textContent = 'RUN SESSIONS';
      const parent = operatorLink.parentElement;
      if (parent && !parent.querySelector('a[href="/manage"]')) {
        const manage = document.createElement('a');
        manage.className = 'action-link secondary-link';
        manage.href = '/manage';
        manage.textContent = 'MANAGE BOOKINGS';
        parent.appendChild(manage);
      }
    }
  }
}

if (location.pathname === '/manage') {
  renderManage();
} else {
  new MutationObserver(relabelUi).observe(document.documentElement, { childList: true, subtree: true });
  relabelUi();
}
