const baseUrl = (process.env.ALLEY_GAITOR_BASE_URL || 'https://alleygaitor.netlify.app').replace(/\/$/, '');

const failures = [];

function pass(label) {
  console.log(`PASS  ${label}`);
}

function fail(label, detail) {
  failures.push(`${label}: ${detail}`);
  console.error(`FAIL  ${label} — ${detail}`);
}

async function fetchText(path, label, expectedText = null) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'user-agent': 'alley-gaitor-live-smoke/1.0',
      },
    });

    if (!response.ok) {
      fail(label, `HTTP ${response.status}`);
      return null;
    }

    const text = await response.text();

    if (expectedText && !text.includes(expectedText)) {
      fail(label, `missing expected text: ${JSON.stringify(expectedText)}`);
      return text;
    }

    pass(label);
    return text;
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function checkHealth() {
  const label = 'health endpoint';

  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        'user-agent': 'alley-gaitor-live-smoke/1.0',
      },
    });

    if (!response.ok) {
      fail(label, `HTTP ${response.status}`);
      return;
    }

    const health = await response.json();
    const requiredTrue = [
      'databaseConfigured',
      'databaseReachable',
      'resendApiKeyConfigured',
      'bookingEmailFromConfigured',
      'emailConfigured',
    ];

    const badKeys = requiredTrue.filter((key) => health[key] !== true);

    if (badKeys.length > 0) {
      fail(label, `expected true: ${badKeys.join(', ')}`);
      return;
    }

    pass(label);
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

console.log(`Alley Gaitor live smoke test: ${baseUrl}\n`);

await fetchText('/', 'homepage', 'Alley Gaitor');
await fetchText('/book', 'booking page', 'Alley Gaitor');
await fetchText('/sessions.html', 'sessions page + Home navigation', '>HOME</a>');
await fetchText('/access.html', 'access management page', 'Manage access');
await checkHealth();

console.log('\nManual browser checks still required:');
console.log('- homepage RUN SESSIONS button is visible and works');
console.log('- booking calendar/date selection works');
console.log('- a test booking can be created when an intentional data-writing test is appropriate');
console.log('- confirmation email delivery is verified when an intentional booking test is run');

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll non-destructive live checks passed.');
}
