import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import tailwindcss from "@tailwindcss/vite"

// Identidad de la compilación (src/core/version.ts): versión de package.json,
// commit corto y momento de compilación. Si no hay git (por ejemplo, una copia
// descargada como .zip), el commit queda como «sin-commit».
//
// Si la carpeta de la aplicación tiene cambios sin commit (o archivos nuevos sin
// seguimiento), el commit lleva «-modificado»: «0.11.0+8c9b648-modificado». Sin
// esa marca, la compilación diría una combinación versión+commit que no existe
// en el historial (auditoría 2026-11-20, M3). Solo se mira esta carpeta, no el
// resto del repositorio de la tesis. En GitHub Actions el árbol está limpio.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string }
let commit = 'sin-commit'
try {
  const git = (args: string) => execSync(`git ${args}`, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  commit = git('rev-parse --short HEAD')
  if (git('status --porcelain -- .') !== '') commit += '-modificado'
} catch { /* sin git */ }

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: así la misma compilación sirve en la raíz (desarrollo y
  // vista previa) y bajo el subdirectorio del repositorio en GitHub Pages.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_COMPILADO__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
