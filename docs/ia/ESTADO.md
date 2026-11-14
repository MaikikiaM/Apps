# ESTADO DEL PROYECTO: Apps (Aplicaciones Web y Móviles)

**Última actualización:** 14/11/2026
**Responsable:** MaikikiaM / Antigravity AI

## 1. Misión y Alcance
Monorrepo de aplicaciones autónomas para Android y Web, orientadas al rendimiento local, reproducción multimedia offline y herramientas de referencia.

## 2. Aplicaciones y Componentes
- `spotilocal/`: Reproductor de música offline nativo Android / PWA (versión v1.8.7 activa). Servidor local Node.js (`server.js`), motor de audio HTML5/ExoPlayer, IndexedDB transaccional, copia nativa durable (`NativeBackupStore`) y persistencia exacta por canción.
- `entrena-offline/`: Aplicación de seguimiento de entrenamientos (natación por estilos, calistenia y pesas), horario semanal recurrente con tracking de accuracy, motor matemático de progresión en React + TypeScript + Vite y blindaje multi-capa + backup nativo Android (v1.4).
- `tabla-periodica/`: Aplicación interactiva de la tabla periódica de los elementos, con vista adaptada para paneles OLED y fondos de pantalla interactivos.
- `registro.txt`: Historial técnico unificado de SpotiLocal y demás aplicaciones.

## 3. Estado de Compilación y Builds
- `spotilocal`: v1.8.7 empaquetada (`SpotiLocal_v1.8.7.apk` / `SpotiLocal.apk`, versionCode 29) y sincronizada desde `Proyectos IA varios\SpotiLocal` (`tests/spotilocal.test.mjs` + tests JUnit4 Android).
- `entrena-offline`: v1.4 verificada (`npm test`: 22/22 tests Vitest en 4 archivos, `npm run build` Vite PWA, `EntrenaOffline_v1.4.apk` / `EntrenaOffline.apk` versionCode 5 firmado v2/v3).
- `tabla-periodica`: Web app pura estática sin dependencias externas.

## 4. Tareas Prioritarias
- [ ] Mantener sincronización del monorrepo con GitHub `Apps`.
- [ ] Excluir APKs, canciones y node_modules del control de versiones.
