/* Conexión del blog con Supabase (Project Settings → API).
   Solo van aquí la URL del proyecto y la clave PÚBLICA "anon": está pensada para ir en la web.
   La seguridad la dan las políticas de la base de datos (ver _herramientas/blog-supabase.sql).
   NUNCA pongas aquí la clave "service_role". */
window.BLOG_CONFIG = {
  url: '',      // p. ej. 'https://abcdefghijkl.supabase.co'
  anonKey: '',  // clave "anon public"
  bucket: 'blog'
};
