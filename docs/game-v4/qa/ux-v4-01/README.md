# UX‑V4‑01 · Integridad de sesión y comandos

La implementación parte de `origin/main` en `9647554afb1cc0f402f7abf80e72910b40ee0acc`. La línea base se preservó en `docs/ux-v4-00-baseline` en `e8e4c98d44eb0758973678f99349316873fdfaf3`, con las 44 capturas y los registros originales. Esta rama se trabajó en un worktree independiente de la rama de arte. [Informe UX‑V4‑00](https://github.com/Josuearv/Micromed-card/blob/e8e4c98d44eb0758973678f99349316873fdfaf3/docs/game-v4/qa/README.md) · [Plan aprobado](https://github.com/Josuearv/Micromed-card/blob/e8e4c98d44eb0758973678f99349316873fdfaf3/docs/game-v4/qa/ux-v4-01-plan.md)

## Comparación con la línea base

| Hallazgo | UX‑V4‑00 | UX‑V4‑01 |
| --- | --- | --- |
| UX-001 **VERIFIED** | Hasta seis escrituras por turno. Cuatro guardaban `TURNO_RIVAL` sin cursor y bloqueaban el CTA al reanudar. | Una escritura del resultado estable antes de la reproducción. Seis fronteras probadas para cada una de tres salidas reales: recarga, cierre de pestaña y regreso al menú. En clásico con semilla 12345, cada salida restaura T2, 3150 LP, RNG `1703695764` y un turno completado. [Captura](screenshots/01-turno-restaurado.png) |
| UX-002 **VERIFIED** | El mazo y el inspector dejaban avanzar la respuesta rival. Con pausa, mazo e inspector apilados, Escape podía cerrar la capa equivocada. | Mazo, inspector y pausa detienen la cola. El fondo y las capas inferiores quedan inertes. Tab y Shift+Tab permanecen en la capa superior. Escape la cierra y restaura el foco al control que la abrió cuando sigue disponible. Se probó también en preparación y combate. [Captura](screenshots/02-modales-apilados.png) |
| UX-003 **VERIFIED** | Enter en el menú y los controles de modo o reinicio podían sustituir el guardado inmediatamente. | Con datos existentes o acceso incierto hay confirmación explícita. Cancelar conserva ambas claves byte a byte. Enter sin foco de control solo inicia directamente con almacenamiento vacío. Confirmar el reinicio produce una escritura principal. [Captura](screenshots/03-confirmacion.png) |
| UX-006 **VERIFIED** | El validador rechazaba la fase y los resolvers aceptaban igualmente cuatro comandos. | Invocar, mover, atacar y activar validan la fase real. Las pruebas recorren las tres fases. Un rechazo conserva el mismo objeto y emite cero eventos. Las ocho comprobaciones de V3 siguen pasando. [Salida](tests.txt) |
| UX-011 **VERIFIED** | Los fallos de escritura eran silenciosos y un documento parseable pero inválido podía ocultar un respaldo válido. | El menú, pausa y HUD muestran el estado de guardado. Si falla la escritura se conserva el punto anterior y se puede reintentar desde la sesión en memoria. Se probaron denegación, escrituras parciales, respaldo directo, lecturas bloqueadas y borrados fallidos. [Fallo](screenshots/04-error-guardado.png) · [Respaldo](screenshots/05-respaldo.png) |

El commit `123c41f` introdujo las regresiones antes del primer arreglo. En esa revisión pasaron las ocho comprobaciones de V3 y fallaron los seis casos nuevos de dominio, además de los seis escenarios iniciales de Chrome. La matriz se amplió durante la verificación final.

## Decisiones de recuperación

- El motor calcula el turno rival una sola vez. El guardado contiene la siguiente preparación, el resumen o el resultado terminal. Las imágenes, estados intermedios y eventos se reproducen en orden desde memoria. Recargar salta al punto estable. Los resultados terminales se pueden abrir desde **Ver resultado** hasta iniciar otra partida.
- Un guardado V3 intermedio busca un respaldo anterior estable de la misma partida. Dos copias interrumpidas se conservan y el menú informa que falta un punto reanudable. Si un respaldo interrumpido prueba que el guardado principal ya llegó a preparación, se recupera el incremento de turno perdido al leer.
- Si persiste un fallo de escritura, **Continuar sin guardar** permite volver a la sesión desde el menú de la misma pestaña. Al cerrar la pestaña sigue disponible el último punto que se pudo guardar. El flujo se verificó con un escritor activo. La edición simultánea de una misma partida desde varias pestañas queda fuera de esta verificación.
- El foco inicial de la confirmación se coloca en **Cancelar**. En una capa sin disparador disponible, el foco pasa a un control de la pantalla accesible. Se aplicó el patrón de diálogo modal y se verificó con teclado en Chrome. [WAI‑ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## Verificación final

| Comprobación | Resultado |
| --- | --- |
| `bun install --frozen-lockfile` | Éxito. El blob de `bun.lock` coincide con la línea base. |
| `bun run build` | Éxito. Vite conservó los avisos por `__dirname` y tamaño del chunk. El JS principal pasó de 276,70 a 280,66 kB gzip, +3,96 kB. [Salida](build.txt) |
| `bun run lint` | Éxito. [Salida](lint.txt) |
| `bun run test` | Ocho comprobaciones de V3 y nueve regresiones nuevas. La comparación con la secuencia del motor abarcó 40 semillas por modo. [Salida](tests.txt) |
| `bun run test:browser` | 17 escenarios y nueve capturas contra el build de producción servido por Vite Preview. Se verificaron [recompensas y recuperación parcial de infinito](screenshots/06-recompensas-restauradas.png), [victoria](screenshots/07-victoria-restaurada.png), [derrota](screenshots/08-derrota-restaurada.png) y [pérdida de contexto 3D con fallback 2D](screenshots/09-webgl-fallback.png). [Salida](browser.txt) |

Se usó Windows, Bun 1.4.5, Chrome headless 158.0.8127.37, Playwright Core 1.65.1 y SwiftShader a 1366×768. Las pantallas terminales parten de fixtures cercanos a victoria o derrota. Se probó el flujo real desde esos estados. La verificación de navegador no comprende lector de pantalla, GPU física, una campaña completa jugada desde cero ni rendimiento comparado en GPU física.

## Reproducir

```powershell
bun install --frozen-lockfile
bun run build
bun run lint
bun run test
npm.cmd install --prefix node_modules/.qa --no-package-lock --no-audit --no-fund playwright-core@1.65.1
bun run preview --host 127.0.0.1 --port 4172 --strictPort
```

En otra terminal, con Chrome instalado:

```powershell
$env:QA_ORIGIN = 'http://127.0.0.1:4172'
$env:QA_EVIDENCE = 'docs/game-v4/qa/ux-v4-01/screenshots'
bun run test:browser
```

`QA_CHROME` permite elegir otro ejecutable y `QA_CASE` filtrar por nombre de escenario. [Regresiones del motor y almacenamiento](../../../../tests/session.test.ts) · [Recorridos](../../../../tests/session.browser.mjs)
