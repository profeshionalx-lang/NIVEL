<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mobile-first

Nivel — **mobile-first** сервис. Любая страница, компонент, модалка, форма проектируется под мобильный viewport (∼390px) в первую очередь. Десктоп — производное.

- Контейнеры ограничивай `max-w-[430px]`, центрируй.
- Тач-зоны ≥ 44px, не полагайся на `:hover`.
- Модалки/sheet'ы используй bottom-sheet pattern (через portal, чтобы не застревать в `transform`-контексте родителя). Не открывай обычные центрированные диалоги.
- Длинные горизонтальные списки (карусели) делай с `overflow-x-auto` + `snap-x snap-mandatory`, не вертикальный stack.
- Шрифты, отступы, иконки выбирай под палец, не курсор. Проверяй на узком экране до того как зафиксировать дизайн.
