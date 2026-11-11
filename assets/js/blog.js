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

  // ---------- listado ----------
  async function listado(el){
    if (!listo){ el.innerHTML = pronto(); return; }
    const { data, error: e } = await sb.from('blog_posts')
      .select('slug,titulo,descripcion,portada_url,portada_alt,publicado_en')
      .eq('estado', 'publicado').order('publicado_en', { ascending: false }).limit(200);
    if (e){ el.innerHTML = error(); return; }
    if (!data.length){ el.innerHTML = pronto(); return; }
    el.innerHTML = `<div class="bl-grid">${data.map((p, i) => `
      <article class="bl-card${i === 0 ? ' bl-first' : ''}">
        <a href="articulo/?a=${encodeURIComponent(p.slug)}" class="bl-link">
          <figure>${p.portada_url ? `<img src="${esc(p.portada_url)}" alt="${esc(p.portada_alt || p.titulo)}" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">` : `<span class="bl-noimg"><svg aria-hidden="true"><use href="#i-bell"/></svg></span>`}</figure>
          <div class="bl-tx">
            <p class="bl-date">${fechaHTML(p.publicado_en)}</p>
            <h2>${esc(p.titulo)}</h2>
            ${p.descripcion ? `<p class="bl-desc">${esc(p.descripcion)}</p>` : ''}
            <span class="bl-more">${t('Leer artículo', 'Read article')}<svg width="14" height="14"><use href="#i-ar"/></svg></span>
          </div>
        </a>
      </article>`).join('')}</div>`;
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
      .select('slug,titulo,subtitulo,descripcion,portada_url,portada_alt,contenido,galeria,publicado_en,actualizado')
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
