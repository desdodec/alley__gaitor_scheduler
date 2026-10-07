const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
let mountedInput = null;
let closeActiveCalendar = null;

function dateString(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

function mountCalendar(input) {
  if (mountedInput === input) return;
  mountedInput = input;

  const originalLabel = input.closest('label');
  if (!originalLabel) return;

  const minDate = input.min;
  const maxDate = input.max;
  if (!minDate || !maxDate) return;

  input.style.display = 'none';
  originalLabel.style.display = 'none';

  const host = document.createElement('section');
  host.className = 'scheduler-picker compact';
  originalLabel.before(host);

  const [minYear, minMonth] = minDate.split('-').map(Number);
  let viewYear = minYear;
  let viewMonth = minMonth - 1;
  let selectedDate = input.value || '';
  let calendarOpen = false;

  function monthBounds() {
    const first = new Date(Date.UTC(viewYear, viewMonth, 1));
    const days = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const mondayIndex = (first.getUTCDay() + 6) % 7;
    return { days, mondayIndex };
  }

  function canMove(delta) {
    const candidate = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    const candidateKey = dateString(candidate.getUTCFullYear(), candidate.getUTCMonth(), 1).slice(0, 7);
    return candidateKey >= minDate.slice(0, 7) && candidateKey <= maxDate.slice(0, 7);
  }

  function calendarMarkup() {
    const { days, mondayIndex } = monthBounds();
    const cells = [];

    for (let i = 0; i < mondayIndex; i += 1) {
      cells.push('<span class="calendar-blank"></span>');
    }

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
      <div class="calendar-modal" role="dialog" aria-modal="true" aria-label="Choose new session date">
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
          <span class="field-title">New session date</span>
          <p class="field-note">Choose a date, then select an available time below.</p>
        </div>
      </div>

      <button type="button" class="date-trigger ${selectedDate ? 'has-value' : ''}" data-open-calendar>
        <span>${selectedLabel}</span>
        <strong>${selectedDate ? 'Change date' : 'Choose date'} →</strong>
      </button>

      ${calendarOpen ? calendarMarkup() : ''}
    `;

    host.querySelector('[data-open-calendar]')?.addEventListener('click', () => {
      calendarOpen = true;
      if (selectedDate) {
        const [year, month] = selectedDate.split('-').map(Number);
        viewYear = year;
        viewMonth = month - 1;
      }
      render();
    });

    host.querySelectorAll('[data-close-calendar]').forEach((button) => {
      button.addEventListener('click', () => {
        calendarOpen = false;
        render();
      });
    });

    host.querySelectorAll('[data-month]').forEach((button) => {
      button.addEventListener('click', () => {
        const delta = Number(button.dataset.month);
        if (!canMove(delta)) return;
        const date = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
        viewYear = date.getUTCFullYear();
        viewMonth = date.getUTCMonth();
        render();
      });
    });

    host.querySelectorAll('[data-calendar-date]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedDate = button.dataset.calendarDate;
        input.value = selectedDate;
        calendarOpen = false;
        render();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  closeActiveCalendar = () => {
    if (!calendarOpen) return;
    calendarOpen = false;
    render();
  };

  render();
}

function scan() {
  const input = document.querySelector('#reschedule-date');
  if (input) {
    mountCalendar(input);
  } else {
    mountedInput = null;
    closeActiveCalendar = null;
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeActiveCalendar?.();
});

new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
scan();
