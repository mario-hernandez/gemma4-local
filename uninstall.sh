#!/bin/bash
# Desinstalar TODO: Gemma 4 Local (app + vMLX + modelo)
# Ejecutar: bash ~/Desarrollo/vmlx-gemma4-gqck2/uninstall.sh

echo "=== Desinstalacion de Gemma 4 Local ==="
echo ""

# 1. Parar procesos
pkill -f "vmlx serve" 2>/dev/null && echo "[1/3] Servidor vMLX detenido" || echo "[1/3] Servidor no estaba corriendo"
pkill -f "Electron.*vmlx-gemma4" 2>/dev/null

# 2. Borrar modelo
MODEL_DIR="$HOME/.cache/huggingface/hub/models--mlx-community--gemma-4-e4b-it-4bit"
if [ -d "$MODEL_DIR" ]; then
    rm -rf "$MODEL_DIR"
    echo "[2/3] Modelo Gemma 4 E4B borrado (~4.9 GB liberados)"
else
    echo "[2/3] Modelo ya no existia"
fi

# 3. Borrar proyecto (guardar este script en /tmp antes de borrar)
PROJECT_DIR="$HOME/Desarrollo/vmlx-gemma4-gqck2"
if [ -d "$PROJECT_DIR" ]; then
    rm -rf "$PROJECT_DIR"
    echo "[3/3] Proyecto completo borrado (~2 GB liberados)"
else
    echo "[3/3] Proyecto ya no existia"
fi

echo ""
echo "Desinstalacion completada. ~6.9 GB liberados."
echo "No se modifico nada del sistema (no hay nada mas que revertir)."
