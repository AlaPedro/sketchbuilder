# SketchMaker

Editor de esquemas para protótipos (ESP32 & cia) em React Flow + Zustand. Componentes são
retângulos com pinos nomeados; fios ligam pino a pino.

## Gerar circuitos para o usuário

Quando pedirem um circuito, escreva um arquivo em `circuitos/<nome>.json` no **formato
simplificado**. O usuário abre pelo botão "Abrir circuito" da barra ou cola em "Colar resposta da IA".

- Especificação do formato: `AI_FORMAT_SPEC` em [src/aiPrompt.ts](src/aiPrompt.ts).
- Componentes da biblioteca (nome do `template` e pinos): [src/templates.ts](src/templates.ts).
  O usuário pode ter modelos próprios salvos no navegador; se ele colar o prompt do botão
  "Copiar para IA", a lista de lá é a que vale.
- Conversão e validação (nomes de pino, `#2` para pinos repetidos): [src/simple.ts](src/simple.ts).

Explique o circuito e aponte riscos elétricos (3.3V vs 5V, falta de resistor, pinos
só-entrada 34/35/36/39 e pinos de boot do ESP32).

## Código

- `src/store.ts`: estado, histórico (undo/redo) e operações de fio (cortar, unir, junção).
- `src/Canvas.tsx`: interações do React Flow.
- Vários canvas (`canvases` + `activeId` no store; o ativo fica em `nodes`/`edges`). UI em `src/ui/CanvasList.tsx`.
- Salvamento automático no `localStorage` (`sketchmaker-v1`), em formato completo.
- `npm run dev` para rodar, `npx tsc -p tsconfig.json` para checar tipos.
