#!/usr/bin/env bash
# Compila y firma el APK de "RJM Publicar" sin Android Studio.
# Requisitos (Ubuntu/Debian): sudo apt-get install aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange openjdk-17-jdk
# Uso:  RJM_KS=/ruta/rjm-publicar.jks RJM_KS_PASS='clave' ./compilar.sh
# La llave (.jks) y su clave NO van al repositorio: sin ellas no se pueden publicar actualizaciones.
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk/platforms/android-23/android.jar
: "${RJM_KS:?Falta RJM_KS (ruta a la llave .jks)}"; : "${RJM_KS_PASS:?Falta RJM_KS_PASS}"
rm -rf build && mkdir -p build/gen build/obj build/dex
aapt package -f -m -J build/gen -M AndroidManifest.xml -S res -I "$SDK"
javac -nowarn -source 8 -target 8 -bootclasspath "$SDK" -classpath "$SDK" -d build/obj \
  build/gen/com/rjmimport/publicar/R.java src/com/rjmimport/publicar/*.java
dalvik-exchange --dex --output=build/dex/classes.dex build/obj
aapt package -f -M AndroidManifest.xml -S res -I "$SDK" -F build/sin-alinear.apk build/dex
zipalign -f -p 4 build/sin-alinear.apk build/alineado.apk
apksigner sign --v2-signing-enabled true --v3-signing-enabled true --ks "$RJM_KS" --ks-pass env:RJM_KS_PASS --ks-key-alias rjm --out build/rjm-publicar.apk build/alineado.apk
apksigner verify --print-certs build/rjm-publicar.apk
echo "Listo: $(pwd)/build/rjm-publicar.apk"
