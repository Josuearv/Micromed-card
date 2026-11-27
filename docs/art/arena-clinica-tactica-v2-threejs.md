# Arena clínica táctica V2

Especificación de geometría para reproducir la estación de CV-ART-01 v1.0 en Three.js. La distribución sigue la cámara táctica fija, los tres carriles emparejados y la zona clínica reservada que describe la [especificación UX/UI](../game-v4/03-ux-ui-specification.md).

[Ilustración original de la Arena V2](../../art-source/arena-clinica-tactica-v2.png)

## Distribución de la mesa

Usar Y como eje vertical, `y = 0` como superficie y Z positivo hacia el lado aliado. Todas las medidas están en unidades de escena.

| Elemento | Centros X, Z | Huella X × Z | Geometría |
| --- | --- | --- | --- |
| Chasis | 0, 0 | 11,2 × 7,3 | Caja biselada, altura 0,45, tapa en `y = 0` |
| Tres posiciones aliadas | X = −3,65, −1,65, 0,35 en Z = +1,23 | 1,64 × 1,90 cada una | Rebaje de perfil bajo, borde teal |
| Tres posiciones enemigas | Mismos valores de X en Z = −1,23 | 1,64 × 1,90 cada una | Rebaje de perfil bajo, borde coral |
| Dos posiciones para trampas | X = −2,65 y −0,65 en Z = +2,90 | 1,16 × 0,55 cada una | Dos rebajes independientes, borde violeta |
| Área del órgano | +3,42, 0 | Ø 2,35 | Base cilíndrica y aro de vidrio, altura total máxima 0,35 |

Cada carril empareja las posiciones aliada y enemiga que comparten X. La calle central de 0,56 unidades deja visibles ambas filas. Los dos alojamientos de trampas ocupan el borde próximo y el órgano se monta fuera de la retícula, en un anclaje propio.

## Montaje y encuadre

- Modelar la cubierta con paneles de titanio y placas de inserción a `y = −0,04` para resolver los ocho rebajes por geometría. Usar perfiles rectos biselados, pequeñas tiras de borde y dos cilindros concéntricos para el muelle del órgano.
- Añadir cuatro patas bajas de grafito con base satinada, centradas en X = ±4,60 y Z = ±2,55, con huella de 1,0 × 1,0 y altura de 0,75. Mantener la silueta de las patas dentro de la cubierta en planta.
- Usar grafito compuesto mate para el chasis, titanio satinado para las piezas expuestas y vidrio con espesor en el muelle. Limitar el color semántico a las tiras de borde. La ubicación y el tamaño también distinguen las zonas.
- Partir de una cámara ortográfica 16:9 fija en `(0,8; 10; 7)`, mirando a `(0; 0; 0)`, con encuadre de 17 unidades de ancho. Este encuadre de implementación da más aire lateral que la ilustración. La vista de inspección puede cambiar de cámara de forma independiente.
- Colocar la luz principal fría arriba a la izquierda, relleno neutro débil y luz posterior tenue. Dejar espacio alrededor del tablero para las capas de presentación del juego. La ilustración de entorno lleva únicamente materiales e iluminación.
- Proyectar los anclajes de escena en el rectángulo real del canvas. Comprobar que las seis posiciones principales, los dos rebajes de trampa y el muelle se vean completos y se puedan distinguir a 160 px de ancho.
