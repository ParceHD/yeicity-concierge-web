/* Conexión del blog con Supabase (Project Settings → API).
   Solo van aquí la URL del proyecto y la clave PÚBLICA "anon": está pensada para ir en la web.
   La seguridad la dan las políticas de la base de datos (ver _herramientas/blog-supabase.sql).
   NUNCA pongas aquí la clave "service_role". */
window.BLOG_CONFIG = {
  url: 'https://tgxiyfujkabcjcxpkcqw.supabase.co',
  anonKey: 'sb_publishable_pZLgJwvyF6pZ2_Fu86VJsA_Eo99GH7E',  // clave pública (publishable)
  bucket: 'blog'
};
