/* Blog de Yei City Concierge — lectura pública (listado y artículo) + funciones compartidas con el panel.
   Requiere: blog-config.js, supabase-js (UMD) y DOMPurify. */
(function(){
  const C = window.BLOG_CONFIG || {};
  const listo = !!(C.url && C.anonKey && window.supabase);
  const sb = listo ? window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: false } }) : null;
  const root = document.documentElement;
  const es = () => root.dataset.lang === 'es';
  const t = (a, b) => `<span class="es">${a}</span><span class="en">${b}</span>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  // contenido del artículo: solo etiquetas de texto e imágenes, nunca scripts ni estilos
  const LIMPIO = {
    ALLOWED_TAGS: ['p','br','h2','h3','strong','b','em','i','u','s','blockquote','ul','ol','li','a','img','figure','figcaption','hr'],
    ALLOWED_ATTR: ['href','src','alt','title','target','rel'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i
  };
  function limpiar(html){
    if (!window.DOMPurify) return '';
    const h = DOMPurify.sanitize(html || '', LIMPIO);
    const d = document.createElement('div'); d.innerHTML = h;
    d.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener nofollow'; });
    d.querySelectorAll('img').forEach(i => { if (!/^https:\/\//.test(i.getAttribute('src') || '')) { i.remove(); return; } i.loading = 'lazy'; i.decoding = 'async'; if (!i.alt) i.alt = ''; });
    return d.innerHTML;
  }
  const fecha = (iso) => iso ? new Intl.DateTimeFormat(es() ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)) : '';
  const fechaHTML = (iso) => iso ? `<time datetime="${esc(iso)}" data-fecha="${esc(iso)}">${esc(fecha(iso))}</time>` : '';
  // las fechas se reescriben al cambiar de idioma
  new MutationObserver(() => document.querySelectorAll('[data-fecha]').forEach(e => e.textContent = fecha(e.dataset.fecha)))
    .observe(root, { attributes: true, attributeFilter: ['data-lang'] });

  // artículo completo (lo usan la página pública y la vista previa del panel)
  function articuloHTML(p, base){
    const gal = Array.isArray(p.galeria) ? p.galeria.filter(g => g && /^https:\/\//.test(g.url)) : [];
    return `
      <header class="bp-head">
        <p class="bp-date">${fechaHTML(p.publicado_en || p.actualizado || new Date().toISOString())}</p>
        <h1>${esc(p.titulo)}</h1>
        ${p.subtitulo ? `<p class="bp-sub">${esc(p.subtitulo)}</p>` : ''}
        ${(p.etiquetas && p.etiquetas.length) ? `<p class="bl-tags bp-tags">${p.etiquetas.map(k => `<a href="${base}blog/?tema=${encodeURIComponent(k.toLowerCase())}">${esc(k)}</a>`).join('')}</p>` : ''}
      </header>
      ${p.portada_url ? `<figure class="bp-cover"><img src="${esc(p.portada_url)}" alt="${esc(p.portada_alt || p.titulo)}" fetchpriority="high"></figure>` : ''}
      <div class="bp-body">${limpiar(p.contenido)}</div>
      ${gal.length ? `<section class="bp-gal" aria-label="${es() ? 'Galería' : 'Gallery'}">${gal.map(g => `<figure><img src="${esc(g.url)}" alt="${esc(g.alt || p.titulo)}" loading="lazy" decoding="async"></figure>`).join('')}</section>` : ''}
      <div class="bp-foot">
        <a class="back" href="${base}blog/"><svg><use href="#i-ar"/></svg>${t('Volver al blog', 'Back to the blog')}</a>
        <a class="btn btn-dark" href="${base}#reserva">${t('Cuéntanos tu plan', 'Tell us your plan')}<span class="ar"><svg width="14" height="14"><use href="#i-ar"/></svg></span></a>
      </div>`;
  }
  window.BLOG = { sb, listo, limpiar, articuloHTML, esc, fecha };

  const vacio = (titulo, texto) => `<div class="bl-empty"><svg aria-hidden="true"><use href="#i-bell"/></svg><h2>${titulo}</h2><p>${texto}</p></div>`;
  const pronto = () => vacio(t('Muy pronto, nuevas historias', 'New stories coming soon'), t('Aquí compartiré anécdotas, experiencias y recomendaciones de Barcelona, la Costa Brava y República Dominicana.', 'Here I will share anecdotes, experiences and recommendations from Barcelona, the Costa Brava and the Dominican Republic.'));
  const error = () => vacio(t('No hemos podido cargar el blog', 'We could not load the blog'), t('Vuelve a intentarlo en unos minutos.', 'Please try again in a few minutes.'));

  // ---------- listado: 1 artículo destacado; con 2 o más, viñetas con palabras clave y lector ----------
  const chips = (et) => (et && et.length) ? `<p class="bl-tags">${et.map(k => `<span>${esc(k)}</span>`).join('')}</p>` : '';
  const tarjeta = (p) => `
      <article class="bl-card bl-first">
        <a href="articulo/?a=${encodeURIComponent(p.slug)}" class="bl-link" data-leer="${esc(p.slug)}">
          <figure>${p.portada_url ? `<img src="${esc(p.portada_url)}" alt="${esc(p.portada_alt || p.titulo)}" decoding="async">` : `<span class="bl-noimg"><svg aria-hidden="true"><use href="#i-bell"/></svg></span>`}</figure>
          <div class="bl-tx">
            <p class="bl-date">${fechaHTML(p.publicado_en)}</p>
            <h2>${esc(p.titulo)}</h2>
            ${p.descripcion ? `<p class="bl-desc">${esc(p.descripcion)}</p>` : ''}
            ${chips(p.etiquetas)}
            <span class="bl-more">${t('Leer artículo', 'Read article')}<svg width="14" height="14"><use href="#i-ar"/></svg></span>
          </div>
        </a>
      </article>`;
  const vineta = (p, i) => `
      <a class="vin" href="articulo/?a=${encodeURIComponent(p.slug)}" data-leer="${esc(p.slug)}" data-tags="${esc((p.etiquetas || []).join('|').toLowerCase())}">
        <figure>${p.portada_url ? `<img src="${esc(p.portada_url)}" alt="${esc(p.portada_alt || p.titulo)}" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async">` : `<span class="bl-noimg"><svg aria-hidden="true"><use href="#i-bell"/></svg></span>`}</figure>
        <p class="bl-date">${fechaHTML(p.publicado_en)}</p>
        <h2>${esc(p.titulo)}</h2>
        ${chips(p.etiquetas)}
        <span class="bl-more">${t('Leer', 'Read')}<svg width="14" height="14"><use href="#i-ar"/></svg></span>
      </a>`;
  async function listado(el){
    if (!listo){ el.innerHTML = pronto(); return; }
    const { data, error: e } = await sb.from('blog_posts')
      .select('slug,titulo,descripcion,portada_url,portada_alt,etiquetas,publicado_en')
      .eq('estado', 'publicado').order('publicado_en', { ascending: false }).limit(200);
    if (e){ el.innerHTML = error(); return; }
    if (!data.length){ el.innerHTML = pronto(); return; }
    if (data.length === 1){ el.innerHTML = `<div class="bl-grid">${tarjeta(data[0])}</div>`; activarLector(el); return; }
    // palabras clave, de la más usada a la menos
    const cuenta = {};
    data.forEach(p => (p.etiquetas || []).forEach(k => { const c = k.toLowerCase(); cuenta[c] = cuenta[c] || [k, 0]; cuenta[c][1]++; }));
    const temas = Object.values(cuenta).sort((a, b) => b[1] - a[1]).slice(0, 24);
    el.innerHTML = (temas.length ? `<div class="bl-filtro" role="group" aria-label="${es() ? 'Palabras clave' : 'Keywords'}">
        <button class="on" data-tema="">${t('Todas', 'All')}</button>${temas.map(([k]) => `<button data-tema="${esc(k.toLowerCase())}">${esc(k)}</button>`).join('')}</div>` : '')
      + `<div class="bl-vin">${data.map(vineta).join('')}</div><p class="bl-none" hidden>${t('No hay historias con esa palabra clave.', 'No stories with that keyword.')}</p>`;
    const filtrar = (tema) => {
      el.querySelectorAll('.bl-filtro button').forEach(b => b.classList.toggle('on', b.dataset.tema === tema));
      let n = 0;
      el.querySelectorAll('.vin').forEach(v => { const ok = !tema || v.dataset.tags.split('|').includes(tema); v.hidden = !ok; if (ok) n++; });
      el.querySelector('.bl-none').hidden = n > 0;
    };
    el.querySelectorAll('.bl-filtro button').forEach(b => b.addEventListener('click', () => filtrar(b.dataset.tema)));
    const pedido = (new URLSearchParams(location.search).get('tema') || '').toLowerCase();
    if (pedido && cuenta[pedido]) filtrar(pedido);
    activarLector(el);
  }

  // lector: el artículo completo se abre encima del blog (la página propia sigue sirviendo para compartir el enlace)
  let lector = null;
  function activarLector(el){
    el.addEventListener('click', ev => {
      const a = ev.target.closest('[data-leer]'); if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      ev.preventDefault(); abrir(a.dataset.leer, true);
    });
    const desdeHash = () => { const m = location.hash.match(/^#leer=([a-z0-9-]+)$/); if (m) abrir(m[1], false); else cerrar(false); };
    addEventListener('hashchange', desdeHash); addEventListener('popstate', desdeHash);
    if (/^#leer=/.test(location.hash)) desdeHash();
  }
  async function abrir(slug, nuevo){
    if (nuevo) history.pushState(null, '', '#leer=' + slug);
    if (!lector){
      lector = document.createElement('div'); lector.className = 'lector'; lector.setAttribute('role', 'dialog'); lector.setAttribute('aria-modal', 'true');
      lector.innerHTML = `<button class="lector-x" aria-label="${es() ? 'Cerrar' : 'Close'}">×</button><article class="bp"></article>`;
      document.body.appendChild(lector);
      lector.querySelector('.lector-x').addEventListener('click', () => cerrar(true));
      lector.addEventListener('click', ev => { if (ev.target.closest('.bp-foot .back')){ ev.preventDefault(); cerrar(true); } });
      addEventListener('keydown', ev => { if (ev.key === 'Escape' && lector.classList.contains('on')) cerrar(true); });
    }
    const art = lector.querySelector('.bp');
    art.innerHTML = `<p class="bp-date" style="text-align:center">${t('Cargando…', 'Loading…')}</p>`;
    lector.classList.add('on'); document.body.style.overflow = 'hidden'; lector.scrollTop = 0;
    const { data } = await sb.from('blog_posts')
      .select('slug,titulo,subtitulo,descripcion,portada_url,portada_alt,contenido,galeria,etiquetas,publicado_en,actualizado')
      .eq('slug', slug).eq('estado', 'publicado').maybeSingle();
    art.innerHTML = data ? articuloHTML(data, '../') : vacio(t('Este artículo no está disponible', 'This article is not available'), '');
    if (data) document.title = `${data.titulo} · Yei City Concierge`;
    lector.querySelector('.lector-x').focus();
  }
  function cerrar(volver){
    if (!lector || !lector.classList.contains('on')) return;
    lector.classList.remove('on'); document.body.style.overflow = ''; document.title = 'Blog · Yei City Concierge';
    if (volver && /^#leer=/.test(location.hash)) history.pushState(null, '', location.pathname + location.search);
  }

  // ---------- artículo ----------
  function meta(nombre, valor, prop){
    const sel = prop ? `meta[property="${nombre}"]` : `meta[name="${nombre}"]`;
    let m = document.querySelector(sel);
    if (!m){ m = document.createElement('meta'); m.setAttribute(prop ? 'property' : 'name', nombre); document.head.appendChild(m); }
    m.setAttribute('content', valor);
  }
  async function articulo(el){
    const slug = new URLSearchParams(location.search).get('a') || '';
    const noEsta = () => { el.innerHTML = vacio(t('Este artículo no está disponible', 'This article is not available'), `<a class="btn btn-dark" href="../">${t('Ver todas las publicaciones', 'See all posts')}<span class="ar"><svg width="14" height="14"><use href="#i-ar"/></svg></span></a>`); meta('robots', 'noindex'); };
    if (!listo){ el.innerHTML = pronto(); return; }
    if (!/^[a-z0-9-]{1,90}$/.test(slug)){ noEsta(); return; }
    const { data, error: e } = await sb.from('blog_posts')
      .select('slug,titulo,subtitulo,descripcion,portada_url,portada_alt,contenido,galeria,etiquetas,publicado_en,actualizado')
      .eq('slug', slug).eq('estado', 'publicado').maybeSingle();
    if (e){ el.innerHTML = error(); return; }
    if (!data){ noEsta(); return; }
    el.innerHTML = articuloHTML(data, '../../');
    const url = `https://yeicityconcierge.es/blog/articulo/?a=${encodeURIComponent(slug)}`;
    document.title = `${data.titulo} · Yei City Concierge`;
    meta('description', data.descripcion || data.subtitulo || data.titulo);
    meta('og:title', data.titulo, true); meta('og:description', data.descripcion || '', true); meta('og:type', 'article', true); meta('og:url', url, true);
    if (data.portada_url) meta('og:image', data.portada_url, true);
    const c = document.querySelector('link[rel="canonical"]'); if (c) c.href = url;
    const ld = document.createElement('script'); ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: data.titulo, description: data.descripcion || undefined, image: data.portada_url || undefined, datePublished: data.publicado_en, dateModified: data.actualizado, author: { '@type': 'Person', name: 'Yeila Castillo Castillo' }, publisher: { '@type': 'Organization', name: 'Yei City Concierge' }, mainEntityOfPage: url });
    document.head.appendChild(ld);
  }

  const L = document.getElementById('blogList'); if (L) listado(L);
  const A = document.getElementById('blogPost'); if (A) articulo(A);
})();
