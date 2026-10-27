# Kit de Sala RPG

Material preparado antes de programar. El plan completo está en `../CLAUDE.md`.

## retratos/
Retratos de los NPCs para la caja de diálogo. PNG 480×600, fondo transparente, con los ojos alineados en la misma posición, así al cambiar de expresión la cara no "salta".

| Archivo | Personaje | Se usa cuando… |
|---|---|---|
| `claude_normal.png` | Claude | explica |
| `claude_feliz.png` | Claude | saluda, felicita, respuesta correcta |
| `claude_pensativa.png` | Claude | piensa, respuesta incorrecta |
| `code_normal.png` | Claude Code | da info |
| `code_guino.png` | Claude Code | saluda, tips |
| `code_bug.png` | Claude Code | errores y bugs |

Las ilustraciones originales se generaron con Gemini. Acá se les sacó el fondo, se recortaron y se alinearon.

## contenido/
- `libros.json`: 4 estantes y 35 libros, basados en la planificación 2026 de Programación IV y en el material de Reverb/Echo de la cátedra. Para agregar o corregir un libro, editás este archivo y corrés `php artisan db:seed --class=BibliotecaSeeder`.
- `dialogos.json`: lo que dicen Claude y Claude Code. `{nombre}` se reemplaza por el nombre del jugador.
- `examen.json`: 50 preguntas de opción múltiple. `correcta` es la posición de la respuesta correcta, contando desde 0.

## Cómo arrancar con Claude Code
1. Abrí una terminal en `C:\xampp\htdocs\sala-rpg` y prendé MySQL en el panel de XAMPP.
2. Ejecutá `claude`.
3. Escribí: **"Leé el CLAUDE.md y hacé la etapa 0."**
4. Cuando termine, probá lo que te indique y seguí con: **"Etapa 1."**, y así.
