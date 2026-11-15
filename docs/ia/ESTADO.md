# ESTADO DEL PROYECTO: Apps (Aplicaciones Web y Móviles)

**Última actualización:** 15/11/2026
**Responsable:** MaikikiaM / Antigravity AI

## 1. Misión y Alcance
Monorrepo de aplicaciones autónomas para Android y Web, orientadas al rendimiento local, reproducción multimedia offline y herramientas de referencia.

## 2. Aplicaciones y Componentes
- `spotilocal/`: Reproductor de música offline nativo Android / PWA (versión v1.8.7 activa). Servidor local Node.js (`server.js`), motor de audio HTML5/ExoPlayer, IndexedDB transaccional, copia nativa durable (`NativeBackupStore`) y persistencia exacta por canción.
- `entrena-offline/`: Aplicación de seguimiento de entrenamientos (natación por estilos, calistenia y pesas), horario semanal recurrente ordenado por días (L–D) y horas con calendario visual compacto estilo Google Calendar (`Ajustado`/`Ampliado` con rango 08:00–22:30 visible sin scroll y modal centrado al pulsar evento), categorías ampliadas (`Universidad`, `Conservatorio`, etc.) con Accuracy por categoría y por evento, motivos de incumplimiento clasificados por mismas palabras y palabras clave repetidas, bloques complementarios de transporte (`Ida`/`Vuelta`) sin cómputo de accuracy, agrupación automática por nombre con horas acumuladas (`Semana`/`Mes`/`Año`/`Histórico`) y blindaje multi-capa + backup nativo Android (v2.2).
- `tabla-periodica/`: Aplicación interactiva de la tabla periódica de los elementos, con vista adaptada para paneles OLED y fondos de pantalla interactivos.
- `registro.txt`: Historial técnico unificado de SpotiLocal y demás aplicaciones.

## 3. Estado de Compilación y Builds
- `spotilocal`: v1.8.7 empaquetada (`SpotiLocal_v1.8.7.apk` / `SpotiLocal.apk`, versionCode 29) y sincronizada desde `Proyectos IA varios\SpotiLocal` (`tests/spotilocal.test.mjs` + tests JUnit4 Android).
- `entrena-offline`: v2.2 verificada (`npm test`: 25/25 tests Vitest en 4 archivos, `npm run build` Vite PWA, `EntrenaOffline_v2.2.apk` / `EntrenaOffline.apk` versionCode 13 firmado v2/v3).
- `tabla-periodica`: Web app pura estática sin dependencias externas.

## 4. Tareas Prioritarias
- [ ] Mantener sincronización del monorrepo con GitHub `Apps`.
- [ ] Excluir APKs, canciones y node_modules del control de versiones.
