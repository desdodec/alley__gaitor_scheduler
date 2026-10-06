const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
let mountedForm = null;

function londonTodayParts() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  return { year: map.year, month: map.month, day: map.day };
}

function dateString(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(parts, amount) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function compareDateStrings(a, b) {
  return a.localeCompare(b);
}

function formatChosenDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function mountCalendar(form) {
  if (mountedForm === form) return;
  mountedForm = form;

  const startsAt = form.querySelector('input[name="startsAt"]');
  const participantCount = form.querySelector('#participant-count');
  if (!startsAt || !participantCount) return;

  const originalLabel = startsAt.closest('label');
  const note = originalLabel?.nextElementSibling;
  if (!originalLabel) return;

  startsAt.type = 'hidden';
  startsAt.required = true;
  originalLabel.style.display = 'none';
  if (note?.classList.contains('field-note')) note.style.display = 'none';

  const host = document.createElement('section');
  host.className = 'scheduler-picker compact';
  originalLabel.before(host);

  const today = londonTodayParts();
  const max = addDays(today, 60);
  const minDate = dateString(today.year, today.month - 1, today.day);
  const maxDate = dateString(max.year, max.month - 1, max.day);
  let viewYear = today.year;
  let viewMonth = today.month - 1;
  let selectedDate = '';
  let selectedStartsAt = '';
  let calendarOpen = false;
  let loading = false;
  let slots = [];
  let durationMinutes = 5;

  function monthBounds() {
    const first = new Date(Date.UTC(viewYear, viewMonth, 1));
    const days = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const mondayIndex = (first.getUTCDay() + 6) % 7;
    return { days, mondayIndex };
  }

  function canMove(delta) {
    const candidate = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    const candidateKey = dateString(candidate.getUTCFullYear(), candidate.getUTCMonth(), 1).slice(0, 7);
    const minKey = minDate.slice(0, 7);
    const maxKey = maxDate.slice(0, 7);
    return candidateKey >= minKey && candidateKey <= maxKey;
  }

  function calendarMarkup() {
    const { days, mondayIndex } = monthBounds();
    const cells = [];
    for (let i = 0; i < mondayIndex; i += 1) cells.push('<span class="calendar-blank"></span>');
    for (let day = 1; day <= days; day += 1) {
      const value = dateString(viewYear, viewMonth, day);
      const disabled = compareDateStrings(value, minDate) < 0 || compareDateStrings(value, maxDate) > 0;
      cells.push(`
        <button type="button" class="calendar-day ${selectedDate === value ? 'selected' : ''}" data-calendar-date="${value}" ${disabled ? 'disabled' : ''}>
          ${day}
        </button>
      `);
    }

    return `
      <div class="calendar-modal" role="dialog" aria-modal="true" aria-label="Choose session date">
        <button type="button" class="calendar-backdrop" data-close-calendar aria-label="Close calendar"></button>
        <div class="calendar-dialog">
          <div class="calendar-dialog-heading">
            <div>
              <span class="field-title">Choose a date</span>
              <p class="field-note">Available times will appear after you choose a day.</p>
            </div>
            <button type="button" class="calendar-close" data-close-calendar aria-label="Close calendar">×</button>
          </div>
          <div class="calendar-card">
            <div class="calendar-toolbar">
              <button type="button" class="calendar-nav" data-month="-1" ${canMove(-1) ? '' : 'disabled'} aria-label="Previous month">←</button>
              <strong>${MONTHS[viewMonth]} ${viewYear}</strong>
              <button type="button" class="calendar-nav" data-month="1" ${canMove(1) ? '' : 'disabled'} aria-label="Next month">→</button>
            </div>
            <div class="calendar-weekdays">${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}</div>
            <div class="calendar-grid">${cells.join('')}</div>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    const selectedLabel = selectedDate ? formatChosenDate(selectedDate) : 'Choose a date';

    host.innerHTML = `
      <div class="scheduler-heading compact-heading">
        <div>
          <span class="field-title">Session date and time</span>
          <p class="field-note">Session length adjusts to the number of participants.</p>
        </div>
        <span class="duration-chip">${durationMinutes} min</span>
      </div>

      <button type="button" class="date-trigger ${selectedDate ? 'has-value' : ''}" id="choose-date-button">
        <span>${selectedLabel}</span>
        <strong>${selectedDate ? 'Change date' : 'Choose date'} →</strong>
      </button>

      <div class="slot-panel">
        ${!selectedDate ? '<p class="slot-hint">Choose a date to see available times.</p>' : `
          ${loading ? '<p class="slot-hint">Checking availability…</p>' : slots.length ? `
            <div class="slot-title"><strong>Available times</strong></div>
            <div class="slot-grid">
              ${slots.map((slot) => `<button type="button" class="slot-button ${selectedStartsAt === slot.startsAt ? 'selected' : ''}" data-slot="${slot.startsAt}">${slot.label}</button>`).join('')}
            </div>
          ` : '<p class="slot-hint">No available times on this date. Choose another date.</p>'}
        `}
      </div>

      <div class="selected-slot" aria-live="polite">
        ${selectedStartsAt ? `Selected: <strong>${formatChosenDate(selectedDate)} at ${slots.find((slot) => slot.startsAt === selectedStartsAt)?.label || ''}</strong>` : ''}
      </div>

      ${calendarOpen ? calendarMarkup() : ''}
    `;

    host.querySelector('#choose-date-button')?.addEventListener('click', () => {
      calendarOpen = true;
      if (selectedDate) {
        const [year, month] = selectedDate.split('-').map(Number);
        viewYear = year;
        viewMonth = month - 1;
      }
      render();
    });

    host.querySelectorAll('[data-close-calendar]').forEach((button) => button.addEventListener('click', () => {
      calendarOpen = false;
      render();
    }));

    host.querySelectorAll('[data-month]').forEach((button) => button.addEventListener('click', () => {
      const delta = Number(button.dataset.month);
      if (!canMove(delta)) return;
      const date = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
      viewYear = date.getUTCFullYear();
      viewMonth = date.getUTCMonth();
      render();
    }));

    host.querySelectorAll('[data-calendar-date]').forEach((button) => button.addEventListener('click', async () => {
      selectedDate = button.dataset.calendarDate;
      selectedStartsAt = '';
      startsAt.value = '';
      calendarOpen = false;
      await loadSlots();
    }));

    host.querySelectorAll('[data-slot]').forEach((button) => button.addEventListener('click', () => {
      selectedStartsAt = button.dataset.slot;
      startsAt.value = selectedStartsAt;
      render();
    }));
  }

  async function loadSlots() {
    if (!selectedDate) return;
    loading = true;
    slots = [];
    render();
    try {
      const response = await fetch(`/api/availability?date=${encodeURIComponent(selectedDate)}&participants=${encodeURIComponent(participantCount.value)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'availability_failed');
      slots = payload.slots || [];
      durationMinutes = Number(payload.durationMinutes) || durationMinutes;
    } catch (error) {
      console.error('Could not load availability', error);
      slots = [];
    } finally {
      loading = false;
      render();
    }
  }

  participantCount.addEventListener('change', async () => {
    const count = Number(participantCount.value);
    durationMinutes = count === 1 ? 5 : count <= 3 ? 10 : 15;
    selectedStartsAt = '';
    startsAt.value = '';
    if (selectedDate) await loadSlots();
    else render();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && calendarOpen) {
      calendarOpen = false;
      render();
    }
  });

  render();
}

function scan() {
  const form = document.querySelector('#booking-form');
  if (form) mountCalendar(form);
  else mountedForm = null;
}

new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
scan();
