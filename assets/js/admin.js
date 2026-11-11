/* Panel privado del blog (/admin). Todo en español.
   Seguridad: inicio de sesión de Supabase + políticas RLS en la base de datos (solo blog_admins puede escribir).
   Requiere: blog-config.js, supabase-js, DOMPurify, Quill y blog.js (para la vista previa). */
(function(){
  const C = window.BLOG_CONFIG || {};
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const aviso = (m, malo) => { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (malo ? ' bad' : ''); clearTimeout(aviso.t); aviso.t = setTimeout(() => t.className = 'toast', 4200); };

  if (!(C.url && C.anonKey && window.supabase)){
    app.innerHTML = `<div class="card narrow"><h1>Panel de mi blog</h1><p>El blog todavía no está conectado a su base de datos. Falta rellenar <code>assets/js/blog-config.js</code> con los datos de Supabase.</p></div>`;
    return;
  }
  const sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const B = C.bucket || 'blog';
  let posts = [], filtro = 'todas', editando = null, quill = null, sucio = false;

  addEventListener('beforeunload', e => { if (sucio){ e.preventDefault(); e.returnValue = ''; } });

  // ---------------- sesión ----------------
  function login(msg){
    sucio = false;
    app.innerHTML = `<form class="card narrow" id="fLogin" autocomplete="on">
      <h1>Panel de mi blog</h1><p class="muted">Entra con tu correo y tu contraseña.</p>
      ${msg ? `<p class="msg">${esc(msg)}</p>` : ''}
      <label>Correo electrónico<input type="email" name="email" required autocomplete="username"></label>
      <label>Contraseña<input type="password" name="pass" required autocomplete="current-password" minlength="8"></label>
      <button class="btn btn-dark" type="submit">Entrar</button>
      <button class="link" type="button" id="olvido">¿Has olvidado tu contraseña?</button>
    </form>`;
    $('#fLogin').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Entrando…';
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.pass.value });
      if (error){ b.disabled = false; b.textContent = 'Entrar'; aviso('Correo o contraseña incorrectos.', true); return; }
      entrar();
    });
    $('#olvido').addEventListener('click', async () => {
      const email = $('#fLogin').email.value.trim();
      if (!email){ aviso('Escribe primero tu correo electrónico.', true); return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      aviso(error ? 'No se ha podido enviar el correo. Inténtalo más tarde.' : 'Te hemos enviado un correo para crear una contraseña nueva.', !!error);
    });
  }
  function nuevaClave(){
    app.innerHTML = `<form class="card narrow" id="fClave"><h1>Nueva contraseña</h1>
      <label>Contraseña nueva (mínimo 10 caracteres)<input type="password" name="p1" required minlength="10" autocomplete="new-password"></label>
      <label>Repítela<input type="password" name="p2" required minlength="10" autocomplete="new-password"></label>
      <button class="btn btn-dark" type="submit">Guardar contraseña</button></form>`;
    $('#fClave').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target;
      if (f.p1.value !== f.p2.value){ aviso('Las contraseñas no coinciden.', true); return; }
      const { error } = await sb.auth.updateUser({ password: f.p1.value });
      if (error){ aviso('No se ha podido cambiar la contraseña.', true); return; }
      aviso('Contraseña guardada.'); entrar();
    });
  }
  async function entrar(){
    const { data: { session } } = await sb.auth.getSession();
    if (!session){ login(); return; }
    const { data: ok, error } = await sb.rpc('es_admin_blog');
    if (error || !ok){ await sb.auth.signOut(); login('Esta cuenta no tiene permiso para gestionar el blog.'); return; }
    $('#who').innerHTML = `<span>${esc(session.user.email)}</span><button class="link" id="salir">Cerrar sesión</button>`;
    $('#salir').addEventListener('click', async () => { if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir igualmente?')) return; await sb.auth.signOut(); $('#who').innerHTML = ''; login(); });
    panel();
  }
  sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') nuevaClave(); });

  // ---------------- listado ----------------
  const ETQ = { publicado: 'Publicada', borrador: 'Borrador', retirado: 'Retirada' };
  const f = iso => iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  async function panel(){
    sucio = false; editando = null;
    app.innerHTML = `<div class="top"><div><h1>Panel de mi blog</h1><p class="muted">Escribe, guarda borradores y publica cuando quieras.</p></div>
      <button class="btn btn-dark" id="nueva">+ Nueva publicación</button></div>
      <div class="filtros" role="tablist">${['todas','publicado','borrador','retirado'].map(k => `<button data-f="${k}" class="${filtro === k ? 'on' : ''}">${{ todas: 'Todas', publicado: 'Publicadas', borrador: 'Borradores', retirado: 'Retiradas' }[k]}</button>`).join('')}</div>
      <div id="lista"><p class="muted">Cargando…</p></div>`;
    $('#nueva').addEventListener('click', () => editor(null));
    app.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.f; panel(); }));
    const { data, error } = await sb.from('blog_posts').select('id,slug,titulo,descripcion,portada_url,estado,publicado_en,actualizado').order('actualizado', { ascending: false });
    if (error){ $('#lista').innerHTML = '<p class="msg">No se han podido cargar las publicaciones.</p>'; return; }
    posts = data;
    const vis = posts.filter(p => filtro === 'todas' || p.estado === filtro);
    $('#lista').innerHTML = vis.length ? vis.map(p => `
      <div class="row">
        <div class="thumb">${p.portada_url ? `<img src="${esc(p.portada_url)}" alt="">` : ''}</div>
        <div class="info"><b>${esc(p.titulo)}</b><span class="st st-${p.estado}">${ETQ[p.estado]}</span>
          <small>${p.estado === 'publicado' ? 'Publicada el ' + f(p.publicado_en) : 'Última edición: ' + f(p.actualizado)}</small></div>
        <div class="acc">
          ${p.estado === 'publicado' ? `<a class="link" href="../blog/articulo/?a=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Ver</a>` : ''}
          <button class="link" data-ed="${p.id}">Editar</button>
          <button class="link bad" data-del="${p.id}">Eliminar</button>
        </div>
      </div>`).join('') : `<div class="empty">${filtro === 'todas' ? 'Todavía no hay publicaciones. Pulsa «Nueva publicación» para escribir la primera.' : 'No hay publicaciones en este apartado.'}</div>`;
    app.querySelectorAll('[data-ed]').forEach(b => b.addEventListener('click', async () => {
      const { data: p, error: e } = await sb.from('blog_posts').select('*').eq('id', b.dataset.ed).single();
      if (e){ aviso('No se ha podido abrir la publicación.', true); return; } editor(p);
    }));
    app.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => eliminar(posts.find(p => p.id === b.dataset.del))));
  }

  async function eliminar(p){
    if (!confirm(`¿Eliminar «${p.titulo}» para siempre?\n\nSe borrarán el texto y sus fotos. Esta acción no se puede deshacer.\nSi solo quieres quitarla de la web, ábrela y pulsa «Retirar».`)) return;
    const carpeta = `posts/${p.id}`;
    const { data: fs } = await sb.storage.from(B).list(carpeta, { limit: 1000 });
    if (fs && fs.length) await sb.storage.from(B).remove(fs.map(x => `${carpeta}/${x.name}`));
    const { error } = await sb.from('blog_posts').delete().eq('id', p.id);
    if (error){ aviso('No se ha podido eliminar.', true); return; }
    aviso('Publicación eliminada.'); panel();
  }

  // ---------------- fotos ----------------
  const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
  async function comprimir(file){
    if (!TIPOS.includes(file.type)) throw new Error('Solo se admiten fotos JPG, PNG o WEBP.');
    if (file.size > 25 * 1024 * 1024) throw new Error('La foto pesa demasiado (máximo 25 MB).');
    const img = await createImageBitmap(file);
    const k = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
    if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('No se ha podido preparar la foto.');
    return blob;
  }
  async function subir(file, id){
    const blob = await comprimir(file);
    const ruta = `posts/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await sb.storage.from(B).upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    if (error) throw new Error('No se ha podido subir la foto.');
    return sb.storage.from(B).getPublicUrl(ruta).data.publicUrl;
  }
  const elegir = (multiple) => new Promise(r => { const i = document.createElement('input'); i.type = 'file'; i.accept = TIPOS.join(','); i.multiple = !!multiple; i.onchange = () => r([...i.files]); i.click(); });

  // ---------------- editor ----------------
  const slugDe = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'articulo';
  function editor(p){
    const nuevo = !p;
    p = p || { id: crypto.randomUUID(), titulo: '', subtitulo: '', descripcion: '', portada_url: '', portada_alt: '', contenido: '', galeria: [], estado: 'borrador' };
    editando = { ...p, galeria: Array.isArray(p.galeria) ? p.galeria.slice() : [], nuevo };
    app.innerHTML = `<div class="top"><div><button class="link" id="volver">← Volver al panel</button><h1>${nuevo ? 'Nueva publicación' : 'Editar publicación'}</h1>
        <p class="muted">Estado: <span class="st st-${p.estado}">${ETQ[p.estado]}</span></p></div></div>
      <div class="ed">
        <label>Título del artículo<input id="eTit" maxlength="160" value="${esc(p.titulo)}" placeholder="Por ejemplo: Una tarde en velero frente a Barcelona"></label>
        <label><span>Subtítulo <span class="opt">(opcional)</span></span><input id="eSub" maxlength="240" value="${esc(p.subtitulo)}"></label>
        <label><span>Descripción breve <span class="opt">(sale en el listado del blog y en Google)</span></span><textarea id="eDes" maxlength="320" rows="3">${esc(p.descripcion)}</textarea><small class="cnt" id="cDes"></small></label>
        <label><span>Palabras clave <span class="opt">(separadas por comas; sirven para buscar en el blog. Ej.: velero, Barcelona, aniversario)</span></span><input id="eTags" maxlength="300" value="${esc((p.etiquetas || []).join(', '))}"></label>
        <div class="fld"><span class="lbl">Imagen de portada</span>
          <div class="cover" id="eCov">${p.portada_url ? `<img src="${esc(p.portada_url)}" alt="">` : '<span>Sin portada</span>'}</div>
          <div class="row-b"><button class="btn btn-line" id="bCov" type="button">${p.portada_url ? 'Cambiar portada' : 'Elegir portada'}</button>${p.portada_url ? '<button class="link bad" id="qCov" type="button">Quitar</button>' : ''}</div>
          <label><span>Descripción de la foto <span class="opt">(para personas con discapacidad visual y para Google)</span></span><input id="eAlt" maxlength="200" value="${esc(p.portada_alt)}"></label></div>
        <div class="fld"><span class="lbl">Contenido del artículo</span><div id="eCont"></div>
          <small class="muted">Usa la barra para poner títulos, negritas, cursivas, listas, enlaces o añadir una foto en medio del texto.</small></div>
        <div class="fld"><span class="lbl">Fotografías adicionales <span class="opt">(galería al final del artículo)</span></span>
          <div class="gal" id="eGal"></div><button class="btn btn-line" id="bGal" type="button">+ Añadir fotografías</button></div>
        <div class="fld"><span class="lbl">Estado</span><div class="estado">
          ${['borrador','publicado'].concat(p.estado === 'retirado' ? ['retirado'] : []).map(k => `<label class="chip"><input type="radio" name="est" value="${k}" ${p.estado === k ? 'checked' : ''}><span>${{ borrador: 'Borrador (solo lo ves tú)', publicado: 'Publicado (visible en la web)', retirado: 'Retirado (oculto, sin borrar)' }[k]}</span></label>`).join('')}</div></div>
      </div>
      <div class="bar">
        <button class="btn btn-line" id="bBor" type="button">Guardar borrador</button>
        <button class="btn btn-line" id="bPrev" type="button">Vista previa</button>
        ${p.estado === 'publicado' ? '<button class="btn btn-line" id="bRet" type="button">Retirar de la web</button><button class="btn btn-dark" id="bPub" type="button">Guardar cambios</button>' : '<button class="btn btn-dark" id="bPub" type="button">Publicar</button>'}
      </div>`;
    $('#volver').addEventListener('click', () => { if (!sucio || confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) panel(); });
    quill = new Quill('#eCont', { theme: 'snow', placeholder: 'Escribe aquí tu anécdota…', modules: { toolbar: { container: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], ['blockquote', { list: 'ordered' }, { list: 'bullet' }], ['link', 'image'], ['clean']], handlers: { image: fotoEnTexto } } } });
    if (p.contenido) quill.clipboard.dangerouslyPasteHTML(window.BLOG.limpiar(p.contenido));
    quill.on('text-change', () => sucio = true);
    app.querySelectorAll('.ed input, .ed textarea').forEach(i => i.addEventListener('input', () => sucio = true));
    const cuenta = () => $('#cDes').textContent = `${$('#eDes').value.length} / 320`; cuenta(); $('#eDes').addEventListener('input', cuenta);
    pintarGaleria(); sucio = false;

    $('#bCov').addEventListener('click', async () => {
      const [file] = await elegir(false); if (!file) return;
      try { aviso('Subiendo portada…'); editando.portada_url = await subir(file, editando.id); $('#eCov').innerHTML = `<img src="${esc(editando.portada_url)}" alt="">`; sucio = true; aviso('Portada lista.'); }
      catch (e){ aviso(e.message, true); }
    });
    const q = $('#qCov'); if (q) q.addEventListener('click', () => { editando.portada_url = ''; $('#eCov').innerHTML = '<span>Sin portada</span>'; sucio = true; });
    $('#bGal').addEventListener('click', async () => {
      const files = await elegir(true); if (!files.length) return;
      for (const file of files){
        if (editando.galeria.length >= 30){ aviso('Máximo 30 fotografías por artículo.', true); break; }
        try { aviso('Subiendo fotografías…'); editando.galeria.push({ url: await subir(file, editando.id), alt: '' }); sucio = true; pintarGaleria(); }
        catch (e){ aviso(e.message, true); }
      }
      aviso('Fotografías añadidas.');
    });
    $('#bBor').addEventListener('click', () => guardar('borrador'));
    $('#bPub').addEventListener('click', () => guardar('publicado'));
    const r = $('#bRet'); if (r) r.addEventListener('click', () => { if (confirm('El artículo dejará de verse en la web, pero no se borra. Podrás volver a publicarlo cuando quieras.')) guardar('retirado'); });
    $('#bPrev').addEventListener('click', vistaPrevia);
    app.querySelectorAll('input[name=est]').forEach(i => i.addEventListener('change', () => sucio = true));
  }
  async function fotoEnTexto(){
    const [file] = await elegir(false); if (!file) return;
    try { aviso('Subiendo foto…'); const url = await subir(file, editando.id); const r = quill.getSelection(true); quill.insertEmbed(r ? r.index : quill.getLength(), 'image', url, 'user'); aviso('Foto añadida.'); }
    catch (e){ aviso(e.message, true); }
  }
  function pintarGaleria(){
    const g = $('#eGal');
    g.innerHTML = editando.galeria.map((x, i) => `<figure><img src="${esc(x.url)}" alt=""><button type="button" data-q="${i}" aria-label="Quitar foto">×</button></figure>`).join('') || '<span class="muted">Sin fotografías adicionales.</span>';
    g.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { editando.galeria.splice(+b.dataset.q, 1); sucio = true; pintarGaleria(); }));
  }
  function datos(){
    return {
      titulo: $('#eTit').value.trim(), subtitulo: $('#eSub').value.trim() || null, descripcion: $('#eDes').value.trim() || null,
      portada_url: editando.portada_url || null, portada_alt: $('#eAlt').value.trim() || null,
      contenido: window.BLOG.limpiar(quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML),
      galeria: editando.galeria.map(g => ({ url: g.url, alt: g.alt || '' })),
      etiquetas: [...new Set($('#eTags').value.split(',').map(s => s.trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean))].slice(0, 12)
    };
  }
  async function guardar(estado){
    const d = datos();
    if (!d.titulo){ aviso('Escribe un título antes de guardar.', true); $('#eTit').focus(); return; }
    if (estado === 'publicado' && !d.contenido){ aviso('El artículo está vacío: escribe el contenido antes de publicarlo.', true); return; }
    if (estado === 'publicado' && !d.portada_url && !confirm('El artículo no tiene imagen de portada. ¿Publicarlo igualmente?')) return;
    const fila = { ...d, estado };
    let res;
    if (editando.nuevo){
      let slug = slugDe(d.titulo), n = 1;
      while (true){
        res = await sb.from('blog_posts').insert({ id: editando.id, slug, ...fila }).select().single();
        if (!res.error || res.error.code !== '23505' || n > 20) break;
        n++; slug = `${slugDe(d.titulo).slice(0, 76)}-${n}`;
      }
    } else {
      res = await sb.from('blog_posts').update(fila).eq('id', editando.id).select().single();
    }
    if (res.error){ aviso('No se ha podido guardar. Revisa tu conexión e inténtalo de nuevo.', true); return; }
    sucio = false;
    aviso({ borrador: 'Borrador guardado.', publicado: '¡Publicado! Ya se ve en la web.', retirado: 'Retirado de la web. Sigue guardado en Retiradas.' }[estado]);
    editor(res.data);
  }
  function vistaPrevia(){
    const d = datos();
    const ov = document.createElement('div'); ov.className = 'prev';
    ov.innerHTML = `<div class="prev-bar"><b>Vista previa</b> · así se verá en la web<button class="btn btn-light" type="button">Cerrar</button></div>
      <article class="bp">${window.BLOG.articuloHTML({ ...d, publicado_en: editando.publicado_en || new Date().toISOString() }, '../')}</article>`;
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    const cerrar = () => { ov.remove(); document.body.style.overflow = ''; };
    ov.querySelector('.prev-bar button').addEventListener('click', cerrar);
    ov.querySelectorAll('.bp a').forEach(a => a.addEventListener('click', e => e.preventDefault()));
    addEventListener('keydown', function k(e){ if (e.key === 'Escape'){ cerrar(); removeEventListener('keydown', k); } });
  }

  entrar();
})();
