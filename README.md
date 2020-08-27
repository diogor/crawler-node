# INSTALAÇÃO

## Baixe o driver do chrome headless
- Verifique qual a versão do Google Chrome instalada (Ajuda > Sobre o Google Chrome)
- Baixe o driver correspondente em: http://chromedriver.storage.googleapis.com/index.html
- Extraia o .zip em alguma pasta no seu computador e coloque o caminho no seu PATH

## Configure
- Crie um arquivo ```.env``` de acordo com suas necessidades. (exemplo em .env.example)
- Entre na pasta do código e instale com: ```npm install```

## Rodando o programa
- Rode com: ```node index.js [data] [região]```
 - Onde [data] é a data no formato DD/MM/AAAA
 - E [região] é uma das opções: sudeste, sul, nordeste ou norte
