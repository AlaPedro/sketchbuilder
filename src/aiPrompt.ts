import { WIRE_COLOR_LIST, type SimpleCircuit } from './simple';
import type { Template } from './types';

/** Especificação do formato simplificado. É o que a IA precisa saber para gerar circuitos. */
export const AI_FORMAT_SPEC = `## Formato do circuito (SketchMaker)

\`\`\`json
{
  "app": "sketchmaker",
  "format": "simple",
  "version": 1,
  "components": [
    { "id": "esp", "template": "ESP32 DevKit", "x": 0, "y": 0 },
    { "id": "r1", "template": "R 10k", "label": "R 220" },
    { "id": "dht", "label": "DHT22", "pins": { "left": ["VCC", "DATA", "NC", "GND"] } }
  ],
  "wires": [
    { "from": "esp.D4", "to": "dht.DATA", "color": "green" },
    { "from": "esp.3V3", "to": "dht.VCC", "color": "red" },
    { "from": "esp.GND", "to": "dht.GND", "color": "black" }
  ],
  "notes": ["DHT22 no D4"]
}
\`\`\`

### components
- \`id\`: nome curto e único, usado nos fios (ex.: "esp", "r1", "led_verde").
- \`template\`: nome de um componente da biblioteca (lista abaixo). Os pinos vêm dele.
- \`label\`: texto escrito no componente (opcional quando usa template).
- \`pins\`: para componentes que NÃO estão na biblioteca. Objeto com os lados
  \`top\`, \`bottom\` (ordem da esquerda para a direita) e \`left\`, \`right\` (ordem de cima para baixo).
  Omita os lados sem pinos. Se usar \`template\` e \`pins\` juntos, \`pins\` vale.
- \`x\`, \`y\`: posição em pixels (opcional). Sem posição o app organiza sozinho.
  Ao alterar um circuito existente, mantenha x/y dos componentes que já estão lá.
- \`color\` (opcional): white, gray, red, yellow, green, blue, purple, orange.
- \`w\`, \`h\` (opcional): tamanho em pixels; normalmente omita.

### wires
- \`{ "from": "id.PINO", "to": "id.PINO", "color": "..." }\` — ligação direta entre dois pinos.
- Use exatamente os nomes de pino do componente.
- Pino com nome repetido no mesmo componente (ex.: dois GND no ESP32): "esp.GND" é o primeiro,
  "esp.GND#2" o segundo (contando top, right, bottom, left, nessa ordem).
- Vários fios no mesmo pino são permitidos (é assim que se faz uma junção/barramento).
- Cores: ${WIRE_COLOR_LIST.join(', ')}. Convenção: red = positivo/VCC, black = GND, as demais para sinais.

### notes
- Textos soltos no desenho: \`"texto"\` ou \`{ "text": "...", "x": 0, "y": 0 }\`.`;

function libraryText(library: Template[]) {
  return library
    .map((t) => {
      const sides = (['left', 'top', 'right', 'bottom'] as const)
        .filter((s) => t.pins[s].length).map((s) => `${s}: ${t.pins[s].join(', ')}`);
      return `- "${t.label}" — ${sides.join(' | ') || 'sem pinos'}`;
    })
    .join('\n');
}

/** `partial`: o circuito é só um trecho (itens selecionados) de um projeto maior. */
export function buildAiPrompt(circuit: SimpleCircuit, library: Template[], partial = false) {
  const empty = circuit.components.length === 0;
  const finish = partial
    ? 'Termine com o trecho COMPLETO (todos os componentes e fios deste trecho, não só as mudanças) em um único bloco ```json no formato abaixo. Eu importo esse JSON direto no app.'
    : 'Termine com o circuito COMPLETO (não só as mudanças) em um único bloco ```json no formato abaixo. Eu importo esse JSON direto no app.';
  const current = partial
    ? `## Trecho selecionado do circuito
Isto é só uma parte de um projeto maior (os itens que selecionei). Fios que ligam este trecho a componentes fora da seleção não aparecem aqui.
${empty ? '(nenhum componente no trecho)' : '```json\n' + JSON.stringify(circuit, null, 2) + '\n```'}`
    : `## Circuito atual
${empty ? '(vazio — crie do zero)' : '```json\n' + JSON.stringify(circuit, null, 2) + '\n```'}`;
  return `Você vai me ajudar a montar e entender circuitos eletrônicos para protótipos (ESP32, Arduino, sensores, módulos) usando o SketchMaker, um editor de esquemas onde cada componente é um retângulo com pinos nomeados e os fios ligam pino a pino.

Como responder:
1. Explique o circuito de forma curta e didática (o que cada ligação faz e por quê).
2. Aponte riscos: tensão errada (ex.: 5V em pino de 3.3V), curto, falta de resistor, pino de boot/entrada-apenas do ESP32, corrente demais num GPIO.
3. ${finish}

${AI_FORMAT_SPEC}

## Biblioteca (componentes disponíveis por "template")
${libraryText(library)}

Se precisar de algo que não está na biblioteca, crie com "pins" usando os nomes de pino reais do módulo.

${current}

## Meu pedido
`;
}
