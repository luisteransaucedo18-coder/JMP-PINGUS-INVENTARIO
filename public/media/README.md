# Video de transición

Fuente: `CargaPantalla.mp4`, proporcionado por el usuario. El original se conserva sin modificaciones en `CargaPantalla-original.mp4`.

`pinguino-caminando.mp4` es el mismo video con estos ajustes de edición:
- Tramo 0–5,3 segundos: caminata completa, sin el acercamiento final a los pies.
- Recorte de 1650 × 1000 desde x=0, y=40: excluye la marca del generador situada en la esquina derecha.
- Pista de audio eliminada, H.264 y faststart para reproducción web.

Comando equivalente:
```sh
ffmpeg -i CargaPantalla-original.mp4 -t 5.3 -vf "crop=1650:1000:0:40" -an -c:v libx264 -crf 19 -preset medium -movflags +faststart pinguino-caminando.mp4
```

La integración del fondo se realiza con `mix-blend-mode: screen` sobre el azul profundo de la tarjeta. La animación sigue siendo video; no utiliza imágenes, GIF ni una recreación CSS.

`pinguino-caminando-alpha.webm` conserva exactamente ese tramo y añade un canal alpha: el negro del fondo se vuelve transparente para que el pingüino se integre con el degradado de la pantalla. El MP4 se conserva como alternativa para navegadores que no reproduzcan WebM.
