import { fileURLToPath } from "node:url";

/**
 * Конфиг vitest. Главное — alias `@/* -> ./src/*` (как в tsconfig `paths`), чтобы
 * тесты могли импортировать модули, которые сами ходят через `@/...` (напр.
 * `src/lib/core/audio.ts` → `@/lib/stt/postprocess`). Без него такие тесты падают
 * на резолве импорта (см. контракт-тесты A6, #187).
 *
 * Экспортируем простой объект (без `defineConfig` из `vitest/config`) — это валидно
 * и не тянет лишний импорт в конфиг.
 */
export default {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
};
