import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Los tests de integración comparten un único proyecto Supabase remoto:
    // si dos archivos corren a la vez, se pisan los usuarios de prueba y el
    // rate limit de Auth empieza a rechazar altas. Va acá arriba y no dentro
    // del proyecto porque `fileParallelism` es una opción de nivel raíz.
    fileParallelism: false,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/integration/setup.ts'],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
})
