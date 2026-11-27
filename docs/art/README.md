# Código Vital · Revisión de arte y cartas

CV-ART-01 v1.0, Clinical Warfare / Cinematic Bio-Tactical. Los dos lotes piloto quedaron aprobados provisionalmente como referencias de estilo. La producción que figura en esta rama está preparada para revisión editorial y anatómica.

## Propuestas de carta

Desde la raíz del repositorio, iniciar `npm run dev -- --host 127.0.0.1` y abrir `/docs/art/review/` en el servidor local. El prototipo consulta el catálogo y muestra las mismas seis cartas en las tres propuestas. El selector de estado simula la presentación de la carta para comparar contorno y mensaje. [Catálogo](../../src/data/medicalCards.ts)

[Captura de las tres propuestas en tamaño de mano](cv-art-01-propuestas-cartas.webp)

| Propuesta | Composición |
| --- | --- |
| Archivo clínico | Cabecera de identificación, ilustración en marco y atributos al pie. |
| Visor táctico | Imagen al borde superior, coste en placa circular y ficha bajo el arte. |
| Ficha de campo | Barra lateral semántica, ventana biselada y atributos en módulos gemelos. |

| Contexto | Tamaño nominal de carta | Regla |
| --- | ---: | --- |
| Mano | 168 × 252 px | Habilidad. La carta abre la regla completa. |
| Recompensa | 240 × 360 px | Regla de catálogo en el cuerpo. |
| Inspector | 320 × 480 px | Regla en la carta y ficha ampliada con sinergias, contrajuego y base científica. |
| Colección | 144 × 216 px | Habilidad. La carta abre la regla completa. |

## Recursos

El inventario de revisión cubre 26 cartas jugables, 8 patógenos y 5 órganos. Conserva además las dos revisiones de la arena. Para cada elemento, la hoja de QA identifica la revisión que tiene un WebP de catálogo.

- [Manifiesto](manifest.json). Un registro por original y revisión. Los recursos de catálogo usan el ID de `medicalCards.ts` u `organs.ts`. Incluye prompt, modelo y parámetros disponibles, referencias, archivos, hashes y estado de revisión.
- [Lotes piloto de referencia](cv-art-01-hoja-comparativa-lotes-1-2.png). Las 14 imágenes se adjuntaron mediante la hoja y, en cada generación, se complementaron con cuatro originales de la familia correspondiente.
- [Cartas jugables a 96 y 160 px](qa-players-96-160.webp), [patógenos a 96 y 160 px](qa-pathogens-96-160.webp) y [órganos y arenas a 96 y 160 px](qa-organs-96-160.webp).
- [Arena V2 para Three.js](arena-clinica-tactica-v2-threejs.md). Contiene geometría y anclajes de la propuesta de entorno.

Los originales PNG viven en `art-source/`. El script `python docs/art/prepare-review-assets.py` exporta WebP de revisión a `public/assets/` y recrea las hojas con Pillow. Los tamaños máximos son 768 × 576 para cartas, 768 × 768 para órganos y 1280 × 720 para arenas. El manifiesto guarda dimensiones, calidad, tamaño y suma SHA-256 de cada derivado.

## Validación de cartas

En Chromium se probaron las 18 instancias en cada contexto a 1440, 390 y 320 px de ancho. Se comprobó la carga y decodificación de las imágenes, la presencia de la regla en recompensa e inspector, el contenido dentro del marco, la apertura con Enter y el retorno de foco con Escape. A 320 px, el contexto inspector adapta la carta al espacio disponible. El contraste mínimo calculado entre los colores de texto y las superficies planas de las cartas fue 8,16:1.

## Decisiones de revisión artística

- Alteplasa Fibrinolítico usa la revisión 2 para distinguir el motivo de fibrina del vial de Meropenem. Sutura y Hemostasia usa la revisión 2 para mantener aguja y tejido dentro del encuadre.
- La segunda revisión de Célula Madre Tisular diferencia su contorno liso del linfocito CD8. La de Estafilococo SARM Crítico diferencia la silueta del racimo sin atribuir rasgos visibles a la resistencia.
- Los cuatro PNG de revisión 1 sustituidos se conservan con su procedencia en el manifiesto.
- Inmunización Activa conserva la revisión 1. Su forma general se parece a una célula en miniatura y merece revisión anatómica. El generador rechazó la solicitud de una segunda revisión.
- Los dos lotes iniciales conservan sus originales y la condición de referencia provisional. La revisión individual de las piezas de catálogo sigue abierta.
