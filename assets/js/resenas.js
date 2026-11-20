/* Opiniones de clientes (sección #opiniones de la portada).
   Las reseñas las copia la clienta desde Google en su panel (/admin → Reseñas) y se guardan en Supabase.
   Se leen con la clave PÚBLICA y solo las marcadas como visibles (lo garantiza la política RLS).
   Sin reseñas, la sección queda como invitación a dejar la primera en Google. */
(function(){
  const sec = document.getElementById('opiniones'); if (!sec) return;
  const C = window.BLOG_CONFIG || {};
  const FEATURABLE = '5b04f0ec-b6f2-4448-b1ed-f39f27f725fc';   // widget gratuito de featurable.com vinculado a la ficha de Google
  const lista = sec.querySelector('.op-list'), root = document.documentElement;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const estrellas = n => '<span class="op-stars" aria-label="' + n + ' / 5">' + [1,2,3,4,5].map(i => '<svg class="' + (i <= n ? 'on' : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>').join('') + '</span>';
  let datos = [];

  function pintar(){
    if (!datos.length){ sec.classList.remove('con'); lista.innerHTML = ''; return; }
    const en = root.dataset.lang !== 'es';
    const fecha = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString(en ? 'en-GB' : 'es-ES', { month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
    const seguro = u => /^https:\/\//.test(u || '') ? u : '';
    lista.innerHTML = datos.map(r => { const t = en && r.texto_en ? r.texto_en : r.texto, url = seguro(r.url), foto = seguro(r.foto);
      return `<figure class="op-card">
        ${estrellas(r.estrellas)}
        ${t ? `<blockquote>${esc(t)}</blockquote>` : '<div class="op-solo"></div>'}
        <figcaption>${foto ? `<img class="op-av" src="${esc(foto)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="op-av" aria-hidden="true">${esc((r.nombre || '?').trim().charAt(0).toUpperCase())}</span>`}<span><b>${esc(r.nombre)}</b><small>${fecha(r.fecha)} · ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Google</a>` : 'Google'}</small></span></figcaption>
      </figure>`; }).join('');
    sec.classList.add('con');
    flechas();
  }
  function flechas(){
    const nav = sec.querySelector('.op-nav'); if (!nav) return;
    nav.hidden = lista.scrollWidth <= lista.clientWidth + 4;
  }
  sec.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => {
    const card = lista.querySelector('.op-card'); const paso = card ? card.getBoundingClientRect().width + 20 : lista.clientWidth;
    lista.scrollBy({ left: b.dataset.op === 'next' ? paso : -paso, behavior: 'smooth' });
  }));
  addEventListener('resize', flechas);
  new MutationObserver(pintar).observe(root, { attributes: true, attributeFilter: ['data-lang'] });

  // 1) automáticas: Featurable lee la ficha de Google cada día (plan gratis) y nos da las reseñas en JSON
  async function deGoogle(){
    const r = await fetch('https://api.featurable.com/v2/widgets/' + FEATURABLE);
    const j = await r.json(); const w = j && j.widget;
    if (!j.success || !w || w.isExampleReviews || !Array.isArray(w.reviews)) return [];
    return w.reviews
      .filter(x => x && x.rating && x.rating.value)
      .map(x => ({ nombre: (x.author && x.author.name) || 'Google', foto: x.author && x.author.avatarUrl, url: x.url || (x.author && x.author.profileUrl), texto: (x.text || '').trim(), estrellas: Math.round(x.rating.value), fecha: String(x.publishedAt || '').slice(0, 10) }))
      .sort((a, b) => (!!b.texto - !!a.texto) || b.fecha.localeCompare(a.fecha)).slice(0, 15);   // primero las que tienen texto, de la más reciente a la más antigua
  }
  // 2) de reserva: las que la clienta haya copiado a mano en su panel (/admin → Reseñas)
  async function delPanel(){
    if (!(C.url && C.anonKey)) return [];
    const r = await fetch(C.url + '/rest/v1/resenas?select=nombre,texto,texto_en,estrellas,fecha&publicada=eq.true&order=fecha.desc&limit=30', { headers: { apikey: C.anonKey } });
    return r.ok ? r.json() : [];
  }
  async function cargar(){
    try { datos = await deGoogle(); } catch (e){ datos = []; }
    if (!datos.length){ try { datos = await delPanel(); } catch (e){ datos = []; } }
    pintar();
  }
  // se cargan al acercarse a la sección (no retrasan la carga de la portada)
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)){ io.disconnect(); cargar(); } }, { rootMargin: '600px 0px' });
    io.observe(sec);
  } else cargar();
})();
