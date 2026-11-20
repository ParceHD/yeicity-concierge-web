/* Opiniones de clientes (sección #opiniones de la portada).
   Las reseñas las copia la clienta desde Google en su panel (/admin → Reseñas) y se guardan en Supabase.
   Se leen con la clave PÚBLICA y solo las marcadas como visibles (lo garantiza la política RLS).
   Sin reseñas, la sección queda como invitación a dejar la primera en Google. */
(function(){
  const sec = document.getElementById('opiniones'); if (!sec) return;
  const C = window.BLOG_CONFIG || {};
  const lista = sec.querySelector('.op-list'), root = document.documentElement;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const estrellas = n => '<span class="op-stars" aria-label="' + n + ' / 5">' + [1,2,3,4,5].map(i => '<svg class="' + (i <= n ? 'on' : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>').join('') + '</span>';
  let datos = [];

  function pintar(){
    if (!datos.length){ sec.classList.remove('con'); lista.innerHTML = ''; return; }
    const en = root.dataset.lang !== 'es';
    const fecha = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString(en ? 'en-GB' : 'es-ES', { month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
    lista.innerHTML = datos.map(r => `<figure class="op-card">
        ${estrellas(r.estrellas)}
        <blockquote>${esc(en && r.texto_en ? r.texto_en : r.texto)}</blockquote>
        <figcaption><span class="op-av" aria-hidden="true">${esc((r.nombre || '?').trim().charAt(0).toUpperCase())}</span><span><b>${esc(r.nombre)}</b><small>${fecha(r.fecha)} · Google</small></span></figcaption>
      </figure>`).join('');
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

  async function cargar(){
    if (!(C.url && C.anonKey)) return;
    try {
      const r = await fetch(C.url + '/rest/v1/resenas?select=nombre,texto,texto_en,estrellas,fecha&publicada=eq.true&order=fecha.desc&limit=30', { headers: { apikey: C.anonKey } });
      if (!r.ok) return;
      datos = await r.json(); pintar();
    } catch (e){}
  }
  // se cargan al acercarse a la sección (no retrasan la carga de la portada)
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)){ io.disconnect(); cargar(); } }, { rootMargin: '600px 0px' });
    io.observe(sec);
  } else cargar();
})();
