# FURIA MORTAL — El Torneo de las Sombras

Juego de peleas 2D estilo *Mortal Kombat 2/3*, hecho con **HTML5 Canvas + JavaScript puro**.
No usa librerías, imágenes ni archivos de sonido: los ninjas se dibujan con código (esqueleto con
cinemática inversa), la música y los efectos se sintetizan con WebAudio, y el locutor usa la voz del sistema.

## Descargar y jugar

- **Android (APK):** https://github.com/bryanturisto-lang/furia-mortal/releases/latest
  → descarga `FuriaMortal.apk`, ábrelo y permite instalar apps de fuentes desconocidas.
- **En el navegador (cualquier teléfono o PC):** https://bryanturisto-lang.github.io/furia-mortal/
  → en el teléfono puedes tocar *Agregar a pantalla de inicio* para tenerlo como app y jugar sin internet.

Cada vez que se suben cambios a GitHub, el APK y la web se vuelven a generar solos
(`.github/workflows/build.yml`). La llave de firma del APK está en `firma/` (solo en tu PC, nunca en GitHub)
y como secreto del repositorio.

## Cómo jugar desde VS Code

1. **Archivo → Abrir carpeta…** y elige `furia-mortal`.
2. Opción A (recomendada): presiona **F5** y elige *Jugar en Edge* o *Jugar en Chrome*.
3. Opción B: instala la extensión **Live Server** (VS Code te la sugiere), clic derecho en
   `index.html` → *Open with Live Server*.
4. Opción C: doble clic en `index.html` y se abre en el navegador.
5. Opción D (servidor local sin instalar nada), en la terminal de VS Code:

   ```bash
   powershell -ExecutionPolicy Bypass -File serve.ps1
   ```

   y abre http://localhost:8080

## Controles

| Acción            | Jugador 1      | Jugador 2          |
|-------------------|----------------|--------------------|
| Moverse / saltar / agacharse | W A S D | Flechas      |
| Golpe Alto (GA)   | F              | I · Num 4          |
| Golpe Bajo (GB)   | V              | K · Num 1          |
| Patada Alta (PA)  | G              | O · Num 5          |
| Patada Baja (PB)  | B              | L · Num 2          |
| Bloqueo           | H · Espacio    | P · Num 0          |

**Teléfono / tableta:** los controles táctiles aparecen solos: cruceta a la izquierda (8 direcciones),
botones GA, PA, GB, PB y BLOQUEO a la derecha, y arriba ❚❚ (pausa), START y pantalla completa.
Juega con el teléfono en horizontal. Versión publicada: https://claude.ai/artifact/QWhEctCEmFD5zuyuFXeWA7

**Combos lentos o rápidos** (menú principal → COMBOS):
- **LENTOS** (por defecto): pulsa ATRÁS, suelta, luego ADELANTE, suelta, y luego el golpe. Tienes casi
  1 segundo entre cada paso. Arriba a la izquierda ves las flechas que vas pulsando.
- **RÁPIDOS:** la secuencia debe hacerse de corrido, como en el arcade.

**Mandos** (Xbox/PlayStation): cruceta o stick, Y=GA, X=GB, B=PA, A=PB, gatillos=bloqueo, START=confirmar.
`ESC` pausa · `M` silencia el sonido · `Q` (en pausa) vuelve al menú.

### Movimientos

- **Correr:** Adelante, Adelante (mantener)
- **Agarre / lanzamiento:** cerca del rival, Adelante + GB (no se puede bloquear)
- **Gancho:** ↓ + GA (lanza al rival por los aires, ideal como antiaéreo)
- **Barrida:** ↓ + PA (golpe bajo, se bloquea solo agachado)
- **Patada giratoria:** Atrás + PA
- **Ataques aéreos:** saltar + cualquier golpe/patada (se bloquean solo de pie)
- **Combos:** si un golpe conecta, puedes encadenar hasta 2 golpes más y rematar con un especial
- **FATALITY:** cuando aparece **¡ACÁBALO!**, acércate y haz la secuencia de tu personaje

## Personajes (12)

Las entradas son relativas a hacia dónde miras (ATRÁS / ADELANTE / ABAJO).

| Guerrero | Especiales | Fatality |
|----------|-----------|----------|
| **KAIZEN** (ninja espectro) | Lanza Infernal (Atrás, Adelante + GA) · Teletransporte (Abajo, Atrás + GA) | Aliento Infernal: Abajo, Abajo + GA |
| **GLACIAR** (guerrero de hielo) | Proyectil de Hielo (Abajo, Adelante + GB) · Pared de Hielo (Abajo, Abajo + GA) · Deslizamiento de Hielo (Atrás, Adelante + PB) · **ULTRA** Tormenta de Hielo (Abajo, Atrás, Adelante + PA) | Congelación Total: Adelante, Adelante + PB |
| **VENENO** (reptil) | Escupitajo Ácido (Atrás, Adelante + GA) · Deslizamiento (Atrás, Adelante + PB) · Invisibilidad (Abajo, Atrás + PA) | Baño de Ácido: Atrás, Atrás + GB |
| **HUMO** (ninja de humo) | Nube Tóxica (Atrás, Adelante + GA) · Paso de Humo (Abajo, Atrás + PB) | Asfixia: Abajo, Abajo + PB |
| **SOMBRA** (asesino del vacío) | Orbe Oscuro (Atrás, Adelante + GA) · Paso Sombrío (Abajo, Atrás + GA) · Patada Sombra (Atrás, Adelante + PB) | Vacío Eterno: Adelante, Adelante + PA |
| **CARMESÍ** (ninja de fuego) | Bola de Fuego (Atrás, Adelante + GA) · Fuego Rastrero (Atrás, Adelante + GB) · Torbellino (Atrás, Adelante + PA) | Explosión Carmesí: Abajo, Adelante + PA |
| **DRAGÓN** (monje shaolin) | Dragón de Fuego (Adelante, Adelante + GA) · Patada Voladora (Adelante, Adelante + PA) · Patada Bicicleta (Atrás, Adelante + PB) | Furia del Dragón: Atrás, Atrás + PA |
| **TITÁN** (brazos de acero) | Onda Sísmica (Abajo, Adelante + PA) · Embestida (Adelante, Adelante + PB) · Agarre Titánico (Atrás, Adelante + GB) | Aplastamiento: Adelante, Adelante + GA |
| **TRUENO** (dios del trueno) | Descarga Celestial (Abajo, Adelante + GB) · Torpedo (Atrás, Adelante + PA) · Teletransporte (Abajo, Atrás + PA) | Electrocución: Abajo, Atrás + GA |
| **CIBORG** (asesino cibernético) | Misil Buscador (Atrás, Adelante + GA) · Red de Captura (Atrás, Atrás + PB) · Granada (Abajo, Atrás + GA) | Demolición: Abajo, Abajo + GB |
| **ABANICO** (princesa guerrera) | Abanico Cortante (Atrás, Adelante + GA) · Levitación (Atrás, Atrás + GA) · Vuelo del Fénix (Abajo, Adelante + GA) | Decapitación: Atrás, Adelante + PB |
| **ALMA** (hechicero) | Calaveras de Fuego (Atrás, Adelante + GA) · Robo de Alma (Atrás, Adelante + GB, cerca) · Erupción (Abajo, Atrás + PA) | Robo del Alma: Adelante, Adelante + GB |

La lista de movimientos de cada guerrero también aparece en la pantalla de selección y en la pausa (ESC).

**ULTRA:** algunos guerreros tienen un ataque definitivo que solo se puede usar **una vez por ronda** y
cuando les queda **40 % de vida o menos**. Cuando está disponible aparece **ULTRA LISTO** bajo tu barra de vida.

## Modos

- **1 Jugador:** torneo contra 7 rivales al azar (la dificultad sube en los últimos).
- **2 Jugadores:** versus local en el mismo teclado (o con dos mandos).

## Estructura del código

| Archivo         | Qué hace                                                        |
|-----------------|-----------------------------------------------------------------|
| `js/util.js`    | Constantes (resolución, suelo) y funciones de ayuda              |
| `js/audio.js`   | Efectos, música y locutor sintetizados                           |
| `js/input.js`   | Teclado y mandos para 2 jugadores                                |
| `js/data.js`    | Personajes, golpes (frames, daño, cajas de golpe), poses, IA     |
| `js/fighter.js` | Luchador: estados, física, golpes, dibujo procedural             |
| `js/ai.js`      | Inteligencia del CPU                                             |
| `js/fx.js`      | Partículas: sangre, chispas, humo, restos, esqueletos            |
| `js/stage.js`   | Escenario con parallax, antorchas y luna                         |
| `js/game.js`    | Bucle principal, rondas, ¡ACÁBALO!, FATALITY, HUD y menús        |

### Ideas para modificarlo

- **Nuevo personaje:** agrega una entrada en `CHARACTERS` (`js/data.js`): colores, aspecto (`look`:
  cabeza `hood`/`hair`/`bald`/`hat`/`helmet`/`bun`/`long`, torso `vest`/`bare`/`robe`/`armor`, brazos,
  tamaño `bulk`), postura (`stance`), especiales y fatality. Los especiales combinan tipos ya hechos:
  `proj` (cualquier proyectil de `PROJ`), `dash` (cualquier ataque de `DASH`), `tele`, `grab`, `erupt`, `invis`.
- **Balance:** cambia `dmg`, `startup`, `recovery` en `MOVES`.
- **Dificultad:** ajusta `AI_LEVELS` (reacción, probabilidad de bloqueo, agresividad).
