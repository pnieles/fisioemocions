## Problema

`src/lib/roles.ts` usa `useSyncExternalStore` con un `getSnapshot` (`readRoles`) que hace `JSON.parse(localStorage...)` en cada llamada, devolviendo un array nuevo cada vez. React interpreta cada render como un cambio de estado y entra en un bucle infinito ("Maximum update depth exceeded" en `AppShell`). El mismo problema aplica en menor medida a `readActive` (string estable, no rompe, pero conviene ser consistente).

## Solución

Cachear el snapshot en el módulo y solo recomputarlo cuando cambia realmente (tras `writeRoles`/`writeActive` o un evento `storage`).

### Cambios en `src/lib/roles.ts`

1. Añadir dos variables módulo-nivel: `cachedRoles: Role[] | null` y `cachedActive: string | null`.
2. Crear `computeRoles()` que hace el parse actual y guarda en `cachedRoles`. `readRoles` (el `getSnapshot`) devuelve `cachedRoles ?? computeRoles()`.
3. Mismo patrón para `readActive` con `cachedActive`.
4. En `writeRoles` y `writeActive`: actualizar la caché con la nueva referencia antes de llamar a `emit()`.
5. En el listener de `storage` (dentro de `subscribe`): invalidar la caché (`cachedRoles = null; cachedActive = null`) antes de notificar, para que la próxima lectura recompute desde `localStorage`.
6. `getServerSnapshot` sigue devolviendo la constante estable `DEFAULT_ROLES` / `"admin"`.

Con esto, entre escrituras la referencia devuelta por `getSnapshot` es idéntica y React deja de re-renderizar en bucle. No se toca ningún otro archivo; `AppShell` y `RolesCard` seguirán funcionando igual.

## Verificación

- Recargar `/` y `/configuracion`, comprobar que no aparece el error en consola.
- Cambiar el rol activo desde `RolesCard` y confirmar que el menú lateral se actualiza correctamente.
