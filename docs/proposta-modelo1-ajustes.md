# Proposta de ajustes no Modelo 1 · CDC completo

> Baseado nos padrões da base histórica (ver [analise-padroes-compras-obras.md](analise-padroes-compras-obras.md)).
> Mantém as **6 fases** e as **28 atividades** atuais — mexe em **providências (lembretes)**, **antecedências**
> e sugere **1 variante de modelo** e **2 pequenos ajustes de SPEC**. Nada aqui quebra as regras de domínio
> (lembrete só tem tipo/descrição/data/status; cronograma em dias úteis).

## Resumo do diagnóstico → decisão

| O que a base mostrou | Lacuna no Modelo 1 hoje | Ajuste proposto |
|---|---|---|
| **Subcontratados = 51% do valor**; "empreiteiro civil / contrato global" em 23/25 obras | Modelo contrata ofício a ofício (pedreiro, azulejista…), sem empreiteiro global | **P1** providência de empreiteiro global + **variante Modelo turnkey** |
| Locação é equipamento de **acesso/apoio** (andaime, betoneira, martelete, banheiro químico, piso metálico), 8,6% das aquisições, em quase toda obra | Só há 2 locações (tapumes, caçambas, munck) | **P2–P5** novas locações nas fases certas |
| **Agregados em 100% das obras, dia ~7** | Contrapiso/chapisco sem providência de compra | **P6** compra de areia/brita/cimento |
| **Esquadrias, granito, AC, equipamentos**: comprados no início, instalados no fim (longo prazo) | Antecedências curtas (15 DU) e atividades sem providência | **P7–P10** + **tabela de antecedências longas** |
| **Enxoval CDC** é bloco próprio (AC, mobiliário, espelhos) em 19 obras | "Equipamentos de academia" é só 1 atividade na Entrega | **P11** tratar enxoval como compras de longo prazo antecipadas |
| **Paisagismo em 92%**, cercamento/incêndio tardios | Sem paisagismo; incêndio sem compra | **P12–P13** |
| **Caçamba/limpeza permanente em 22 obras** (corre a obra toda) | Caçamba só na demolição | **P14** locação recorrente |

---

## 1. Providências novas/alteradas, por fase

Formato: `tipo` · "descrição" · `antecedência_du` (dias úteis antes do início da atividade). Tudo sem valor/fornecedor.

### Fase 1 · Mobilização
**Mobilização e tapumes** (hoje: locação "Tapumes e container" 3du)
- **P1 — NOVA** · `contratacao` · **"Empreiteiro civil (contrato global MO+material)"** · **antecedência 20du**
  → é a maior realidade da base (51% do valor sai daqui). Disparar logo no início da obra.
- **P2 — NOVA** · `locacao` · **"Banheiro químico"** · 3du (entra no dia ~13 na base; apoio de canteiro)
- **P3 — NOVA** · `locacao` · **"Betoneira"** · 3du (pos. 0.15; estrutura/contrapiso)

**Demolições e retiradas** (hoje: locação "Caçambas" 2du, contratação "Equipe de demolição" 5du)
- **P4 — NOVA** · `locacao` · **"Martelete / rompedor"** · 2du (locação mais precoce da base, pos. 0.09)

### Fase 2 · Infraestrutura
**Alvenarias e novos fechamentos** (hoje: contratação "Pedreiro" 5du, compra "Blocos e argamassa" 5du)
- *sem mudança* (bate com a base: AGREGADOS/alvenaria logo no início).

**Infra de ar-condicionado** (hoje: contratação "Instaladora de ar" 10du, compra "Tubulação frigorígena" 7du)
- **P7 — NOVA** · `compra` · **"Equipamentos de ar-condicionado (evaporadoras/condensadoras)"** · **antecedência 30du**
  → AC 12k/54k BTU aparece nas 10 primeiras requisições: é item de **longo prazo, comprado no começo** mesmo
  instalado no fim. (Hoje a compra das evaporadoras está só na Fase 5 com 15du — tarde demais.)

### Fase 3 · Fechamentos
**Contrapiso e regularização** (hoje: **sem providência**)
- **P6 — NOVA** · `compra` · **"Areia, brita e cimento"** · 3du → agregados estão em 100% das obras, muito cedo.

**Revestimento cerâmico vestiários** (hoje: contratação "Azulejista" 5du, compra "Porcelanato e argamassa" 10du)
- *sem mudança* (ok).

### Fase 4 · Acabamentos
**Bancadas e divisórias** (hoje: **sem providência**)
- **P8 — NOVA** · `contratacao` · **"Marmoraria (granito/pedras)"** · **antecedência 25du**
- **P9 — NOVA** · `compra` · **"Granito e pedras (corte sob medida)"** · **antecedência 25du**
  → GRANITO em 24 obras e nas 10 primeiras; é corte sob medida, pede antecipação grande.

**Esquadrias, vidros e espelhos** (hoje: **sem providência**)
- **P10 — NOVA** · `contratacao` · **"Esquadrias de alumínio e vidraçaria"** · **antecedência 30du**
  → esquadrias/vidro temperado aparecem entre as 5–10 primeiras requisições e valem R$2,9mi: item fabricado,
  **encomendado no início** e instalado no acabamento. Antecedência longa é o ponto central.

### Fase 5 · Instalações finais
**Luminárias e acabamento elétrico** (hoje: compra "Luminárias" 15du) → subir para **antecedência 20du** (item de compra longa).
**Evaporadoras e start-up do ar** (hoje: compra "Evaporadoras" 15du) → a compra do equipamento passa para a **P7** (Fase 2);
aqui fica só a contratação do start-up/instalação.
**Comunicação visual e fachada** (hoje: contratação "Comunicação visual" 15du) → ok.

### Fase 6 · Entrega
**Equipamentos de academia** (hoje: locação "Caminhão munck" 5du)
- **P11 — NOVA** · `compra` · **"Enxoval CDC — equipamentos e mobiliário"** · **antecedência 30du**
  → enxoval (AC, bancos em metalon, balcões MDF, espelhos) é bloco próprio em 19 obras; compra de longo prazo
  disparada muito antes da entrega. (Ver também recomendação de SPEC §3.)

### Transversal (corre em várias fases)
- **P12 — NOVA atividade curta** `Paisagismo` na Fase 6 (ou providência `contratacao` "Paisagismo" 10du) → 92% das obras.
- **P13 — NOVA** · `compra` em **Infra de incêndio**: "Materiais de incêndio (sprinklers/tubulação)" 10du (hoje só tem a contratação).
- **P14 — NOVA** · `locacao` · **"Caçamba — limpeza permanente"** · recorrente, a partir da Fase 2 → caçamba/limpeza
  permanente em 22 obras, corre a obra toda (hoje caçamba só existe na demolição).

---

## 2. Tabela de antecedências "longo prazo" (o maior aprendizado)

A base mostra que **o que demora para chegar é comprado no início, não quando vai ser instalado**. Sugestão de
antecedência mínima para itens fabricados/encomendados (hoje muitos estão em 15du):

| Item (providência) | Antecedência hoje | Proposta | Por quê |
|---|---|---|---|
| Esquadrias de alumínio / vidros | — | **30du** | fabricação sob medida |
| Equipamentos de ar-condicionado | 15du (Fase 5) | **30du (Fase 2)** | lead time + instala no fim |
| Granito / marmoraria | — | **25du** | corte sob medida |
| Enxoval CDC (equip./mobiliário) | — | **30du** | compra+entrega longas |
| Luminárias | 15du | **20du** | compra especificada |
| Piso emborrachado/vinílico | 15du | ok (15du já condiz) | — |

> Sugestão de UI: marcar essas providências como **"compra de longo prazo"** na trilha, para o gestor disparar cedo.

---

## 3. Dois pequenos ajustes de SPEC (opcionais, fora da regra atual)

1. **Locação com início e fim previstos.** 8,6% das aquisições são locação e o custo corre por tempo
   (hora/dia/semana/quinzena/mês no legado). Um lembrete de locação ganha muito com **data de devolução**
   (ex.: andaime da semana 6 à 16), **mantendo** a regra de "sem valor/fornecedor". Requer um campo de data-fim
   no lembrete de locação — decisão de produto. *(Se aprovado, atualizar PRD/SPEC no mesmo PR.)*

2. **Bloco "Enxoval CDC" separado da obra civil.** Os dados tratam o enxoval como rubrica própria. Opções:
   (a) manter dentro da Fase 6 com as compras antecipadas da P11; ou (b) criar uma fase/bloco "Enxoval" paralelo.
   Recomendo (a) agora (menos ruptura), deixando (b) como evolução.

---

## 4. Recomendação estrutural: variante "turnkey"

O Modelo 1 contrata ofício a ofício — ótimo para obra autogerida. Mas **23/25 obras reais rodam com empreiteiro
civil global**. Sugiro criar depois um **"Modelo 4 · CDC turnkey (empreiteiro global)"**: mesma trilha de fases,
mas as contratações de ofício (pedreiro, azulejista, pintor, encanador, forro, piso) são substituídas por **uma
única contratação "Empreiteiro civil global"** no início, sobrando as compras de material de longo prazo e as
contratações especializadas (ar-condicionado, incêndio, comunicação visual). Como o CONTRO já suporta vários
modelos salvos, é só mais um modelo — sem alterar o Modelo 1.

---

## 5. Como implementar (quando você aprovar)

- Edições concentradas em `supabase/seeds/modelos.sql` (novas linhas `modelo_providencia`, ajuste de `antecedencia_du`).
- Se entrar a atividade "Paisagismo", também `modelo_atividade` + `modelo_dependencia` + reordenar.
- Regras de domínio em `packages/core` não mudam (lembrete continua tipo/descrição/data/status); só muda **dado de seed**.
- Ajustes de SPEC (§3) → atualizar PRD/SPEC e registrar em "Decisões" no PLAN.md, no mesmo PR.
- Seguir o fluxo de milestone (branch, commit por item, PR sem merge).
