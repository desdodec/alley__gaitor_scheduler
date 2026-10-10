import './styles.css';

const app = document.querySelector('#app');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderForm(message = '', isError = false) {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <p class="eyebrow">ALLEY GAITOR</p>
        <h1>Contact</h1>
        <p class="subtle">Questions about a booking or your session? Send us a message.</p>
      </header>

      <a class="back-link" href="/">← Home</a>

      <section class="card form-card">
        <form id="contact-form">
          <label>
            Your name
            <input name="name" autocomplete="name" maxlength="120" required>
          </label>

          <label>
            Email address
            <input name="email" type="email" autocomplete="email" maxlength="200" required>
          </label>

          <label>
            Message
            <textarea name="message" rows="7" maxlength="3000" required style="width:100%;margin-top:7px;padding:14px;border:1px solid #444;border-radius:12px;background:#101010;color:#fff;font:inherit;resize:vertical"></textarea>
          </label>

          <label style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden" aria-hidden="true">
            Website
            <input name="website" tabindex="-1" autocomplete="off">
          </label>

          <button class="primary" type="submit">SEND MESSAGE</button>
          <div id="contact-status" class="status ${isError ? 'error' : ''}">${escapeHtml(message)}</div>
        </form>
      </section>
    </main>
  `;

  document.querySelector('#contact-form').addEventListener('submit', submitContact);
}

async function submitContact(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector('#contact-status');
  const button = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form).entries());

  button.disabled = true;
  status.className = 'status';
  status.textContent = 'Sending…';

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'send_failed');

    app.innerHTML = `
      <main class="shell">
        <header class="topbar">
          <p class="eyebrow">ALLEY GAITOR</p>
          <h1>Message sent</h1>
        </header>
        <section class="card">
          <p>Thanks — your message has been sent.</p>
          <a class="action-link primary-link" href="/">BACK TO HOME</a>
        </section>
      </main>
    `;
  } catch {
    button.disabled = false;
    status.className = 'status error';
    status.textContent = 'Could not send your message. Please try again.';
  }
}

renderForm();
