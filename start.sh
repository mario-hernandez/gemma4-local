#!/bin/bash
# Arrancar vMLX con Gemma 4 E4B
# Uso: ./start.sh [puerto]

PORT=${1:-11434}
DIR="$(cd "$(dirname "$0")" && pwd)"

source "$DIR/.venv/bin/activate"

echo "Arrancando Gemma 4 E4B en http://127.0.0.1:$PORT ..."
echo "Para parar: Ctrl+C o ./stop.sh"
echo ""

vmlx serve mlx-community/gemma-4-e4b-it-4bit --port "$PORT" --host 127.0.0.1
