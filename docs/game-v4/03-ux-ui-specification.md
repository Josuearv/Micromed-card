# Especificación UX/UI V4

## 1. Arquitectura de información
Dirección B: Tactical Clinical Arena. El jugador debe distinguir qué ocurre, qué puede hacer, qué costará y qué pasará después. Mantener datos críticos visibles, ocultar explicación científica bajo inspección. No inventar reglas nuevas por estética.
Desktop: shell con cabecera de encuentro (guardia/turno/fase, LP brote, utilidades), panel clínico lateral plegable (órgano, sinergia, mutadores, amenaza global), zona central de tres carriles, dock inferior con LP paciente, PA, mano, trampas y CTA. El canvas ocupa la región de arena, no necesariamente toda la ventana; proyectar anchors respecto de su rect real. Ningún panel sobre órgano o CTA. Cámara táctica fija por defecto, inspección como modo separado con salida clara. Mobile: barra vital compacta siempre visible, grid táctico 2D por defecto según capacidad/preferencia, mano deslizable independiente, CTA sticky, inspector en sheet desplazable. No forzar zoom de la escena 3D. Tablet: priorizar tablero y mano; panel lateral plegable. Safe-area, viewport dinámico, zoom 200%, landscape/portrait.

## 2. Pantallas y estados
| ID | Pantalla | Contenido / interacción / aceptación |
|---|---|---|
| S01 | Menú | Continuar partida con modo/guardia/fecha; nueva partida con confirmación si sobrescribe; opciones; no iniciar infinito por tecla accidental |
| S02 | Modalidades | Clásico 3 duelos, infinito, entrenamiento (propuesta, no existente); explicar objetivo y dificultad |
| S03 | Briefing | Órgano, sinergia, mutadores, enemigo inicial, LP y continuar; reutilizar datos del encuentro; omitir si usuario decide |
| S04 | Preparación | Mano con coste, regla, objetivo, PA; seleccionar, cancelar, desplegar/mover/habilidad; mostrar resultado estimado |
| S05 | Combate | Selección de atacante, previsión ATK/contraataque, resultado y objetivo; CTA indica pendientes y regla real; no agregar pasar/defender sin decisión de diseño |
| S06 | Turno rival | Bloqueo de acciones, cola visual y log legible, orden de eventos, ajustes velocidad/pausa; estado guardable |
| S07 | Estabilización | Resultado, daño, turnos, LP recuperado y explicación; transición no bloqueante |
| S08 | Recompensas | Comparar tres cartas, inspeccionar, selección explícita + confirmar u omitir; no avanzar por clic accidental |
| S09 | Mazo | Composición, curva PA, filtros, búsqueda, clasificación, campo/descarte; no mostrar orden futuro salvo decisión explícita |
| S10 | Inspector | Regla completa, stats, duración, sinergias, contrajuego; ciencia separada de simplificación del juego |
| S11 | Códice | Catálogo de entidades, órganos y cartas; recurso futuro con fuentes y sin consejo médico |
| S12 | Entrenamiento | Semilla fija, tutorial guiado y repetible, no afecta récord; futuro |
| S13 | Derrota/victoria | Motivo, guardia, récord, cartas usadas, turnos; reinicio seguro |
| S14 | Ajustes | Volumen maestro/efectos, calidad, 2D/3D, velocidad, movimiento reducido, atajos; persistencia |
| S15 | Pausa | Reanudar, mazo, ajustes, menú con guardado verificable; modal superior único |

## 3. Componentes
| Componente actual | Evolución |
|---|---|
| App.tsx | Controlador del flujo y navegación; estado modal único/stack, comandos de motor y presentación separados |
| GameHUD.tsx | EncounterHeader, PatientStatus, ActionDock, Hand, IntentSummary, UtilityBar, EventLog |
| ArenaBoard.tsx | LaneView 2D/3D compartida, IntentBadge, TargetHighlight, UnitStats, TrapSlot; usar selectores del motor |
| CardVisual.tsx | CardFrame + Artwork + CardMeta + Rule + Stats + State; variantes hand/reward/collection/inspect |
| CardInspectorModal.tsx | Inspector accesible con pestañas o secciones tácticas y ciencia; cierre solo modal superior |
| DeckModal.tsx | Colección y pilas, filtros, curva PA, orden explícito; lectura sin mutación |
| EndModals.tsx | Pause, RoundSummary, RewardPicker, RunResult; confirmación |
| TitleScreen.tsx | Menú, continuar, preferencias, modos |
| MedicalTableCanvas.tsx | Cámara, escena, picking, proyección, ciclo de recursos y VFX independientes |
| index.css | tokens, tipos, espaciado, foco, estados, motion y layouts adaptativos |

## 4. Contrato de interacción
- Selección: idle → selected card/attacker → valid target → preview → confirm → resolving → result. Cancelar sin consumir PA. Una sola acción lógica por interacción. Mouse, touch y teclado comparten comandos. Selección por clic/tap es básica; drag opcional con alternativa equivalente.
- Carta: normal, hover/focus, disponible, seleccionada, objetivo requerido, no jugable con motivo, sinergia activa, recién robada, resolviendo. Mantener texto legible incluso inactiva. Icono de tipo, nombre completo bajo focus/inspector, coste y stats visibles. Evitar hover obligatorio para conocer efectos.
- Carril: libre, ocupado, objetivo válido/inválido, amenaza, protegido, aliado pendiente/agotado, estado clínico y resultado reciente. Numeración 1–3 persistente. No ocultar amenaza en panel truncado. Mostrar presión directa junto al carril, invocación, mutación, brote global y trampas, con iconos + texto. Recalcular desde estado real y evitar prometer que intención original no cambia por acciones del jugador.
- Predicción: usar funciones puras del motor, no duplicar reglas en UI. Si hay incertidumbre mostrar rango/condición. No consumir RNG ni mutar estado; pruebas de paridad con resolución. Daño previo y posterior a defensa, costes, destrucción y cambios de estado. Los eventos no bloquean decisiones más allá de lo necesario.
- CTA: preparación → Ir a combate / finalizar si no hay atacantes; combate con pendientes → explicar selección requerida; combate sin pendientes → Finalizar turno; rival → Resolviendo. Si se decide permitir pasar/defender, modificar motor y tests en tarea aparte.
- Tutorial: objetivos pequeños con resaltado no invasivo; jugar carta, pagar PA, proteger carril, ataque, habilidades, trampas, mutadores, recompensa. Skip y replay; no bloquear todo con tutorial. Medir comprensión y evitar recomendaciones obligatorias.
- Historial: agrupación por turno, filtros, icono, cantidades efectivas, causa y objetivo; no solo último evento; mensaje contextual visible sin truncar contenido crítico.

## 5. Accesibilidad y respuesta
Usar WCAG 2.2 AA aplicable: contraste 4.5:1 para texto normal, 3:1 grande y componentes relevantes, 24×24 CSS px mínimo de objetivos con excepciones, meta 44×44 táctil; no depender del color. Foco visible, nombre/rol/estado, gestión y restauración de foco modal, fondo inerte, Escape solo top, atajos configurables o desactivables; evitar live region excesiva (resumen de turno). El modo 2D ofrece todas las acciones, no solo lectura. Respetar prefers-reduced-motion y preferencias del juego; desactivar órbitas, pulsos, sacudidas y partículas no esenciales; animación instantánea alternativa. Audio nunca único canal. Validar teclado, touch, lector de pantalla y zoom.

## 6. Game feel
Duraciones propuestas: hover 100ms, selección 140, robo 260, invocación 450, fagocitosis 650, ataque 450, diagnóstico 350, trampa 500, crítico 350, estabilización 900. Cola de eventos con snapshots/IDs de origen y destino, director audiovisual con barreras y cancelación; no temporizar la lógica mediante FPS. Modo rápido acorta efectos, reducido/instantáneo conserva números y resultado. Mantener efectos separados si se superponen; reproducir sonido según evento y evitar saturación. No eliminar unidad visual antes de su animación de salida.
