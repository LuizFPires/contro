# SPEC — CONTRO · especificação técnica

Versão 1.0 · 24/10/2026 · complementa o PRD.md. Em caso de conflito sobre comportamento, o PRD vale; sobre implementação, este SPEC.

---

## 1. Stack (proposta)

| Camada | Escolha | Por quê |
|---|---|---|
| App | **React 18 + TypeScript + Vite**, PWA com `vite-plugin-pwa` | Uma base para celular (campo e modelos) e desktop, instalável e sem loja |
| Estado do servidor | **TanStack Query** com atualização otimista | Feedback instantâneo ao toque |
| Estado local e offline | **Dexie (IndexedDB)** + fila de sincronização | Campo sem sinal |
| Estilo | CSS Modules + tokens CONTRO em CSS variables | Sem dependência de UI kit; tokens do design system |
| Backend | **Supabase**: Postgres, Auth, Storage, RLS, Edge Functions, `pg_cron` | Banco relacional para o cronograma; fotos no Storage; regras de acesso no banco |
| PDF | **Serviço Node + Playwright** (container) renderizando templates HTML | Mesmo método validado nos PDFs do protótipo (A4, Nunito Sans, ícones SVG) |
| Testes | Vitest (lógica), Playwright (E2E), testes de RLS em SQL | O motor de cronograma é o coração e precisa de testes |
| Observabilidade | Sentry (front e PDF), logs do Supabase | Erros de campo chegam sem depender do usuário |

> Se a equipe preferir outra base (por exemplo, a mesma do sistema "Obra"), o domínio e as regras deste SPEC continuam válidos. Só as seções 1, 9 e 10 mudam.

## 2. Arquitetura

```
[PWA React] ⇄ (TanStack Query + Dexie / fila offline) ⇄ [Supabase: Postgres + RLS + Storage]
                                                         ├─ Edge Function: gerar_obra, duplicar_modelo
                                                         ├─ pg_cron: snapshot semanal (seg 06:30), rotina diária (00:10)
                                                         └─ [pdf-service] boletim e ata (HTML → PDF)
```

- **A regra de domínio vive em um pacote compartilhado** (`/packages/core`, TypeScript puro e testado): cronograma, liberação, atrasos, %, semana, atribuições e textos do boletim e da ata. Front e pdf-service importam o mesmo código.
- O banco guarda **fatos** (concluído em, providenciado em, prazo, foto). **Derivados** (atrasada, lembretes pendentes, %, ritmo) são calculados pelo `core`. O que precisar ir para o PDF é materializado no snapshot semanal.

## 3. Modelo de dados

Convenções: `uuid` como PK, `created_at`/`updated_at`/`created_by` em tudo, `deleted_at` para exclusão lógica e datas em `date` (sem hora) quando são de calendário.

### 3.1 Cadastro
```
pessoa(id, nome, papel_texto, perfil: 'gestor'|'equipe', user_id → auth.users, ativo)   -- papel_texto (engenheiro, mestre, compras…) é só rótulo
unidade(id, nome, cidade text)                     -- unidade Contorno do Corpo
sugestao(id, tipo: 'pessoa'|'prestador'|'local', texto, usos int, ultimo_uso)   -- autocompletar alimentado pelo uso
-- Sem cadastro de feriados (decisão do produto). Uma pessoa pode ser criada na hora a partir de um nome digitado.
```

### 3.2 Modelos de obra (vários, sem versões)
```
modelo(id, nome, subtitulo, ordem int, criado_de_id null → modelo, criado_por, atualizado_em, excluido_em null)
modelo_fase(id, modelo_id, ordem int, titulo)       -- editável: renomear, criar, excluir (cascata nas atividades)
modelo_atividade(id, modelo_id, fase_id, ordem, nome, duracao_du int ≥1,
                 pai_id null → modelo_atividade,      -- preenchido = subitem (um nível só)
                 em_sequencia bool default true)       -- subitem: depois do irmão anterior (true) ou no início do pai (false)
-- Atividade com subitens: duracao_du é DERIVADA (vão dos subitens); dependências e providências ficam só no nível da atividade.
modelo_dependencia(modelo_id, atividade_id, predecessora_id)    -- qualquer fase; proibido ciclo (validado no core e em trigger)
modelo_providencia(id, modelo_id, atividade_id, tipo: 'contratacao'|'locacao'|'compra', descricao, antecedencia_du int ≥0, duracao_du int ≥0 default 0)
```
Sem rascunho nem publicação: cada edição grava direto no modelo. `gerar_obra` copia o estado do modelo naquele instante, então obras existentes nunca mudam. "Novo modelo" = cópia profunda de um modelo (ou só as fases) com `criado_de_id`. Excluir é lógico (`excluido_em`) e exige que reste ao menos um modelo ativo. O cálculo do cronograma usa **ordenação topológica**, não a ordem das fases.

### 3.3 Obra (cópia independente)
```
obra(id, unidade_id, nome, inicio date, modelo_id, modelo_rotulo text,   -- rótulo = nome · subtítulo no momento da criação
      engenheiro_id → pessoa, status: 'ativa'|'concluida'|'pausada', xp int default 0)
obra_fase(id, obra_id, ordem, titulo)
obra_atividade(id, obra_id, fase_id, ordem, nome, duracao_du, origem_modelo_atividade_id null,
               pai_id null, em_sequencia bool,                     -- subitens copiados do modelo
               inicio_manual date null,                            -- ajuste manual (feriado, imprevisto)
               concluida_em timestamptz null, concluida_por → pessoa, foto_conclusao_id → foto null,
               prestador text null)                                -- nome livre, opcional, com sugestões
obra_dependencia(obra_id, atividade_id, predecessora_id)
obra_providencia(id, obra_id, atividade_id, tipo, descricao, antecedencia_du, duracao_du,
                 na_obra_em date null,                             -- override; null = início da atividade
                 status: 'pendente'|'feito', feito_em, feito_por)
```

### 3.4 Pendências
```
pendencia(id, obra_id, atividade_id null, titulo, local, criticidade: 'alta'|'media'|'baixa',
          foto_antes_id, apontada_por, apontada_em,
          status: 'aberta'|'em_vistoria'|'fechada',
          ordem_fila numeric,                                      -- reordenar = mudar ordem
          adiada_ate date null, motivo_adiamento text null,
          foto_depois_id null, resolvida_por null, resolvida_em null,
          vistoriada_por null, vistoriada_em null)
pendencia_evento(id, pendencia_id, tipo: 'apontada'|'adiada'|'trazida'|'resolvida'|'aprovada'|'reaberta', por, em, dados jsonb)
```

### 3.5 Fotos
```
foto(id, obra_id, storage_path, largura, altura, tirada_em, tirada_por, lat null, lng null, sha256)
```

### 3.6 Reunião, ata e tarefas
```
reuniao(id, data date, hora time default '16:00', status: 'pauta'|'em_andamento'|'fechada', fechada_em, fechada_por)
reuniao_obra(reuniao_id, obra_id, observacoes text, snapshot jsonb)   -- snapshot do previsto x realizado ao fechar
modelo_fase/obra_fase.preliminar bool                         -- pré-obra: antes do dia 0, fora do % e do prazo
modelo_atividade/obra_atividade.mapa_alvo_id, mapa_antecedencia_du  -- mapa de coleta: fim = ES(alvo) − antecedência
obra.entrega_original date null                                -- inauguração planejada (fixar_entrega_original, uma vez)
obra_dependencia.defasagem_du int default 0 (≤ 0)             -- paralelismo: começa N du antes do fim da predecessora
obra_atividade excluída (deleted_at): as dependências ficam; no cálculo a sucessora herda as predecessoras dela (core dependenciasAtivas). RPCs adicionar_atividade_obra / excluir_atividade_obra / restaurar_atividade_obra (eventos criada/excluida/restaurada).
RPC adicionar_mapa_obra(p_obra_id, p_nome, p_duracao_du, p_antecedencia_du, p_libera uuid[], p_id): security definer, membro; valida fase preliminar "Mapa de coleta" e alvos de topo, de fases não preliminares, da mesma obra (pelo menos um); insere a atividade com mapa_antecedencia_du e as linhas de obra_mapa_libera; evento criada; idempotente por p_id. Web: campo.ts adicionarMapa e useObraCampo.novoMapa chamam a RPC direto e invalidam a obra (como "Adicionar atividade"; **não passa pela fila offline**); folha NovoMapaSheet; Desfazer = excluir_atividade_obra, otimista.
obra.excluida_por (pessoa) + RPCs excluir_obra / restaurar_obra (só gestor; trigger obra_protege_exclusao barra update direto de deleted_at pela equipe).
tarefa(id, obra_id, texto, responsavel_id → pessoa, prazo date,
       prazo_original date null, replanejamentos int default 0,
       status: 'aberta'|'feita', feita_em, feita_por,
       origem_reuniao_id → reuniao null, origem_texto,            -- ex.: 'Reunião 19/10'
       vinculo_tipo: null|'providencia'|'atividade', vinculo_id uuid null,
       efeito_providencia_id null,                                 -- lembrete marcado por esta tarefa (para reabrir)
       observacao text null,                                       -- observação livre (pauta da reunião)
       responsavel_nome text null,                                 -- nome digitado de quem não tem login (sem responsavel_id); vira sugestao 'pessoa'
       avanco_pct smallint 0..100, comentario text null,           -- informados por quem cuida (Minhas ações; informar_avanco_tarefa, 0..99)
       avanco_em timestamptz null, avanco_por → pessoa null)
tarefa_evento(id, tarefa_id, tipo: 'criada'|'editada'|'replanejada'|'concluida'|'reaberta'|'excluida'|'avanco', por, em, antes jsonb, depois jsonb)
reuniao_resposta(reuniao_id, obra_id, secao, item_id, resposta, respondido_por, respondido_em)   -- PK (reuniao_id, secao, item_id)
  secao: 'cobranca'|'passada_concluir'|'passada_comecar'|'semana_concluir'|'semana_comecar'|'semana_providencia'
  resposta: 'feita'|'nao_feita'|'terminou'|'nao_terminou'|'comecou'|'nao_comecou'|'segue'|'acao'|'ja_providenciado'
  -- grava/apaga por responder_reuniao (membro; reunião fechada não muda). A ata (core/ata.ts) monta os blocos a partir daqui.
```

**Ações (04/11/2026, `packages/core/src/acoes.ts`):** tarefa e pendência (com ou sem responsável) viram `Acao` (tipo, obra, responsável, prazo, concluída em). `prazoPendencia(criticidade, apontadaEm, config)` = `addDU(diaUtilAPartir(apontadaEm), n)` com n = 2 (alta), 4 (média), 6 (baixa) dias úteis (`config_avisos.pend_*_du`). `estadoAcao(acao, hoje)` → atrasada | hoje | proxima | concluida; `classificarAcoes(acoes, hoje, { proximosDU = PROXIMOS_DU (5) })` → `{atrasadas, hoje, proximas, depois, concluidas}` (`proximas`: abertas com `hoje < prazo <= addDU(hoje, proximosDU)`; `depois`: abertas além da janela, nunca exibidas) (a janela de 30 dias das pendências resolvidas não é do core: fica no web, em `acoesVisiveis` de `acoesObra.ts`); `resumoAcoesDia` (contagem por pessoa) e `resumoEquipeDia` (por responsável, ordenado); textos `textoAvisoAcoes`, `textoAvisoEquipe` (≤ 120 caracteres) e `textoResumoSecoes` ("N nos próximos 5 dias"). `agendaDia.ts` ganha o item de tipo `'acao'`. O web só adapta (`acoesObra.ts`, `useAcoesDasObras`, `usePendenciasDasObras`) e não recalcula.
**Providências como ações (04/11/2026):** `OrigemAcao` inclui `'providencia'` e `providenciaParaAcaoBase` (`acoes.ts`) monta a ação (texto "Contratação: …", sem responsável, prazo = providenciar até). A regra de quais providências viram ação está no core, em `packages/core/src/providencias.ts`: `providenciasSemDono` (pendente, atividade aberta, obra ativa, sem tarefa vinculada aberta; atividades do pré-obra ficam de fora), `semTarefaAberta` (tira as que já têm tarefa aberta no cache otimista) e `prazosParaGravar` (prazos a gravar em `providenciar_ate`); o web (`api.ts`, `useAcoesDasObras`, `acoesObra.ts`) só importa. A lista Hoje nunca mostra a mesma providência duas vezes: sem dono, ela entra como item de providência (não em `agenda.acoes`); com tarefa vinculada aberta, a agenda esconde o item de providência e só a tarefa da pessoa aparece. Os contadores "Ações da equipe" da tela inicial (`acoesAbertas`, `acoesAtrasadas`, `acoesHoje` de `ObraResumo`) somam as `providenciasSemDono` à parte.

**Atividades como ações (04/11/2026):** `OrigemAcao` inclui `'atividade'` e `atividadeParaAcaoBase` (`acoes.ts`; texto "Atividade: <nome>"). Módulo `packages/core/src/atividadesAcoes.ts`: `atividadesSemDono(atividades, fases, cron, tarefasAbertas, obraId, obraNome)` (topo, não concluída, com fim previsto — da obra ou do pré-obra —, sem tarefa vinculada aberta; o pré-obra entra desde 04/11/2026, `listarObras` junta `cron` e `cronogramaPreObra`), `semTarefaAbertaAtividade` (cache otimista) e `prazosParaGravarAtividades` (valores de `fim_previsto_calc` a gravar). `agendaDia.ts`: a entrada de atividade tem `comTarefa?`; com tarefa vinculada aberta esconde os itens concluir/começar/em andamento (os lembretes dela continuam). `ObraResumo.atividadesSemDono` soma nos contadores "Ações da equipe". Hoje esconde a atividade que tem **qualquer** tarefa vinculada aberta (inclusive de ata). O prazo da tarefa atribuída não acompanha o fim previsto se o cronograma mudar (replanejar a tarefa segue a regra 8). `concluir_atividade` fecha as tarefas vinculadas abertas (com evento `concluida`); `desfazer_conclusao` não mexe em tarefas: o cliente reabre. O Desfazer de Tarefas/Minhas ações reabre a atividade e depois a tarefa; o Desfazer da obra/ficha (`useObraCampo.desfazer`) enfileira `desfazer_conclusao` e um `reabrir_tarefa` por tarefa que a conclusão fechou (as guardadas no concluir ou, sem elas, as feitas da atividade nos últimos 5 minutos, `tarefasFechadasPelaAtividade`). O contador "abertas na equipe" da tela inicial conta só atrasadas, hoje e próximos 5 d.u. (`contarAcoesNaJanela`).

**Score e Log (04/11/2026, `packages/core/src/log.ts`, `score.ts`, `nomes.ts`):** `montarLog(entrada) -> LinhaLog[]` transforma eventos de tarefa, pendência e atividade (e itens do cronograma) em linhas com cor `neutra | ok | atencao | atraso`. O evento **vencida** é derivado, não gravado: aparece no **primeiro dia útil** após o prazo quando o item ainda estava aberto (janela de 90 dias). Também: `agruparPorDia`, `filtrarLog(linhas, { obraId?, tipo?: 'replanejadas'|'atividades'|'tarefas'|'pendencias', pessoaId?, pessoaNome? })` ("Eu" compara `pessoaId` da linha, que vem de `EventoBruto.por` ou, na vencida, de `ItemLog.responsavelId`; `pessoaNome` fica por compatibilidade), `vidaDoItem(item: ItemLog, eventos: EventoBruto[], hoje, formatarData) -> { passos: PassoVida[], resumo }` (resumo "N d.u. além do prazo original · N replanejamentos · N dias aberta"; cada passo traz `pessoa`; os dias aberta contam do evento de criação, senão de `ItemLog.criadaEm`: tarefa `created_at`, pendência `apontada_em`, atividade o início da obra) e `rotuloLinhaLog`. `nomes.ts`: `normalizarNome`, `iniciais`, `nomeCurtoObra`. `score.ts`: `calcularScoreEquipe(itens, janela, hoje)` e `calcularScorePrestadores(itens, janela, hoje)` (posicionais; `janela` = 30 | 90) -> `LinhaScore[]` (nome, score, faixa, indicadores, `numeros` = atraso médio, mediana, média de replanejamentos, obras, `piores` = 3 itens de maior atraso); `tendencia` (diferença de 5 pontos ou mais entre as janelas de 30 e 90 dias), `rotuloFaixa`. Só entram itens concluídos ou vencidos na janela (dias corridos); **mínimo de 5 itens**, senão sem score. Na equipe, toda pessoa com item não excluído (de qualquer data, aberto ou não) tem linha; sem item na janela, `itens = 0`, indicadores nulos e `faixa = 'sem_score'`. Pesos da equipe: pontualidade 35, conclusão do dia 20, resposta ao atraso 20, replanejamentos 15, pendências 10; prestadores: no fim previsto 45, atraso médio 30, com foto 25. Indicador sem base vale `null` e seu peso é redistribuído. Faixas: >= 75 Resolutivo (equipe) / Em dia (prestador), 50 a 74 Regular, < 50 Atenção. **Conclusão do dia = concluída até o prazo vigente** (não só no dia original). Quem conclui depois do prazo tem atraso mínimo de 1 d.u., mesmo se o prazo cair no fim de semana (`atrasoDU` em `datas.ts`, interno ao core e usado pelo Log e pelo Score). Prazo da atividade = cronograma vigente (também o `fimPrevisto` dos prestadores). Na equipe, pontualidade, resposta ao atraso e `piores` medem contra o `prazoOriginal`; Conclusão do dia usa o `prazo` vigente.
**Carregamento (web):** `features/log/dadosLogScore.ts` busca obras ativas e as concluídas com algum item na janela, tarefas e pendências abertas ou fechadas desde o início da janela (`status = aberta` ou `feita_em`/`resolvida_em >= desde`), todas as atividades dessas obras (o cronograma precisa delas) e os eventos dos últimos 90 dias (`tarefa_evento`, `pendencia_evento`, `obra_atividade_evento`, sem repetidos por id), paginando por `todasAsPaginas` em páginas de 1000; `cronogramaDaObra` foi extraído de `api.ts` e é compartilhado com `listarObras`. Hooks `useLogDados` e `useScoreDados` (com `erro` para "Sem conexão") e `useVidaDoItem(itemId)` (mesma consulta com `select`, sem `montarLog`); adaptadores em `itensLog.ts` (o web só adapta). O Log mostra 7 dias por vez ("Ver dias anteriores"). `sync.ts` marca `['log-score']` como velha após cada operação sincronizada (`refetchType: 'none'`): Log e Score buscam de novo ao montar ou ao voltar o foco. **Limites conhecidos:** item reaberto ganha linha "vencida" no prazo+1 mesmo que tenha sido concluído no prazo antes; tarefa replanejada depois de vencer perde a linha "vencida" do prazo anterior; item excluído não aparece no Log. Migration `20261104300000_log_score.sql`: índices `(em desc)` nas três tabelas de evento e `p_motivo text default null` em `salvar_tarefa`, gravado em `depois.motivo` do evento `replanejada` (até 120 caracteres); pgTAP `log_score.test.sql`.
**Score diário (05/11/2026):** tabela `score_diario (aba, chave, dia, nome, score30, score90, atualizado_em)`, PK `(aba, chave, dia)`; RLS: select para `contro_e_membro()`, sem escrita direta. RPC `gravar_score_diario(p_linhas jsonb)` (security definer, só membro, até 1000 linhas) faz upsert com `dia = hoje em America/Sao_Paulo` decidido pelo servidor, então dia passado fica congelado; pgTAP `score_diario.test.sql`. Web: `ScoreScreen` calcula as duas abas nas duas janelas com o core e chama `useGravarScoreDiario` (não regrava o mesmo conteúdo; erro fica para a próxima abertura); `useScoreHistorico(aba, chave)` lê até 95 dias. Core `scoreEvolucao.ts`: `evolucaoScore(registros, agora, hoje, janela)` monta a série (só dias úteis fechados com score na janela, hoje aberto no fim, maior/menor) e `variacaoScore(pontos, i)` dá o delta e se o anterior é "ontem". Componente `EvolucaoScore.tsx` (SVG inline, toque/arrasto lê o dia).

### 3.7 Boletim
```
boletim(id, obra_id, semana_inicio date, edicao: 'segunda'|'sexta', snapshot jsonb, texto_whatsapp text, pdf_path, gerado_em)

-- Agendamento do boletim automático (global; só gestor edita). Linha única.
config_boletim(id bool=true PK, ativo, dia_semana 1..7 (ISO), hora time,
               fechamento_ativo, fechamento_dia 1..7, fechamento_hora time,
               updated_at, updated_by)

-- Disparo = "está na hora do boletim" por obra/semana/edição (dedup único).
-- O texto/snapshot é calculado no cliente (core) ao abrir; aqui só o marcador.
boletim_disparo(id, obra_id, semana_inicio date, edicao: 'principal'|'fechamento',
                criado_em, notificado_em, enviado_em,
                unique(obra_id, semana_inicio, edicao))

-- Assinaturas de Web Push (um aparelho = um endpoint). Cada um gerencia a sua.
push_subscription(id, user_id, endpoint unique, p256dh, auth, user_agent, criado_em)
```

## 4. Motor de cronograma (`packages/core/schedule.ts`)

### 4.1 Calendário
- Dia útil = **segunda a sexta. Não há cadastro de feriados** (decisão do produto); feriado e imprevisto se resolvem com `inicio_manual`.
- `addDU(data, n)`: avança n dias úteis.
- `duEntre(a, b)`: dias úteis em [a, b).

### 4.2 Datas planejadas (forward pass)
As atividades são ordenadas topologicamente. A ordem do modelo já garante isso, porque só há ligação com atividades anteriores.
```
dur(a) = sem subitens ? duracao_du : vão dos subitens
         (subitem k: ini = em_sequencia ? fim(k−1) : 0; fim = ini + dur(k); vão = max(fim))
ES(a) = max( max(EF(p) for p in pred(a)) ou 0 , duEntre(obra.inicio, a.inicio_manual) se houver )
EF(a) = ES(a) + dur(a)
total = max(EF)
inicio_previsto(a) = addDU(obra.inicio, ES(a))
fim_previsto(a)    = addDU(obra.inicio, EF(a) − 1)
entrega (inauguração) = addDU(obra.inicio, total − 1)
```
Caminho crítico (modelos de obra e obras): backward pass com `LS = min(LS(sucessoras)) − duração`, e folga = LS − ES; crítica quando a folga é 0.

> Tanto o protótipo quanto a v1 planejam sempre pelas **datas do modelo da obra**. A conclusão tardia não empurra o plano. O atraso aparece como atraso, e para mudar o plano o engenheiro edita o cronograma da obra.

### 4.3 Estados derivados
```
decorridos = duEntre(obra.inicio, hoje)            -- 0 se a obra não começou
concluida(a)  = a.concluida_em != null   -- com subitens: só permitido quando todos os subitens estão marcados
avanço com subitens = peso(a) × (Σ dur dos subitens marcados / Σ dur dos subitens)
avanço parcial(a) = a.avanco_pct / 100 (0..99, aberta)   -- concluída vale 1 (28/10/2026)
real = Σ peso(a) × (concluida ? 1 : avanço parcial) / Σ peso
predsOk(a)    = todas predecessoras concluídas
provOk(a)     = todas providências de a com status 'feito'
ES(a) = max over p (max(EF(p) + defasagem(p,a), ES(p)))      -- defasagem ≤ 0; nunca antes do início da predecessora
previsão: aberta com EF ≤ decorridos termina hoje; não começada não começa antes de hoje
liberada(a)   = !concluida                      -- sem atividade bloqueada (26/10/2026); predsOk/provOk não travam
lembretesPendentes(a) = !concluida && !provOk   -- só aviso
aguardandoProvidencia(a) = !concluida && predsOk && !provOk
atrasada(a)   = !concluida && obra iniciada && EF(a) ≤ decorridos
fase_atual    = menor fase com atividade não concluída
fase concluída / em execução / planejada / com atraso (se tem atividade atrasada)
```

### 4.4 Providências (lembretes)
```
limite(p)      = ES(atividade) − antecedencia_du
comecar(p)     = providenciarAte(p) − duracao_du   (core: comecarProvidencia; o Hoje avisa de comecar até o prazo)
providenciar_ate(p) = addDU(obra.inicio, max(limite, 0))
na_obra_em(p)  = p.na_obra_em ?? inicio_previsto(atividade)
atrasada(p)    = status='pendente' && atividade não concluída && obra iniciada && decorridos > max(limite, 0)   -- "até sex" ainda vale na sexta (26/10/2026)
```

### 4.5 Indicadores
```
sumD   = Σ duração de todas as atividades
real   = Σ duração das concluídas / sumD
prev(x)= Σ clamp((x − ES)/duração, 0, 1) × duração / sumD
previsto_hoje = prev(decorridos); previsto_sexta = prev(decorridos + 5)
ritmo_dias = round((real − previsto_hoje) × total)
  ≥ +1 → "N dias à frente do modelo"
  −1..0 → "No ritmo do modelo"
  ≤ −2 → "Atrasada · N dias"   (vermelho)
```
Q2 (PRD), decidido em 28/10/2026: peso pela duração **com % parcial** por atividade (`obra_atividade.avanco_pct`, 0..99; 100% é concluir). Anel da trilha: cada toque +25% (`proximoAvancoAnel`), em 75% o toque conclui; cards da ficha 25 · 50 · 75 · Pronta (`avancoAoTocarCard`: o mesmo card volta um passo). RPC `definir_avanco(atividade, pct, client_op_id)`: membro, idempotente, só atividade de topo aberta e fora do mapa de coleta, evento `avanco` com antes/depois. `desfazer_conclusao` mantém o avanço que havia.

### 4.6 Semana
A semana começa na segunda (seg 07:00 é a referência do boletim e da reunião).
```
concluir_semana = não concluídas com decorridos < EF ≤ decorridos + 5
comecar_semana  = não concluídas com decorridos ≤ ES < decorridos + 5
providenciar_semana = providências pendentes, não atrasadas, com limite < decorridos + 5
semana_passada_concluir = decorridos − 5 < EF ≤ decorridos  → concluída? / não (com motivo)
semana_passada_comecar  = decorridos − 5 ≤ ES < decorridos → concluída? senão a reunião pergunta "Começou / Não começou"
motivo(a) = "falta providenciar" (lembrete pendente) | nada
```

### 4.7 Atribuições ("Quem faz o quê")
Fontes, nesta ordem:
1. Tarefas da obra (todas as origens), com situação.
2. Engenheiro da obra:
   - "Recuperar atraso: X" para cada atividade atrasada (prazo = fim previsto);
   - "Garantir conclusão: X (prestador)" para cada atividade em `concluir_semana`;
   - "Mobilizar início: X" para cada atividade em `comecar_semana`.
3. Compras:
   - "Destravar <tipo>: X" para cada providência atrasada;
   - "<Contratar|Alugar|Comprar>: X (na obra dd/mm)" para cada providência da semana.
   - Fica de fora a providência que já tem tarefa vinculada.

Agrupar por pessoa (pela função em `papel_texto`: engenheiro, compras, gestão, demais). Ordenar abertas por prazo e deixar as concluídas no fim. Vencida e aberta = vermelho.

## 5. Máquinas de estado

**Pendência**
```
aberta ──resolver(foto_depois)──▶ fechada        (sem vistoria, 28/10/2026)
  ▲                                    │
  └──reabrir_pendencia(manter_foto)────┘
```
Pendentes = `status='aberta'`, ordenadas por **criticidade** (alta → média → baixa) e, dentro dela, por `ordem_fila` (`classificarPendencias`). Resolvidas = `fechada` (e `em_vistoria` antigo), da mais recente (`resolvida_em`). `em_vistoria` não é mais gerado: a migration de 28/10 fechou as que estavam nele e `vistoriar_pendencia` fica sem uso. Sem adiar (28/10/2026): `adiada_ate`/`motivo_adiamento` ficam no banco só pelo histórico; o app ignora e não oferece mais adiar/trazer.
Em qualquer estado, qualquer membro corrige a pendência (`editar_pendencia`: título, local, criticidade, atividade da mesma obra; evento `editada` com o antes) ou a apaga (`excluir_pendencia`, exclusão lógica, evento `excluida`; Desfazer por `restaurar_pendencia`). Todas idempotentes por `client_op_id` (offline).
`reabrir_pendencia(id, manter_foto)`: só `fechada` → `aberta` no topo da fila, limpa resolvido/vistoriado e adiamento; `manter_foto=false` tira `foto_depois_id` (o id fica no evento `reaberta`, nada se apaga). Sem Desfazer: a própria escolha (manter/tirar) é a confirmação.

**Tarefa**
```
aberta ⇄ feita    (concluir / reabrir; ambos com "Desfazer")
editar: texto, responsável, prazo, status. Mudar o prazo com status aberta:
  prazo_original ??= prazo_anterior; replanejamentos += 1; tarefa_evento('replanejada')
excluir: exclusão lógica, com "Desfazer"
```
Efeitos de concluir:
- vínculo com providência pendente → marca a providência como `feito` e grava `efeito_providencia_id`;
- vínculo com atividade aberta → abre a câmera de conclusão.

Efeito de reabrir: se `efeito_providencia_id` aponta para uma providência `feito` cuja atividade não foi concluída, ela volta para `pendente`.

**Providência:** `pendente ⇄ feito`. A edição permite descrição, data na obra e status.

**Atividade:** `aberta (0..99% de avanço) → concluída` (sem estado bloqueado) (com ou sem foto; sem foto, a foto pode ser anexada depois por `anexar_foto_conclusao`). A atividade volta para pendente por `desfazer_conclusao`, pelo "Desfazer" do toast ou pelo botão "Voltar para pendente" na ficha, por **qualquer membro** (evento `reaberta` com quem fez).

## 6. Operações (RPC / Edge Functions)

| Operação | Quem | Efeito |
|---|---|---|
| `gerar_obra(unidade_id, inicio, nome, modelo_id)` | gestor, equipe | Copia o modelo escolhido (fases, atividades, subitens, dependências e providências) numa transação |
| `ajustar_inicio(atividade_id, data)` | gestor, equipe | Grava `inicio_manual` e o evento; sucessoras recalculam |
| `marcar_subitem(id, feito)` | gestor, equipe | Marca ou desmarca o subitem (foto opcional) |
| `salvar_modelo_*` (fase, atividade, subitem, dependência, providência, nome/subtítulo) | **só gestor** | Valida sem ciclos, duração ≥ 1, fase com nome e subitem com um nível só |
| `duplicar_modelo(modelo_id \| null)`, `excluir_modelo(id)` | **só gestor** | Cópia profunda (ou em branco); exclusão lógica, mantendo ao menos um |
| `concluir_atividade(id, foto_id)` | gestor, equipe | Qualquer atividade aberta (sem checar predecessoras nem lembretes); marca os subitens abertos; +50 XP e +200 se fechar a fase |
| `marcar_providencia(id, status)` | gestor, equipe | Alterna pendente/feito |
| `apontar_pendencia(...)`, `resolver_pendencia(id, foto_depois_id)` | gestor, equipe | — |
| `vistoriar_pendencia(id, aprovado, motivo?)` | — | Sem uso desde 28/10/2026 (Check list sem vistoria) |
| `adiar_pendencia(id, data, motivo)`, `trazer_pendencia(id)` | gestor, equipe | — |
| `salvar_tarefa`, `concluir_tarefa`, `reabrir_tarefa`, `excluir_tarefa` | gestor, equipe | Grava `tarefa_evento`. `salvar_tarefa` aceita `p_observacao`, `p_motivo` (opcional, até 120 caracteres, gravado em `depois.motivo` do evento `replanejada`) e `p_responsavel_nome` (só vale sem `p_responsavel_id`; registra a sugestão) |
| `fechar_reuniao(id)` | gestor | Materializa `reuniao_obra.snapshot` e gera o PDF da ata |
| `reabrir_reuniao(id)` | gestor | Ata fechada volta a ser pauta e ganha as obras ativas de hoje (observações e snapshots ficam) |
| `responder_reuniao(reuniao_id, obra_id, secao, item_id, resposta)` | gestor, equipe | Grava a resposta do item da pauta (null apaga); recusa com a reunião fechada |
| `informar_avanco_tarefa(id, pct 0..99, comentario)` | gestor, equipe | Avanço e comentário da ação + evento `avanco`; 100% é `concluir_tarefa` |
| `gerar_boletim(obra_id, edicao)` | sistema (cron) ou usuário | Snapshot, texto do WhatsApp e PDF |

Todas são idempotentes por `client_op_id` (uuid gerado no aparelho), para a fila offline poder reenviar sem duplicar.

## 7. Permissões (RLS)

Dois perfis:
- **Gestor:** tudo, inclusive escrita em `modelo*`.
- **Equipe de obra:** leitura e escrita em todas as tabelas de obra, pendência, providência, tarefa, reunião e boletim; **somente leitura** em `modelo*` (para escolher o modelo na nova obra). A UI esconde "Modelos" e "Editar modelos" para esse perfil, e a RLS bloqueia a escrita.
- Sem vistoria (28/10/2026): resolver com a foto do depois fecha a pendência, para qualquer perfil.
- **Fotos:** bucket privado, com acesso por URL assinada de curta duração e caminho `obra_id/…`.

## 8. Boletim e ata

### 8.1 Texto do WhatsApp (gerado por `core/boletim.ts`)

> **Atualizado em 31/10/2026 (opção A do protótipo "WhatsApp mais legível"):** todo texto de WhatsApp (boletim, ata, pauta antecipada) segue `core/whatsapp.ts`: obra em destaque (`*🏗 NOME*` + `_indicador_`), seções em negrito com ícone (ex.: 🚨 Atenção, 🏁 Concluir, ▶️ Começar, ✅ Aconteceu, ❌ Não aconteceu, 📅 Semana que vem, 🛒 Providências, 🔁 Cobrança, 👥 Quem faz o quê), **um item por linha** com `- ` e a **bolinha da temperatura** do prazo (`temperaturaPrazo`: 🔴 atrasado, 🟡 vence/começa em até 7 dias, 🔵 em dia, 🟢 feito, ⚪ sem resposta), separador `━━━━━━━━━━━━━━` entre obras. O modelo abaixo é o anterior, mantido para referência.

```
*CONTRO · Boletim da semana*
*{obra}* · {seg dd/mm} a {sex dd/mm}
Avanço real {x}% · previsto até sexta {y}% · {ritmo}

*ATENÇÃO · {n} em atraso*            (se houver)
• {tipo/atividade atrasada}

*Concluir nesta semana*
• {dia dd/mm} · {atividade}
*Começar nesta semana*
• {dia dd/mm} · {atividade} ({motivo se bloqueada})
*Quem faz o quê*      (tarefas e pendências, 04/11/2026)
_{pessoa}_
• {dia dd/mm} · {tarefa ou pendência}

PDF completo com fotos e cronograma no app CONTRO.
```
O envio é `https://wa.me/?text=` + `encodeURIComponent(texto)`, aberto em nova aba. O usuário escolhe o grupo. Limite prático de cerca de 4.000 caracteres: se passar, truncar "Quem faz o quê" e remeter ao PDF.

### 8.2 PDF do boletim (A4 retrato)
Cabeçalho preto com a marca, a obra e a semana.

KPIs: real, previsto até sexta, ritmo e atrasos.

Barra (real, marcador do previsto hoje e da meta da semana).

Seções:
1. Atenção (vermelho).
2. Quem faz o quê (por pessoa).
3. Concluir na semana.
4. Começar na semana.
5. Providenciar na semana.
6. Fases (6 cards).
7. Qualidade.
8. Encaminhamentos (tabela em branco).

Rodapé com a data de geração. Margens: primeira página 0/0/10 mm, demais 12/0/10 mm. Caixas com `box-decoration-break: clone`.

### 8.3 PDF da ata
Montado por `core/ata.ts` (`montarObraAta`, `totaisAta`, `textosTotais`, `textoAtaWhatsapp`) a partir das respostas da pauta. Cabeçalho com data e hora; totais: aconteceram, não aconteceram, ações novas, cobrança cumprida/total, sem resposta.

Dois formatos (o usuário escolhe em "Baixar PDF"):
- **Resumo em tabela + ata** (padrão, A4 **paisagem**): página 1 com a tabela obras × (semana passada · cumprido | não cumprido → ação | próxima semana | providências | cobrança) e "Quem faz o quê" em 3 colunas; depois a ata.
- **Só a ata** (A4 retrato).

Por obra (faixa cinza #4A4A4A): indicador e situação; 1 · Planejado e aconteceu; 2 · Planejado e não aconteceu (com "está em X%" e a ação); 3 · Próxima semana (segue o plano / com ação / sem resposta); Providências (contratar, alugar, comprar e ações avulsas); 4 · Cobrança da reunião anterior (cumprida, ou "N% feito · remarcada (Nx), até dd/mm"); Observações. No fim, Quem faz o quê por pessoa. Sem pdf-service, o app imprime a mesma ata (e a tabela, em paisagem) pelo navegador.

Em seguida, **Providências por responsável**, com caixa de check para impressão, e as assinaturas.

A faixa lateral de cada obra é **cinza escuro #4A4A4A**.

## 9. Offline e sincronização

- Leituras: cache da obra aberta e das tarefas do usuário em IndexedDB. A sincronização em segundo plano roda ao abrir o app e a cada 5 minutos com conexão.
- Escritas: ação aplicada otimisticamente no estado local → `fila_ops` (Dexie) `{client_op_id, op, payload, criado_em}` → envio em ordem, com retry exponencial.
- Fotos: o arquivo comprimido vai para a fila de upload. A operação que depende da foto referencia um `foto_id` gerado no aparelho.
- Conflitos: last write wins por campo, com registro de evento. Exceção: `concluir_atividade` recusa atividade já concluída. Se falhar, a UI reverte e explica o motivo.

## 10. Frontend

### 10.1 Rotas
```
/                         carteira
/obras/nova               nova obra a partir do modelo
/obras/:id                fases (padrão)  · ?aba=pendencias|providencias|cronograma
/obras/:id/boletim        boletim da semana
/obras/:id/vistoria       vistoria antes/depois
/reuniao/:data            pauta e ata em construção
/reuniao/:data/ata        ata
/tarefas?pessoa=          tarefas da equipe
/modelos                  lista de modelos de obra (só gestor)
/modelos/:id              modelo: fases, atividades e assistente de 5 passos (só gestor)
/modelos/:id/tabela       visão desktop complementar (tabela + Gantt)
```

### 10.2 Componentes-chave
`FaseTrilha`, `AtividadeItem`, `FichaAtividade` (bottom sheet, com subitens e "Ajustar início"), `AutocompleteNome` (sugestões de pessoa e prestador), `LembreteItem`, `PendenciaDeck` (swipe com limiar de 100 px, rotação dx/22 e botões equivalentes), `ListaPendencias`, `AdiarSheet`, `CameraGhost` (overlay do antes com 40% de opacidade), `Gantt`, `Inauguracao`, `BoletimView`, `ReuniaoObraCard`, `TarefaItem`, `TarefaSheet`, `Toast` com ação "Desfazer" (5 s).

### 10.3 Tokens CONTRO
```css
--contro-turquoise:#54B4B0; --contro-black:#181818; --contro-white:#FFFFFF;
--contro-text:#181818; --contro-muted:#696969; --contro-bg:#F6F6F6; --contro-surface:#FFFFFF;
--contro-border:rgb(24 24 24 / 10%); --contro-selected:rgb(84 180 176 / 22%);
--contro-late:#C62828;            /* exceção: só atraso */
--contro-attention:#B45309;       /* exceção: só "vence hoje" */
--contro-late-bg:#FBEAEA;         /* fundo do card atrasado */
--contro-separator:#4A4A4A;       /* faixa lateral das obras na ata */
--radius-field:12px; --radius-card:16px; --radius-modal:20px;
font-family:'Nunito Sans',sans-serif;
```
**Exceção aprovada (04/11/2026):** âmbar `#B45309` só para **vence hoje** (ação com prazo no dia); fundo do card atrasado `#FBEAEA`. Não use âmbar para nada mais.

Alvos de toque ≥ 44 px. Nunca branco sobre turquesa em texto pequeno; usar preto.

## 11. Rotinas agendadas

| Quando | O quê |
|---|---|
| Diário 00:10 | Devolve à fila as pendências com `adiada_ate ≤ hoje` (registra evento) |
| Segunda 06:30 | `gerar_boletim(obra, 'segunda')` para cada obra ativa; notificação push ao engenheiro: "Boletim pronto para enviar" |
| A cada 5 min | `gerar_avisos()`: lembretes da reunião e avisos do dia de `config_avisos` (fuso de São Paulo), um `aviso_disparo` por pessoa/tipo/dia, dentro de 3 h após o horário; a Edge Function `enviar-avisos` manda o push (runbook em `supabase/functions/enviar-avisos/README.md`). Tipos (`aviso_disparo.tipo`): `reuniao_manha`, `reuniao_antes`, `acoes`, `acoes_equipe`, `providencias`, `atribuicao` |
| Sexta 17:00 | `gerar_boletim(obra, 'sexta')` (fechamento) |

A reunião também deixa de ser fixa (28/10/2026): `config_avisos` (linha única, membro lê, gestor edita) guarda `reuniao_dia` (1–5) e `reuniao_hora`; a pauta é a da **reunião que vem**, `reuniaoQueVem(hoje, dia)` (core): a desta semana até o fim do dia da reunião, depois a da semana seguinte (30/10/2026); nasce com esse horário. A tela da reunião tem "Anterior · data" para ver a ata da semana passada (só lê: não cria reunião). O cron fixo "Segunda 15:30" saiu: a pauta abre sob demanda pela tela.

**Ações do dia (migration `20261104100000_acoes_do_dia.sql`, 04/11/2026):** `config_avisos` ganha `acoes_ativo`, `acoes_hora` (07:30) e `pend_alta_du`/`pend_media_du`/`pend_baixa_du` (2/4/6, 1–30); saem `resumo_*` e `tarefas_*` ("Bom dia" e "Tarefas que vencem hoje"). Helpers SQL `contro_add_du`, `contro_prazo_pendencia` (espelham o core), `contro_nome_curto`, `contro_totais_acoes` e `contro_texto_equipe`. `gerar_avisos` manda `acoes` a cada pessoa com login (título "CONTRO · Ações de hoje"; "N atrasadas e M vencem hoje. Toque para ver a lista."; url `/?ir=minhas`) e `acoes_equipe` ao gestor (título "CONTRO · Equipe hoje"; "N atrasadas e M vencem hoje · Nome C a+h, … e mais K."; ≤ 120 caracteres; url `/?ir=tarefas`); com 0 ações não há push. Teste pgTAP: `supabase/tests/acoes_avisos.test.sql`. Nota local: a CLI do Supabase v3 rejeita o `config.toml`; use `npx supabase@2.122.1`. Regra de prazo e textos: `core/acoes.ts` (§3.6).
**Providências como ações (migration `20261104200000_providencia_prazo.sql`, 04/11/2026):** `obra_providencia.providenciar_ate date` é **derivada** (calculada pelo core no app; nula até o app gravar; sem backfill). RPC `atualizar_prazos_providencias(p_obra_id, p_prazos jsonb [{id, ate}])` (exige membro da instalação, `contro_e_membro()`; grava só o que mudou), chamada em segundo plano por `listarObras`. **Defasagem:** o valor pode ficar velho até alguém abrir o app (mudança de cronograma, p.ex.). `gerar_avisos`: a CTE `acoes` ganha `union all` das providências pendentes sem tarefa vinculada aberta e com `providenciar_ate` não nulo (prazo = `providenciar_ate`, chave `'sem'`; obra ativa, atividade não concluída nem excluída), que somam ao total do gestor (grupo "Sem responsável", nunca ocupa vaga de nome). pgTAP: `providencia_prazo.test.sql`. Nada mais muda em `obra_providencia` (sem valor e fornecedor).

**Atividades como ações (migration `20261104500000_atividade_prazo.sql`, 04/11/2026):** `obra_atividade.fim_previsto_calc date` é **derivada** (calculada pelo core no app; nula até o app gravar; sem backfill). RPC `atualizar_prazos_atividades(p_obra_id, p_prazos jsonb [{id, ate}])` (exige `contro_e_membro()`; grava só o que mudou), chamada em segundo plano por `listarObras`. Mesma defasagem das providências. `gerar_avisos`: a CTE `acoes` ganha ramo das atividades de topo não concluídas (pré-obra incluído desde `20261104700000_pre_obra_como_acao.sql`), em obra ativa, com `fim_previsto_calc` não nulo e sem tarefa vinculada aberta (chave `'sem'`, grupo "Sem responsável"). pgTAP: `atividade_prazo.test.sql`. Migration `20261104600000_concluir_atividade_fecha_tarefa.sql`: `concluir_atividade` fecha as tarefas abertas com `vinculo_tipo = 'atividade'` da atividade e grava `tarefa_evento ('concluida')` de cada uma; `concluir_tarefa` ignora tarefa já feita (a câmera da tarefa conclui a atividade e depois a tarefa, sem evento duplicado); pgTAP `concluir_atividade_fecha_tarefa.test.sql`.

Os horários do boletim **deixam de ser fixos**: o gestor configura dia e hora (global, vale para todas as obras) em `config_boletim` — edição principal + edição de fechamento opcional. Os valores acima viram apenas o **padrão** da linha única. O cron da geração lê `config_boletim` e dispara no horário configurado (fatia 2); o aviso é por push (fatia 3).

## 12. Testes obrigatórios

- `core`:
  - forward pass e backward pass com os 28 itens do modelo (total de 54 dias úteis na versão do protótipo);
  - subitens em sequência e em paralelo (Demolições: alvenaria 2 · forro 2 em paralelo · piso 3 em sequência = 5 du);
  - `inicio_manual` empurrando a atividade e as sucessoras;
  - liberação com providências;
  - atrasos;
  - % e ritmo (casos Eldorado 47% / 53% / −3, Pampulha e Betim do protótipo);
  - semana e atribuições;
  - texto do boletim (snapshot).
- RLS: cada perfil tenta ler e escrever fora do seu escopo.
- E2E:
  - criar obra → concluir atividade com foto → fase concluída;
  - adiar e trazer pendência;
  - resolver e vistoriar (bloqueio da mesma pessoa);
  - concluir e reabrir tarefa vinculada (o lembrete volta);
  - replanejar tarefa (contador e prazo original);
  - gerar boletim e ata em PDF.
- Offline: concluir atividade sem rede → reconectar → servidor consistente.

## 13. Dados iniciais (seed)

Três modelos de obra: **Modelo 1 · CDC completo · reforma pesada** (as 28 atividades do Anexo A, precedidas do pré-obra — fase 1 "Orçamento" e fase 2 "Mapa de coleta" — incluído em 26/10/2026 por `contro_garantir_pre_obra`), **Modelo 2 · CDC sem vestiários** (sem as atividades 10, 13, 18 e 19; quem dependia delas herda as predecessoras) e **Modelo 3 · Retrofit leve** (sem 4, 9, 10, 11, 13, 18 e 19; demolição vira "Retiradas pontuais", 2 du). Referência: `prototipo/ModeloCel.dc.html`. Obras de demonstração Eldorado, Pampulha e Betim **apenas em ambiente de homologação**.

### Anexo A — Modelo 1 · CDC completo (seed)

| # | Fase | Atividade | Dur. (du) | Predecessoras | Providências padrão (tipo · descrição · antecedência) |
|---|---|---|---|---|---|
| 1 | 1 Mobilização | Mobilização e tapumes | 2 | — | Locação · Tapumes e container de obra · 3 |
| 2 | 1 | Demolições e retiradas | 5 (calc.) | 1 | Locação · Caçambas de entulho · 2; Contratação · Equipe de demolição · 5 |
| 2.1 | 1 | ↳ Demolição de alvenaria | 2 | início da atividade | — |
| 2.2 | 1 | ↳ Demolição de forro | 2 | em paralelo | — |
| 2.3 | 1 | ↳ Demolição de piso | 3 | em sequência | — |
| 3 | 1 | Limpeza e bota-fora | 2 | 2 | — |
| 4 | 2 Infraestrutura | Alvenarias e novos fechamentos | 6 | 3 | Contratação · Pedreiro (alvenaria) · 5; Compra · Blocos e argamassa · 5 |
| 5 | 2 | Infra de elétrica | 8 | 3 | Contratação · Eletricista · 7; Compra · Cabos, eletrodutos e quadros · 7 |
| 6 | 2 | Infra de ar-condicionado | 6 | 3 | Contratação · Instaladora de ar-condicionado · 10; Compra · Tubulação frigorígena e drenos · 7 |
| 7 | 2 | Água fria e esgoto | 6 | 3 | Contratação · Encanador · 5; Compra · Tubos e conexões · 5 |
| 8 | 2 | Infra de dados, CFTV e som | 4 | 5 | — |
| 9 | 2 | Infra de incêndio | 5 | 3 | Contratação · Empresa de incêndio (sprinkler) · 10 |
| 10 | 3 Fechamentos | Impermeabilização dos vestiários | 3 | 7 | — |
| 11 | 3 | Contrapiso e regularização | 4 | 7, 10 | — |
| 12 | 3 | Forro de gesso | 8 | 5, 6, 8, 9 | Contratação · Empreiteiro de forro · 7; Compra · Placas de gesso, perfis e tirantes · 7 |
| 13 | 3 | Revestimento cerâmico vestiários | 6 | 11 | Contratação · Azulejista · 5; Compra · Porcelanato e argamassa · 10 |
| 14 | 3 | Fechamento em drywall | 4 | 4, 5 | Compra · Placas de drywall · 7 |
| 15 | 4 Acabamentos | Emassamento | 6 | 12, 14 | Contratação · Pintor (massa e pintura) · 7; Compra · Massa corrida e lixas · 3 |
| 16 | 4 | Pintura | 6 | 15 | Compra · Tintas · 5 |
| 17 | 4 | Piso emborrachado e vinílico | 5 | 11, 16 | Contratação · Instalador de piso · 7; Compra · Piso emborrachado e vinílico · 15 |
| 18 | 4 | Louças e metais | 3 | 13 | — |
| 19 | 4 | Bancadas e divisórias | 3 | 13 | — |
| 20 | 4 | Esquadrias, vidros e espelhos | 4 | 16 | — |
| 21 | 5 Instalações finais | Luminárias e acabamento elétrico | 4 | 16 | Compra · Luminárias · 15 |
| 22 | 5 | Evaporadoras e start-up do ar | 3 | 12, 16 | Compra · Evaporadoras · 15 |
| 23 | 5 | Comunicação visual e fachada | 4 | 16 | Contratação · Comunicação visual · 15 |
| 24 | 5 | Catraca, CFTV e som | 3 | 21 | — |
| 25 | 6 Entrega | Equipamentos de academia | 3 | 17 | Locação · Caminhão munck · 5 |
| 26 | 6 | Limpeza fina | 2 | 18–25 | — |
| 27 | 6 | Vistoria e punch list | 2 | 26 | — |
| 28 | 6 | Entrega à operação | 1 | 27 | — |

Prazos médios são **provisórios** (questão Q6 do PRD): substituir pelo histórico real antes do piloto.

---

## Anexo B — Melhoria futura E1: Maquete 3D (NÃO implementar na v1)

Fica registrado para o estudo de viabilidade (PRD §11). Nada desta seção entra em migrations, rotas ou telas da v1.

### B.1 Proposta técnica (`apps/web/maquete`)
- **Render:** Three.js (WebGL) no cliente, com sombras suaves, câmera orbital própria (arrastar, pinça, roda) e raycast para tocar nas peças. Texturas procedurais (vinílico, borracha, pista, porcelanato, concreto, chapa canelada, parede verde) para não depender de imagens pesadas. Meta: 60 fps em celular médio, ≤ 2 MB por maquete.
- **Coordenadas da planta:** x à direita, z da rua para o fundo, y para cima, em metros; a cena espelha x para a mão correta do WebGL.
- **Dados:**
```
maquete_base(id, nome, origem_pdf_path, pranchas int, criada_por, status: 'rascunho'|'conferida')
maquete_peca(id, base_id, chave_atividade text,                  -- liga à atividade do modelo pelo nome canônico
             modo: 'construir'|'remover'|'temporaria'|'entre', etapas jsonb,   -- [{atividade, material}], ex.: alvenaria→massa→pintura
             fim_atividade text null, nivel: 'terreo'|'alto', geometria jsonb, quantidade text null)
obra.maquete_base_id → maquete_base
```
- **Estado de uma peça** (função pura no core): `construir` → material da última etapa concluída, senão "prevista"; `remover` → some quando a atividade conclui; `temporaria` → aparece na atividade e some no `fim_atividade` (tapume até a limpeza fina); `entre` → visível entre duas atividades (entulho).
- **Animação:** peça nova cresce de baixo (easeOutBack, 750 ms, escalonada); troca de etapa faz pulso curto; remoção encolhe. Concluir a atividade foca a câmera na peça. Entrega liga o modo noite.
- **Importação do PDF (assistida, não mágica):** 1) extrair texto e vetores das pranchas (pdf.js/PyMuPDF) e identificar pranchas pelo carimbo; 2) ler legendas e quadros (ex.: "PISO VINÍLICO 3MM 803,80 m²", "PISO BORRACHA 100×100 308,00 m²", "PORCELANATO 60×60 CEMENTO GRIGIO 55,44 m²"); 3) detectar contorno, paredes, pilares e ambientes da planta de layout (polígonos e textos de ambiente) com ajuda de IA de visão; 4) montar a proposta de peças com escala e cotas; 5) **o gestor confere e ajusta** num editor simples antes de `status = conferida`. Sem conferência, a obra usa a maquete padrão CDC. Preferir DWG/IFC quando houver.

### B.2 Onde há custo
- **Render no celular:** sem custo de servidor (Three.js, texturas procedurais). Custo é de desenvolvimento e de desempenho.
- **Importação com IA:** custo por chamada de visão em cada prancha (pranchas A0 precisam ser fatiadas para leitura legível), mais extração de texto (sem custo de IA). Medir no estudo: pranchas por unidade, chamadas por prancha, custo por unidade e taxa de acerto antes da conferência.
- **Sem IA:** maquete padrão por modelo de obra, montada uma vez; custo recorrente zero.
