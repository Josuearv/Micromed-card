# Código Vital / Micromed-card — Game V4
Estado: propuesta rectora de diseño, pendiente de validación visual y de ejecución.
Baseline auditado: [f31afcc](https://github.com/Josuearv/Micromed-card/tree/f31afcc25f82a39c17536536d1daa0b8fbd65864), 27-11-2026.
Alcance: documentación solamente; no cambia reglas, código ni assets existentes.

## Decisión de dirección
**Clinical Warfare — Cinematic Bio-Tactical (CV-ART-01 v1.0)**. Layout táctico B, materiales clínicos A, riqueza biológica C. Un único lenguaje gráfico para cartas, modelos, efectos, interfaz y marketing. El mundo es una simulación táctica ficticia, no una herramienta clínica.
Priorizar información accionable, lectura rápida y controles claros sobre espectáculo. Preservar React, TypeScript, Three.js, modo clásico e infinito, cinco órganos, trampas, semillas, persistencia y fallback 2D. No introducir dependencias o mecánicas sin justificación y pruebas.

## Lectura obligatoria
1. [Biblia de arte](01-art-direction.md): identidad y reglas visuales.
2. [Producción de imágenes](02-image-generation.md): prompt maestro, manifiesto, catálogo y QA.
3. [Especificación UX/UI](03-ux-ui-specification.md): arquitectura de pantallas y componentes.
4. [Remediación de auditoría](04-audit-remediation.md): evidencia y criterios de cierre.
5. [Roadmap](05-implementation-roadmap.md): orden, gates, pruebas y prompt de ejecución.

## Regla de trabajo
Primero reproducir baseline; después corregir P0; luego producir una muestra visual de referencia y aprobarla antes de generar todo el catálogo. Documentar hipótesis y resultados; no marcar tareas PASS sin pruebas. Nunca reemplazar la lógica con datos inventados por la IA.
Los valores visuales y objetivos de UX son propuestas, no resultados medidos. La auditoría fue estática, con una captura anterior; no se han verificado FPS, build, navegador, accesibilidad clínica ni playtesting. El plan V3 histórico en public/assets/aistudio se conserva; este directorio es la especificación V4.
