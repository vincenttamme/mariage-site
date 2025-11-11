// Header scroll state
const header = document.querySelector('.site-header');
const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 12);
onScroll(); window.addEventListener('scroll', onScroll, {passive:true});

// Countdown (homepage only)
const cd = document.getElementById('countdown');
if (cd) {
const target = new Date('2027-07-30T14:00:00+02:00'); // ← modifie l'heure si besoin
const pad = n => String(n).padStart(2,'0');
const tick = () => {
const now = new Date(); let ms = target - now;
if (ms < 0) { cd.innerHTML = '<span class="pill">C\'est le grand week‑end ! 🎉</span>'; return; }
const d = Math.floor(ms/86400000); ms-=d*86400000;
const h = Math.floor(ms/3600000); ms-=h*3600000;
const m = Math.floor(ms/60000); ms-=m*60000;
const s = Math.floor(ms/1000);
cd.innerHTML = `
<div class="cd-box"><div class="num">${d}</div><div>jours</div></div>
<div class="cd-box"><div class="num">${pad(h)}</div><div>heures</div></div>
<div class="cd-box"><div class="num">${pad(m)}</div><div>min</div></div>
<div class="cd-box"><div class="num">${pad(s)}</div><div>sec</div></div>`;
};
tick(); setInterval(tick, 1000);
}

// Timeline reveal
const items = document.querySelectorAll('.timeline .item');
if (items.length) {
const io = new IntersectionObserver((entries)=>{
entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('revealed'); io.unobserve(e.target); } });
}, {threshold:.15});
items.forEach(i=>io.observe(i));
}

// Lightbox
const lb = document.createElement('div');
lb.className = 'lightbox';
lb.innerHTML = '<button class="close" aria-label="Fermer">Fermer ✕</button><img alt=""/>';
document.body.appendChild(lb);
const lbImg = lb.querySelector('img');
lb.addEventListener('click', e=>{ if(e.target===lb || e.target.classList.contains('close')) lb.classList.remove('open'); });
document.querySelectorAll('.gallery img').forEach(img=>{
img.loading = 'lazy'; img.style.cursor = 'zoom-in';
img.addEventListener('click', ()=>{ lbImg.src = img.src; lb.classList.add('open'); });
});
