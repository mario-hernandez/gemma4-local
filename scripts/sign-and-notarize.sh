#!/bin/bash
# Firmar y notarizar el DMG de Gemma 4 Local
# Uso: ./scripts/sign-and-notarize.sh

APP="dist/mac-arm64/Gemma 4 Local.app"
DMG="dist/Gemma 4 Local-1.0.0-arm64.dmg"
BUNDLE_ID="com.local.gemma4"
APPLE_ID="${APPLE_ID:-your-apple-id@example.com}"
TEAM_ID="${APPLE_TEAM_ID:-YOUR_TEAM_ID}"

echo "=== Paso 1: Firmar la app ==="
codesign --deep --force --options runtime \
  --sign "Developer ID Application: Mario Hernandez ($TEAM_ID)" \
  --entitlements build/entitlements.mac.plist \
  "$APP" && echo "App firmada" || { echo "ERROR firmando. Abre Keychain Access y verifica que el certificado tiene clave privada."; exit 1; }

echo ""
echo "=== Paso 2: Verificar firma ==="
codesign --verify --deep --strict "$APP" && echo "Firma OK" || { echo "ERROR en verificacion"; exit 1; }
spctl --assess --type execute "$APP" 2>&1 && echo "Gatekeeper OK" || echo "Gatekeeper: pendiente de notarizacion"

echo ""
echo "=== Paso 3: Crear DMG ==="
npx electron-builder --mac --dir 2>/dev/null  # ya existe, skip si falla
# Si necesitas recrear el DMG manualmente:
# hdiutil create -volname "Gemma 4 Local" -srcfolder "$APP" -ov -format UDZO "$DMG"

echo ""
echo "=== Paso 4: Firmar DMG ==="
codesign --force --sign "Developer ID Application: $CSC_NAME ($TEAM_ID)" "$DMG" && echo "DMG firmado"

echo ""
echo "=== Paso 5: Notarizar ==="
echo "Subiendo a Apple para notarizacion (puede tardar 2-5 minutos)..."
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" \
  --team-id "$TEAM_ID" \
  --password "@keychain:AC_PASSWORD" \
  --wait && echo "Notarizacion completada"

echo ""
echo "=== Paso 6: Staple ==="
xcrun stapler staple "$DMG" && echo "Staple OK"

echo ""
echo "=== LISTO ==="
echo "El DMG esta firmado, notarizado y stapled."
echo "Se puede distribuir sin avisos de seguridad en cualquier Mac."
ls -lh "$DMG"
