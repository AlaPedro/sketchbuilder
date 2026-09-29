# SketchMaker

Rabiscador de circuitos para protótipos (ESP32 & cia), feito com React Flow.
Componentes são retângulos com pinos nomeados; os fios ligam pino a pino.

```bash
npm install
npm run dev
```

## Como usar

- **Novo componente**: dê um nome e liste os pinos de cada lado (`3V3, GND, D15...`).
  Marque "Salvar também na biblioteca" para reutilizar.
- **Ligar**: arraste de um pino até outro pino.
- **Ponta solta**: solte o fio no vazio. Depois arraste a ponta até um pino para ligar.
- **Tesoura (C)**: clique num fio para cortar; ficam duas pontas soltas.
- **Junção (J)** ou **duplo clique no fio**: cria um ponto no meio do fio. Arraste o
  centro do ponto para puxar um fio novo (junção) ou a borda para mover (dobra).
- **Unir**: solte um ponto (ponta/dobra/junção) em cima de um pino ou de outro ponto.
- Selecionar um fio destaca todo o circuito ligado a ele.
- `R` gira, `Ctrl+D` duplica, `Del` apaga, `Ctrl+Z`/`Ctrl+Y` desfaz/refaz.
- Arrastar no vazio seleciona; botão do meio, botão direito ou espaço+arrastar move a tela;
  `Ctrl+scroll` dá zoom.

O projeto é salvo automaticamente no navegador. Use os botões da barra para
exportar/importar `.json` e exportar `.png`.
