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
   ========================= */
(function initRSVP() {
  const form = document.getElementById('rsvp-form');
  if (!form) return; // pas de formulaire sur cette page

  const presenceSelect = form.querySelector('#presence');
  const detailsWrap = document.getElementById('presence-details');
  const dayCheckboxes = form.querySelectorAll('input[name="jours[]"]');

  // Crée le champ hidden si pas présent dans le HTML
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

  // Listeners
  presenceSelect?.addEventListener('change', () => {
    updatePresenceUI();
    buildPresenceDetail();
  });

  dayCheckboxes.forEach((cb) => cb.addEventListener('change', buildPresenceDetail));

  // Avant envoi, on force la mise à jour (pour être sûr que Formspree reçoive le bon résumé)
  form.addEventListener('submit', () => {
    buildPresenceDetail();
  });

  // Init
  updatePresenceUI();
  buildPresenceDetail();
})();
