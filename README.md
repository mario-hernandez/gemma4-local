# Gemma 4 Local — App de chat con IA local para Mac

App de escritorio (Electron) para chatear con Google Gemma 4 corriendo 100% en tu Mac.
Sin internet, sin suscripciones, sin que tus datos salgan de tu ordenador.

## Que hay instalado

| Componente | Ubicacion | Tamano |
|-----------|-----------|--------|
| App Electron + node_modules | `~/Desarrollo/vmlx-gemma4-gqck2/` (excepto .venv) | ~500 MB |
| Entorno virtual Python (vMLX) | `~/Desarrollo/vmlx-gemma4-gqck2/.venv/` | ~1.5 GB |
| Modelo Gemma 4 E4B 4-bit | `~/.cache/huggingface/hub/models--mlx-community--gemma-4-e4b-it-4bit/` | ~4.9 GB |

**Espacio total en disco: ~6.9 GB**

## Como usar

### Forma rapida: App de escritorio

```bash
cd ~/Desarrollo/vmlx-gemma4-gqck2
npm start
```

1. Se abre la app con un aviso de que el Mac puede ir lento ~10-15s
2. Pulsas "Arrancar modelo"
3. Esperas a que cargue (~10s)
4. Chateas!

El icono de engranaje (arriba derecha) abre el panel de ajustes donde puedes configurar:
- Modo pensamiento (on/off/auto)
- Temperatura, top-p, top-k
- Tokens maximos
- Penalizacion por repeticion
- Instruccion de sistema personalizada

### Forma alternativa: Solo servidor (sin interfaz)

```bash
cd ~/Desarrollo/vmlx-gemma4-gqck2
./start.sh
```

El servidor arranca en `http://127.0.0.1:11434` con API compatible OpenAI.

### Usar con herramientas externas

vMLX es compatible con la API de OpenAI, asi que funciona con:
- **Cursor**: Settings > Models > OpenAI API Base URL: `http://127.0.0.1:11434/v1`
- **Continue (VS Code)**: Configurar como proveedor OpenAI-compatible
- **Cualquier cliente OpenAI**: Apuntar base_url a `http://127.0.0.1:11434/v1`

### Chatear via curl

```bash
curl http://127.0.0.1:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mlx-community/gemma-4-e4b-it-4bit",
    "messages": [{"role": "user", "content": "Hola!"}],
    "max_tokens": 200
  }'
```

## Parametros del modelo

| Parametro | Default | Rango | Que hace |
|-----------|---------|-------|----------|
| Temperatura | 1.0 | 0.0 - 2.0 | Creatividad de la respuesta. 0=rigido, 1=natural, 2=loco |
| Top-p | 0.95 | 0.1 - 1.0 | Diversidad de palabras. 0.95 recomendado por Google |
| Top-k | 64 | 0 - 200 | Candidatas por paso. 64 recomendado por Google |
| Tokens max | 4096 | 256 - 32768 | Longitud maxima de respuesta |
| Rep. penalty | 1.0 | 1.0 - 2.0 | Penaliza repeticiones. 1.0=desactivado |
| Thinking | auto | on/off/auto | Modo "pensar antes de responder" |

## Rendimiento observado

- **RAM GPU usada**: 4.98 GB (de 16 GB totales)
- **Tiempo de arranque**: ~8-15 segundos
- **Modelo**: Gemma 4 E4B instruction-tuned, 4-bit quantization
- **Contexto maximo practico**: ~64K tokens (con 16 GB RAM)

## Notas de seguridad

- El servidor escucha SOLO en localhost (127.0.0.1)
- Las herramientas agenticas de vMLX (ejecucion de comandos) estan DESACTIVADAS
- No se envia ninguna telemetria ni dato a ningun servidor externo
- Auditoría completa del código fuente realizada el 2026-04-06

---

## COMO DESINSTALAR TODO

### Opcion 1: Script automatico (recomendado)

```bash
bash ~/Desarrollo/vmlx-gemma4-gqck2/uninstall.sh
```

### Opcion 2: Manual paso a paso

```bash
# 1. Parar procesos
pkill -f "vmlx serve"; pkill -f "Electron"

# 2. Borrar el proyecto completo (app + venv + node_modules)
rm -rf ~/Desarrollo/vmlx-gemma4-gqck2

# 3. Borrar el modelo descargado
rm -rf ~/.cache/huggingface/hub/models--mlx-community--gemma-4-e4b-it-4bit

# 4. (Opcional) Si no usas HuggingFace para nada mas
rm -rf ~/.cache/huggingface
```

**Espacio recuperado: ~6.9 GB**

### Verificar que no queda nada

```bash
ps aux | grep -E "vmlx|Electron" | grep -v grep
ls ~/Desarrollo/vmlx-gemma4-gqck2 2>/dev/null && echo "AUN EXISTE" || echo "BORRADO OK"
ls ~/.cache/huggingface/hub/models--mlx-community--gemma-4-e4b-it-4bit 2>/dev/null && echo "AUN EXISTE" || echo "BORRADO OK"
```

### Que NO se modifico (no hay nada que revertir)

- No se instalo nada globalmente (todo en venv + node_modules locales)
- No se modifico ningun archivo del sistema
- No se creo ningun servicio, daemon ni LaunchAgent
- No se modifico el PATH, .zshrc, ni ningún archivo de configuracion
- No se creo ningun archivo fuera de `~/Desarrollo/vmlx-gemma4-gqck2/` y `~/.cache/huggingface/`

---

Fecha de instalacion: 2026-04-06
Repositorio auditado: https://github.com/jjang-ai/vmlx (v1.3.28)
