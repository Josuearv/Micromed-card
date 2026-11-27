# Plan de implementación — Game UX V4

## Reglas
Rama de implementación sugerida feature/game-ux-ui-v4, creada desde main una vez revisada esta documentación. No mezclar cambios de motor, UI y assets sin pruebas; commits pequeños, PRs draft, no merge automático. Preservar API/compatibilidad donde sea posible. No reemplazar el proyecto ni migrar Three.js a otra librería por preferencia. Sin nuevas mecánicas/valores sin decisión registrada. Documentación fuera de public. Usar catálogo real como fuente de datos, no valores hardcodeados de mockup.

## Secuencia con gates
| Tarea | Depende | Trabajo / archivos | Aceptación |
|---|---|---|---|
| UX-V4-00 | documentación | baseline local, package.json, tests, capturas, inventario y mediciones | build/lint/tests registrados; reproducción de UX-001/002/003/006/011; no cambios funcionales antes de baseline |
| UX-V4-01 | 00 | corregir integridad de sesión y comandos: App, persistence, combatEngine, tests | P0 verificadas; recovery consistente y guardado visible; regresión V3 |
| UX-V4-02 | 00 | piloto arte CV-ART-01: seis referencias, manifiesto, contacto de miniaturas | aprobación humana de estilo y anatomía; sin producción masiva |
| UX-V4-03 | 01,02 | wireframes S01–S15 y 3 tamaños; tokens y componentes base; index.css | revisión de layout, legibilidad, interacción, contraste; sin motor nuevo |
| UX-V4-04 | 03 | CardVisual, Inspector, Deck; arte inicial y fallback SVG | cartas coherentes, coste/objetivo/regla accesibles, modales y focus, sin alterar catálogo |
| UX-V4-05 | 03,04 | GameHUD/ArenaBoard: layout, intents, selector de preview, CTA, event log | intenciones por carril y global, previsión pura verificada contra resolución, 2D/3D equivalentes |
| UX-V4-06 | 02,05 | MedicalTableCanvas/organRigs/bioEntities: cámara, áreas seguras, modelos, picking, recursos | cinco órganos legibles, sin solapamientos, fallback, medición GPU antes/después |
| UX-V4-07 | 04,05 | TitleScreen/EndModals/DeckModal; briefing, pausa, resultado, recompensa confirmable | continuar, nuevo, inspeccionar, elegir/omitir y volver al menú seguros |
| UX-V4-08 | 05,06 | director audiovisual y soundEngine; cola, salida de unidad, efectos, volumen | eventos visibles/sonoros en orden, modo rápido/reducido, cancelación segura |
| UX-V4-09 | 07 | tutorial por objetivos y entrenamiento reproducible | todas las mecánicas básicas explicadas, skip/replay; no afecta récord |
| UX-V4-10 | 05,07,08 | mobile, tablet, accesibilidad y calidad adaptativa; todos componentes | navegación teclado/touch/2D, modales, contraste, movimiento reducido, sin pérdida de controles |
| UX-V4-11 | 01–10 | playtesting, simulación de dificultad, revisión médica y QA | evidencia y comparación baseline; bugs críticos cerrados; hipótesis balance documentadas |
| UX-V4-12 | 02,04,06 | completar catálogo restante y escenarios, optimizar assets | manifiesto completo, derechos y QA; no placeholders silenciosos |

## Arquitectura objetivo (incremental, no carpetas obligatorias)
Motor determinista mantiene verdad de reglas, snapshots y RNG. Controller traduce intención del usuario a comando. Selectores puros derivan targets, costes y previsiones. UI HTML/CSS mantiene accesibilidad y layout. Three.js es representación: separar lifecycle de escena, cámara, proyección, picking, recursos, entidades, órganos y AnimationDirector sin reescribir todo. Compartir contrato de eventos con sonido; recursos propios y compartidos tienen ownership y dispose verificable. Guardado estable y recuperable, preferencia 2D independiente de lógica. DPR/LOD/sombras adaptativos solo después de medir. No introducir bloom pesado sin prueba.

## Matriz mínima de QA
- Viewports: 360×800, 390×844, 768×1024, 1366×768, 1920×1080; portrait/landscape, zoom 200%, DPR 1 y 2, teclado y touch.
- Estados: mano vacía/llena, PA insuficiente, 0/3 aliados y 3/3 enemigos, ambos slots de trampa, estados múltiples, fase rival, jefe, 5 órganos, clásico e infinito, pérdida de WebGL, storage corrupto, modales apilados, animaciones normal/rápida/reducida.
- Tests unitarios: rechazo atómico de comandos, RNG determinista, invariantes, preview parity, ciclo de cartas y traps, guardado a cada frontera, pausa/resume.
- Browser E2E (herramienta a justificar, por ejemplo Playwright): recorrido menú→guardia→recompensa→siguiente, reload en resolución, teclado, capturas por seed. No afirmar ejecución si no hay entorno.
- Visual: referencia y screenshot comparables; revisar arte a tamaño real, contraste, recorte, foco, HUD y órgano.
- Performance: establecer equipo/navegador, objetivo inicial 60fps escritorio / 30fps móvil o fallback estable; frame p95, draw calls, consumo GPU y tiempo de carga; presupuesto de assets después de baseline. No extrapolar resultados de software GL a todos los dispositivos.
- Playtesting formativo 5–8 personas, nuevos y expertos; tareas sin guía adicional, think-aloud, registrar tiempo/errores/abandono. Metas iniciales (no resultados): identificar amenaza <5s, primera acción válida <30s, comprensión daño ≥90%, tutorial ≥85%, cero pérdida de progreso y solapamientos críticos en matriz. En muestra pequeña informar n y conteos, no generalizar porcentajes.
- Balance: simulaciones con seeds fijas, varias políticas de juego, curvas por guardia, duración, recursos, cartas elegidas y causas de derrota; no usar agentes perfectos como sustituto de jugadores.

## Prompt inicial para el agente de código
```text
Actúa como senior game developer, UX engineer y Three.js engineer en Micromed-card.
Lee todos los docs/game-v4/ en orden y contrástalos con HEAD. No implementes
todo de golpe. Primera tarea exclusiva UX-V4-00:
1. Verifica git status, rama y SHA; no sobreescribas cambios locales.
2. Inspecciona package.json, bun.lock, pruebas y comandos disponibles.
3. Ejecuta baseline build/lint/tests con herramientas compatibles; documenta
   comandos, resultados, limitaciones y errores sin ocultarlos.
4. Reproduce riesgos P0 de 04-audit-remediation.md; captura pantallas y registra
   seed, viewport y pasos. Si no puedes reproducir, deja estado abierto.
5. Propón plan granular con archivos, dependencias, tests y riesgos para
   UX-V4-01. No modifiques reglas, arte ni producción en esta tarea.
6. Guarda evidencia en docs/game-v4/qa/ y presenta reporte para revisión.
Tras aprobación, crea rama feature/game-ux-ui-v4 desde el SHA verificado,
implementa una tarea por vez, ejecuta regresión y abre PR draft. No hagas merge.
Los prompts de imágenes deben reutilizar CV-ART-01 y el catálogo real; generar
primero seis referencias piloto y esperar aprobación del estilo.
```

## Definición de terminado por tarea
Código y docs consistentes, pruebas reproducibles, capturas/resultado verificables, no regresión de modo clásico/infinito/2D, no assets sin licencia o manifiesto, riesgos pendientes explícitos, PR sin merge hasta revisión. Registro: ID, estado, SHA, responsable, evidencia, decisión, limitaciones, siguiente paso. Actualmente todos los bloques de ejecución están PENDING; esta entrega solo establece el plan.
