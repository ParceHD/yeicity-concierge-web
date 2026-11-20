/* Opiniones de clientes (sección #opiniones de la portada).
   1) Automáticas: se leen de la ficha de Google con la API de Places (New).
      La clave va restringida en Google Cloud a yeicityconcierge.es y solo a Places API (New), con tope diario de consultas.
      Cada visitante consulta Google como mucho una vez cada 6 horas por idioma (se guarda en su navegador).
   2) De reserva: las que la clienta copie a mano en su panel (/admin → Reseñas), guardadas en Supabase.
   Sin reseñas, la sección queda como invitación a dejar la primera en Google. */
(function(){
  const sec = document.getElementById('opiniones'); if (!sec) return;
  const C = window.BLOG_CONFIG || {};
  const GOOGLE_KEY = '';   // clave de API de Google (AIza…), restringida a la web; vacía = solo reseñas del panel
  const PLACE_ID = 'ChIJJVc_jzINUYQRdqEV_XrRHJI';   // ficha de Google de Yei City Concierge
  const CACHE_H = 6;
  const lista = sec.querySelector('.op-list'), root = document.documentElement;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const estrellas = n => '<span class="op-stars" aria-label="' + n + ' / 5">' + [1,2,3,4,5].map(i => '<svg class="' + (i <= n ? 'on' : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>').join('') + '</span>';
  const idioma = () => root.dataset.lang === 'es' ? 'es' : 'en';
  const porIdioma = {};   // reseñas ya cargadas: { es: [...], en: [...] }
  let visible = false;

  function pintar(){
    const datos = porIdioma[idioma()];
    if (!datos) { if (visible) cargar(); return; }
    if (!datos.length){ sec.classList.remove('con'); lista.innerHTML = ''; return; }
    const en = idioma() === 'en';
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
    nav.hidden = !sec.classList.contains('con') || lista.scrollWidth <= lista.clientWidth + 4;
  }
  sec.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => {
    const card = lista.querySelector('.op-card'); const paso = card ? card.getBoundingClientRect().width + 20 : lista.clientWidth;
    lista.scrollBy({ left: b.dataset.op === 'next' ? paso : -paso, behavior: 'smooth' });
  }));
  addEventListener('resize', flechas);
  new MutationObserver(pintar).observe(root, { attributes: true, attributeFilter: ['data-lang'] });

  // 1) Google (Places API New). Pide el texto traducido al idioma de la web; si la reseña ya está en ese idioma, va tal cual.
  async function deGoogle(lang){
    if (!GOOGLE_KEY) return [];
    const k = 'ycc-resenas-' + lang;
    try { const c = JSON.parse(localStorage.getItem(k) || 'null'); if (c && Date.now() - c.t < CACHE_H * 3600e3) return c.d; } catch (e){}
    const r = await fetch('https://places.googleapis.com/v1/places/' + PLACE_ID + '?languageCode=' + lang, { headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'reviews' } });
    if (!r.ok) return [];
    const j = await r.json();
    const d = (j.reviews || []).filter(x => x && x.rating).map(x => {
      const a = x.authorAttribution || {};
      return { nombre: a.displayName || 'Google', foto: a.photoUri, url: x.googleMapsUri || a.uri, texto: ((x.text && x.text.text) || (x.originalText && x.originalText.text) || '').trim(), estrellas: Math.round(x.rating), fecha: String(x.publishTime || '').slice(0, 10) };
    }).sort((a, b) => (!!b.texto - !!a.texto) || b.fecha.localeCompare(a.fecha));   // primero las que tienen texto, de la más reciente a la más antigua
    try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), d })); } catch (e){}
    return d;
  }
  // 2) de reserva: las que la clienta haya copiado a mano en su panel (/admin → Reseñas)
  let panel = null;
  async function delPanel(){
    if (panel) return panel;
    if (!(C.url && C.anonKey)) return [];
    const r = await fetch(C.url + '/rest/v1/resenas?select=nombre,texto,texto_en,estrellas,fecha&publicada=eq.true&order=fecha.desc&limit=30', { headers: { apikey: C.anonKey } });
    return (panel = r.ok ? await r.json() : []);
  }
  let cargando = null;
  function cargar(){
    const lang = idioma();
    if (cargando === lang) return;
    cargando = lang;
    (async () => {
      let d = [];
      try { d = await deGoogle(lang); } catch (e){}
      if (!d.length){ try { d = await delPanel(); } catch (e){} }
      porIdioma[lang] = d; cargando = null; pintar();
    })();
  }
  // se cargan al acercarse a la sección (no retrasan la carga de la portada)
  const empezar = () => { visible = true; cargar(); };
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)){ io.disconnect(); empezar(); } }, { rootMargin: '600px 0px' });
    io.observe(sec);
  } else empezar();
})();
