/* =========================
   script.js 
   ========================= */

document.documentElement.classList.add('js');

// Header scroll state
const header = document.querySelector('.site-header');
const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 12);
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
  setInterval(tick, 1000);
}

/* =========================
   Timeline reveal
   ========================= */
function initTimelineReveal(root = document) {
  const items = root.querySelectorAll('.timeline .item');
  if (!items.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });

  items.forEach((i) => io.observe(i));
}

/* =========================
   Lightbox (galerie)
   ========================= */
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

document.querySelectorAll('.gallery img').forEach((img) => {
  img.loading = 'lazy';
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => {
    lbImg.src = img.src;
    lb.classList.add('open');
  });
});

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

bindNumberWheelGuards();

async function mountHtmlComponents() {
  const hosts = document.querySelectorAll('[data-rsvp-component], [data-programme-component]');
  if (!hosts.length) return;

  const sources = [...new Set(Array.from(hosts).map((host) => host.dataset.rsvpSource || host.dataset.programmeSource).filter(Boolean))];
  const templates = new Map();

  await Promise.all(sources.map(async (source) => {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Impossible de charger le composant HTML: ${source}`);
    }
    templates.set(source, await res.text());
  }));

  hosts.forEach((host) => {
    const source = host.dataset.rsvpSource || host.dataset.programmeSource;
    if (!source || !templates.has(source)) return;
    host.innerHTML = templates.get(source);
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
    detailsWrap.style.display = isPartial ? 'block' : 'none';
    attendanceSection?.classList.toggle('rsvp-hidden', isAbsent);
    guestsSection?.classList.toggle('rsvp-hidden', isAbsent);

    // si on quitte "partiel", on décoche et on vide le résumé
    if (!isPartial) {
      dayCheckboxes.forEach((cb) => { cb.checked = false; });
      presenceDetailInput.value = '';
    } else {
      buildPresenceDetail(); // recalcul direct
    }

    // Si "non", on force 0 invités et on masque le bloc invités (logique RSVP)
    if (isAbsent) {
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
    note.classList.remove('is-success', 'is-error');

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

    const { a, k, t } = totalGuests();

    // Si présence = non, pas d'invités
    if (presenceSelect?.value === 'non') {
      guestsWrap.innerHTML = '';
      return;
    }

    // protection saisie absurde
    if (t > 12) {
      guestsWrap.innerHTML = `
        <p class="rsvp-guests-note" style="color:#b42318">
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
        alert("Merci de cocher au moins un jour si vous êtes présent(e) partiellement.");
        detailsWrap?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
    }

    // 2) Si présence != non => au moins 1 invité (adultes+enfants)
    if (presenceSelect?.value !== 'non' && adultsInput && kidsInput) {
      const { t } = totalGuests();
      if (t < 1) {
        alert("Merci d’indiquer le nombre d’adultes et d’enfants.");
        adultsInput.focus();
        return false;
      }
    }

    // 3) Si bloc invités présent => prénom et nom requis pour chaque invité
    if (guestsWrap && presenceSelect?.value !== 'non') {
      const requiredInputs = guestsWrap.querySelectorAll('input[required]');
      for (const inp of requiredInputs) {
        if (!inp.value || !inp.value.trim()) {
          alert("Merci de renseigner le prénom et le nom de chaque invité.");
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
    showSubmitNote("Votre réponse est en cours d'envoi. Cela ne prend que quelques instants.", 'success');

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
        toast.textContent = 'Merci ! Votre reponse est enregistree.';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2200);
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
        toast.textContent = "Oups, impossible d'envoyer. Reessayez ou contactez-nous.";
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2600);
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

(async function initPage() {
  try {
    await mountHtmlComponents();
  } catch (err) {
    console.error(err);
  }

  initTimelineReveal();
  initRSVP();
  bindNumberWheelGuards();
})();
