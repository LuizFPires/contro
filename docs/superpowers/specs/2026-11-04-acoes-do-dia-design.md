# Ações do dia: aviso individual e da equipe, seções por prazo

Data: 04/11/2026 · Estado: aprovado pelo usuário em 04/11/2026 (opção 2: tudo é ação)

Protótipos: telas https://claude.ai/artifact/JeSVVNoHoYFxexKh9exjJH · fluxo https://claude.ai/artifact/ENLyqf2QeGbmmS76VUPXU4

## Intenção e por quê

Hoje o CONTRO manda dois avisos de manhã: um "Bom dia" igual para todos (quantas obras em andamento e quantas tarefas atrasadas na empresa) e um "Tarefas" por responsável, só com as tarefas que vencem hoje. Nenhum deles diz à pessoa **o que está no nome dela e já venceu**, e o gestor não enxerga, num toque, o que cada pessoa da equipe tem para hoje.

O usuário quer (04/11/2026):

- cada pessoa da equipe recebe um aviso com **as ações dela** que estão atrasadas e as que vencem hoje;
- o gestor recebe um aviso **da equipe inteira**, mostrando o que cada pessoa precisa fazer hoje;
- o aviso é curto e o toque abre uma **lista em tela**, porque uma pessoa pode ter 15 itens;
- "ação" é qualquer coisa que ficou no nome da pessoa, não só tarefa de reunião: tarefas (de ata ou avulsas) **e pendências do Check list** com responsável;
- a tela Tarefas da equipe (e as listas por pessoa) ganha quatro seções: Atrasadas, Vencem hoje, Próximos dias e Concluídas, com ícone próprio e a cor âmbar para "vence hoje".

## Decisões do usuário (fonte: conversa de 04/11/2026)

1. O aviso lista tudo que está vinculado ao nome da pessoa, de qualquer origem e de qualquer obra.
2. Aviso curto; o toque abre a lista na tela.
3. O gestor recebe a visão de toda a equipe.
4. A palavra é **ação**, não "tarefa", nos avisos e nas seções, para não confundir com a tarefa de reunião.
5. Pendência do Check list entra no bolo.
6. Prazo da pendência deriva da criticidade: **alta 2, média 4, baixa 6 dias úteis** a partir do dia em que foi apontada.
7. Seções da tela Tarefas: **Atrasadas**, **Vencem hoje**, **Próximos dias** (no lugar de "Abertas"), **Concluídas**; cada uma com ícone; "vence hoje" em tom âmbar.
8. Âmbar **`#B45309`** aprovado como **exceção do design system só para "vence hoje"**.
9. **Tudo é "ação", sem subdivisão entre tarefa e pendência** (04/11/2026, vendo o protótipo): mesma importância, mesma lista, mesmo card, sem etiqueta de origem. Vale para a tela inicial (Hoje), os cards de obra, o boletim e a ata, não só para o push e as listas (opção 2 do protótipo).
10. Card atrasado com **fundo vermelho suave `#FBEAEA`**, além da borda e do título em vermelho.

## Objetivos

- Toda pessoa com `user_id` recebe, de manhã, no máximo **um** aviso "Ações do dia" com as contagens dela; o gestor recebe o da equipe.
- Uma única regra, no `packages/core`, decide se uma ação está atrasada, vence hoje, é dos próximos dias ou está concluída, e as telas e o SQL batem com ela.
- A tela Tarefas da equipe, Minhas ações e os chips por pessoa passam a mostrar as quatro seções e incluem as pendências.
- A tela inicial (Hoje), os cards de obra, o boletim e a ata contam e listam **ações** (tarefa + pendência) com a mesma regra, para o número ser um só em todo lugar.

## Não objetivos

- Atividades da obra e lembretes de providência não entram: não têm responsável. Continuam na tela Hoje e no aviso de providências, que fica como está.
- Nenhum valor, fornecedor ou campo novo em lembretes (regra 4 do CLAUDE.md).
- Não cria cadastro de feriados; dias úteis são segunda a sexta (regra 2).
- Não muda o aviso de reunião (manhã e antes) nem o fluxo de atribuição imediata (`atribuicao`).
- Pendência sem responsável não é ação de ninguém, mas é ação da obra: aparece em "Sem responsável" (Tarefas da equipe, Hoje, boletim) com o mesmo prazo por criticidade.
- E-mail, WhatsApp automático e qualquer canal além do Web Push já existente.

## Anti-objetivos (o que faria isso falhar mesmo funcionando)

- Mandar 2 avisos de manhã para a mesma pessoa (o "Bom dia" antigo mais o novo).
- Aviso que lista 15 linhas no corpo do push: o sistema do celular corta e ninguém lê.
- Pessoa sem nada atrasado nem vencendo hoje receber "0 ações".
- Usar âmbar fora de "vence hoje" ou vermelho fora de atraso.
- Tela recalculando prazo de pendência por conta própria, fora do core.

## Restrições

- Stack e regras do `CLAUDE.md` valem integralmente (core puro e testado, dias úteis, otimista/offline, Desfazer, dois perfis, RLS).
- O gerador de avisos é SQL (`gerar_avisos`, pg_cron a cada 5 min, fuso de São Paulo, janela de 3 horas, dedup por tipo+dia+pessoa). O SQL precisa aplicar **a mesma** regra do core; o teste do core é a referência e a migration deve ter teste de política no mesmo PR.
- Web Push: o corpo deve caber em ~2 linhas no celular (até uns 120 caracteres).

## Como fica (decidido na conversa, salvo onde marcado "minha escolha")

### 1. Regra de domínio (packages/core, novo módulo `acoes.ts`)

Tipo `Acao`:

```
{ origem: 'tarefa' | 'pendencia', id, obraId, texto, prazo: DataISO,
  aberta: boolean, responsavelId: string | null, concluidaEm?: string }
```

- `prazoPendencia(criticidade, apontadaEm: DataISO, cfg)` → `addDU(apontadaEm, dias[criticidade])`. Padrão `{ alta: 2, media: 4, baixa: 6 }`. "Apontada em" é a data de `apontada_em` no fuso de São Paulo. Se o dia apontado cair no fim de semana, conta a partir do próximo dia útil (`diaUtilAPartir`).
- `estadoAcao(acao, hoje)` → `'atrasada' | 'hoje' | 'proxima' | 'concluida'`: aberta e `prazo < hoje` → atrasada; aberta e `prazo = hoje` → hoje; aberta e `prazo > hoje` → próxima; fechada → concluída. (Mesma regra de `tarefaAtrasada`.)
- `classificarAcoes(acoes, hoje)` → `{ atrasadas, hoje, proximas, concluidas }`, cada lista por prazo; concluídas da mais recente.
- `resumoAcoesDia(acoes, hoje)` → `{ atrasadas: n, hoje: n }` por pessoa, e `resumoEquipeDia` → total mais lista por pessoa `{ nome, atrasadas, hoje }` ordenada por atrasadas desc, depois hoje desc, depois nome. Inclui o grupo "Sem responsável" ao fim quando tiver itens.
- **Minha escolha (quem é "pessoa" no resumo da equipe):** a mesma chave dos chips da tela Tarefas: pessoa cadastrada por `pessoa.id`; tarefa com responsável só por nome digitado vira linha pelo nome; pessoa sem login conta como linha normalmente (ela só não recebe push). "Sem responsável" soma no total "5 atrasadas e 9 vencem hoje" mas nunca ocupa uma das 3 vagas de nome do corpo do push.
- `textoAvisoAcoes(resumo)` e `textoAvisoEquipe(resumoEquipe)` geram título e corpo do push (abaixo), para o SQL copiar o formato e os testes fixarem o texto.
- Tudo com teste (Vitest): fins de semana, prazo no dia, sem itens, concordância singular/plural, corte do corpo.

**Minha escolha:** os dias por criticidade ficam configuráveis pelo gestor na tela de avisos (colunas `pend_alta_du`, `pend_media_du`, `pend_baixa_du` em `config_avisos`, padrões 2/4/6, entre 1 e 30). O core recebe o objeto de configuração; nunca lê o banco.

### 2. Aviso "Ações do dia" (substitui "Bom dia" e "Tarefas que vencem hoje")

- Dias úteis, na hora configurada (padrão **07:30**, herdada do "Bom dia"), janela de 3 horas como os demais.
- **Pessoa da equipe:** `tipo = 'acoes'`. Só recebe se `atrasadas + hoje > 0`.
  - Título: `CONTRO · Ações de hoje`
  - Corpo: `3 atrasadas e 4 vencem hoje. Toque para ver a lista.` Variações: `1 atrasada.`, `4 vencem hoje.`, `1 atrasada e 1 vence hoje.`
  - URL: `/?ir=minhas` (tela Minhas ações).
- **Gestor:** `tipo = 'acoes_equipe'`. Só recebe se o total da equipe for > 0. Não recebe também o individual (**minha escolha**: as ações dele estão dentro do da equipe; dois pushes na mesma manhã é o anti-objetivo).
  - Título: `CONTRO · Equipe hoje`
  - Corpo: `5 atrasadas e 9 vencem hoje · João V 2+3, Matheus T 1+2, Thaina C 0+4 e mais 1.` Nome curto (como nos chips), formato `atrasadas+hoje`, até **3 pessoas** e "e mais N"; corta em 120 caracteres.
  - URL: `/?ir=tarefas` (Tarefas da equipe, aba Todos).
- Dedup: `unique (tipo, dia, user_id)` já cobre; a constraint de `tipo` recebe os dois valores novos e perde `resumo` e `tarefas`.
- **Minha escolha de migração de config:** `acoes_ativo = resumo_ativo or tarefas_ativo`, `acoes_hora = resumo_hora`; `resumo_*`, `tarefas_ativo` e `tarefas_hora` são removidos (o novo aviso é sempre "cada um o seu; gestor a equipe"). Todas as linhas de `aviso_disparo` dos tipos `resumo` e `tarefas` são apagadas na migration (a tabela é fila, não histórico), antes de trocar a constraint.
- Tela **Avisos** do gestor: o bloco "Bom dia" e o bloco "Tarefas que vencem hoje" viram um só, "Ações do dia", com ligar/desligar, hora e os três campos de prazo da pendência (alta/média/baixa, em dias úteis).
- A Edge Function `enviar-avisos` não muda (ela só entrega o que `gerar_avisos` gravou).

### 3. Pendência como ação

- Fonte: `pendencia` com `status = 'aberta'` e `responsavel_id` preenchido (obra ativa). `prazo` = regra do item 1. Concluída = `fechada`, data `resolvida_em`.
- Fonte inclui também pendência **sem** responsável (grupo "Sem responsável").
- Nas listas a pendência é um card de ação **igual ao da tarefa, sem etiqueta de origem**; a linha de detalhe traz obra, criticidade, local e "apontada ter 03/11". Toque no card abre o Check list da obra naquela pendência (**minha escolha**; não se resolve pendência fora do fluxo de foto do depois, regra 5).
- O "✓" do card de tarefa não existe no card de pendência: ela só fecha com a foto do depois.
- O SQL de `gerar_avisos` calcula o prazo da pendência com um helper `contro_add_du(date, int)` (criar se não houver), que deve ter teste comparando com casos do core.

### 4. Tela Tarefas da equipe e Minhas ações

Seções, nesta ordem, cada uma com cabeçalho "ÍCONE NOME · N" e some quando vazia:

| Seção | Ícone (inline SVG, traço 2 px) | Card | Linha de prazo |
|---|---|---|---|
| Atrasadas | triângulo com exclamação | borda e título em vermelho `#C62828`, **fundo `#FBEAEA`** | `ATRASADA · prazo era ter 03/11` |
| Vencem hoje | círculo com exclamação | borda e título em âmbar `#B45309` | `VENCE HOJE · qua 04/11` |
| Próximos dias | calendário | como o card aberto de hoje | `Prazo seg 09/11` |
| Concluídas | círculo com check | apagado, como hoje | `Feita qua 04/11` |

- Linha de resumo: `Equipe: 1 atrasada · 7 vencem hoje · 43 próximas · 2 concluídas` (idem por pessoa e em Minhas ações, com "Você:").
- Chip por pessoa: mantém o badge vermelho só com atrasadas (decisão anterior); **minha escolha:** sem badge âmbar no chip, para não poluir.
- Minhas ações: abas "Abertas/Feitas" dão lugar às mesmas quatro seções numa lista só, agrupadas por obra dentro de cada seção como já é.
- Token novo em `packages/ui`: `--contro-atencao: #B45309`, usado **somente** nesses cards, texto e ícone de "vence hoje". Registrar a exceção no `CLAUDE.md`, `CONTRO_Design_System_v1.md`, PRD e SPEC.
- Estados sempre com texto e ícone, nunca só cor (acessibilidade do design system).

### 4b. Tela inicial, cards de obra, boletim e ata

- Bloco da tela inicial: "Tarefas · 51 abertas · 1 atrasada" vira **"Ações da equipe · 53 abertas · 3 atrasadas · 9 vencem hoje"**.
- Lista "Hoje" por obra (`agendaDoDia`): o item `tarefa` passa a chamar **`acao`** e recebe também as pendências (abertas, prazo por criticidade), com o rótulo "Ação", vencidas em vermelho no topo como já é. O badge da aba Hoje soma tudo.
- Cards de obra: o contador de atrasadas soma ações.
- Boletim (PDF e WhatsApp): o "Quem faz o quê" (hoje só com tarefas por responsável) passa a incluir as pendências, com a mesma regra de atraso; pendência sem responsável aparece em "Sem responsável". O boletim não tem seção de pendências por criticidade; nada a tirar. O Check list no app continua agrupado por criticidade porque é a organização das fotos, não uma lista de ações.
- **Ata: não muda** (minha escolha, a confirmar): a ata lista as ações combinadas em reunião e a cobrança da anterior; pendência do Check list não é item de reunião.
- Vocabulário no app: onde dizia "tarefa" para a pessoa ler (bloco, boletim, ata, textos do WhatsApp em `core/whatsapp.ts`), passa a "ação". A tela de criar/editar tarefa de reunião continua chamando "tarefa" (é a origem, não a lista).

### 5. Dados e desempenho

- Tarefas da equipe e Minhas ações carregam as pendências seguindo o **mesmo padrão das tarefas** (`useTarefasDasObras`: uma consulta por obra com a chave de cache `['pendencias', obraId]`), para que os patches otimistas do Check list apareçam na hora nessas telas (**minha escolha**; consulta única criaria um segundo cache que não recebe os patches). Fechadas: **minha escolha**: só as dos últimos 30 dias.
- Offline: listas vêm do cache Dexie como as tarefas; nada novo de escrita.

### 6. Documentação

- PRD: seção de avisos e de Tarefas descrevem "ação", as quatro seções e a regra do prazo da pendência.
- SPEC: módulo `acoes.ts`, colunas novas, tipos de aviso, textos do push.
- PLAN: item novo "Ações do dia" com checklist, e entrada em "Decisões" (04/11/2026: ação, prazo por criticidade 2/4/6, âmbar `#B45309`).

## O que fica para quem constrói

- Desenho exato dos quatro ícones dentro do padrão (linear, arredondado, 1,8–2 px).
- Nome das funções SQL e organização dos commits (um item do PLAN por commit).
- Como navegar do card de pendência até o Check list da obra posicionado nela.
- Textos de teste e fixtures.
- Forma de truncar o corpo do push em 120 caracteres sem cortar nome no meio.
