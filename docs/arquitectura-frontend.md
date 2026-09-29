# Arquitectura frontend

El frontend se organiza por responsabilidad y por dominio de negocio. Las pantallas de un mismo flujo deben permanecer juntas aunque distintos roles las utilicen.

## Carpetas principales

- `src/app`: composición de la aplicación, navegación, permisos y resolución de vistas.
- `src/domain`: contratos compartidos del negocio, sin dependencias de React o Supabase.
- `src/features`: páginas y componentes agrupados por dominio funcional.
- `src/services`: acceso a Supabase y operaciones remotas. Las vistas no consultan Supabase directamente.
- `src/components`: componentes visuales compartidos por varios dominios.
- `src/store`: estado global y sincronización de fuentes compartidas.
- `src/utils`: funciones puras reutilizables.
- `src/views`: experiencias completas específicas de un rol, como dashboards, perfil y manual.

## Reglas

1. Un dominio nuevo se crea bajo `src/features/<dominio>`.
2. Las diferencias entre roles se expresan con permisos o modos de una misma funcionalidad, no duplicando el dominio.
3. Los menús, títulos y accesos se declaran en `src/app/navigation.ts`.
4. El acceso remoto se encapsula en `src/services`; una página consume funciones del servicio y no el cliente de Supabase.
5. Los tipos de negocio viven en `src/domain/types.ts`.
6. Un archivo de página debe delegar tablas, formularios, modales y lógica reutilizable cuando crezca. La página conserva la composición del flujo.

## Estructura

```text
src/
  app/
    navigation.ts
    ViewRouter.tsx
  domain/
    types.ts
  features/
    compras/pages/
    consultas/pages/
    devoluciones/pages/
    entregas/pages/
    inventario/pages/
    proyectos/pages/
    reportes/pages/
    requerimientos/pages/
    transporte/pages/
    usuarios/pages/
  services/
  components/
  store/
  utils/
  views/
```
