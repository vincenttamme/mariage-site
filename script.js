// Header scroll state
const header = document.querySelector('.site-header');
const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 12);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

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
    const s = Math.floor(ms / 1000);

    cd.innerHTML = `
      <div class="cd-box"><div class="num">${d}</div><div>jours</div></div>
      <div class="cd-box"><div class="num">${pad(h)}</div><div>heures</div></div>
      <div class="cd-box"><div class="num">${pad(m)}</div><div>min</div></div>
      <div class="cd-box"><div class="num">${pad(s)}</div><div>sec</div></div>`;
  };

  tick();
  setInterval(tick, 1000);
}

/* =========================
   Timeline reveal
   ========================= */
const items = document.querySelectorAll('.timeline .item');
if (items.length) {
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

document.querySelectorAll('.gallery img').forEach((img) => {
  img.loading = 'lazy';
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => {
    lbImg.src = img.src;
    lb.classList.add('open');
  });
});

/* =========================
   RSVP helpers (Formspree)
   - Affiche les jours si "partiel"
   - Remplit "presence_detail" (champ caché) pour éviter la perte d'info
   - Adultes/Enfants -> génère Nom/Prénom/Allergies par invité
   - Validations (standard RSVP)
   ========================= */
(function initRSVP() {
  const form = document.getElementById('rsvp-form');
  if (!form) return; // pas de formulaire sur cette page

  const presenceSelect = form.querySelector('#presence');
  const detailsWrap = document.getElementById('presence-details');
  const dayCheckboxes = form.querySelectorAll('input[name="jours[]"]');

  // Adultes / Enfants + wrapper invités (doivent exister dans ton HTML)
  const adultsInput = form.querySelector('#adults');
  const kidsInput = form.querySelector('#kids');
  const guestsWrap = document.getElementById('guests-wrap');

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

  function updatePresenceUI() {
    if (!presenceSelect || !detailsWrap) return;

    const isPartial = presenceSelect.value === 'partiel';
    detailsWrap.style.display = isPartial ? 'block' : 'none';

    // si on quitte "partiel", on décoche et on vide le résumé
    if (!isPartial) {
      dayCheckboxes.forEach((cb) => { cb.checked = false; });
      presenceDetailInput.value = '';
    } else {
      buildPresenceDetail(); // recalcul direct
    }

    // Si "non", on force 0 invités et on masque le bloc invités (logique RSVP)
    if (presenceSelect.value === 'non') {
      if (adultsInput) adultsInput.value = '0';
      if (kidsInput) kidsInput.value = '0';
      renderGuests();
    }
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

  function renderGuests() {
    // Si pas de champ invités dans cette page, on ne fait rien
    if (!guestsWrap || !adultsInput || !kidsInput) return;

    const { a, k, t } = totalGuests();

    // Si présence = non, pas d'invités
    if (presenceSelect?.value === 'non') {
      guestsWrap.innerHTML = '';
      return;
    }

    // protection saisie absurde
    if (t > 12) {
      guestsWrap.innerHTML = `
        <p class="muted" style="color:#b42318;margin:8px 0 0">
          Valeur anormale. Merci de nous contacter si vous êtes plus de 12.
        </p>`;
      return;
    }

    if (t === 0) {
      guestsWrap.innerHTML = `
        <p class="muted" style="margin:8px 0 0">
          Merci d’indiquer le nombre d’adultes et d’enfants.
        </p>`;
      return;
    }

    let html = `
      <div class="muted" style="margin:8px 0 10px"><strong>Détails des invités</strong> (prénom, nom, allergies/régime)</div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
    `;

    for (let i = 1; i <= t; i++) {
      const type = (i <= a) ? 'Adulte' : 'Enfant';
      html += `
        <div style="grid-column:1/-1;border:1px solid #eee;border-radius:14px;padding:12px 12px 10px">
          <div class="muted" style="margin-bottom:8px;font-weight:700">Invité ${i} — ${type}</div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
            <label>Prénom<br>
              <input name="invite_${i}_prenom" required
                placeholder="Prénom"
                style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:10px">
            </label>
            <label>Nom<br>
              <input name="invite_${i}_nom" required
                placeholder="Nom"
                style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:10px">
            </label>
            <label style="grid-column:1/-1">Allergies / régime / infos<br>
              <input name="invite_${i}_infos" required
                placeholder="aucun / végétarien / sans gluten / allergie…"
                style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:10px">
            </label>
            <input type="hidden" name="invite_${i}_type" value="${type}">
          </div>
        </div>
      `;
    }

    html += `</div>`;
    guestsWrap.innerHTML = html;
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

    // 3) Si bloc invités présent => tous les required dans guestsWrap remplis
    if (guestsWrap && presenceSelect?.value !== 'non') {
      const requiredInputs = guestsWrap.querySelectorAll('input[required]');
      for (const inp of requiredInputs) {
        if (!inp.value || !inp.value.trim()) {
          alert("Merci de renseigner le prénom, nom et allergies/régime pour chaque invité.");
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
  dayCheckboxes.forEach((cb) => cb.addEventListener('change', buildPresenceDetail));

  // Listeners adultes/enfants
  adultsInput?.addEventListener('input', renderGuests);
  kidsInput?.addEventListener('input', renderGuests);

  // Avant envoi, on force la mise à jour + validations
  form.addEventListener('submit', (e) => {
    buildPresenceDetail();
    renderGuests();
    if (!validateBeforeSubmit()) {
      e.preventDefault();
      return;
    }
  });

  // Init
  updatePresenceUI();
  buildPresenceDetail();
  renderGuests();
})();
