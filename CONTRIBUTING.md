# Contribuindo com o SketchMaker

Obrigado pelo interesse! O projeto é pequeno e simples de mexer.

## Relatar um problema ou sugerir algo

Abra uma [issue](https://github.com/AlaPedro/sketchbuilder/issues) contando:

- o que você fez, o que esperava e o que aconteceu;
- se possível, o circuito em `.json` (botão "Salvar circuito") ou um print.

## Enviar código

1. Faça um fork e crie uma branch: `git checkout -b minha-melhoria`.
2. `npm install` e `npm run dev`.
3. Antes de abrir o PR, rode `npm run build` (checa os tipos e gera o build).
4. Abra o pull request explicando o que mudou e por quê.

Siga o estilo do código ao redor. Textos da interface são em português.

## Adicionar um componente à biblioteca

Os modelos ficam em [src/templates.ts](src/templates.ts). Cada um tem nome, cor e os pinos
de cada lado (`top`/`bottom` da esquerda para a direita, `left`/`right` de cima para baixo).
Use os nomes de pino impressos na placa real.

## Licença

Ao contribuir, você concorda que sua contribuição será distribuída sob a [licença MIT](LICENSE).
