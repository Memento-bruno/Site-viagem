# Roteiro Europa 2026 — documentação do projeto

Aplicação de página única, em arquivo autocontido, com o itinerário dia a dia de
uma viagem de carro de 19 dias por sete países: Espanha, Itália, Suíça, Áustria,
Liechtenstein, Eslovênia e Croácia, de 10 a 28 de setembro de 2026.

**No ar:** <https://memento-bruno.github.io/Site-viagem/>

---

## Sumário

- [O que é](#o-que-é)
- [Como rodar](#como-rodar)
- [Arquitetura](#arquitetura)
- [Estrutura de dados](#estrutura-de-dados)
- [Funcionalidades](#funcionalidades)
- [Modelo de custos](#modelo-de-custos)
- [Recomendação de roupas](#recomendação-de-roupas)
- [Dados externos e como foram obtidos](#dados-externos-e-como-foram-obtidos)
- [Publicação](#publicação)
- [Método de verificação](#método-de-verificação)
- [Defeitos encontrados e corrigidos](#defeitos-encontrados-e-corrigidos)
- [Histórico de commits](#histórico-de-commits)
- [Limitações conhecidas](#limitações-conhecidas)

---

## O que é

Um roteiro que funciona na estrada: abre no dia corrente, roda sem internet,
mostra quanto o dia custa em euro e em real, avisa a que horas o sol se põe e
leva direto ao Google Maps ou à bilheteria oficial de cada atração.

| | |
|---|---|
| Dias | 19 (10/09 a 28/09) |
| Países | 7 |
| Blocos de cronograma | 201 |
| Refeições com opção vegana e onívora | 39 |
| Fotos de licença livre | 99 |
| Ingressos com link oficial | 24, sendo 10 com hora marcada |
| Peças de roupa desenhadas | 23, em 4 faixas de temperatura |
| Quilometragem | 2.627 km |
| Custo estimado, 2 pessoas | € 3.662 (média de € 193/dia) |

---

## Como rodar

O projeto não tem build, dependências nem etapa de compilação.

```bash
# Basta servir a pasta por HTTP. Exemplo:
python3 -m http.server 8080
# depois abra http://localhost:8080
```

Abrir o `index.html` direto do disco (`file://`) funciona para ler o roteiro,
mas **o modo offline não liga** — service workers exigem `https://` ou
`localhost`. O código detecta isso e explica em vez de falhar em silêncio.

---

## Arquitetura

```
Site-viagem/
├── index.html               # aplicação inteira: markup, estilos, dados e lógica
├── sw.js                    # service worker: cache e funcionamento offline
├── manifest.webmanifest     # instalação na tela inicial (PWA)
├── icon-192.png             # ícones gerados por codificador PNG próprio
├── icon-512.png
├── .nojekyll                # o Pages serve os arquivos sem passar pelo Jekyll
└── .github/workflows/
    └── pages.yml            # publicação automática a cada push na main
```

### Por que um arquivo só

O requisito original pedia um entregável único e autocontido. A decisão se
sustentou por um motivo prático: um arquivo é trivial de salvar, copiar para
outro aparelho ou abrir sem servidor. São 2.788 linhas e 222 KB, com os dados
embutidos como constantes JavaScript.

### Dependências externas

Quatro, todas por CDN e todas cacheadas para uso offline:

| Recurso | Origem | Papel |
|---|---|---|
| Tailwind CSS | `cdn.tailwindcss.com` | utilitários de estilo |
| Font Awesome 6.5.2 | `cdnjs.cloudflare.com` | ícones |
| Inter e Outfit | `fonts.googleapis.com` | tipografia |
| Fotos | `upload.wikimedia.org`, `live.staticflickr.com` | imagens das atrações |

---

## Estrutura de dados

Cinco constantes no topo do `<script>`, todas legíveis e editáveis à mão.

### `DAYS` — o itinerário

```js
{
  id:'d20', date:'20/09', dow:'Sábado', n:11,
  tmax:20, tmin:9, tamp:[14,25],        // temperatura média de 4 anos
  sr:'06:49', ss:'19:08',               // nascer e pôr do sol
  title:'Dia inteiro no Lago Bled',
  country:'Eslovênia', flag:'🇸🇮', base:'Liubliana',
  park:'liubliana', tips:'sl',          // chaves para PARK e TIPS
  hotel:{ n:'Holiday Inn Express Ljubljana', bf:true, tax:'R$ 48', q:'...' },
  drive:110, walk:14,
  alerts:[ {l:'danger', t:'VINHETA ESLOVENA obrigatória...'} ],
  transport:[ 'Villach › Bled: 1h05 pela A11/E61...' ],
  tl:[ /* blocos do cronograma */ ]
}
```

Cada bloco do cronograma:

```js
{ p:'Tarde', time:'18:05', ic:'fa-chess-rook', k:'star',
  title:'Blejski grad — Castelo de Bled ao pôr do sol',
  txt:'...', dur:'1 h 30', cost:'€ 15',
  q:'Blejski grad Bled Castle',        // chave do Maps, das fotos e dos ingressos
  dir:{ o:'origem', d:'destino' },     // quando é deslocamento
  opts:[ {k:'vegano', n:'...', price:'€ 12–18', q:'...'} ] }
```

O campo `q` é a chave que amarra tudo: gera o link do Maps, indexa a foto em
`PHOTOS` e o ingresso em `BILHETES`. Uma string, três usos.

### As outras quatro

| Constante | Conteúdo |
|---|---|
| `CUSTOS` | custo de cada dia, separado por quem paga (ver adiante) |
| `PHOTOS` | 99 fotos indexadas pela mesma chave `q` |
| `BILHETES` | 24 endereços oficiais de venda, com preço e se tem hora marcada |
| `PARK` / `TIPS` | regras de estacionamento e dicas culturais, reaproveitadas por país |
| `PECA` | catálogo de 23 peças de roupa: símbolo SVG, rótulo curto e explicação |
| `FAIXA_FRIO` / `FAIXA_CALOR` | os quatro degraus de temperatura e o que se veste em cada um |
| `VESTE_CTX` | o que o roteiro do dia exige além do clima: igreja, trilha, altitude, caverna, água, voo |

---

## Funcionalidades

### Navegação

- Menu horizontal com rolagem no celular; barra lateral fixa no desktop
- Troca de dia sem recarregar a página
- Abre no **dia de hoje** quando a data está dentro da viagem; link direto por
  hash (`#d20`) tem prioridade; fora do período volta ao primeiro dia
- Botão "Hoje" aparece só durante a viagem
- Setas do teclado navegam entre os dias
- Modal de visão geral com os 19 dias

### Layout

Três colunas no desktop (etapas, painel principal, informações de apoio), coluna
única no celular com os painéis de apoio abaixo do cronograma. Estética
*glassmorphism* sobre gradiente escuro, pensada para leitura sob sol forte. Alvos
de toque de no mínimo 44 px.

### Luz do dia

Nascer e pôr do sol calculados para os 19 dias pelo algoritmo NOAA, no local onde
a luz importa em cada etapa. A duração encolhe de 12h43 a 11h55 ao longo da
viagem. Blocos que começam depois do escuro recebem selo automático.

### Temperatura

Média das máximas e mínimas de cada data nos últimos quatro anos (2022–2025),
medida por satélite. Vai de 30 °C em Madri a 3 °C de mínima no Val di Fassa.
Alertas de frio, calor e caminhada longa são gerados desses números.

### Uso offline

- Instalável na tela inicial (PWA)
- Botão "Offline" pré-carrega 108 arquivos com barra de progresso
- Navegação usa **rede primeiro** com 3,5 s de paciência e cache como reserva
- Demais recursos usam cache primeiro, com revalidação em segundo plano

### Ingressos

Cards de atrações com bilheteria mostram preço, aviso de hora marcada e link para
o site oficial. Os 10 com horário marcado ficam destacados em âmbar.

### O que vestir

Painel recolhido na coluna lateral, um por dia. Fechado mostra só a cidade e as
duas temperaturas; abre no toque e revela dois looks (masculino e feminino) para
o frio da manhã e para o calor da tarde, mais a lista do que vai na mochila.
Detalhado em [Recomendação de roupas](#recomendação-de-roupas).

---

## Modelo de custos

O ponto que mais deu trabalho, e que passou por três versões até ficar correto.

### Três escalas, porque nem todo custo cresce igual

| Escala | O que entra | Como escala |
|---|---|---|
| **Do casal** | alimentação, taxa turística, diversos | valor já é do casal |
| **Por pessoa** | ingressos, transporte público | multiplica por `PESSOAS` |
| **Do carro** | combustível, pedágio, vinheta, estacionamento | valor único |

Alimentação é do casal por um motivo específico: cada refeição tem uma opção
vegana e uma onívora, e vocês pedem uma de cada. O custo da refeição é a soma das
duas, não o dobro de uma.

### As oito categorias

| Categoria | Total | % |
|---|---|---|
| Alimentação | € 1.647 | 45,0% |
| Ingressos e atrações | € 840 | 22,9% |
| Combustível | € 313 | 8,6% |
| Diversos | € 298 | 8,1% |
| Pedágios e vinhetas | € 189 | 5,2% |
| Transporte público | € 140 | 3,8% |
| Estacionamento | € 121 | 3,3% |
| Taxa turística | € 114 | 3,1% |
| **Total** | **€ 3.662** | |

Hotéis, voos e a diária do aluguel ficam de fora — já estavam contratados.

### Combustível

Jeep Avenger 1.2 turbo alugado na Alamo. O ciclo WLTP declara 5,9 L/100 km; o
modelo usa **6,8 L/100 km**, que é o realista com bagagem, dois ocupantes e a
quantidade de montanha do roteiro. Preço da gasolina por país:

| País | €/L |
|---|---|
| Suíça | 1,95 |
| Itália | 1,85 |
| Áustria | 1,65 |
| Espanha | 1,55 |
| Eslovênia | 1,55 |
| Croácia | 1,55 |

Total: 2.627 km, cerca de 179 litros, € 313.

### O teto de € 50 é limite, não previsão

Os valores de alimentação saem dos preços que estão nos próprios cartões de
restaurante — não foram ajustados para caber no teto. **Três dias passam dele**, e
o site avisa em cada um:

| Dia | Por pessoa | Onde |
|---|---|---|
| 14/09 | € 58 | Splügen / Churwalden |
| 15/09 | € 53 | Zurique |
| 17/09 | € 54 | Vaduz |

### Câmbio

O euro é a moeda base; o real é sempre conversão. A taxa fica **editável** no
painel de gastos e é guardada no navegador. O padrão é R$ 6,20 por euro — o
briefing original implicava R$ 10,00 ("€ 50 ≈ R$ 500"), e a diferença muda o
total de R$ 22.703 para R$ 36.620, o que justifica deixar a escolha visível em
vez de congelada no código.

---

## Recomendação de roupas

### Por que dois looks por dia, e não um por cidade

A amplitude térmica do roteiro chega a 12 °C dentro do mesmo dia: 18/09 em
Cortina tem mínima média de 4 °C e máxima de 15 °C. Quem sai do hotel às 7h
vestido para a tarde passa frio de manhã, e quem se veste para a manhã carrega
casaco a tarde inteira. Por isso cada dia mostra **dois** conjuntos — o da
mínima e o da máxima — e não um "look de Cortina".

Pela mesma razão a recomendação não é um texto fixo por cidade: ela sai do
`tmax` e do `tmin` que já estavam em `DAYS`, os mesmos números do cabeçalho.
20 °C em Liubliana pedem a mesma roupa que 20 °C em Zurique.

### Os quatro degraus

| Faixa fria (pela mínima) | | Faixa quente (pela máxima) | |
|---|---|---|---|
| ≤ 5 °C | Frio de verdade — três camadas, bota, gorro, luva | ≥ 28 °C | Quente — regata, bermuda/saia, boné |
| 6–10 °C | Frio — fleece e corta-vento | 24–27 °C | Morno — manga curta, bermuda/vestido |
| 11–14 °C | Fresco — fleece por cima da camiseta | 19–23 °C | Agradável — manga curta com calça leve |
| ≥ 15 °C | Ameno — camisa aberta por cima | ≤ 18 °C | Fresco mesmo na máxima — manga longa o dia todo |

Abaixo de 8 °C entra cachecol nos dois looks, independentemente da faixa.

### O que o roteiro acrescenta

`VESTE_CTX` marca, por data, o que a temperatura sozinha não diz:

| Contexto | O que muda |
|---|---|
| `igreja` | Almudena, Duomo de Como, igreja da ilha de Bled, San Marco, Duomo de Milão exigem ombros e joelhos cobertos → lenço na mochila |
| `alto` | Splügen (2.113 m), Pordoi (2.239 m), Tre Cime (2.320 m): aplica −6,5 °C por 1.000 m sobre a máxima do vale e diz o número que sai |
| `trilha` | Val Masino, Tre Cime, Vintgar: tênis fechado, meia de troca, capa de chuva |
| `caverna` | Postojna fica a 10 °C o ano inteiro, com 20 °C lá fora |
| `agua` | Como, Bled, Mužilj: óculos de sol e chinelo no porta-malas |
| `voo` | vestir o mais pesado em vez de despachar |
| `walk ≥ 10 km` | tênis amaciado, meia de troca, curativo |

O cálculo de altitude usa a altitude da cidade cuja série de temperatura foi
medida, não o nível do mar — subtrair 2.239 m de uma média já tomada a 1.224 m
daria −15 °C em vez dos −7 °C reais.

### Por que desenho e não foto

O pedido era "com fotos". Não deu para atender e o motivo importa: no Wikimedia
Commons, "winter jacket" devolve *2005 Autumn-Winter Maison Margiela jacket*,
"wool scarf" devolve um fragmento de lã do século III em Dura-Europos. São peças
de museu, não orientação de mala. As fotos de "look" com licença livre no
Flickr, por sua vez, mostram pessoas privadas identificáveis.

As 23 peças são então `<symbol>` SVG desenhados neste projeto, num sprite oculto
logo após o `<body>`. Custam 4 KB, funcionam offline sem precisar de cache,
acompanham a cor do tema e mostram *o item* em vez de uma pessoa aleatória.

### Implementação

`<details>` nativo: abre sem JavaScript, fecha sozinho ao trocar de dia (o
painel é reconstruído) e não precisa de estado. O `summary` é o botão; o
conteúdo só existe expandido.


## Dados externos e como foram obtidos

Nada aqui foi escrito de memória sem verificação.

### Fotos (99)

91 do **Wikimedia Commons** e 8 do **Openverse** (Flickr, licença CC). Buscadas
por título de artigo curado à mão em espanhol, italiano, alemão, esloveno, croata
e português, porque a busca automática por texto livre trazia lixo: "Sant'Abbondio"
devolvia um pintor, e o centro de aluguel de carros de Malpensa devolvia o
aeroporto de Singapura.

Um filtro remove brasões, logos, mapas e bandeiras, que a API devolve como imagem
principal de artigos de cidade — foi o caso de Rovinj (brasão), Barajas (logo da
Aena), Pula e Vaduz (brasões).

Detalhe técnico: o Wikimedia só serve larguras de miniatura **já geradas**.
Reescrever a largura na URL devolve HTTP 400; é preciso pedir o tamanho à própria
API, que a gera sob demanda.

### Temperatura

**NASA POWER** (`power.larc.nasa.gov`), gratuita e sem chave. A Open-Meteo, que
seria a primeira escolha, estava com o limite diário estourado no ambiente de
desenvolvimento.

### Nascer e pôr do sol

Calculados localmente pelo algoritmo NOAA, sem depender de rede. Erro abaixo de
um minuto.

### Ingressos

Cada URL foi testada por requisição real antes de entrar. Cinco candidatos
falharam e foram substituídos:

| Não funciona | Substituído por |
|---|---|
| `tour.realmadrid.com` | `realmadrid.com/es-ES/tour-bernabeu` |
| `schattenburg.at` | `feldkirch.travel` |
| `tre-cime-dolomiti.it` | `auronzomisurina.it` |
| `canazei.org` | `fassa.com` |

### Paleta das categorias

Validada pelo verificador do skill de visualização, não escolhida a olho. A
primeira tentativa, com os tons que o site já usava, **reprovou em três
critérios**: banda de luminosidade, piso de croma e separação entre verde e ciano
(ΔE 12,1, abaixo do piso de 15). A paleta final passa em todos, e a identidade
nunca depende só da cor — cada faixa tem rótulo e ícone.

---

## Publicação

GitHub Pages, com deploy automático a cada push na `main` pelo workflow
`.github/workflows/pages.yml`.

O `GITHUB_TOKEN` do Actions **publica** no Pages mas não **cria** o site do zero:
a tentativa com `enablement: true` falhou com `Resource not accessible by
integration`. Ligar o Pages foi um passo manual e único em
*Settings → Pages → Source: GitHub Actions*.

O endereço é fixo e não muda a cada publicação.

---

## Método de verificação

Toda alteração passa pela mesma bateria, executada em Chromium via Playwright:

| Verificação | O que cobre |
|---|---|
| Sintaxe | `node --check` no JS extraído e no service worker |
| Integridade dos dados | 19 dias, chaves válidas, refeições com as duas opções |
| Overflow horizontal | 8 larguras (320 a 1920 px) × 19 dias |
| Links | formato, hosts e ausência de `<a>` aninhado |
| Imagens | miniaturas renderizadas e nenhuma quebrada |
| Runtime | nenhum erro de JavaScript |
| Painel de roupas | fecha por padrão, abre no clique e chega a ≥ 300 px em 19 dias × 8 larguras; todo chip com rótulo, explicação e desenho renderizado |
| Offline | rede cortada, recarga, navegação entre dias |

A publicação é confirmada por comparação de hash entre o arquivo local e o que o
GitHub está servindo.

---

## Defeitos encontrados e corrigidos

Registro honesto, incluindo os que eu mesmo causei.

### No roteiro

**Cinco momentos prometiam luz que não existiria.** Descoberto ao calcular o pôr
do sol e comparar com os horários planejados:

| Dia | Antes | Depois |
|---|---|---|
| 17/09 | chegada 20:15, escuro desde 19:24 | Innsbruck cortado para 45 min, chegada 19:25 |
| 20/09 | castelo de Bled 18:40 | tarde reordenada, castelo às 18:05 |
| 21/09 | Tivoli 19:30, no escuro | Tivoli 15:45, castelo 17:40 |
| 22/09 | Mužilj 19:00, sol às 19:05 | antecipado para 18:30 |
| 24/09 | San Giuliano 19:30, sol às 19:07 | antecipado para 18:25 |

Também: 21/09 é domingo e o mercado de Liubliana não abre — o texto foi ajustado.

### No orçamento

**Somava grandezas incompatíveis.** A versão original juntava comida de uma pessoa
com pedágio do carro inteiro e chamava aquilo de total. **Combustível não existia
na conta.** E a alimentação estava colada no teto de € 50 em todos os dias, sinal
de que os números tinham sido ajustados para caber em vez de estimados.

### No código

**Cards com ingresso tinham `<a>` dentro de `<a>`** — HTML inválido que faz o
navegador desmontar a árvore. Nesses cards o Maps virou botão próprio.

**O painel de ingressos aparecia em todos os dias.** Estava montado no rodapé
lateral, que é comum a todo dia, então Postojna aparecia no dia de Madri.

**O service worker prendia o usuário na versão antiga.** A navegação usava cache
primeiro, e a versão nova só entrava em cache para a visita seguinte. Virou rede
primeiro com reserva no cache.

**O service worker quebrava as fontes de ícone.** O mais instrutivo. A função de
cache forçava `mode: 'no-cors'` em toda requisição cross-origin, o que devolve
resposta opaca — e o navegador **recusa resposta opaca para `@font-face`**, por
regra da especificação. Todo ícone virava quadrado com X no instante em que o
worker assumia o controle, online inclusive.

O primeiro diagnóstico foi errado, e o teste tinha culpa: ele reescrevia o Font
Awesome para a mesma origem, então o ramo cross-origin nunca era exercitado. Só
uma reprodução com a página numa porta e a fonte em outra expôs o defeito, na
segunda visita:

| | fonte carrega | tipo no cache |
|---|---|---|
| Antes | ❌ `false` | `opaque` |
| Depois | ✅ `true` | `cors` |

A correção foi preservar o modo da requisição: o navegador já pede fonte em CORS e
imagem em no-cors, bastava repassar. O `no-cors` virou plano B, para servidores
sem cabeçalho CORS.

**Lição que fica:** um teste que não exercita o caminho real dá falsa confiança.
Este passou enquanto a produção falhava.

### Overflow horizontal

Vários, todos em telas estreitas: chips com `nowrap`, `truncate` sem `min-w-0`,
itens de grid sem `grid-cols-1` explícito, e nomes sem ponto de quebra
(`Café/Bistrô`) que exigiram `overflow-wrap: anywhere` — só ele reduz o
`min-content`.

---

## Histórico de commits

| Commit | Data | O que entrou |
|---|---|---|
| `a01ac9e` | 06/09 | SPA com os 19 dias, cronograma, hotéis, estacionamento e dicas |
| `26a0131` | 06/09 | 99 fotos de licença livre |
| `ae4fe2b` | 06/09 | Luz do dia, correção de 5 horários, modo offline, abertura no dia corrente |
| `bf09f05` | 06/09 | Workflow de publicação |
| `4cd6cca` | 06/09 | Ajuste do workflow após erro real de permissão |
| `b657f9c` | 06/09 | Orçamento para 2 pessoas, em euro e real |
| `dc608fe` | 06/09 | 8 categorias de gasto, alimentação real, temperatura |
| `12a0483` | 06/09 | Links oficiais de ingresso |
| `3a720c4` | 06/09 | Painel de ingressos repetido e fontes na pré-carga |
| `36c9fd4` | 07/09 | Correção real das fontes: modo da requisição preservado |

---

## Limitações conhecidas

**Preços e horários são estimativas.** Vêm de conhecimento geral, não de consulta
em tempo real. Os que mais pesam — Postojna (€ 45 o combo), Palácio Ducal (€ 30),
Bernabéu (€ 35) — merecem conferência no site oficial, ainda mais porque precisam
ser comprados com hora marcada de qualquer forma.

**O tour do Bernabéu é cancelado em dia de jogo.** Confira o calendário do Real
Madrid antes do dia 28.

**Restaurantes são sugestões.** Alguns nomes podem ter fechado ou mudado. Os
links do Maps resolvem na hora.

**Hotéis e restaurantes não têm foto.** Não existe imagem de licença livre da
maioria. O cartão mostra o ícone da categoria; a foto real está no link do Maps.
Preferi isso a colocar uma foto genérica de quarto de hotel.

**A temperatura por satélite é da célula do vale.** No Rifugio Auronzo, a
2.320 m, tire uns 12 °C. Vale para todos os dias de alta montanha.

**A Decolar não cobre este roteiro.** Foi pesquisada a pedido, para parcelamento:
o catálogo dela tem as capitais, mas não Postojna, Bled, Vintgar, Pula, Lindt,
Tre Cime nem Braies. Onde existe algo, é passeio guiado ou passe de cidade, não a
entrada avulsa no horário necessário. O site bloqueia leitura automatizada, então
a checagem saiu do índice de busca e merece confirmação no aplicativo.

**Só uma pessoa por vez.** Marcações e o câmbio ficam no navegador de quem
acessa, sem sincronizar entre aparelhos.

---

## Créditos

Fotos do [Wikimedia Commons](https://commons.wikimedia.org/) e do
[Openverse](https://openverse.org/), sob licenças livres — crédito e autoria no
atributo `title` de cada imagem. Temperatura da
[NASA POWER](https://power.larc.nasa.gov/). Ícones do
[Font Awesome](https://fontawesome.com/) e estilos do
[Tailwind CSS](https://tailwindcss.com/).
