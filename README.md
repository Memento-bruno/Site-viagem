# Roteiro Europa 2026

Itinerário interativo de uma viagem de carro de 19 dias por sete países —
Espanha, Itália, Suíça, Áustria, Liechtenstein, Eslovênia e Croácia — de 10 a 28
de setembro de 2026.

**➜ <https://memento-bruno.github.io/Site-viagem/>**

Abre no dia de hoje, funciona sem internet, mostra quanto o dia custa em euro e
em real, avisa a que horas o sol se põe e leva direto ao Google Maps ou à
bilheteria oficial de cada atração.

| | |
|---|---|
| Dias | 19 · 7 países · 2.627 km |
| Blocos de cronograma | 201 |
| Fotos de licença livre | 99 |
| Ingressos com link oficial | 24 |
| Custo estimado (2 pessoas) | € 3.662 |

## Uso

Não há build nem dependências. Para rodar localmente:

```bash
python3 -m http.server 8080
```

O modo offline exige `https://` ou `localhost` — abrir o arquivo direto do disco
mostra o roteiro, mas não instala o service worker.

No celular: abra o link, toque em **Offline** e espere a barra completar (cerca de
7 MB de fotos), depois use *Adicionar à tela de início*.

## Documentação

[**DOCUMENTACAO.md**](DOCUMENTACAO.md) detalha a arquitetura, a estrutura de
dados, o modelo de custos, a origem de cada dado externo, o método de verificação
e os defeitos encontrados ao longo do projeto.
