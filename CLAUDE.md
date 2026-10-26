# CLAUDE.md — CONTRO · obras da contorno

Guia para o Claude Code trabalhar neste repositório. Leia este arquivo inteiro antes de qualquer tarefa.

## O que é
O CONTRO é um app (PWA, mobile first) para planejar e acompanhar as obras de reforma das unidades Contorno do Corpo.

Cada obra nasce de um **modelo de obra** escolhido entre os modelos salvos (ex.: Modelo 1 · CDC completo, com 29 atividades em 7 fases (a 1ª é Orçamento), prazos médios em dias úteis, dependências e lembretes de providência) e é conduzida como um jogo de fases:
- concluir atividade **com ou sem foto** (sem foto, dá para anexar depois);
- resolver pendência com **antes e depois**;
- lembretes de contratação, locação e compra;
- boletim semanal pelo WhatsApp e em PDF;
- reunião de segunda às 16h com ata e tarefas por responsável.

A **maquete 3D da obra** é uma melhoria futura (E1) em avaliação: **não implemente** nada dela sem pedido explícito do usuário.

## Documentos (fonte da verdade)
- `PRD.md`: o quê e por quê (comportamento, regras de negócio, fora de escopo).
- `SPEC.md`: como (stack, modelo de dados, algoritmos, máquinas de estado, permissões, PDFs, offline).
- `PLAN.md`: ordem de execução por **milestones**, com checklists e critérios de aceite.
- `prototipo/`: o protótipo navegável aprovado, a referência visual e de fluxo: `Main` (app de campo), `ModeloCel` (modelos de obra no celular, gestor), `Modelo` (visão desktop complementar) e `Maquete` (só referência da melhoria E1).

Antes de implementar: localize o milestone atual no PLAN.md, leia as seções correspondentes do PRD e do SPEC e só então codifique. Ao terminar um item, marque o checkbox no PLAN.md e registre desvios na seção "Decisões" do próprio PLAN.

## Stack
React 18 + TypeScript + Vite (PWA) · TanStack Query · Dexie (offline) · Supabase (Postgres, Auth, Storage, RLS, Edge Functions, pg_cron) · pdf-service Node + Playwright · Vitest + Playwright E2E.

## Estrutura do repositório
```
/apps/web            PWA (rotas, telas, componentes)
/apps/pdf-service    HTML → PDF (boletim, ata)
/packages/core       REGRAS DE DOMÍNIO puras e testadas (cronograma, liberação, %, semana, atribuições, textos)
/packages/ui         tokens CONTRO e componentes base
/supabase            migrations, policies (RLS), seed, functions
/docs                PRD.md, SPEC.md, PLAN.md, protótipo
```

## Comandos
```
pnpm i
pnpm dev              # web em http://localhost:5173
pnpm test             # vitest (core + web)
pnpm test:e2e         # playwright
pnpm db:reset         # supabase db reset + seed (Modelos 1, 2 e 3)
pnpm pdf:dev          # pdf-service local
pnpm lint && pnpm typecheck
```

## Regras que não podem ser quebradas
1. **Regra de domínio só em `packages/core`.** Telas e pdf-service importam do core e nunca recalculam por conta própria. Toda função do core tem teste.
2. **Cronograma em dias úteis de segunda a sexta, sem feriados.** Não crie cadastro de feriados (decisão do produto); o usuário ajusta datas manualmente com `inicio_manual`. Nunca use dias corridos.
3. **Não existe atividade bloqueada** (decisão do usuário em 26/10/2026): qualquer atividade aberta pode ser concluída a qualquer momento, mesmo com predecessora aberta ou lembrete pendente. Dependências servem só para o cronograma; lembretes só avisam. Conclui **com ou sem foto**: sem foto, fica "Concluída · sem foto" e a foto pode ser anexada depois. Atividade com subitens tem prazo derivado dos subitens (sequência ou paralelo); concluí-la marca os subitens abertos junto. Subitem tem um nível só.
4. **Lembretes de contratação, locação e compra não têm valor nem fornecedor.** Só tipo, descrição, data na obra e status (pendente/feito). Não adicione esses campos (decisão do produto: isso é de outro sistema).
5. **Pendência só fecha com foto de depois aprovada por outra pessoa** (vistoriador ≠ quem resolveu).
6. **Obra é cópia do modelo escolhido.** Editar a obra nunca altera o modelo, e editar um modelo nunca altera obras já criadas. Não há versões nem "publicar": há vários modelos salvos (nome + subtítulo).
7. **Nada se apaga de fato:** exclusão lógica e tabela de eventos para atividades, pendências e tarefas.
8. **Replanejar tarefa é rastreado:** mudar o prazo de tarefa aberta preserva `prazo_original` e incrementa `replanejamentos`.
9. **Toda ação de campo é otimista e funciona offline.** Fila com `client_op_id` idempotente. Nenhum toque espera o servidor para dar feedback (meta: < 100 ms).
10. **Ações destrutivas ou fáceis de tocar sem querer têm "Desfazer"** (toast de 5 s): concluir tarefa, adiar pendência, excluir, salvar edição.
11. **Dois perfis só:** Gestor (tudo) e Equipe de obra (tudo menos editar modelos). Esconda a edição de modelos na UI **e** bloqueie na RLS.
12. **Dependências entre quaisquer fases, sem ciclo.** O core calcula por ordenação topológica e rejeita ciclo.
13. **Modelos se editam no celular** por assistente de 5 passos (nome com sugestões, prazo, começa depois de, providências, revisão). Editar abre direto na revisão.

## Design system CONTRO
- Cores: **somente** turquesa `#54B4B0`, preto `#181818` e branco, com opacidades. Fundo do app `#F6F6F6`.
- **Exceção aprovada:** vermelho `#C62828` só para **atraso** (atividade, lembrete, providência vencida e ritmo atrasado). Não use vermelho para nada mais. A faixa separadora de obra na ata é cinza `#4A4A4A`, não vermelha.
- Tipografia Nunito Sans (títulos 700–800, corpo 400–600, números 800). Mínimo de 12 px.
- Botão primário: fundo turquesa e **texto preto**. Secundário: preto com texto branco. Terciário: contorno.
- Alvos de toque ≥ 44 px. Estados sempre com **texto e ícone**, nunca só cor. Contraste AA.
- Ícones lineares arredondados com traço 1,8–2 px, inline SVG. Sem emoji na UI.
- Marca **"CONTRO"** sempre em maiúsculas.
- Decisões de layout já tomadas pelo usuário:
  - tela inicial sem card de XP e sem linha de contadores;
  - "nova obra" é ícone "+" ao lado de "Minhas obras";
  - cabeçalho da obra sem chips, com o ícone discreto de boletim à direita;
  - tarja preta de **Inauguração** no fim da trilha de fases;
  - botões curtos ("WhatsApp", "Baixar PDF").

## Cadastros e marca
- Não há cadastro prévio obrigatório de equipe nem de prestadores. Os nomes fictícios ficam só no seed de homologação.
- Todo nome digitado (responsável, prestador, local) vira **sugestão** de autocompletar (`sugestao`), ordenada por uso.
- Símbolo: use o **vetor aprovado que está na pasta do projeto CONTRO**. Não redesenhe o símbolo.

## Linguagem e formatos
- Toda a UI em **pt-BR**.
- Datas no formato "qua 21/10"; data completa "quinta, 03/12/2026".
- Números e valores no padrão brasileiro (1.234,56).
- Vocabulário: obra, unidade, fase, atividade, subitem, **lembrete/providência** (contratação, locação, compra), pendência, vistoria, tarefa, reunião, ata, boletim, inauguração, prestador.

## Performance
- Abrir uma obra deve levar < 1,5 s em 4G. Busque a obra inteira em uma consulta e calcule os derivados no cliente com o core.
- Proibido N+1 em listas. Paginar apenas listas históricas (concluídas).
- Fotos: comprimir no aparelho (lado maior até 1600 px, JPEG ~0,75) e enviar em segundo plano.

## Como trabalhar
- Commits pequenos, um item do PLAN por vez, com mensagem em pt-BR no imperativo ("adiciona fila offline de tarefas").
- Migrations sempre com RLS e teste de política no mesmo PR.
- Mudou uma regra? Atualize PRD e SPEC no mesmo PR e registre em "Decisões" no PLAN.md.
- Dúvida de comportamento: o protótipo em `docs/prototipo/` é a referência. Se ele e o PRD divergirem, vale o PRD; pergunte ao usuário se for ambíguo.
- Não invente dados de obra real. Seeds de demonstração só em homologação.
