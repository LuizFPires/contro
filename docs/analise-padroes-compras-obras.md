# Padrões de aquisição nas obras — análise da base histórica (base-21102026.sql)

> Insumo para evolução do **CONTRO**. Gerado a partir do dump do ERP de suprimentos da construtora
> (PostgreSQL 11, ~114 MB). Não altera código nem documentos do produto; é material de apoio para o PRD/SPEC.

## 1. O que é a base (importante)

Não é uma base só de academias. É o **ERP de compras/locações da construtora** que executa as obras,
com **126 obras** no total (shoppings, supermercados — MART MINAS, VILLEFORT, SUPERMERCADOS BH —, edifícios etc.).
Dentro dela há **27 obras "Contorno do Corpo"** (Divinópolis, Barbacena, Sete Lagoas, Varginha, Lavras, Ubá, Barão…).

A análise abaixo foca nas **25 obras Contorno com histórico suficiente** (≥ 30 dias de compras):

- **14.586** itens de requisição vinculados a essas obras;
- **duração mediana ≈ 395 dias** (~13 meses) entre a 1ª e a última requisição;
- modelo transacional: `type = 1` → **compra** (material); `type = 2` → **locação** (confirmado pelos status
  "REQUISIÇÃO DE MATERIAL OU LOCAÇÃO" / "PROCESSO DE COMPRA/LOCAÇÃO FINALIZADO");
- **contratação/serviço não é um tipo separado**: entra como *compra* cujo fornecedor/rubrica é de
  MÃO DE OBRA, SUBCONTRATADOS, CONSULTORIAS ou PROJETOS (ver §5);
- "família" da aquisição = `offering.category_id`, que compartilha a taxonomia das 28 `supplier_category`.

## 2. A obra Contorno JÁ é padronizada (o achado mais forte)

A árvore de rubricas (`account`) é **praticamente idêntica em 23 das 25 obras**. Ou seja, a construtora
já opera com um "modelo de obra Contorno" de fato. As rubricas que se repetem em ~23 obras:

**Serviços / disciplinas (contrato global MO+material):**
EXECUÇÃO DE ALVENARIA (bloco de concreto) · CHAPISCO · REBOCO/EMBOÇO · CONTRAPISO ·
IMPERMEABILIZAÇÃO · REGULARIZAÇÕES · PISO EM CONCRETO ARMADO · REVESTIMENTO DE PISO ·
EXECUÇÃO DE PISO EM PORCELANATO · DIVISÓRIAS (TS estrutural branca) · FORROS · FACHADA ·
ESQUADRIAS E VIDROS · MARCENARIA E MOBILIÁRIO · SERRALHERIA · PINTURA · GRANITO · LOUÇAS E METAIS.

**Instalações (repetem em 37–46 obras somando reformas não-Contorno):**
INSTALAÇÕES ELÉTRICAS · HIDROSSANITÁRIAS · CFTV · SONORIZAÇÃO · COMBATE A INCÊNDIO · CLIMATIZAÇÃO.

**Blocos de abertura/fechamento (natureza de custo):**
DESPESAS INICIAIS · MOB. E DESMOB. · IMPLANTAÇÃO/MANUTENÇÃO DE CANTEIRO · MÁQUINAS E EQUIPAMENTOS ·
CONTRATOS GLOBAIS · MATERIAIS · MÃO DE OBRA · **ENXOVAL CDC** · SERVIÇOS FINAIS · DESPESAS FINAIS ·
LIMPEZA FINA GERAL · RETOQUES EM GERAL.

> "ENXOVAL CDC" (equipamentos/mobiliário da academia Contorno do Corpo) aparece como rubrica própria
> em 19 obras — é um bloco específico do cliente, distinto da obra civil.

## 3. Sequência de aquisição (quando cada família ENTRA na obra)

Medindo a **1ª ocorrência de cada categoria por obra**, normalizada pela duração (0 = início, 1 = entrega).
`dia` = dia mediano, em dias desde o início, numa obra típica de ~395 dias.

| Ordem | Família | Entra em (pos) | Dia | % das obras |
|---|---|---|---|---|
| — (transversais, dia 0) | **SUBCONTRATADOS, DIVERSOS, FRETE, EQUIPAMENTOS** | 0.00–0.01 | 0–3 | 96–100% |
| 1 | PROJETOS | 0.01 | ~5 | 52% |
| 2 | AGREGADOS (areia, brita, cimento) | 0.02 | ~7 | 100% |
| 3 | SERRALHERIA | 0.02 | ~8 | 92% |
| 4 | REVESTIMENTOS | 0.02 | ~6 | 96% |
| 5 | ESQUADRIAS | 0.04 | ~11 | 96% |
| 6 | DIVISÓRIAS, FORROS E TELHAS | 0.04 | ~14 | 88% |
| 7 | INST. ELÉTRICAS | 0.04 | ~17 | 92% |
| 8 | MARMORARIA / INOX | 0.06 | ~19 | 92–96% |
| 9 | FERRAMENTAS | 0.06 | ~20 | 100% |
| 10 | INST. HIDRÁULICAS | 0.06 | ~17 | 100% |
| 11 | MADEIRAS / AÇO | 0.04–0.06 | ~21–26 | 72–92% |
| 12 | **MÃO DE OBRA (direta)** | 0.11 | ~43 | 96% |
| 13 | EPI, SEGURANÇA E LIMPEZA | 0.14 | ~63 | 92% |
| 14 | PAISAGISMO | 0.16 | ~77 | 92% |
| 15 | CONCRETO (usinado) | 0.17 | ~69 | 40% |
| 16 | INST. INCÊNDIO | 0.22 | ~96 | 48% |
| 17 | CERCAMENTO | 0.26 | ~98 | 52% |

**Leituras:**
- A obra abre com **mobilização + subcontratação + canteiro** (SUBCONTRATADOS/DIVERSOS/FRETE/EQUIPAMENTOS no dia 0)
  — combinam com as rubricas DESPESAS INICIAIS / MOB. E DESMOB. / CANTEIRO.
- Nas **5 primeiras requisições** de cada obra, as campeãs são: SUBCONTRATADOS (28×), DIVERSOS (15×),
  AGREGADOS (12×), ESQUADRIAS (11×), REVESTIMENTOS (11×), EQUIPAMENTOS (9×).
- Itens concretos que mais aparecem nas **10 primeiras requisições**: **FRETE**, **INSTALAÇÃO ELÉTRICA (MDO+MAT)**,
  **MOBILIZAÇÃO E DESMOBILIZAÇÃO**, materiais elétricos, fita crepe/lona (proteção), vidro temperado,
  ar-condicionado 12.000/54.000 BTU, granito, gesso/sanca.
- INST. INCÊNDIO, CERCAMENTO e PAISAGISMO são as famílias que **começam mais tarde** (acabamento/fachada externa).

## 4. Locação (type = 2)

- **8,6%** das aquisições Contorno são locação (1.255 itens) — o resto é compra.
- Quase tudo é **acesso/apoio de obra**, não insumo. Top itens e quando entram (pos. mediana):

| Item locado | Qtd | Entra em |
|---|---|---|
| Rodízio para andaimes tubular | 206 | 0.27 |
| Piso metálico | 169 | 0.31 |
| Andaime tubular | 157 | 0.27 |
| Diagonal 1,50 | 70 | 0.27 |
| Escada modular | 54 | 0.38 |
| Betoneira 400 L | 39 | 0.15 |
| Martelete 10 kg | 35 | 0.25 |
| Banheiro químico | 18 | 0.13 |

> Padrão: **betoneira e banheiro químico cedo** (estrutura/canteiro); **andaimes/piso metálico/escada no miolo**
> (fachada, forro, pintura). Locação é majoritariamente **equipamento de acesso e mistura**, nunca material de aplicação.

## 5. Onde está o dinheiro (concentração de valor)

| Família | Valor | % do total | Posição média do gasto |
|---|---|---|---|
| **SUBCONTRATADOS** | R$ 29,0 mi | **50,8%** | 0.19 |
| REVESTIMENTOS | R$ 4,4 mi | 7,6% | 0.12 |
| EQUIPAMENTOS | R$ 4,1 mi | 7,2% | 0.16 |
| SERRALHERIA | R$ 3,3 mi | 5,8% | 0.13 |
| DIVERSOS | R$ 3,3 mi | 5,8% | 0.21 |
| ESQUADRIAS | R$ 2,9 mi | 5,0% | 0.11 |
| DIVISÓRIAS/FORROS | R$ 2,4 mi | 4,3% | 0.13 |
| PINTURA | R$ 1,5 mi | 2,6% | 0.18 |
| INST. ELÉTRICAS | R$ 1,3 mi | 2,3% | 0.18 |

Pela árvore de contas, **Contratos globais (mão de obra + material) = R$ 42 mi** vs. **Materiais avulsos = R$ 10 mi**
e **Mão de obra direta = R$ 10 mi**. Ou seja: **a obra Contorno é executada majoritariamente por empreiteiros/subcontratados
sob contrato global (turnkey por disciplina)**, com compra direta de material como complemento.

## 6. O que isso sugere para o CONTRO

1. **O "Modelo 1 · CDC completo" bate com a realidade.** A base confirma um conjunto estável de disciplinas por obra.
   Vale alinhar os nomes de fase/atividade do modelo às rubricas reais (§2): alvenaria → chapisco → reboco →
   contrapiso → impermeabilização → revestimento de piso/porcelanato → divisórias → forros → fachada →
   esquadrias/vidros → marcenaria → serralheria → pintura → granito → louças e metais → paisagismo →
   instalações (elétrica, hidrossanitária, CFTV, sonorização, incêndio, climatização) → enxoval CDC →
   serviços/despesas finais + limpeza fina + retoques.

2. **Modelar aquisição como 3 naturezas, não só "lembrete de compra".** Os dados separam claramente
   **compra de material**, **locação de equipamento de acesso** e **contratação/empreitada (subcontratado)**.
   Como o CONTRO já tem lembretes de *contratação, locação e compra* (sem valor/fornecedor), o encaixe é direto —
   mas vale embutir no **modelo de obra** *quais* lembretes nascem em *cada fase* seguindo a sequência da §3.

3. **Sequência de providências por fase (sugestão de defaults no modelo):**
   - **Abertura (0–5%):** contratar empreiteiro civil (subcontratado), mobilização/canteiro, locar betoneira e
     banheiro químico, fechar PROJETOS, pedir agregados/cimento, EPI.
   - **Estrutura/vedação (5–20%):** aço, madeiras, concreto, alvenaria; locar andaimes/piso metálico/escada.
   - **Instalações (10–25%):** elétrica e hidráulica começam cedo e correm em paralelo; incêndio entra depois.
   - **Acabamento (15–40%):** revestimentos, porcelanato, granito/marmoraria, esquadrias/vidros, divisórias,
     forros, marcenaria, serralheria, pintura, inox.
   - **Fechamento (>33%):** paisagismo, cercamento, louças e metais, **enxoval CDC**, serviços finais,
     limpeza fina, retoques.

4. **Locação pede data de devolução, não só "feito".** 8,6% das aquisições são locação e o custo corre por tempo
   (há `time_unit`: hora/dia/semana/quinzena/mês). Um lembrete de locação no CONTRO ganha muito com **início e fim
   previstos** (ex.: andaime da semana 6 à 16), mesmo mantendo a regra de "sem valor/fornecedor".

5. **"Enxoval CDC" é um bloco à parte.** Equipamentos/mobiliário da academia (ar-condicionado 12k/54k, bancadas,
   espelhos, bancos em metalon…) não são obra civil e entram no fim. No modelo Contorno, vale uma **fase/bloco
   "Enxoval" separado** da construção, com seus próprios lembretes de compra.

6. **Priorize onde está o risco de prazo/custo:** subcontratados (51% do valor) e os grandes acabamentos
   (revestimento, esquadrias, serralheria, divisórias/forros). São as famílias que, atrasando, travam a entrega —
   bons candidatos a **dependências e lembretes de providência destacados** na trilha de fases.

---
*Metodologia: itens = `request_item` → `supply_request` → `process` (obra + data da requisição) → `offering`
(nome + categoria). Valor via `order_item` (preço × quantidade). Datas normalizadas por obra (1ª→última requisição).
Fases via árvore `account` (rubricas). Scripts em `scratchpad/` (build_db.py, analise*.py).*
