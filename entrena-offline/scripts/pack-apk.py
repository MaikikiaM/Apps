# scripts/pack-apk.py
# Empaqueta classes.dex y assets/ en el APK asegurando 100% barras inclinadas POSIX '/'
import os
import sys
import zipfile

def pack(apk_path, dist_dir, dex_path):
    print(f"Abriendo APK base: {apk_path}")
    with zipfile.ZipFile(apk_path, 'a', compression=zipfile.ZIP_DEFLATED) as zf:
        # Inyectar classes.dex
        if os.path.exists(dex_path):
            zf.write(dex_path, 'classes.dex')
            print("[OK] Inyectado classes.dex")
        else:
            raise FileNotFoundError(f"No se encontro {dex_path}")

        # Inyectar todos los archivos de dist/ en assets/ con '/'
        for root, _, files in os.walk(dist_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, dist_dir).replace('\\', '/')
                arcname = f"assets/{rel_path}"
                zf.write(full_path, arcname)
                print(f"  + {arcname}")

    print("[OK] Todos los assets inyectados con barras '/' estandares de Android.")

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Uso: python pack-apk.py <apk_path> <dist_dir> <dex_path>")
        sys.exit(1)
    pack(sys.argv[1], sys.argv[2], sys.argv[3])
