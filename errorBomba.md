# Error Bomba - Electron OOM

## Problema
- La carpeta `desktop/` contenia una app Electron que causaba errores OOM (out of memory)
- node_modules se quedaba trancado con errores de memoria
- Se llevo 1 hora tratando de arreglarlo sin exito

## Solucion Applied
Se elimino completamente Electron del proyecto:

### Local
- `desktop/` - eliminada
- `package-lock.json` (raiz) - eliminado

### GitHub
- Se eliminaron 5 archivos de la carpeta `desktop/` del repo `ale061191/agenteScrapling`:
  - desktop/README.md
  - desktop/SPEC.md
  - desktop/package.json
  - desktop/python/api_server.py
  - desktop/python/requirements.txt
  - desktop/src/main/main.js
  - desktop/src/main/preload.js

## Estado Actual del Repo
El repo `agenteScrapling` en GitHub ahora solo contiene:
- `lead_finder/` - modulo Python del scraper
- `dashboard/` - app Next.js (desplegada en Vercel)
- `leads_data/` - datos SQLite y archivos de leads
- `microservice/` - scraper API
- `main.py` - CLI del scraper
- `AGENTS.md` - documentacion
- `supabase_schema.sql` - schema de BD
- `vercel.json` - config Vercel

## Lo que se Quiere Hacer
Reemplazar la app Electron por una app Flutter multiplataforma.

### Pasos sugeridos para continuar en otro momento/lugar:

1. **Eliminar dashboard/ de este repo** (ya no se necesita Next.js)
2. **Crear proyecto Flutter** en otra carpeta o en otro repo
3. **El proyecto Flutter deberia:**
   - Conectar a Supabase para leer/escribir leads
   - Tener la misma funcionalidad que el dashboard actual (ver leads, pipeline kanban, estadisticas, buscar nuevos leads)
   - Ser multiplataforma: Windows, Mac, Linux, Android, iOS
4. **Mantener el scraper Python** (`lead_finder/`, `main.py`) para ejecutar localmente y sincronizar a Supabase

### Configuracion necesaria para Flutter:
- Supabase URL: `https://vdknyyempgailnbnxeqz.supabase.co`
- Supabase Anon Key: `sb_publishable_GXskpY7mq_pnwO0EFA4Cfw_Ws-5BfDh`
- Tablas: `leads`, `campaign_log`

### Nota Importante
El deploy actual en Vercel (dashboard Next.js) seguira funcionando independientemente. Cuando se decida reemplazar por Flutter, se puede eliminar o mantener el deploy de Vercel.