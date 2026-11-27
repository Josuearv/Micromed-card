# Auditoría y remediación — baseline f31afcc

Auditoría estática, no pruebas ejecutadas. Los hallazgos son observaciones o riesgos; reproducir antes de corregir. Referencias de líneas al commit base (pueden desplazarse). Preservar fixes V3: sourceCard en tablero, semillas, recuperación parcial, cola de eventos, modo 2D, pausa con cursor en memoria. No reintroducir bugs antiguos.

| ID | Prioridad | Evidencia / problema | Acción y aceptación |
|---|---|---|---|
| UX-001 | P0 | App.tsx 128–150, 618–675, 287–315; persistence.ts 108–125: guarda cada paso, pero cursor de playback vive en ref | Guardar transacción estable o fase/cursor serializable; al recargar en cada paso, continuar una sola vez o restaurar checkpoint documentado, nunca quedar bloqueado ni duplicar daño/RNG |
| UX-002 | P0 | App.tsx 618–675, 1003, 1045: inspector/mazo abiertos no suspenden necesariamente playback | Política única de pausa modal, impedir interacción de fondo; prueba abrir/cerrar durante cada fase |
| UX-003 | P0 | App.tsx 256–285, TitleScreen 125–153: iniciar modo guarda encima de anterior | Confirmar sobrescritura/reinicio; cancelar conserva snapshot byte a byte |
| UX-004 | P1 | DeckModal 34–43, CardInspectorModal 18–27: listeners Escape independientes | Stack modal central, cerrar solo superior, foco restaurado, fondo inerte |
| UX-005 | P1 | GameHUD 141–164: ArenaBoard no recibe RivalIntent.actions | Selectores/intenciones por carril y global; probar cambio tras despliegue, trampas y mutaciones |
| UX-006 | P0 | combatEngine.ts 757–765, 890–900, 1409–1460: algunos resolvers fuerzan phase en validación | Validar estado real; comandos ilegales no modifican estado ni RNG; revisar compatibilidad de tests/llamadores |
| UX-007 | P1 | GameHUD 240: hidden sm:block para LP rival | LP rival/paciente y PA siempre visibles a 360px y zoom |
| UX-008 | P1 | MedicalTableCanvas 820–905: cooldown 140ms y wave/beam 420–500ms reutilizados | Director de efectos con duración y cancelación; no perder eventos ni reemplazar efectos clave prematuramente |
| UX-009 | P1 | MedicalTableCanvas 1037–1069, ArenaBoard 540–660: anchors sin packing/reserva de HUD | Cámara táctica, safe rect, colisiones; no superposición crítica en 5 tamaños y ocupaciones |
| UX-010 | P1 | organRigs 529–562, MedicalTableCanvas 707–907: motion ambiental persistente | Preferencia del sistema y propia gobierna todas las animaciones no esenciales; prueba ambos modos |
| UX-011 | P0 | persistence.ts safeSetItem y saveRunSnapshot 108–125: errores de escritura no llegan a UI | Propagar resultado y mostrar guardado/no guardado, recuperación backup y almacenamiento bloqueado; validar esquema e invariantes |
| UX-012 | P1 | package.json sin test, tests/engine.test.ts presente | Script reproducible según lock/runtime; CI build/lint/test; registrar salida real |
| UX-013 | P1 | CardVisual 265–341: 9–11px, nombre truncado, ayuda 20px | CardFrame legible, regla accesible, targets medidos; validar 200% zoom |
| UX-014 | P1 | GameHUD 445–521: 196px fijo + mano + CTA; overflow/pointer-events | Shell responsive y scroll táctil; todos los controles alcanzables en portrait |
| UX-015 | P1 | ArenaBoard 370–660: intención no localizada, paneles sobre 3D | LaneView con numeración, amenazas y preview; equivalencia 2D/3D |
| UX-016 | P1 | EndModals 142–159: clic recompensa avanza | seleccionar/confirmar; cancelar/inspeccionar no consume RNG ni avanza |
| UX-017 | P2 | DeckModal 56–74: drawPile visible en orden | Decisión de diseño; por defecto mostrar composición sin revelar orden; si se permite, documentar |
| UX-018 | P1 | App 676–685: tutorial se descarta al resolver primer turno | tutorial por objetivos y entrenamiento; skip persistente, replay |
| UX-019 | P1 | organRigs 298–374: hígado procedural; captura órgano poco visible | Capturar cinco órganos en 3D y 2D, verificar escala/posición/oclusiones/recursos; no afirmar causa sin reproducción |
| UX-020 | P2 | soundEngine.ts osciladores, mute general | mezclador maestro y efectos, eventos sincronizados, prueba mute/volumen y pestaña oculta |
| UX-021 | P2 | encounterGenerator 17–22, 115–128: escala LP sin límite y stats limitadas | simular duración, decisiones y variedad, ajustar con aprobación; no cambiar balance por intuición |
| UX-022 | P2 | outbreaks.ts y medicalCards.ts: casos y simplificaciones | revisión científica, fuente y etiqueta de ficción por concepto; evitar asociaciones causales engañosas |
| UX-023 | P1 | App 811–871: atajos globales E/num no siempre excluyen control interactivo | alcance de shortcuts, no disparar en campos/diálogo; teclado completo |
| UX-024 | P2 | public/assets/aistudio/codigo_vital_implementation_v3_6480c108.md | documento histórico servido potencialmente como asset; revisar si se retira/mueve en tarea autorizada, no borrar automáticamente |

## Reproducción prioritaria
1. Registrar SHA, runtime y lockfile; instalar según bun.lock, build y lint; ejecutar tests con método compatible con tests/engine.test.ts y añadir script en tarea dedicada.
2. Capturar menú, preparación, combate, rival, recompensas, mazo/inspector, pausa, 2D y derrota; seed fija, datos de ejemplo reproducibles.
3. Recargar/pausar/cerrar pestaña durante cada paso; confirmar persistencia. Simular storage denegado y JSON corrupto. Abrir inspector sobre mazo, Escape y Tab.
4. Probar los cinco órganos, modos y cambios de cámara, context lost, 2D fallback, pantalla pequeña y navegador sin WebGL.
5. Medir frame time p50/p95, FPS, draw calls, geometrías/texturas y memoria en dispositivo/navegador identificados; comprobar estabilidad después de al menos 20 cambios de órgano como ensayo inicial.
6. Registrar cada resultado en docs/game-v4/qa/ con capturas y comando; status OPEN/REPRODUCED/FIXED/VERIFIED/NOT_REPRODUCED. No cerrar por lectura de código.

## Referencias técnicas y de diseño
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA dialog pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- Xbox Accessibility Guidelines: https://learn.microsoft.com/en-us/gaming/accessibility/guidelines
- Game Accessibility Guidelines: https://gameaccessibilityguidelines.com/
- Three.js responsive: https://threejs.org/manual/en/responsive.html
- Three.js dispose: https://threejs.org/manual/en/how-to-dispose-of-objects.html
- MDA: https://users.cs.northwestern.edu/~hunicke/MDA.pdf
- GDC Vault (buscar Metrics Driven Design and Balance, Slay the Spire; Hearthstone immersive UI): https://gdcvault.com/
- Game Feel, Steve Swink; The Gamer's Brain, Celia Hodent; Designing Game Feel: A Survey (IEEE, 2022); The Impact of Tutorials on Games of Varying Complexity (CHI 2012). Referencias de investigación previa, no nuevas pruebas del juego.
