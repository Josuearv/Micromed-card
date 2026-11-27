# Sistema de generación de imágenes — CV-ART-01

## 1. Contrato de producción
Leer primero 01-art-direction.md y las definiciones reales de src/data/medicalCards.ts, organs.ts, outbreaks.ts. No inventar nombres, reglas, estadísticas o causalidad médica. Generar **solo artwork**, nunca una tarjeta completa ni UI con texto; el layout se construye en React. La referencia visual aprobada tiene precedencia para estilo, el catálogo para identidad. No copiar assets de videojuegos. Verificar licencias de modelos, texturas y datos de terceros, y procedencia de imágenes generadas.

## 2. Prompt maestro (mantener invariable)
```text
CÓDIGO VITAL — CV-ART-01 v1.0, Clinical Warfare, Cinematic Bio-Tactical.
Create a single premium scientific videogame illustration, stylized photorealistic
3D PBR biomedical visualization, scientifically recognizable silhouette, selective
microscopic surface detail, restrained cinematic lighting, cool soft key light
from upper left, neutral fill, subtle rim light, dark graphite-blue laboratory
or microenvironment background, realistic organic membrane or satin titanium
material, moderate contrast, crisp focal subject, subtle atmospheric depth.
Single dominant subject, three-quarter perspective, centered within a 10–15%
safe margin, approximately 65–75% frame occupancy, composition readable as a
small card thumbnail. Match the approved style reference in materials, framing,
lighting, color grading and scale language. Artistic game abstraction, not
clinical diagnostic imagery.
SUBJECT: [exact catalog name and ID]
CATEGORY: [unit / treatment / diagnosis / trap / pathogen / organ / environment]
IDENTITY: [distinctive biological or instrument features]
ACTION: [one readable game concept, no invented clinical mechanism]
ACCENT: [approved semantic accent, restrained]
COMPOSITION: [category preset and aspect ratio]
OUTPUT: clean illustration only, no card frame, no labels, no typography,
no numbers, no logos, no watermark, no UI, no collage.
```
Negatives where supported (otherwise append as prose): cartoon/anime, toy plastic, excessive neon, glossy chrome, generic stock photo, excessive blur, visual clutter, gore, false anatomy, multiple unrelated subjects, text, signature, logos, copied franchise art. Do not impose parameters not supported by provider. Seed is optional and does not guarantee identical results across versions/providers.

## 3. Presets por categoría
| Categoría | Composición / identidad | Acento |
|---|---|---|
| Unidad inmunitaria | Macro 3/4, célula completa, núcleo/membrana reconocible; acción contenida | teal |
| Unidad quirúrgica | Instrumental biomédico avanzado, sólido, lectura de silueta; sin humano salvo decisión explícita | ámbar |
| Tratamiento | Vial o interacción molecular conceptual, sin nombre de marca/dosis | azul |
| Diagnóstico | Instrumento, muestra o señal analítica; sin UI ni texto | cian |
| Trampa | Mecanismo defensivo latente, tensión visual, un motivo claro | violeta |
| Patógeno | Macro científico, morfología específica, contraparte hostil sin monstruosidad | coral moderado |
| Órgano | Objeto aislado, 3/4 y turntable de referencia, escala anatómica coherente | perfil del órgano |
| Escenario | Panorámica 16:9, cámara táctica, tres carriles, márgenes reservados para HUD | grafito/titanio |
| Menú | 16:9, focal anatómico a la derecha, espacio de copy a izquierda, sin UI | teal neutro |
| VFX | Referencia de forma, inicio/impacto/recuperación; implementación procedural, no texto | semántico |

Cartas y patógenos: master 4:3, sugerido 1600×1200 si el proveedor lo soporta; validar recorte y thumbnail. Órganos: 1:1 master y vistas ortográficas de referencia si se requieren (no afirmar precisión geométrica). Escenarios: 16:9. Para imágenes generadas usar la imagen de referencia aprobada como entrada visual cuando exista, además del prompt. Para consistencia de personaje/especie, guardar referencia frontal/3/4 y registrar rasgos que no se cambian.

## 4. Inventario actual — 26 cartas jugables y 8 patógenos
Fuente: [medicalCards.ts](../../src/data/medicalCards.ts) en baseline f31afcc. Un artwork por ID, no por copia. Los textos de identidad son briefs de arte, no nuevas reglas.
| ID | Motivo visual |
|---|---|
| macrofago-alveolar | Macrófago con pseudópodos y vesículas, silueta irregular |
| anticuerpo-igg | Molécula Y, brazos y dominios diferenciados |
| linfocito-cd8 | Linfocito citotóxico compacto, gránulos |
| celula-madre | Célula redondeada con núcleo y membrana suave |
| desfibrilador-qx | Unidad instrumental con electrodos aislados |
| diagnostico-pcr | Muestra y cámara de amplificación conceptual |
| oseltamivir | Interacción molecular conceptual con neuraminidasa, sin dosis |
| meropenem-iv | Vial y motivo molecular, sin marca |
| alteplasa-tpa | Red de fibrina en disolución conceptual |
| adrenalina-bolo | Ampolla e impulso energético abstracto |
| sueroterapia-ringer | Fluido translúcido y sistema de perfusión estilizado |
| vacuna-arnm | Nanopartícula lipídica y motivo ARN conceptual |
| cirujano-vascular | Instrumental endovascular de precisión |
| fagocito-gigante | Macrófago activado, pseudópodos marcados |
| barrera-mucociliar | Corte epitelial con cilios y capa protectora |
| igm-neutralizante | Complejo pentamérico estilizado |
| contramedida-citoquina | Interacción molecular antagonista IL-6 conceptual |
| hemostasia-urgencia | Sutura y barrera localizada, sin gore |
| neutrofilo-pmn | Núcleo multilobulado, red NETs |
| celula-nk | Célula con gránulos y silueta diferenciada |
| plaqueta-hemostatica | Plaqueta activada con prolongaciones |
| antifungico-anfo | Liposoma y membrana fúngica conceptual |
| corticosteroide-iv | Vial de medicamento sin marca y motivo molecular |
| hemocultivo-rapido | Recipiente de muestra y sensor analítico |
| interferon-alfa | Proteína y señal celular conceptual |
| terapia-hiperinmune | Complejo de anticuerpos y fluido |
| e-rino | Cápside icosaédrica compacta |
| e-adeno | Cápside con fibras distintivas |
| e-staph | Racimo de cocos |
| e-sarm | Racimo de cocos con marca de amenaza de juego en UI separada |
| e-trombo | Agregado de fibrina y componentes sanguíneos |
| e-pseudo | Bacteria bacilar con rasgo flagelar |
| e-candida | Levaduras gemantes y pseudohifas |
| e-embolo | Fragmento trombótico libre |

Otros recursos: cinco órganos (corazon, pulmon, higado, cerebro, epitelio), arena base y variantes de iluminación, menú, dorso de carta, iconos de tipo/clase/estado, efectos de combate y fondos de briefing. Derivar lista de cartas de brote por ID desde outbreaks.ts en baseline, no inventarlas. Primero 6 referencias piloto (Macrófago, Candida, PCR, Barrera, hígado, arena); después lote inicial; finalmente recompensas y enemigos restantes. No generar 34 imágenes antes de aprobar las referencias.

## 5. Registro y almacenamiento propuesto
```text
docs/art/manifest.json
docs/art/references/       # referencias aprobadas y permisos
art-source/                # originales, opcional LFS/almacenamiento externo
public/assets/cards/{id}.webp
public/assets/organs/{id}.webp
public/assets/environments/{id}.webp
public/assets/models/{id}.glb
```
Un registro por recurso: assetId, catalogId, category, artDirectionVersion, revision, prompt, negativePrompt, model/provider/version (si conocido), seed (si disponible), referenceIds, sourcePath, outputPath, size, checksum, rights, qaStatus, reviewer, notes. Registrar parámetros reales, no simular seeds o modelos. Originales grandes no deben entrar en public ni subirse sin política de almacenamiento; exportar solo optimizados. WebP/AVIF según soporte, fallback; sugerencia 768×576 para cartas, 384×288 thumbnail opcional; medir peso/calidad antes de fijar presupuesto (objetivo inicial 50–150 KB por artwork). GLB y texturas KTX2 si se justifican por perfil GPU. No confundir ilustración con modelo 3D editable. Pipeline alternativo: render offline del modelo Three.js con iluminación CV-ART-01 y composición equivalente.

## 6. QA visual
Rechazar si: anatomía errónea, especie confundible, texto accidental, aspecto ajeno a referencia, sujeto cortado, bajo contraste en miniatura, exceso de ruido/neón o arte duplicado. Comparar contacto entre familias y dentro de cada familia a 96/160px; revisión grande para anatomía. Verificar recorte 4:3 y accesibilidad del UI final. Aprobar con revisión humana y especialista para afirmaciones científicas. Estado: PENDING → GENERATED → QA → APPROVED → OPTIMIZED → INTEGRATED. No marcar aprobado sin imagen real y revisión. En esta entrega solo hay especificación, no assets.
