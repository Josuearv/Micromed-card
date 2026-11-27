# UX-V4-00 · Línea de base de Código Vital

| Campo | Valor |
| --- | --- |
| Fecha y responsable | 27 de noviembre de 2026 · Codex |
| Rama y SHA al inicio | `main` · `9647554afb1cc0f402f7abf80e72910b40ee0acc`, igual a `origin/main` |
| PR de referencia | [#1](https://github.com/Josuearv/Micromed-card/pull/1), integrado antes de esta auditoría. La rama documental apunta a `9cb59fc4dbda716077ffbb14f39358facaaf1c6f`. GitHub devolvió seis archivos y cero revisiones o hilos. |
| Baseline de código | `f31afcc`; el merge solo añadió documentos. `src/`, `tests/`, `package.json` y `bun.lock` tienen el mismo contenido. |
| Estado del árbol al inicio | Sin cambios rastreados. `art-source/` y `docs/art/` existían como material local sin seguimiento. |
| Entorno | Windows 11 build 26200, AMD Ryzen 7 5700U, Bun 1.4.5, Node 24.19.0, Playwright Core 1.65.1, Chrome headless 158.0.8127.37 y SwiftShader. |
| Lockfile | `HEAD:bun.lock` · blob `627148d6825c8ebcbf48335e1114edfad04a5158` |

Se leyeron los seis documentos y se verificó que coinciden byte a byte entre la rama documental y el merge. [Índice rector de Game V4](../README.md).

## Comprobaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `bun install --frozen-lockfile` | Éxito, 188 paquetes. La primera ejecución encontró `EPERM` en la caché de usuario. La caché local resolvió el permiso y la descarga requirió acceso de red. Bun bloqueó dos scripts de instalación y los comandos de baseline funcionaron. [Registro](logs/install.txt) |
| `bun run build` | Éxito, Vite 8.4.0, 1685 módulos. Advertencias por `__dirname` con el futuro cargador nativo y por chunk JS de 1024,56 kB minificado, 276,70 kB gzip. [Salida](logs/build.txt) |
| `bun run lint` | Éxito. Ejecuta `tsc --noEmit`. [Salida](logs/lint.txt) |
| `bun tests/engine.test.ts` | Éxito, ocho bloques de asserts. Es una suite ejecutable directamente. `bun test` evalúa los mismos asserts y su contador informa 0 pruebas porque el archivo usa `runTest` propio. `package.json` carece de script `test`. [Salida](logs/test.txt) |
| `bun docs/game-v4/qa/repro-domain.mjs` | Éxito. Reproducción de los cuatro resolvers, pasos del turno y semillas de las capturas. [Script](repro-domain.mjs) · [Salida](logs/domain.txt) |
| `bun docs/game-v4/qa/repro-browser.mjs` | Éxito, cero fallos de automatización y 44 capturas. El guion reproduce los defectos esperados con recorridos, fallos inyectados, matriz de tamaños y medición 3D. [Script](repro-browser.mjs) · [Salida JSONL](logs/browser.txt) |

## Cinco P0 reproducidos

| ID | Estado | Pasos y resultado |
| --- | --- | --- |
| UX-001 | REPRODUCED | Clásico, semilla 12345, 2D, sin aliados. Pulsar **Finalizar Turno** y continuar desde cada una de las seis escrituras capturadas. Las cuatro de `TURNO_RIVAL` restauran el CTA deshabilitado. Dos ocurren antes del daño y dos después de bajar de 4000 a 3150 LP. La primera escritura de preparación del turno 2 conserva `turnsElapsed=0`; la siguiente registra 1. También se recargó una frontera intermedia en la misma pestaña. [Bloqueo tras recarga](screenshots/12-turno-rival-bloqueado-tras-recarga.png) |
| UX-002 | REPRODUCED | Durante la respuesta rival, abrir el mazo o el inspector y dejar transcurrir el reloj simulado. En ambos pasa de T1 a T2 y de 4000 a 3150 LP con el modal abierto. **Pausa** mantiene T1 y 4000 LP, y **Reanudar Duelo** completa el turno. [Mazo](screenshots/13-rival-mazo.png) · [Inspector](screenshots/13-rival-inspector.png) · [Pausa](screenshots/13-rival-pausa.png) |
| UX-003 | REPRODUCED | Con una partida activa, volver al menú y pulsar Enter para iniciar infinito, o pulsar el botón de clásico. Se reemplaza el guardado principal sin confirmación. Los bytes anteriores se verificaron en el respaldo para Enter. **Reiniciar Guardia** en pausa cambió de T2 a T1 sin confirmación. [Menú con Continuar](screenshots/09-menu-continuar.png) |
| UX-006 | REPRODUCED | Invocar, mover, atacar y activar habilidad con un estado `TURNO_RIVAL`. El validador devuelve `INVALID_PHASE` y los cuatro resolvers aceptan y emiten un evento. La carta gasta 3 PA, la habilidad gasta 1 PA, los cuatro avanzan la secuencia y el RNG queda igual en estos casos. El objeto de entrada permanece intacto. [Salida de dominio](logs/domain.txt) |
| UX-011 | REPRODUCED | Denegar `setItem` solo para principal y backup. La Guardia inicia, no se escribe la partida, no se ve error y el menú pierde **Continuar**. JSON roto en principal recupera el respaldo válido. Un principal JSON parseable con `playerSlots: []` sigue ofreciendo **Continuar**. [Menú con storage denegado](screenshots/14-menu-storage-denegado.png) |

La causa de UX-001 y UX-002 está en el controlador de `App.tsx`: guarda estados por paso, conserva el cursor en memoria y suspende los timers solo en pausa. UX-003 escribe inmediatamente desde `startMode` y `handleRestart`. UX-006 fuerza fase al invocar el validador. UX-011 descarta el resultado de `safeSetItem` y aplica una validación estructural parcial.

## Pantallas, contraste con V4 e inventario

| Especificación | Evidencia y diferencia |
| --- | --- |
| S01, S02 y S14 | Menú con modos y preferencias integrados. Hay audio, vista 2D/3D, movimiento y velocidad repartidos entre menú y HUD. El menú con partida ofrece **Continuar**. [Menú](screenshots/01-menu-modos-ajustes.png) · [Continuar](screenshots/09-menu-continuar.png) |
| S03, S11 y S12 | Briefing independiente, códice y entrenamiento aún ausentes. El HUD muestra órgano, sinergia e intención y el primer encuentro tiene un tutorial contextual. |
| S04 a S06 | Preparación, selección, combate y turno rival disponibles. Hay historial y un resumen de intención global. `ArenaBoard` aún no consume las acciones por carril. CTA y overlays dependen de la fase; la respuesta rival deshabilita el CTA. [Preparación](screenshots/02-preparacion-2d-tutorial.png) · [Selección](screenshots/03-preparacion-seleccion.png) · [Combate](screenshots/04-combate.png) · [Rival](screenshots/11-turno-rival.png) · [Historial](screenshots/05-historial.png) |
| S07 y S08 | Estabilización y recompensa en el mismo diálogo. UX-016 **REPRODUCED**: tras recargar el resumen, inspeccionar y cerrar la ficha, un clic sobre `vacuna-arnm` añade la carta y avanza del duelo 1 al 2. El snapshot coincide con `advanceToNextGuard`. [Resumen y elección](screenshots/15-estabilizacion-recompensas.png) · [Inspector](screenshots/18-recompensa-inspector.png) · [Siguiente duelo](screenshots/19-siguiente-guardia.png) |
| S09, S10 y S15 | Mazo, inspector y pausa disponibles. El mazo tiene pilas y filtros. UX-004 **REPRODUCED**: con pausa → mazo → inspector, Tab dejó el foco en el mazo y Escape cerró el mazo bajo el inspector. [Pausa](screenshots/06-pausa.png) · [Mazo](screenshots/07-mazo.png) · [Inspector](screenshots/08-inspector-sobre-mazo.png) |
| S13 | Victoria y derrota son diálogos del motor real. Las capturas terminales usan fixtures del catálogo y LP de frontera para llegar al estado con una interacción. [Victoria](screenshots/16-victoria-clasica.png) · [Derrota](screenshots/17-derrota.png) |
| Modos de juego | Tres duelos clásicos y guardia infinita disponibles. [Infinita](screenshots/10-guardia-infinita.png) |

El inventario rector corresponde a 26 cartas jugables y 8 patógenos en `medicalCards.ts`, además de cinco perfiles en `organs.ts` y el catálogo de brotes en `outbreaks.ts`. `CardVisual` usa iconografía vectorial, `organRigs` y `bioEntities` generan modelos procedurales, y `public/assets/aistudio/` contiene dos PNG y el documento V3 histórico. El manifiesto local preexistente contiene candidatos en estado QA. Se trató como material pendiente de aprobación. El trabajo visual futuro parte de [CV-ART-01 v1.0](../01-art-direction.md) y el [inventario de IDs y piloto](../02-image-generation.md).

## Tamaños, WebGL y rendimiento

- UX-007 **REPRODUCED**. La cifra LP rival está oculta a 360×800 y 390×844 y visible a 768×1024, 1366×768, 1920×1080 y 800×360. El CTA medido es de 119×44 CSS px en las seis capturas. UX-014 **REPRODUCED** a 360×800: el dock tapa casi toda la mano y la barra superior de utilidades queda recortada. [360×800](screenshots/viewport-360x800.png) · [390×844](screenshots/viewport-390x844.png) · [768×1024](screenshots/viewport-768x1024.png) · [1366×768](screenshots/viewport-1366x768.png) · [1920×1080](screenshots/viewport-1920x1080.png) · [800×360](screenshots/viewport-800x360.png).
- UX-009 y UX-019 **REPRODUCED** para el caso de hígado a 1366×768. El modelo aparece parcialmente cubierto por la tarjeta de C2 en arena y detalle. Es un solapamiento visible, con el órgano aún presente. [Arena](screenshots/organo-higado-3d-arena.png) · [Detalle](screenshots/organo-higado-3d-detalle.png) · [2D](screenshots/organo-higado-2d.png).
- Cinco órganos en arena, cámara de órgano y 2D. Semillas de infinito: cerebro 1, epitelio 4, hígado 6, corazón 7 y pulmón 12. [Cerebro](screenshots/organo-cerebro-3d-arena.png) · [Epitelio](screenshots/organo-epitelio-3d-arena.png) · [Corazón](screenshots/organo-corazon-3d-arena.png) · [Pulmón](screenshots/organo-pulmon-3d-arena.png).
- Se comprobó el cambio a 2D con WebGL indisponible al inicio y tras pérdida real inducida con `WEBGL_lose_context`. El caso inicial permite ejecutar una acción de fase en 2D, aunque al continuar la partida el aviso de fallback quedó oculto. [Sin WebGL](screenshots/20-webgl-no-disponible.png) · [Pérdida de contexto](screenshots/21-webgl-contexto-perdido.png).
- El perfil de software WebGL a 1366×768 usa Chrome/ANGLE/SwiftShader, DPR 1. Dos ventanas de 45 renders, antes y después de 20 cambios de órgano en el mismo canvas. El arnés añade telemetría y dirige el ID del órgano en la respuesta de Vite. Antes registró 2,97 FPS y p50/p95 de 332,7/376,5 ms. Después registró 2,92 FPS y 349,8/392,8 ms. Al volver a pulmón quedaron 85 draw calls, 33.360 triángulos, 50 geometrías y 7 texturas en ambos extremos. El heap JS pasó de 28,6 a 30,8 MB sin forzar GC. El ensayo verifica los contadores del renderer para esta secuencia corta. La VRAM queda fuera de la medición. [Resultados crudos](logs/browser.txt).

## Límites y siguientes comprobaciones

- Los resultados de navegador son de una máquina y un renderer por software. Quedan pendientes GPU física, presión de memoria GPU, segundo navegador, lector de pantalla, zoom real al 200 %, DPR 2, touch real y matriz completa de ocupación. Tampoco se realizó playtesting ni revisión clínica.
- Los fixtures de cierre de combate facilitan capturar estados y mantienen los datos del catálogo. Las capturas de resultados no representan una campaña clásica completa jugada desde T1. La validación de guardados cubrió recarga real y recreación de páginas desde cada frontera capturada. Queda por cubrir el cierre real en cada frontera con almacenamiento persistente de sesión.
- Los P1/P2 restantes siguen **OPEN** fuera de las reproducciones de esta entrega. [Auditoría rectora](../04-audit-remediation.md).
- El [plan granular de UX-V4-01](ux-v4-01-plan.md) cubre regresiones, restauración determinista, persistencia, modales y confirmaciones. Implementación pendiente de revisión de esta línea base.

## Repetir navegador

```powershell
$env:BUN_INSTALL_CACHE_DIR = Join-Path $PWD 'node_modules/.cache/bun'
bun install --frozen-lockfile
npm.cmd install --prefix node_modules/.qa --no-package-lock --no-audit --no-fund playwright-core@1.65.1
bun run dev --host 127.0.0.1 --port 4170 --strictPort
```

Desde otra terminal, ejecutar `bun docs/game-v4/qa/repro-browser.mjs`. Se puede ajustar `QA_CHROME` con la ruta al navegador, `QA_ORIGIN` para el origen Vite y `QA_SCENARIO` para filtrar por nombre de escenario. El escenario de rendimiento requiere Vite en desarrollo para instrumentar el módulo servido. El resto del código se ejecuta desde las entradas normales de la app con un perfil temporal.
