# Guía Rápida: Cómo Instalar y Usar la App en el Móvil 100% Offline

Esta app está diseñada como una **PWA (Progressive Web App)** nativa: no necesita internet, no depende de ningún servidor remoto y todos tus datos se almacenan exclusivamente en la memoria local de tu teléfono mediante **IndexedDB**.

---

## Opción 1: En tu red Wi-Fi local (La más directa desde tu PC)

1. En tu ordenador, abre la terminal dentro de esta carpeta y arranca el servidor local:
   ```bash
   node scripts/serve-lan.mjs
   ```
2. La consola te mostrará una dirección de red local (por ejemplo `http://192.168.1.X:4173`).
3. Con tu móvil conectado a la misma red Wi-Fi, abre esa dirección en tu navegador:
   - **En Android (Google Chrome):**
     Toca el menú de los tres puntos `⋮` arriba a la derecha y pulsa **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.
   - **En iPhone (Safari):**
     Toca el botón central de **Compartir** (icono de cuadrado con una flecha hacia arriba) y pulsa **"Añadir a pantalla de inicio"**.
4. ¡Listo! Se creará un icono con el logotipo de la app en la pantalla de inicio de tu teléfono como si fuera una app nativa descargada de la tienda.
5. Puedes apagar el ordenador o poner el móvil en **Modo Avión**: la app continuará funcionando al 100% para siempre.

---

## Opción 2: Subir la carpeta `dist` a la nube estática (Netlify Drop / Vercel / GitHub Pages)

Si prefieres tener un enlace `https://` permanente para instalarla en cualquier momento sin depender de tu Wi-Fi:
1. Compila la app:
   ```bash
   npm run build
   ```
2. Entra en [app.netlify.com/drop](https://app.netlify.com/drop) (gratuito) y arrastra la carpeta `dist/`.
3. Te dará un enlace HTTPS propio. Ábrelo en tu móvil y pulsa **"Instalar aplicación"**.
4. A partir de esa primera visita, el Service Worker cachea todos los archivos en tu teléfono y **nunca más necesitará internet**.

---

## Funcionalidades Clave de la App

- **Natación:**
  - Registra metros en **Crol, Espalda, Braza y Mariposa** con botones rápidos `+25`, `+50`, `+100`.
  - Los **Metros Totales** se sincronizan automáticamente con la suma de estilos o puedes escribir directamente un total si ese día no desglosas o haces nado variado.
  - Al poner minutos y segundos, calcula al instante tu **Ritmo medio (`mm:ss / 100m`)**.
- **Calistenia y Pesas con Mancuerna:**
  - Trae precargados de serie tus ejercicios:
    - *Dominadas*, *Dominadas Comando*, *Chin-ups*, *Flexiones en Pica Elevadas*, *Fondos*.
    - *Curl de Bíceps* (mancuernas) y *Tríceps Apoyado con Mancuerna*.
  - En cada ejercicio puedes elegir **Modo Series** (con botón de repetir serie y precarga del último peso usado) o **Modo Rápido** (total de repeticiones del día).
  - En la pestaña **Ajustes** puedes añadir ejercicios nuevos o renombrar los existentes cuando quieras.
- **Calendario Mensual Interactivo:**
  - Cuadrícula con mapa de calor y puntos de color por disciplina (Cian = Piscina, Verde = Calistenia, Ámbar = Pesas, Violeta = Peso corporal).
  - Toca cualquier día para ver su resumen completo y editarlo.
- **Gráficas de Todo:**
  - Natación: Metros totales, desglose apilado, curva individual por estilo, ritmo y donut histórico.
  - Fuerza: Progresión de reps, récord de mejor serie, peso de mancuerna usado día a día y 1RM estimado.
  - Peso mensual: Evolución continua de peso corporal interpolado y fuerza relativa.
- **Motor Matemático Diario y Predicción:**
  - Puntuación compuesta de rendimiento base 100 día a día (con descansos y supercompensación).
  - Modelo de carga fisiológica (Forma crónica vs Fatiga aguda vs Frescura).
  - Estimaciones y proyecciones automáticas a **+30 días** y **+90 días**.
- **Copia de Seguridad en 1 Toque:**
  - En **Ajustes**, pulsa **Exportar Copia (.json)** para guardar o compartir un respaldo de todos tus datos.
