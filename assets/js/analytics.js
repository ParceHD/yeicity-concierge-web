/* Yei City Concierge — aviso de cookies + Google Analytics 4.
   Analytics solo se carga si la persona acepta (LSSI / RGPD). La elección se guarda en localStorage ('ycc-cookies').
   Mide también los contactos: WhatsApp, envíos del formulario y reservas desde las actividades. */
(function(){
  const GA_ID = 'G-EJWJVDT7QJ';
  const KEY = 'ycc-cookies';
  const root = document.documentElement;
  const get = ()=>{ try{ return localStorage.getItem(KEY); }catch(e){ return null; } };
  const put = v=>{ try{ localStorage.setItem(KEY, v); }catch(e){} };
  // ruta a la raíz de la web (para el enlace a la política), según dónde esté este script
  const me = document.currentScript && document.currentScript.getAttribute('src') || 'assets/js/analytics.js';
  const base = me.replace(/assets\/js\/analytics\.js.*$/, '');

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  let cargado = false;
  function cargar(){
    if (cargado) return; cargado = true;
    gtag('js', new Date());
    gtag('config', GA_ID);
    const s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }
  const evento = (n, p)=>{ if (cargado) gtag('event', n, Object.assign({ idioma: root.dataset.lang || 'en' }, p || {})); };

  // ---------- aviso ----------
  const css = `
.ck{position:fixed;z-index:90;left:20px;bottom:20px;max-width:420px;background:var(--paper,#FBF7F1);color:var(--ink,#2E2723);border:1px solid rgba(58,47,41,.14);border-radius:20px;padding:20px 22px;box-shadow:0 30px 60px -30px rgba(46,36,30,.55);font-size:14px;line-height:1.5;transform:translateY(20px);opacity:0;transition:transform .5s cubic-bezier(.2,.7,.1,1),opacity .5s}
.ck.on{transform:none;opacity:1}
.ck b{display:block;font-family:var(--serif,Georgia,serif);font-weight:500;font-size:21px;margin-bottom:6px}
.ck a{color:var(--gold-deep,#9C7A3A);text-decoration:underline;text-underline-offset:3px}
.ck .ck-b{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
.ck button{font:inherit;font-weight:600;font-size:14px;padding:10px 20px;border-radius:999px;cursor:pointer;border:1px solid rgba(58,47,41,.2);background:#fff;color:var(--ink,#2E2723)}
.ck button.ok{background:var(--night,#3A2F29);border-color:var(--night,#3A2F29);color:var(--paper,#FBF7F1)}
@media (max-width:560px){ .ck{left:12px;right:12px;bottom:12px;max-width:none} }`;
  function aviso(){
    if (document.querySelector('.ck')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const d = document.createElement('div'); d.className = 'ck'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Cookies');
    d.innerHTML = `<b><span class="es">Cookies</span><span class="en">Cookies</span></b>
      <span class="es">Usamos cookies de analítica (Google Analytics) para saber cómo se usa la web y mejorarla. Solo se activan si aceptas. <a href="${base}legal/cookies/">Más información</a></span>
      <span class="en">We use analytics cookies (Google Analytics) to understand how the site is used and improve it. They are only enabled if you accept. <a href="${base}legal/cookies/">More info</a></span>
      <div class="ck-b"><button class="ok" data-ck="si"><span class="es">Aceptar</span><span class="en">Accept</span></button><button data-ck="no"><span class="es">Rechazar</span><span class="en">Reject</span></button></div>`;
    document.body.appendChild(d);
    requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.add('on')));
    d.querySelectorAll('[data-ck]').forEach(b=>b.addEventListener('click', ()=>{
      put(b.dataset.ck); if (b.dataset.ck === 'si') cargar();
      d.classList.remove('on'); setTimeout(()=>d.remove(), 500);
    }));
  }
  // cualquier elemento con data-cookies (p. ej. en la política) vuelve a abrir el aviso
  document.addEventListener('click', e=>{ const t = e.target.closest('[data-cookies]'); if (t){ e.preventDefault(); aviso(); } });

  const v = get();
  if (v === 'si') cargar();
  else if (v !== 'no'){ if (document.body) aviso(); else document.addEventListener('DOMContentLoaded', aviso); }

  // ---------- contactos y reservas ----------
  document.addEventListener('click', e=>{
    const a = e.target.closest('a, button'); if (!a) return;
    if (a.matches('a[href*="wa.me"]')) evento('contacto_whatsapp', { boton: a.id || a.className || 'enlace' });
    else if (a.matches('a[href^="mailto:"], a[href*="mail.google.com"]')) evento('contacto_email');
    else if (a.matches('a[href*="instagram.com"]')) evento('contacto_instagram');
    else if (a.matches('.add')){ try{ evento('actividad_anadida', { actividad: JSON.parse(a.closest('.act').dataset.item).es }); }catch(err){} }
    else if (a.id === 'selGo') evento('reservar_seleccion', { actividades: Number((document.getElementById('selN')||{}).textContent) || 0 });
  }, true);
  document.addEventListener('submit', e=>{
    if (!e.target.matches('#form')) return;
    evento('solicitud_formulario', { via: (e.submitter && e.submitter.dataset.via) || 'form', destino: (e.target.querySelector('input[name="dest"]:checked')||{}).value || '' });
  }, true);
})();
