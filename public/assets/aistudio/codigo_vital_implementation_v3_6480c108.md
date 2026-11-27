# Código Vital — Plan de implementación V3 basado en auditoría del repositorio

**Fecha:** 27-11-2026 | **Estado:** propuesta de implementación; sin cambios remotos.
**Base inmutable:** [Josuearv/Micromed-card, eed9bb9328f4db83b44a5337e3f2e200a5fc5385](https://github.com/Josuearv/Micromed-card/tree/eed9bb9328f4db83b44a5337e3f2e200a5fc5385). Este documento sustituye las instrucciones contradictorias del V2; conserva sus objetivos de diseño. Auditoría estática del árbol y archivos principales mediante GitHub; no se ejecutó build, juego, benchmark, simulación ni pruebas. Los riesgos inferidos deben reproducirse antes de modificar. Los criterios cuantitativos son objetivos propuestos, no mediciones.

## 1. Decisiones y límites

Conservar React, Three.js imperativo, TypeScript, Tailwind, Motion, Web Audio y el estilo clínico. No migrar a Unity, R3F, WebGPU, ECS o backend por defecto. Conservar modo clásico de tres duelos como tutorial/regresión; Guardia Infinita es el modo nuevo principal. Mantener cinco órganos, dos ranuras de trampa, mutadores, cartas de brote, draft 1 de 3/omitir y visor de mazo. El diseño es ficción educativa, no herramienta clínica. No alterar assets, borrar sistemas, hacer push/merge o publicar sin autorización. La cámara y el audio no pueden determinar resultados.

## 2. Inventario real y alcance

| Ruta | Baseline | Decisión |
|---|---|---|
| `package.json` | React ^19.0.1, Three ^0.187.0, Vite ^8.3.0, TS ^7.0.2, Tailwind ^4.3.3, Motion ^12.23.24. Scripts dev/build/preview/lint; sin test | Verificar lock Bun e instalación reproducible, no actualizar dependencias por capricho |
| `src/App.tsx` | 856 líneas; fase, campaña, UI, refs, timers | Extraer controlador de partida gradualmente |
| `src/engine/combatEngine.ts` | 1101 líneas; reglas, ataques, habilidades, pasos de turno | Mantener API temporalmente y crear núcleo determinista |
| `src/types/game.ts` | 203 líneas; cartas, unidades, intent, eventos | Ampliar contratos con migración explícita |
| `src/data/medicalCards.ts` | 552 líneas; 11 definiciones iniciales, 14 instancias iniciales, 3 recompensas, 5 enemigos, 3 duelos | Separar catálogo, recetas, enemigos y casos, conservar IDs |
| `src/components/MedicalTableCanvas.tsx` | 1005 líneas; renderer, cámara, VFX, picking, proyección DOM, ciclo render | Extraer subsistemas sin reemplazar renderer |
| `src/three/{models,bioEntities,textures}.ts` | Modelos procedurales, partículas y eritrocitos instanciados, texturas canvas | Conservar y ampliar con rigs anatómicos, gestión de recursos |
| `src/components/{ArenaBoard,GameHUD,CardVisual,CardInspectorModal,TitleScreen,EndModals}.tsx` | HUD híbrido, controles, diálogos y tutorial | Mejorar jerarquía, responsive, accesibilidad |
| `src/audio/soundEngine.ts` | Web Audio procedural | Reutilizar, añadir colas, niveles y controles |

## 3. Registro de hallazgos y pruebas de reproducción

Las referencias son líneas del commit auditado. P0: condición de integridad previa al contenido. P1: núcleo/UX. P2: pulido y optimización medida.

| ID | Evidencia | Impacto y prueba | Corrección |
|---|---|---|---|
| A01 P0 | engine:416–488 | `resolvePlayCard` resta PA y descarta todas las cartas antes de resolver; invocar, vaciar pila y verificar si reaparece carta de unidad viva | Identidad de instancia y zonas exclusivas; unidad a campo hasta morir, tratamiento a descarte tras resolver |
| A02 P0 | engine:136–175,416–443; App:237–267 | Validación parcial separada; invocar función con PA insuficiente, objetivo inválido, carril ocupado/índice fuera de rango | `validateCommand` en frontera de dominio; error sin cambios, sin eventos y sin incrementar contador; no redirigir silenciosamente a otro carril |
| A03 P0 | App:549–600,666–731,830 | Pausa cambia estado visual pero callback programado puede seguir; reproducir pausa/inspector/reinicio durante resolución | Resolver reglas sin temporizadores, pausa de presentación o guardar cursor; cancelación mediante generation token; política explícita |
| A04 P0 | App:43–75,167–225 | Vida siempre 4000 al nuevo duelo, incompatible con attrition de infinita | `RunState` guarda LP y aplica recuperación solo una vez en transición; clásico conserva curación actual |
| A05 P1 | medicalCards:507–552; engine:44–53,109–133 | RNG y IDs globales impiden reproducibilidad completa | RNG y secuencias de IDs serializadas por run, RNG cosmético separado |
| A06 P1 | engine:109–134,950–1099 | Intención solo invocación/mutación; ataques directos de carriles desprotegidos no se enumeran como plan | `IntentAction[]` con actor, target, condición, daño, política de invalidación; no sustituir plan por buff secreto |
| A07 P1 | engine:291–415; App:625–638 | Ataque libre a cualquier enemigo y ataque obligatorio; reduce valor de carriles y fuerza intercambios | Prototipo de alcance y defender/pasar; mantener perfil de reglas clásico hasta probar |
| A08 P1 | engine:861–948,950–1014,350–368 | Estados decrecen antes de presión rival; aturdimiento se consume en contraataque o presión; semántica ambigua | Tabla de duración y momento de expiración; pruebas de preview, contraataque y presión |
| A09 P1 | medicalCards:289–351; App:167–179,640–652 | Pool de 3 cartas: draft varía solo orden; mazo crece sin gestión | Ampliar pool gradualmente y agregar sustituir/mejorar/eliminar en oportunidades limitadas |
| A10 P1 | App:142–165; canvas:147–160 | Solo último evento de lote llega a VFX/audio | Cola ordenada de eventos con snapshots y IDs; pausa/skip/velocidad no altera estado |
| A11 P1 | HUD:131–454; CardVisual:170–239; ArenaBoard:141–372 | Tipografía 9–11 px, tamaños fijos, rival oculto en móvil, anclas flotantes | Layout adaptativo, inspector, prioridades, teclado y tacto |
| A12 P1 | App:781–790 | Clic en deck solo notifica contadores | `DeckViewer` con mazo maestro, mano, robo, descarte, campo y filtros |
| A13 P1 | canvas:472–521,880–954 | Selección en pointerdown puede interferir con órbita; opacidad 0 no desactiva foco; riesgo de colisión/ocultación | Click al soltar con umbral de arrastre; cámara táctica por defecto; DOM inerte si oculto; layout de anclas relativo al canvas |
| A14 P2 | canvas:161–218,538–565,954–1000 | Ya hay cleanup, proxies, DPR cap, modo software; falta fallback visible y política de context restore; validar fence y recursos | Medir primero; registro de ownership/dispose, suspender vista oculta, fallback 2D y restaurar visual sin perder run |
| A15 P1 | package.json:6–12; árbol sin tests | No hay suite declarada | Vitest o runner compatible con baseline + Playwright para E2E; CI tras verificar dependencias |
| A16 P1 | engine:583–612,919–943; engine:519–552 | Adrenalina acumula ATK permanentemente mientras elimina sobrecarga al cierre; vacuna acumula stats y roba; riesgo de escalado por reciclaje | Reproducir y balancear; definir duración explícita, límites y/o agotamiento solo tras medición |
| A17 P1 | data:418–437 | SARM se presenta como bacilo aunque S. aureus es coco; diagnóstico/PCR y vacunas tienen efectos ficticios | Revisión profesional de contenido, separar regla de juego de explicación médica y fuentes |

## 4. Motor objetivo y migración incremental

No mover todo `combatEngine.ts` en el primer PR. Primero caracterizar las funciones actuales con pruebas; después extraer por dominio. Nombres de archivos nuevos propuestos, no rutas existentes.

```text
src/engine/
  combatEngine.ts          # fachada de compatibilidad durante migración
  commands.ts              # discriminated union + validateCommand
  reducer.ts               # transición pura, resultado con eventos
  rng.ts                   # semilla, estado RNG y shuffle
  zones.ts                 # instancias y movimientos de zona
  attacks.ts               # cálculo compartido preview/resolución
  effects.ts               # resolución de efectos y duración
  intents.ts               # planificación rival + ejecución
  traps.ts                 # reacciones y orden
  encounterGenerator.ts    # restricciones, presupuesto, versión
  runEngine.ts             # transiciones entre guardias y draft
  invariants.ts            # integridad del estado
src/game/                  # controlador React y cola de presentación
  useGameController.ts
  playback.ts
  persistence.ts
src/data/                  # catálogo existente + organs.ts, encounters.ts, outbreaks.ts
```

`GameCommand` = playCard, moveUnit, activateSkill, beginCombat, attack, guard, pass, endTurn, chooseReward, skipReward, retire. `transition(state, command)` devuelve `ok: true, state, events[]` o `ok:false, errorCode` sin alterar referencia/estado previo. Toda acción valida fase, ID, ownership, PA, límites, objetivo y condición de fin. Cada evento referencia actor/objetivo estables, tipo, resultado y secuencia; color y audio pertenecen a presentación. Nunca usar timers, Date.now ni DOM en dominio. Estado: versión de reglas, runId, seed, rngState, idSequence, modo, nivel, fase, cartas por zona, unidades con sourceCardUid, intents, trampas, LP, PA, flags y resultado. La receta maestra no es una zona de combate. Cada combate instancia sus propias cartas de la receta. Las cartas rivales se distinguen de las aliadas.

**Invariantes:** LP/PS entre cero y máximo, PA no negativo (bono sobre máximo solo si se aprueba y documenta), 3 carriles válidos por lado, 2 trampas máximo, IDs únicos, ninguna carta en dos zonas, sin unidades muertas en slots, ninguna acción después de terminal, resultado de empate definido (proponer derrota del paciente salvo regla explícita). Preview de daño utiliza el mismo cálculo que resolución sin avanzar RNG. Rechazo no cambia ni RNG ni contadores. Replays de mismos comandos y semilla producen mismo hash de estado, excluyendo presentación.

### Fases propuestas

Inicio (recarga/robo/intenciones) → preparación (jugar/mover/habilidades/armar) → combate (atacar/defender/pasar) → respuesta (acciones publicadas + reacciones) → cierre (expiración/limpieza) → siguiente turno o resultado. Conservar inicialmente 4 PA, crecimiento hasta 6, 5 cartas iniciales, mano retenida y robo actual; no introducir descarte total de mano del V2 sin prueba A/B. Mantener contraataque simultáneo como regla inicial. Definir explícitamente que un defensor aturdido no contraataca según reglas existentes; si cambia, actualizar preview y textos juntos. Si se abandona combate sin atacar, advertir sin bloquear; la acción Guard es una propuesta de prototipo, no regla confirmada. Quick resolve solo cuando el jugador elige y los objetivos son inequívocos; usa los mismos comandos manuales.

## 5. Estrategia, equilibrio y generación de guardias

Baseline real: paciente 4000 LP, rivales 3000/4000/5000, cartas aliadas de 0–3 PA, ataques ~750–1950, enemigo inicial central. No adoptar valores 8000 LP de wireframes V2. Medir primero con baseline.

- Intenciones: cada enemigo muestra presión directa si carril queda vacío, ataques/efectos secundarios y carta de brote planeada. Si una acción queda invalidada, cancelar o aplicar fallback anunciado; nunca reroll secreto. Simular contraataque, daño esperado y curación. Capear buffs acumulativos por encuentro tras pruebas; no subir todo por nivel.
- Alcance: comparar reglas actuales con ataque a carril propio + palabra clave `alcance` que habilita otros carriles. Mantener accesibles opciones contra amenazas sin crear bloqueo inevitable. No combinar este experimento con cambios de economía simultáneos.
- Órganos: iniciar con corazón (protección) y pulmón (posición), probar una regla ambiental visible por órgano. Hígado: economía diagnóstico/tratamiento; cerebro: control temporal; epitelio: barreras. No afirmar que las mecánicas representan causalidad clínica. Cada regla debe tener mínimo dos vías de contrajuego y no invalidar clases enteras.
- Generador: seed + difficultyTier + organ rotation + case template + budget + allowed mutation tags + enemy recipe. Usar bolsa de órganos sin repetición inmediata; filtrar incompatibilidades. Validar catálogo y candidatos antes de usar, límite de intentos y fallback conocido. Sin promesa de que cada semilla sea única. Guardias 1–2 enseñan, 3–4 introducen una regla, 5 jefe, luego nuevos patrones alternados con aumentos moderados. Un jefe cada cinco es hipótesis. Presupuesto de amenaza inicial basado en PA, HP, daño y unidades, calibrado con simulación, no fórmula definitiva.
- Recuperación original propuesta: `min(maxLP, LP + max(1000, floor((maxLP-LP)*0.5)))` tras victoria, una vez; probar frente a variantes de recuperación parcial. Derrota no recupera LP. Guardar después de transición.
- Trampas: armar paga PA y ocupa slot; trigger se evalúa en orden de armado sobre evento antes de aplicación. Revalidar después de cada reacción; no gastar segunda trampa si ataque se anuló; una activación por instancia y sin ciclos de reacción. Definir disparadores beforeDirectDamage, beforeEnemySummon, beforeOutbreak, beforeAllyDamage. Primera tanda dos trampas simples, después cuatro triggers. Mostrar condición y objetivo antes de armar. Cada resolución debe producir un log explicativo.
- Draft: 3 opciones únicas y legales, pesos por tier y máximo de copias propuesto de 3 por carta (sin romper deck legado); omitir siempre. Recompensas diferentes de mejora/eliminación/reemplazo en descansos limitados, no en cada guardia necesariamente. Revisar mínimo de cartas y evitar explotar ciclo de robo. Mazo visible antes de decidir. Crear inicialmente 6–9 recompensas funcionalmente distintas para que el draft no sea fijo.

## 6. UX/UI: implementación sobre componentes reales

HUD híbrido conserva HTML para información y Three.js para estética. `GameHUD` pasa a grid de tres zonas: cabecera (caso, fase, amenaza, ambos LP); arena flexible (3×2 carriles, telegráficos por unidad); dock inferior (PA, mano, CTA primario, cancelar). Inspector contextual lateral en desktop y sheet en móvil. `ArenaBoard` mantiene anclas pero aplica rectángulo visible, colisión, escala mínima y fallback lista 2D; no esconder información táctica al mover cámara. `CardVisual` separa versión compacta y ampliada: coste, tipo/keyword, ATK/PS, texto corto, objetivo, efecto, fuente médica bajo detalle. No depender de hover: click/tap/teclado. Estado deshabilitado explica causa visible. `CardInspectorModal` y `EndModals`: foco inicial y retorno, focus trap, Escape, inert fondo, overflow interno; no activar hotkeys globales desde un botón/input enfocado. `TitleScreen`: continuar/nueva guardia/entrenamiento/ajustes. `DeckViewer` accesible desde mazo 3D y HUD. `Tutorial`: secuencia práctica de invocar, ver amenaza, jugar tratamiento, defender/atacar y cerrar turno, repetible/omitir; no castigar al jugador por aprender.

Breakpoints de prueba: 360×800, 390×844, 768×1024, 1280×720, 1920×1080; modo táctico 2D disponible en todos. Objetivos 14–16 px para información crítica en escritorio (ajustar con pruebas), 44px controles táctiles preferentes; WCAG mínimo AA 24px o excepción válida, contraste AA y foco visible. CSS `100dvh` donde apropiado, safe areas, scroll interno de mano y modales. Color + icono + texto para estado. Mantener vida y PA siempre visibles. Modo reduced-motion desactiva shake y transiciones largas, no información. Cualquier acción 3D debe tener alternativa DOM. Medir clicks por turno, comprensión de intención, abandono tutorial y errores de objetivo.

## 7. Three.js y game feel

El canvas ya usa proxies, shadowMap condicional, DPR cap, instancing de eritrocitos, texturas canvas y cleanup explícito. No repetir esas mejoras como si faltaran. Extraer `sceneFactory`, `organRig`, `entityRegistry`, `picking`, `anchorProjection`, `vfxPlayback`, `qualityManager` y `resourceRegistry` gradualmente. Rigs comparten interfaz `root, hitProxy, update(dt, visualTelemetry), dispose()` y límites espaciales de arena. Mantener corazón existente; construir pulmón procedimental de prueba antes de crear otros tres. GLB opcional si aporta calidad verificable, no requisito. Cache y ownership de geometrías/materiales; no disponer recursos compartidos prematuramente; contador de memoria con renderer.info y series de cambios de guardia. Revisar RoomEnvironment temporal y syncs WebGL del modo software, gestionar pérdida/restauración, error de creación y pestaña oculta. Evitar render loop para estado lógico. Raycast en proxies existentes, seleccionar al soltar sin arrastre; cámara táctica no orbita accidentalmente. Mapear DOM al rect real de canvas; elementos fuera de frustum sin pointer/focus. Desacoplar `CameraPreset='heart'` hacia `organ` con compatibilidad.

Eventos: anticipación corta, contacto, consecuencia visible, recuperación; animaciones de 150–450ms como hipótesis, velocidad normal/rápida/reducida; no bloquear por VFX ni ocultar pérdidas. Capturar snapshot antes/después para animar una unidad destruida sin eliminarla visualmente antes del impacto. Reutilizar Web Audio y partículas. Audio master/music/SFX, mute persistente, desbloqueo por gesto, suspender según visibilidad, limitar volumen y concurrencia; no usar música como señal única. Objetivos de rendimiento propuestos: 60 fps desktop y 30 fps modo bajo en hardware acordado; p95 frame time, draw calls, geometrías, texturas, tiempo de carga. No declarar cumplimiento sin benchmark real. Medir 50 transiciones de guardia y 100 montajes/desmontajes en pruebas, buscar crecimiento sostenido, no exigir contador cero de caches internas.

## 8. Persistencia y pruebas

`RunSave` versionado con runState, catálogo/rulesVersion, seed/rng, próxima secuencia, modo, deck, LP, intent, rewards pendientes y preferencias separadas. Guardar en fronteras estables (después de comando o transición atómica, nunca estado intermedio sin cursor). `localStorage` para settings/récord y snapshot pequeño; IndexedDB si replays/volumen lo requieren. Validar esquema y migración; manejar storage deshabilitado, quota, corrupción, versión futura. Guardar antes de presentar draft y al confirmar reward (idempotente), conservar un backup previo. No enviar telemetría externa por defecto. El modo clásico no se migra silenciosamente.

Pruebas: fixtures de baseline (invocar, ataque, counter, biofilm, stun, habilidad, movimiento, robo, victoria); invalid command no-op; cardinalidad de zonas; RNG replay; previsualización exacta; dos trampas no duplican gasto; estados con duración; terminal tras cada efecto; pausa/skip/reinicio no duplican comandos; generación de 1000 semillas válidas con fallback; save/reload en preparación y draft; E2E tutorial, ronda, draft, continuar, teclado, móvil, pérdida WebGL y 2D. Simular bots heurísticos variados (agresivo, defensa, control, aleatorio legal) y registrar distribución de guardias, daño recibido, PA desperdiciado, pick rate, aparición en mazos ganadores con tamaño de muestra, duración y loops. No confundir win rate de bot con diversión humana. Playtests 5–8 personas por iteración como objetivo exploratorio, no validación estadística; registrar decisiones, frustración y comprensión. Comparar variantes sin alterar varias reglas a la vez.

## 9. Roadmap por PR con gates

| Task | Scope exacto | Gate antes de siguiente |
|---|---|---|
| CV-000 | Verificar rama/SHA, estado limpio, lock y scripts, screenshots baseline, inventario/ADR | build/lint y errores registrados; no corregir por fuera del alcance |
| CV-001 | Añadir runner y fixtures de reglas actuales | tests reproducibles, distinguir comportamiento intencional de defectos |
| CV-002 | `combatEngine`, `game.ts`, App: validación y zonas, resultados explícitos | pruebas A01/A02, invariantes, sin pérdida de reglas |
| CV-003 | RNG, IDs, comandos, cola de eventos, pausa | replay determinista, no callbacks antiguos, A03/A05/A10 |
| CV-004 | HUD, ArenaBoard, CardVisual, inspector, modales, tutorial | desktop/móvil/teclado; LP visible; pruebas de flujo |
| CV-005 | Intenciones, alcance/defensa como variantes, balance clásico | simulación + playtest; elegir variante antes de expandir |
| CV-006 | RunEngine, guardias, seed, recuperación, draft/visor, persistencia | 20 guardias de fixture, guardar/reanudar, clásico funciona |
| CV-007 | 2 órganos (corazón/pulmón), mutadores y dos trampas, brotes | contrajuego, reacciones, rotación sin fuga medida |
| CV-008 | tres órganos restantes, pool ampliado, jefes | gates de contenido y revisión médico-educativa |
| CV-009 | performance, audio, VFX, accessibility, fallback, balance | resultados de benchmarks y E2E, deuda documentada |

Cada PR: alcance, archivos tocados, test plan, resultados reales, riesgos, rollback, capturas si UI. Mantener cambios pequeños. Propuesta de rama `feature/codigo-vital-cv-000-baseline`; ejecutar `git status --short`, `git fetch origin`, `git rev-parse HEAD`, comprobar base antes de `git switch -c ...`. Si hay cambios no relacionados, no stash/reset ni sobrescribir. No crear rama remota, PR ni merge sin permiso; no usar datos/keys externos. **Primera ejecución autorizable: CV-000 solamente**, sin cambios funcionales. Informar si lock no instala o tools no están disponibles; no inventar pruebas aprobadas.

## 10. Fuentes y trazabilidad

- [Repositorio fijado](https://github.com/Josuearv/Micromed-card/tree/eed9bb9328f4db83b44a5337e3f2e200a5fc5385): evidencia primaria de hallazgos.
- [Motor](https://github.com/Josuearv/Micromed-card/blob/eed9bb9328f4db83b44a5337e3f2e200a5fc5385/src/engine/combatEngine.ts), [App](https://github.com/Josuearv/Micromed-card/blob/eed9bb9328f4db83b44a5337e3f2e200a5fc5385/src/App.tsx), [datos](https://github.com/Josuearv/Micromed-card/blob/eed9bb9328f4db83b44a5337e3f2e200a5fc5385/src/data/medicalCards.ts), [canvas](https://github.com/Josuearv/Micromed-card/blob/eed9bb9328f4db83b44a5337e3f2e200a5fc5385/src/components/MedicalTableCanvas.tsx).
- [GDC: Slay the Spire — Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/): medir balance a partir de elecciones y resultados; no extrapolar valores numéricos.
- [Game Developer: How Slay the Spire's devs use data](https://www.gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder): pick rate y presencia en mazos ganadores, control de confusión y muestra.
- [Three.js Cleanup](https://threejs.org/manual/pages/cleanup.html) y [How to dispose of objects](https://threejs.org/manual/pages/how-to-dispose-of-objects.html): liberar recursos explícitamente, ownership y caches.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) y [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): objetivos de accesibilidad web y excepciones.
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API): suspender presentación cuando página queda oculta; no depender de timers en dominio.
- El V2 contiene investigación adicional de MDA, generación procedural y juegos de referencia; sus recomendaciones conceptuales se mantienen donde no contradicen este plan basado en código. No se verificó científicamente cada carta; revisión médica es tarea pendiente.

## 11. Prompt inicial para agente de código

Trabaja sobre Josuearv/Micromed-card. Lee este documento y el código real; confirma HEAD y si diverge del commit auditado. Ejecuta exclusivamente CV-000. Antes de editar, inventaría herramientas, scripts y dependencias, corre instalación reproducible si está autorizada, lint/build, abre el juego y captura menú, preparación, combate, respuesta, derrota y draft si son alcanzables. Reproduce A01–A04 sin alterar estado del repositorio; registra resultados con archivo/línea, comandos y evidencia. Si no puedes ejecutar una prueba, marca NO EJECUTADA. Propón un plan CV-001–CV-003 con alcance, riesgos y tests; no implementes nuevas mecánicas ni rediseñes todavía. Si se aprueba después, usa una rama independiente, commits pequeños y no hagas merge. Preserva reglas actuales hasta disponer de tests. No inventes resultados, no uses claves ni servicios pagos. Entrega un informe con hallazgos confirmados, hipótesis pendientes, baseline medido, bloqueos y decisiones que requieren aprobación.
