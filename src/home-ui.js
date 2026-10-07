import './home.css';

const slides = [
  {
    src: '/assets/images/human_reflex_art_bauhaus_construct.png',
    alt: 'Alley Gaitor artwork example using a Bauhaus-inspired geometric construction',
    label: 'Bauhaus construct',
  },
  {
    src: '/assets/images/human_reflex_art_nautilus_spiral.png',
    alt: 'Alley Gaitor artwork example using a nautilus spiral pattern',
    label: 'Nautilus spiral',
  },
  {
    src: '/assets/images/human_reflex_art_seismic_strata.png',
    alt: 'Alley Gaitor artwork example using a seismic strata pattern',
    label: 'Seismic strata',
  },
];

let slideshowTimer = null;
let currentSlide = 0;

function homeMarkup() {
  return `
    <main class="shell home-shell">
      <header class="topbar home-topbar">
        <img class="home-logo" src="/assets/images/Alley%20Gaitor%20Cycling%20Logo%20Banner.png" alt="Alley Gaitor">
        <p class="home-intro">Alley Gaitor turns the way you walk into a kind of secret drawing.</p>
        <a class="action-link primary-link home-book-link" href="/book">BOOK A SESSION</a>
      </header>

      <section class="home-video-section" aria-label="How Alley Gaitor captures your walk">
        <div class="home-section-heading">
          <p class="eyebrow">HOW IT STARTS</p>
        </div>
        <div class="home-video-frame">
          <video
            class="home-video"
            src="/assets/video/bike_walk_with_sound.mp4"
            autoplay
            muted
            loop
            playsinline
            controls
            preload="metadata"
          ></video>
        </div>
        <p class="home-caption">A small tag clicks against the bicycle spokes as you walk. Turn the sound on to hear it.</p>
      </section>

      <section class="card home-story">
        <p>
          Your <strong>gait</strong> — the particular rhythm and pattern of your footsteps — is captured by walking a bike while a small tag clicks against the spokes.
        </p>
        <p>
          Those clicks reveal tiny differences in pace, balance and left-right movement that are strangely personal to you.
        </p>
        <p>
          We can turn that rhythmic data into visual patterns which can be printed onto a T-shirt.
        </p>
      </section>

      <section class="home-gallery" aria-labelledby="artwork-title">
        <div class="home-section-heading">
          <p class="eyebrow">FROM RHYTHM TO IMAGE</p>
          <h2 id="artwork-title">One walk. Many possible drawings.</h2>
        </div>

        <div class="slideshow" aria-live="polite">
          <div class="slideshow-stage">
            ${slides.map((slide, index) => `
              <figure class="home-slide ${index === 0 ? 'active' : ''}" data-slide="${index}" aria-hidden="${index === 0 ? 'false' : 'true'}">
                <img src="${slide.src}" alt="${slide.alt}" ${index === 0 ? '' : 'loading="lazy"'}>
                <figcaption>${slide.label}</figcaption>
              </figure>
            `).join('')}
          </div>

          <div class="slideshow-controls" aria-label="Artwork slideshow controls">
            <button type="button" class="slideshow-arrow" data-slide-direction="-1" aria-label="Previous artwork">←</button>
            <div class="slideshow-dots">
              ${slides.map((_, index) => `<button type="button" class="slideshow-dot ${index === 0 ? 'active' : ''}" data-slide-index="${index}" aria-label="Show artwork ${index + 1}" aria-pressed="${index === 0 ? 'true' : 'false'}"></button>`).join('')}
            </div>
            <button type="button" class="slideshow-arrow" data-slide-direction="1" aria-label="Next artwork">→</button>
          </div>
        </div>
      </section>

      <section class="home-footer-actions">
        <a class="action-link secondary-link" href="/sessions.html">RUN SESSIONS</a>
      </section>
    </main>
  `;
}

function drawSlide(index) {
  const slideNodes = document.querySelectorAll('[data-slide]');
  if (!slideNodes.length) return;

  currentSlide = (index + slides.length) % slides.length;

  slideNodes.forEach((slide) => {
    const active = Number(slide.dataset.slide) === currentSlide;
    slide.classList.toggle('active', active);
    slide.setAttribute('aria-hidden', active ? 'false' : 'true');
  });

  document.querySelectorAll('[data-slide-index]').forEach((dot) => {
    const active = Number(dot.dataset.slideIndex) === currentSlide;
    dot.classList.toggle('active', active);
    dot.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function stopSlideshow() {
  if (slideshowTimer) clearInterval(slideshowTimer);
  slideshowTimer = null;
}

function startSlideshow() {
  stopSlideshow();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  slideshowTimer = window.setInterval(() => drawSlide(currentSlide + 1), 4500);
}

function bindHome() {
  document.querySelectorAll('[data-slide-direction]').forEach((button) => {
    button.addEventListener('click', () => {
      drawSlide(currentSlide + Number(button.dataset.slideDirection));
      startSlideshow();
    });
  });

  document.querySelectorAll('[data-slide-index]').forEach((button) => {
    button.addEventListener('click', () => {
      drawSlide(Number(button.dataset.slideIndex));
      startSlideshow();
    });
  });

  const slideshow = document.querySelector('.slideshow');
  slideshow?.addEventListener('mouseenter', stopSlideshow);
  slideshow?.addEventListener('mouseleave', startSlideshow);
  slideshow?.addEventListener('focusin', stopSlideshow);
  slideshow?.addEventListener('focusout', startSlideshow);

  startSlideshow();
}

function renderHomeExperience() {
  if (location.pathname !== '/') {
    stopSlideshow();
    return;
  }

  const app = document.querySelector('#app');
  if (!app || app.querySelector('.home-shell')) return;
  app.innerHTML = homeMarkup();
  currentSlide = 0;
  bindHome();
}

renderHomeExperience();

window.addEventListener('popstate', () => queueMicrotask(renderHomeExperience));

document.addEventListener('click', () => queueMicrotask(renderHomeExperience));

new MutationObserver(() => {
  if (location.pathname === '/' && !document.querySelector('.home-shell')) {
    queueMicrotask(renderHomeExperience);
  }
}).observe(document.documentElement, { childList: true, subtree: true });
