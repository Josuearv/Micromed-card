# Biblia de arte — CV-ART-01 v1.0

## 1. Identidad
Clinical Warfare / Cinematic Bio-Tactical. Fantasía: dirigir una intervención biológica desde una estación de investigación avanzada. Realismo científico estilizado de videojuego AAA, no fotografía hospitalaria ni caricatura. Mostrar escala microscópica con membranas translúcidas, microtexturas, formas anatómicas legibles y profundidad controlada. El conflicto se lee como biología, no soldados humanos ni monstruos de terror. Evitar gore, sangre decorativa, alarmismo y falsas imágenes diagnósticas. Referencias funcionales: Into the Breach (amenaza), Slay the Spire (decisión), Hearthstone (manipulación), Master Duel (puesta en escena), Inscryption (atmósfera); no copiar IP, marcos ni arte.

## 2. Gramática visual obligatoria
| Propiedad | Norma |
|---|---|
| Estilo | Render 3D científico cinematográfico semirrealista, PBR, superficies con detalle selectivo, no plástico brillante |
| Cámara de ilustración | Macro 85–105 mm equivalente como guía estética; perspectiva 3/4 moderada; una silueta dominante |
| Luz | Key fría suave arriba-izquierda, relleno neutro tenue, rim posterior controlado; acento semántico subordinado |
| Fondo | Azul grafito, oscuro pero no negro puro, profundidad atmosférica discreta; sin decoraciones dominantes |
| Composición | Sujeto centrado, 65–75% de ocupación, margen de seguridad 10–15%; una acción o concepto por imagen |
| Materiales | Orgánico: membrana húmeda con dispersión suave, rugosidad variable; metal: titanio cepillado satinado; vidrio: transparente con espesor |
| Post | Contraste moderado, detalle focal nítido, bloom mínimo, ruido bajo; no aberración cromática, lens flare o bokeh exagerado |
| Anatomía | Silueta y rasgos biológicos diferenciados; licencia estilística explícita; no prometer exactitud clínica |
| Prohibiciones | Tipografía generada, marcas, marcos, cifras, logos, texto, iconos UI, collage, manos humanas innecesarias, neón arcoíris, estética de dashboard |

## 3. Paleta y jerarquía
| Token | Hex | Uso |
|---|---|---|
| bg | #080E15 | entorno / fondo |
| surface | #111E29 | HUD / panel |
| surface-raised | #1B2C38 | inspector |
| titanium | #748692 | materiales / detalle secundario, no asumir contraste de texto |
| text | #E9F0F4 | lectura |
| text-secondary | #B7C7D1 | etiquetas |
| ally | #32C6A0 | lado aliado |
| enemy | #F05276 | amenaza rival |
| energy | #38BCE5 | PA |
| selected | #F1BE61 | selección |
| trap | #AD8AE8 | reacción |
| danger | #FA814A | peligro |
| inactive | #526171 | contorno inactivo |
| heal | #7FD58A | recuperación |

Color no único indicador. Lado, clase, rareza, coste y estado usan canales distintos: posición + emblema de lado; icono de clase; marco/insignia de rareza; numeral de coste; contorno y etiqueta de estado. No usar rojo/verde solos para distinguir. Clases: inmunología teal, farmacología azul, cirugía ámbar moderado, diagnóstico cian frío; trampa violeta como tipo, no clase. Arte usa acento de clase de forma sutil, nunca recolorea una especie hasta volverla irreconocible. Enemigos: rim coral y base hostil, no teñir todo el sujeto de rojo. Órganos: paleta anatómica natural con acentos del perfil existente. El color de texto debe pasar contraste medido, no inferido por hex.

## 4. Familias y coherencia 2D/3D
- Macrófago: cuerpo irregular grande, pseudópodos y vesículas; neutrófilo: núcleo multilobulado y redes NETs diferenciadas; linfocito T: núcleo compacto y gránulos; NK: gránulos y distinta silueta; anticuerpo IgG: Y molecular estilizada, IgM: conjunto pentamérico; célula madre: núcleo y membrana suaves; plaqueta: disco irregular activado con prolongaciones.
- Virus: cápside icosaédrica diferenciada por especie, adenovirus con fibras, rinovirus sin envoltura; bacterias: estafilococos en racimos de cocos (SARM no es bacilo), Pseudomonas con forma bacilar; Candida: levaduras gemantes y pseudohifas según contexto; trombo y émbolo: fibrina y componentes sanguíneos. Las diferencias de resistencia no son distinguibles por aspecto real: usar marcas de juego, no falsas características clínicas.
- Tratamiento: vial/instrumento o acción molecular conceptual, no etiquetas de dosis ni marcas, no aparentar protocolo de tratamiento; diagnóstico: muestra, sensor o proceso analítico; trampa: mecanismo defensivo latente. Mantener lenguaje de laboratorio, no iconos de botiquín genéricos.
- Órganos: corazón, pulmón, hígado, cerebro y epitelio. Contorno anatómico identificable aun a tamaño reducido; detalle principal, sin mezclas; epitelio como corte tisular. Mismo modelo o turntable como referencia para arte 2D. Los perfiles de organs.ts gobiernan las reglas y el nombre.
- Escenario: mesa táctica de titanio/grafito, tres carriles estables, monitor y herramientas periféricas. Órgano en zona dedicada, sin tapar carriles. El HUD HTML domina decisiones; el mundo 3D aporta identidad. No poner información indispensable exclusivamente en textura o geometría.
- VFX: ataque (trayectoria e impacto), defensa (barrera), diagnóstico (escaneo), cura (reparación), trampa (revelación + resolución), mutación (cambio de silueta/halo), victoria (estabilización ambiental). Forma, ritmo, icono y texto redundantes; sin estrobos ni sacudida obligatoria.

## 5. Tipografía y UI
Conservar Outfit (títulos), Plus Jakarta Sans (reglas y controles), IBM Plex Mono (datos). Propuesta inicial: 32–48 px pantalla; 20–26 encuentro; 18–24 cifras clave; 14–16 nombres; 13–16 reglas; 12–13 etiquetas. No usar 9px para información esencial. Espaciado 4/8/12/16/24/32. Bordes funcionales, superficies discretas, esquinas 4–8 px; evitar tarjetas genéricas de dashboard. UI vectorial y texto en React/CSS, no rasterizar textos con IA.
Cartas: relación 2:3 para tarjeta completa; ventana de ilustración común 4:3 (recorte controlado), nombre hasta dos líneas, coste visible, regla concisa, stats ATK/PS o efecto/objetivo; expansión para leer regla completa. Separar ilustración, marco, iconografía, texto y estado. Rareza no altera jerarquía de coste.

## 6. Gate de dirección artística
Comparar las propuestas a 96 y 160 px y en vista grande. Revisar silueta, color, anatomía, materiales y coherencia. Los 14 recursos de los dos lotes piloto cuentan con aprobación provisional como referencias de dirección artística CV-ART-01 v1.0. Sus revisiones se conservan en el [manifiesto de arte](../art/manifest.json) y se pueden consultar en la [hoja de referencias](../art/cv-art-01-hoja-comparativa-lotes-1-2.png). La aprobación individual de los recursos de catálogo y su integración se registran después de la revisión.
