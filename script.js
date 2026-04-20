/* =========================
   script.js 
   ========================= */

document.documentElement.classList.add('js');

let motionApi = null;
let toastHideTimeout = null;
const COMPONENT_SOURCE_DATA_KEYS = ['headerSource', 'footerSource', 'rsvpSource'];
const MOTION_REVEAL_SELECTORS = [
  '.card.rsvp-intro, .card.rsvp-form',
  'main > section .container.grid > .card',
];
const MOTION_HOVER_CARD_SELECTOR = '.programme-day, .card.rsvp-intro, .gallery img';
const MOTION_HOVER_BUTTON_SELECTOR = '.site-header .btn-outline, .overlay .btn-outline';
const LIEU_GALLERY_SLIDES = [
  {
    src: './media/photos galerie/domaine-de-baldasse-14.jpg',
    alt: 'Vue du Domaine de Baldassé dans son écrin naturel',
  },
  {
    src: './media/photos galerie/domaine-de-baldasse-33.jpg',
    alt: 'Perspective lumineuse sur le Domaine de Baldassé',
  },
  {
    src: './media/photos galerie/domaine-de-baldasse-36.jpg',
    alt: 'Terrasses et extérieurs du Domaine de Baldassé',
  },
  {
    src: './media/photos galerie/domaine-de-baldasse-48.jpg',
    alt: 'Vue du domaine au calme en fin de journée',
  },
  {
    src: './media/photos galerie/domainedebaldasseaveyron7.jpg',
    alt: 'Paysage autour du Domaine de Baldassé en Aveyron',
  },
  {
    src: './media/photos galerie/340101t30_307588-domaine-de-baldasse-dfranco-171653937710251_2024-05-24-10-32-55.jpg',
    alt: 'Vue éditoriale du Domaine de Baldassé',
  },
  {
    src: './media/photos galerie/josephinewilliam10_3_307588-169054168564717.jpeg',
    alt: 'Ambiance élégante du Domaine de Baldassé',
  },
  {
    src: './media/photos galerie/domaine-de-baldasse-aveyron-6-3-209839-158512221860705_3_2322-168554282158963.jpeg',
    alt: 'Vue du Domaine de Baldassé au coeur de son environnement naturel',
  },
];

function getComponentSource(host) {
  return COMPONENT_SOURCE_DATA_KEYS
    .map((key) => host.dataset[key])
    .find(Boolean);
}

// Header scroll state
const onScroll = () => {
  const header = document.querySelector('.site-header');
  header && header.classList.toggle('scrolled', window.scrollY > 12);
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const heroVideo = document.querySelector('.hero-video video');
if (prefersReducedMotion && heroVideo) {
  heroVideo.removeAttribute('autoplay');
  heroVideo.pause();
}

/* =========================
   Countdown (homepage only)
   ========================= */
const cd = document.getElementById('countdown');
if (cd) {
  // IMPORTANT Safari: éviter le parsing ISO ambigu.
  // 30 juillet 2027 14:00 Paris (CEST UTC+2) => 12:00 UTC
  const target = new Date(Date.UTC(2027, 6, 30, 12, 0, 0));

  const pad = (n) => String(n).padStart(2, '0');

  const tick = () => {
    const now = new Date();
    let ms = target - now;

    if (ms < 0) {
      cd.innerHTML = '<span class="pill">C\'est le grand week-end ! ✨</span>';
      return;
    }

    const d = Math.floor(ms / 86400000); ms -= d * 86400000;
    const h = Math.floor(ms / 3600000);  ms -= h * 3600000;
    const m = Math.floor(ms / 60000);    ms -= m * 60000;
    cd.innerHTML = `
      <div class="cd-box"><div class="num">${d}</div><div>jours</div></div>
      <div class="cd-box"><div class="num">${pad(h)}</div><div>heures</div></div>
      <div class="cd-box"><div class="num">${pad(m)}</div><div>min</div></div>`;
  };

  tick();
  setInterval(tick, 60000);
}

/* =========================
   Lightbox (galerie)
   ========================= */
const galleryImages = document.querySelectorAll('.gallery img');
if (galleryImages.length) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = '<button class="close" aria-label="Fermer">Fermer ✕</button><img alt=""/>';
  document.body.appendChild(lb);

  const lbImg = lb.querySelector('img');
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('close')) lb.classList.remove('open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') lb.classList.remove('open');
  });

  galleryImages.forEach((img) => {
    img.loading = 'lazy';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      lbImg.src = img.src;
      lb.classList.add('open');
    });
  });
}

function bindNumberWheelGuards(root = document) {
  root.querySelectorAll('input[type="number"]').forEach((input) => {
    if (input.dataset.wheelGuardBound === 'true') return;

    input.addEventListener('wheel', (e) => {
      if (document.activeElement === input) {
        e.preventDefault();
      }
    }, { passive: false });

    input.dataset.wheelGuardBound = 'true';
  });
}

async function mountHtmlComponents() {
  const hosts = document.querySelectorAll('[data-header-component], [data-footer-component], [data-rsvp-component]');
  if (!hosts.length) return;

  const sources = [...new Set(Array.from(hosts).map(getComponentSource).filter(Boolean))];
  const templates = new Map();

  await Promise.all(sources.map(async (source) => {
    const res = await fetch(source, { cache: 'default' });
    if (!res.ok) {
      throw new Error(`Impossible de charger le composant HTML: ${source}`);
    }
    templates.set(source, await res.text());
  }));

  hosts.forEach((host) => {
    const source = getComponentSource(host);
    if (!source || !templates.has(source)) return;
    host.innerHTML = templates.get(source);
  });
}

function initNavigationState() {
  const page = document.body.dataset.page;
  if (!page) return;

  document.querySelectorAll('[data-nav-page]').forEach((link) => {
    const isCurrent = link.dataset.navPage === page;
    link.classList.toggle('active', isCurrent);

    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function updateFooterYear(root = document) {
  root.querySelectorAll('#year').forEach((node) => {
    node.textContent = new Date().getFullYear();
  });
}

function initLieuGallery() {
  const gallery = document.querySelector('[data-lieu-gallery]');
  if (!gallery || !LIEU_GALLERY_SLIDES.length) return;

  const stage = gallery.querySelector('[data-lieu-gallery-stage]');
  const dots = gallery.querySelector('[data-lieu-gallery-dots]');
  if (!stage || !dots) return;

  let currentIndex = 0;
  let isAnimating = false;
  let activeSlide = null;
  let autoplayTimer = null;
  const slideEasing = [0.78, 0.04, 0.9, 0.3];
  const mediaEasing = [0.32, 0.72, 0, 1];
  const autoplayDelay = 4200;

  function buildSlide(index) {
    const slide = LIEU_GALLERY_SLIDES[index];
    const figure = document.createElement('figure');
    figure.className = 'lieu-gallery-slide';

    const media = document.createElement('div');
    media.className = 'lieu-gallery-media';

    const image = document.createElement('img');
    image.src = encodeURI(slide.src);
    image.alt = slide.alt;
    image.decoding = 'async';
    image.loading = index === 0 ? 'eager' : 'lazy';

    media.appendChild(image);
    figure.appendChild(media);
    return figure;
  }

  function preloadAround(index) {
    [index + 1, index - 1].forEach((value) => {
      const safeIndex = (value + LIEU_GALLERY_SLIDES.length) % LIEU_GALLERY_SLIDES.length;
      const img = new Image();
      img.src = encodeURI(LIEU_GALLERY_SLIDES[safeIndex].src);
    });
  }

  function updateMeta(index) {
    dots.querySelectorAll('.lieu-gallery-dot').forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === index);
      dot.setAttribute('aria-current', dotIndex === index ? 'true' : 'false');
    });

    const activeDot = dots.querySelector('.lieu-gallery-dot.is-active');
    if (activeDot) {
      const targetLeft = activeDot.offsetLeft - ((dots.clientWidth - activeDot.clientWidth) / 2);
      dots.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  }

  function goTo(index, direction = 1) {
    const nextIndex = (index + LIEU_GALLERY_SLIDES.length) % LIEU_GALLERY_SLIDES.length;
    if (isAnimating || nextIndex === currentIndex) return;

    const incomingSlide = buildSlide(nextIndex);
    stage.appendChild(incomingSlide);

    updateMeta(nextIndex);
    preloadAround(nextIndex);

    if (motionApi && !prefersReducedMotion) {
      isAnimating = true;
      const overlapOffset = 96;
      const incomingMedia = incomingSlide.querySelector('.lieu-gallery-media');
      const outgoingMedia = activeSlide?.querySelector('.lieu-gallery-media');

      const incomingAnimation = motionApi.animate(
        incomingSlide,
        { x: [direction > 0 ? `${overlapOffset}%` : `-${overlapOffset}%`, '0%'] },
        { duration: 0.98, easing: slideEasing }
      );

      const outgoingAnimation = activeSlide
        ? motionApi.animate(
            activeSlide,
            { x: ['0%', direction > 0 ? `-${overlapOffset}%` : `${overlapOffset}%`] },
            { duration: 0.98, easing: slideEasing }
          )
        : null;

      const incomingMediaAnimation = incomingMedia
        ? motionApi.animate(
            incomingMedia,
            {
              x: [direction > 0 ? '8%' : '-8%', '0%'],
              scale: [1.06, 1],
            },
            { duration: 0.98, easing: mediaEasing }
          )
        : null;

      const outgoingMediaAnimation = outgoingMedia
        ? motionApi.animate(
            outgoingMedia,
            {
              x: ['0%', direction > 0 ? '-6%' : '6%'],
              scale: [1, 1.05],
            },
            { duration: 0.98, easing: mediaEasing }
          )
        : null;

      Promise.all([
        incomingAnimation.finished.catch(() => {}),
        outgoingAnimation?.finished.catch(() => {}) || Promise.resolve(),
        incomingMediaAnimation?.finished.catch(() => {}) || Promise.resolve(),
        outgoingMediaAnimation?.finished.catch(() => {}) || Promise.resolve(),
      ]).finally(() => {
        activeSlide?.remove();
        activeSlide = incomingSlide;
        currentIndex = nextIndex;
        isAnimating = false;
      });
      return;
    }

    activeSlide?.remove();
    activeSlide = incomingSlide;
    currentIndex = nextIndex;
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplay() {
    if (prefersReducedMotion || autoplayTimer || LIEU_GALLERY_SLIDES.length < 2) return;
    autoplayTimer = window.setInterval(() => {
      goTo(currentIndex + 1, 1);
    }, autoplayDelay);
  }

  LIEU_GALLERY_SLIDES.forEach((slide, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'lieu-gallery-dot';
    dot.setAttribute('aria-label', `Voir l’image ${index + 1}`);
    dot.innerHTML = `<img src="${encodeURI(slide.src)}" alt="" loading="lazy" decoding="async">`;
    dot.addEventListener('click', () => goTo(index, index > currentIndex ? 1 : -1));
    dots.appendChild(dot);
  });

  activeSlide = buildSlide(0);
  stage.appendChild(activeSlide);
  updateMeta(0);
  preloadAround(0);

  gallery.addEventListener('pointerenter', stopAutoplay);
  gallery.addEventListener('pointerleave', startAutoplay);
  gallery.addEventListener('focusin', stopAutoplay);
  gallery.addEventListener('focusout', () => {
    if (!gallery.contains(document.activeElement)) {
      startAutoplay();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });

  gallery.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(currentIndex - 1, -1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(currentIndex + 1, 1);
    }
  });

  startAutoplay();
}

function showToastMessage(toast, message, duration = 2200) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  if (toastHideTimeout) {
    clearTimeout(toastHideTimeout);
  }

  if (motionApi && !prefersReducedMotion) {
    motionApi.animate(
      toast,
      { opacity: [0, 1], y: [16, 0] },
      { duration: 0.28, easing: [0.22, 1, 0.36, 1] }
    );
  }

  toastHideTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

async function initMotionEnhancements() {
  if (prefersReducedMotion) return;

  try {
    motionApi = await import('https://cdn.jsdelivr.net/npm/motion@12.23.13/+esm');
  } catch (err) {
    console.warn('Motion n’a pas pu être chargé.', err);
    return;
  }

  const { animate, hover, inView } = motionApi;
  const easing = [0.22, 1, 0.36, 1];

  const heroCard = document.querySelector('.hero-card');
  if (heroCard) {
    animate(
      heroCard,
      { opacity: [0, 1], y: [14, 0] },
      { duration: 0.8, easing, delay: 0.08 }
    );
  }

  const revealTargets = MOTION_REVEAL_SELECTORS.flatMap((selector) => [...document.querySelectorAll(selector)]);

  const uniqueTargets = [...new Set(revealTargets)];
  uniqueTargets.forEach((element, index) => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(14px)';

    inView(
      element,
      () => animate(
        element,
        { opacity: 1, y: 0 },
        { duration: 0.6, delay: Math.min(index * 0.02, 0.08), easing }
      ),
      { amount: 0.18, margin: '0px 0px -8% 0px' }
    );
  });

  hover(MOTION_HOVER_CARD_SELECTOR, (element) => {
    const enter = animate(
      element,
      { y: -2, scale: 1.01 },
      { duration: 0.18, easing }
    );

    return () => {
      enter.stop();
      animate(
        element,
        { y: 0, scale: 1 },
        { duration: 0.22, easing }
      );
    };
  });

  hover(MOTION_HOVER_BUTTON_SELECTOR, (element) => {
    const enter = animate(
      element,
      { y: -1, opacity: 0.98 },
      { duration: 0.18, easing }
    );

    return () => {
      enter.stop();
      animate(
        element,
        { y: 0, opacity: 1 },
        { duration: 0.22, easing }
      );
    };
  });
}

/* =========================
   RSVP helpers (Formspree)
   - Affiche les jours si "partiel"
   - Remplit "presence_detail" (champ caché) pour éviter la perte d'info
   - Adultes/Enfants -> génère Nom/Prénom/Allergies par invité
   - Validations (standard RSVP)
   ========================= */
function initRSVP() {
  const form = document.getElementById('rsvp-form');
  if (!form) return; // pas de formulaire sur cette page

  const presenceSelect = form.querySelector('#presence');
  const presenceChoiceInputs = form.querySelectorAll('input[name="presence_choice"]');
  const detailsWrap = document.getElementById('presence-details');
  const dayCheckboxes = form.querySelectorAll('input[name="jours[]"]');

  // Adultes / Enfants + wrapper invités (doivent exister dans ton HTML)
  const adultsInput = form.querySelector('#adults');
  const kidsInput = form.querySelector('#kids');
  const guestsWrap = document.getElementById('guests-wrap');
  const attendanceSection = form.querySelector('[data-rsvp-attendance-section]');
  const guestsSection = form.querySelector('[data-rsvp-guests-section]');
  const firstNameInput = form.querySelector('input[name="prenom"]');
  const lastNameInput = form.querySelector('input[name="nom"]');
  const emailFieldNote = form.querySelector('[data-field-note-for="email"]');
  const endpointInput = form.querySelector('#fs-endpoint');
  const submitButton = form.querySelector('#rsvp-submit');
  const submitLabel = submitButton?.querySelector('.label');
  const note = document.getElementById('rsvp-note');
  const ring = document.getElementById('ring');
  const toast = document.getElementById('toast');

  // Champ hidden résumé présence partielle
  let presenceDetailInput = form.querySelector('#presence-detail');
  if (!presenceDetailInput) {
    presenceDetailInput = document.createElement('input');
    presenceDetailInput.type = 'hidden';
    presenceDetailInput.name = 'presence_detail';
    presenceDetailInput.id = 'presence-detail';
    form.appendChild(presenceDetailInput);
  }

  const prettyDay = (v) => {
    if (v === 'vendredi') return 'Vendredi';
    if (v === 'samedi') return 'Samedi';
    if (v === 'dimanche') return 'Dimanche (brunch)';
    return v;
  };

  function totalGuests() {
    const a = Math.max(0, parseInt(adultsInput?.value || '0', 10));
    const k = Math.max(0, parseInt(kidsInput?.value || '0', 10));
    return { a, k, t: a + k };
  }

  function syncPresenceChoicesFromSelect() {
    if (!presenceChoiceInputs.length || !presenceSelect) return;
    presenceChoiceInputs.forEach((input) => {
      input.checked = input.value === presenceSelect.value;
    });
  }

  function updatePresenceUI() {
    if (!presenceSelect || !detailsWrap) return;

    const isPartial = presenceSelect.value === 'partiel';
    const isAbsent = presenceSelect.value === 'non';
    const isTbd = presenceSelect.value === 'tbd';
    detailsWrap.classList.toggle('is-hidden', !isPartial);
    attendanceSection?.classList.toggle('rsvp-hidden', isAbsent || isTbd);
    guestsSection?.classList.toggle('rsvp-hidden', isAbsent || isTbd);

    // si on quitte "partiel", on décoche et on vide le résumé
    if (!isPartial) {
      dayCheckboxes.forEach((cb) => { cb.checked = false; });
      presenceDetailInput.value = '';
    } else {
      buildPresenceDetail(); // recalcul direct
    }

    // Si "non" ou "tbd", on force 0 invités et on vide le bloc invités
    if (isAbsent || isTbd) {
      if (adultsInput) adultsInput.value = '0';
      if (kidsInput) kidsInput.value = '0';
      renderGuests();
    }

    syncPresenceChoicesFromSelect();
  }

  function buildPresenceDetail() {
    if (!presenceSelect) return;

    if (presenceSelect.value !== 'partiel') {
      presenceDetailInput.value = '';
      return;
    }

    const checked = Array.from(dayCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => prettyDay(cb.value));

    presenceDetailInput.value = checked.length
      ? checked.join(', ')
      : 'Présence partielle (jours à préciser)';
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setSubmitState(state) {
    if (!submitButton || !submitLabel) return;

    submitButton.classList.remove('is-loading', 'is-success');

    if (state === 'loading') {
      submitButton.disabled = true;
      submitButton.classList.add('is-loading');
      submitLabel.textContent = 'Envoi en cours...';
      return;
    }

    if (state === 'success') {
      submitButton.disabled = true;
      submitButton.classList.add('is-success');
      submitLabel.textContent = 'Réponse envoyée';
      return;
    }

    submitButton.disabled = false;
    submitLabel.textContent = 'Envoyer ma réponse';
  }

  function showSubmitNote(message, type) {
    if (!note) return;

    note.textContent = message;
    note.classList.add('is-visible');
    note.classList.remove('is-success', 'is-error', 'is-loading', 'is-info');

    if (type) {
      note.classList.add(`is-${type}`);
    }
  }

  function showInlineFieldMessage(field, message) {
    if (field.name === 'email' && emailFieldNote) {
      emailFieldNote.textContent = message;
    }
  }

  function clearInlineFieldMessage(field) {
    if (field.name === 'email' && emailFieldNote) {
      emailFieldNote.textContent = '';
    }
  }

  function getFieldValidationMessage(field) {
    const labelText = field.closest('label')?.childNodes?.[0]?.textContent?.trim() || 'ce champ';

    if (field.validity.valueMissing) {
      if (field.name === 'email') return 'Merci de renseigner votre adresse e-mail.';
      return `Merci de renseigner ${labelText.toLowerCase()}.`;
    }

    if (field.validity.typeMismatch && field.name === 'email') {
      return "Merci de vérifier votre adresse e-mail. Le format semble incomplet.";
    }

    if (field.validity.badInput) {
      return `Merci de vérifier ${labelText.toLowerCase()}.`;
    }

    return '';
  }

  function syncPrimaryGuestIdentity() {
    if (!guestsWrap) return;

    const guestOneFirstName = guestsWrap.querySelector('input[name="invite_1_prenom"]');
    const guestOneLastName = guestsWrap.querySelector('input[name="invite_1_nom"]');

    if (guestOneFirstName && firstNameInput) {
      guestOneFirstName.value = firstNameInput.value;
    }

    if (guestOneLastName && lastNameInput) {
      guestOneLastName.value = lastNameInput.value;
    }
  }

  function renderGuests() {
    // Si pas de champ invités dans cette page, on ne fait rien
    if (!guestsWrap || !adultsInput || !kidsInput) return;

    const existingValues = {};
    guestsWrap.querySelectorAll('input[name]').forEach((input) => {
      existingValues[input.name] = input.value;
    });

    const { a, t } = totalGuests();

    // Si présence = non, pas d'invités
    if (presenceSelect?.value === 'non') {
      guestsWrap.innerHTML = '';
      return;
    }

    // protection saisie absurde
    if (t > 12) {
      guestsWrap.innerHTML = `
        <p class="rsvp-guests-note is-alert">
          Valeur anormale. Merci de nous contacter si vous êtes plus de 12.
        </p>`;
      return;
    }

    if (t === 0) {
      guestsWrap.innerHTML = `
        <p class="rsvp-guests-note">
          Merci d’indiquer le nombre d’adultes et d’enfants.
        </p>`;
      return;
    }

    let html = `
      <p class="rsvp-guests-note"><strong>Détails des invités</strong> : chaque personne apparaît dans une carte dédiée pour une lecture plus simple.</p>
      <div class="rsvp-guest-grid">
    `;

    for (let i = 1; i <= t; i++) {
      const type = (i <= a) ? 'Adulte' : 'Enfant';
      const firstNameValue = i === 1 && firstNameInput
        ? firstNameInput.value
        : (existingValues[`invite_${i}_prenom`] || '');
      const lastNameValue = i === 1 && lastNameInput
        ? lastNameInput.value
        : (existingValues[`invite_${i}_nom`] || '');

      html += `
        <div class="rsvp-guest-card">
          <div class="rsvp-guest-head">Invité ${i} — ${type}</div>
          <div class="rsvp-guest-fields">
            <label class="rsvp-field">Prénom
              <input name="invite_${i}_prenom" required
                value="${escapeAttr(firstNameValue)}"
                placeholder="Prénom"
                class="rsvp-input">
            </label>
            <label class="rsvp-field">Nom
              <input name="invite_${i}_nom" required
                value="${escapeAttr(lastNameValue)}"
                placeholder="Nom"
                class="rsvp-input">
            </label>
            <label class="rsvp-field rsvp-field-full">Allergies / régime / infos
              <input name="invite_${i}_infos"
                value="${escapeAttr(existingValues[`invite_${i}_infos`] || '')}"
                placeholder="aucun / végétarien / sans gluten / allergie…"
                class="rsvp-input">
            </label>
            <input type="hidden" name="invite_${i}_type" value="${type}">
          </div>
        </div>
      `;
    }

    html += `</div>`;
    guestsWrap.innerHTML = html;
    syncPrimaryGuestIdentity();
  }

  function validateBeforeSubmit() {
    // 1) Si partiel => au moins 1 jour
    if (presenceSelect?.value === 'partiel') {
      const checked = Array.from(dayCheckboxes).some((cb) => cb.checked);
      if (!checked) {
        showSubmitNote("Merci de cocher au moins un jour si vous êtes présent(e) partiellement.", 'error');
        detailsWrap?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dayCheckboxes[0]?.focus();
        return false;
      }
    }

    // 2) Si présence != non => au moins 1 invité (adultes+enfants)
    if (presenceSelect?.value !== 'non' && adultsInput && kidsInput) {
      const { t } = totalGuests();
      if (t < 1) {
        showSubmitNote("Merci d’indiquer le nombre d’adultes et d’enfants.", 'error');
        adultsInput.focus();
        return false;
      }
    }

    // 3) Si bloc invités présent => prénom et nom requis pour chaque invité
    if (guestsWrap && presenceSelect?.value !== 'non') {
      const requiredInputs = guestsWrap.querySelectorAll('input[required]');
      for (const inp of requiredInputs) {
        if (!inp.value || !inp.value.trim()) {
          showSubmitNote("Merci de renseigner le prénom et le nom de chaque invité.", 'error');
          inp.focus();
          inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return false;
        }
      }
    }

    return true;
  }

  // Listeners présence + jours
  presenceSelect?.addEventListener('change', () => {
    updatePresenceUI();
    buildPresenceDetail();
    renderGuests();
  });
  presenceChoiceInputs.forEach((input) => input.addEventListener('change', () => {
    if (!presenceSelect) return;
    presenceSelect.value = input.value;
    presenceSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  dayCheckboxes.forEach((cb) => cb.addEventListener('change', buildPresenceDetail));

  // Listeners adultes/enfants
  adultsInput?.addEventListener('input', renderGuests);
  kidsInput?.addEventListener('input', renderGuests);
  firstNameInput?.addEventListener('input', syncPrimaryGuestIdentity);
  lastNameInput?.addEventListener('input', syncPrimaryGuestIdentity);

  form.querySelectorAll('input, select, textarea').forEach((field) => {
    field.addEventListener('invalid', () => {
      const message = getFieldValidationMessage(field);
      if (message) {
        field.setCustomValidity(message);
        showInlineFieldMessage(field, message);
        if (field.name !== 'email') {
          showSubmitNote(message, 'error');
        }
      }
    });

    field.addEventListener('input', () => {
      field.setCustomValidity('');
      clearInlineFieldMessage(field);
      if (note?.classList.contains('is-error')) {
        note.classList.remove('is-visible', 'is-error');
      }
    });

    field.addEventListener('change', () => {
      field.setCustomValidity('');
      clearInlineFieldMessage(field);
      if (note?.classList.contains('is-error')) {
        note.classList.remove('is-visible', 'is-error');
      }
    });
  });

  // Avant envoi, on force la mise à jour + validations
  form.addEventListener('submit', async (e) => {
    buildPresenceDetail();
    if (!validateBeforeSubmit()) {
      e.preventDefault();
      return;
    }

    if (!endpointInput?.value) return;

    e.preventDefault();
    setSubmitState('loading');
    showSubmitNote("Votre réponse est en cours d'envoi. Cela ne prend que quelques instants.", 'loading');

    const data = new FormData(form);
    data.append('_subject', 'Mariage - Nouvelle réponse de présence');

    try {
      const res = await fetch(endpointInput.value, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Erreur envoi');

      if (toast) {
        showToastMessage(toast, 'Merci ! Votre reponse est enregistree.');
      }
      showSubmitNote('Merci, votre réponse a bien été enregistrée. Nous nous réjouissons de partager ce week-end avec vous.', 'success');
      setSubmitState('success');

      form.reset();
      updatePresenceUI();
      buildPresenceDetail();
      renderGuests();
    } catch (err) {
      setSubmitState('idle');
      showSubmitNote("Un contretemps est survenu pendant l'envoi. Vous pouvez réessayer dans un instant.", 'error');
      if (toast) {
        showToastMessage(toast, "Oups, impossible d'envoyer. Reessayez ou contactez-nous.", 2600);
      }
    } finally {
      if (ring) {
        ring.classList.remove('show');
        ring.offsetHeight;
        ring.classList.add('show');
        setTimeout(() => ring.classList.remove('show'), 1200);
      }
    }
  });

  // Init
  updatePresenceUI();
  syncPresenceChoicesFromSelect();
  buildPresenceDetail();
  renderGuests();
  setSubmitState('idle');
}

function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const header = document.querySelector('.site-header');
  const panel = document.getElementById('mobile-nav');
  if (!toggle || !header || !panel) return;

  function openMenu() {
    header.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fermer le menu');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closeMenu() {
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Ouvrir le menu');
    panel.setAttribute('aria-hidden', 'true');
  }

  toggle.addEventListener('click', () => {
    header.classList.contains('menu-open') ? closeMenu() : openMenu();
  });

  panel.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) {
      closeMenu();
      toggle.focus();
    }
  });
}

(async function initPage() {
  try {
    await mountHtmlComponents();
  } catch (err) {
    console.error(err);
  }

  initNavigationState();
  initMobileNav();
  updateFooterYear();
  onScroll();
  initRSVP();
  bindNumberWheelGuards();
  await initMotionEnhancements();
  initLieuGallery();
})();
