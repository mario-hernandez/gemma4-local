#!/bin/bash
# Parar vMLX
PID=$(ps aux | grep "[v]mlx serve" | awk '{print $2}')
if [ -n "$PID" ]; then
    kill "$PID"
    echo "vMLX detenido (PID $PID)"
else
    echo "vMLX no esta corriendo"
fi
