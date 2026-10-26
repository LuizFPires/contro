# PILOTO · prontidão para o go-live

O que já funciona, o que **trava** o piloto e o que é débito conhecido. Objetivo do
piloto (M10): uma obra real do início ao fim, com reunião e boletim pelo app por 4 semanas.

## Pronto (M0–M8)
- **Login** e dois perfis (gestor / equipe de obra), com RLS no servidor.
- **Modelos** de obra (3 no seed) editáveis no celular; obra é **cópia** do modelo.
- **Obra**: trilha de fases, cronograma em dias úteis, liberação por predecessoras +
  providências, conclusão **com foto**.
- **Providências** (contratação/locação/compra) com atraso em vermelho.
- **Pendências**: apontar com foto, fila com swipe, resolver com **ghost do antes**,
  adiar com Desfazer, **vistoria** (quem resolveu não aprova — regra 5).
- **Cronograma/indicadores**: Gantt por fase, % real/previsto, ritmo, tarja de Inauguração;
  editar duração/predecessoras.
- **Tarefas**: por responsável, concluir num toque com Desfazer, replanejamento rastreado.
- **Reunião** semanal: pauta por obra, nova providência/tarefa, **ata HTML imprimível** +
  WhatsApp.
- **Boletim** semanal: texto de WhatsApp + prévia + imprimir/PDF.

## Bloqueadores do go-live (fazer antes do piloto)
Dependem de acesso do usuário (Supabase/Vercel) — ver **DEPLOY.md**:
- [x] **Migrations** aplicadas em produção (as 36, até a do cadastro por e-mail) e o histórico registrado com `supabase migration repair` em 26/10/2026. Daqui em diante, migration nova sobe com `npx supabase db push`.
- [x] **pg_cron** ligado e os 3 jobs agendados em 26/10/2026: `pendencia-devolver-adiadas` (00:10 UTC), `reuniao-abrir-pauta` (seg 15:30 UTC = 12:30 de Brasília) e `boletim-gerar-disparos` (a cada 15 min). O pg_cron roda em UTC.
- [x] **Vercel**: env configurado e deploy automático a cada merge no `main`.
- [x] **Auth** e-mail/senha ligado; 2 gestores e 1 pessoa da equipe ativos; bucket `fotos` criado.
- [ ] Fumaça em produção: criar obra, concluir atividade com foto, apontar e vistoriar pendência, abrir reunião e gerar ata, abrir boletim (até 26/10/2026, nenhuma atividade tinha sido concluída com foto em produção).
- [ ] Push do boletim automático: gerar VAPID, `VITE_VAPID_PUBLIC_KEY` na Vercel, segredos e deploy da função `enviar-push-boletim`, ligar `pg_net` (runbook em `supabase/functions/enviar-push-boletim/README.md`). Sem isso, os boletins prontos aparecem só na lista "prontos para enviar" do início.

## Débitos conhecidos (não travam o piloto)
- **PDF** por HTML imprimível; `pdf-service` (Playwright, SPEC §8.2) não implementado.
- **Push** e crons de boletim (seg 06:30 / sex 17:00) — o boletim abre sob demanda.
- **Offline**: ações de campo esperam o servidor (sem fila Dexie) → milestone dedicado
  **M9-offline** (fila idempotente, upload em 2º plano, conflitos, "x aguardando sinal").
- **"Quem faz o quê"** da ata/boletim: só tarefas por responsável; fontes engenheiro/compras
  (§4.7) dependem de decisão de produto (como identificar esses papéis por obra).
- **Desfazer** em edições (início/prestador/duração/predecessoras/edição de tarefa) e o
  otimismo de UI entram com o M9-offline.
- **"Providências anteriores"** na reunião (requer a reunião anterior).
- **Paginar "Concluídas"** nas pendências; **E2E** (SPEC §12) e **testes de RLS por perfil**
  no CI (precisa de Docker/Supabase local); auditoria **Lighthouse ≥ 90**.
- Protótipos em `prototipo/*.html` ainda citam "contro" (snapshot aprovado, não alterado).

## Piloto (M10)
- [ ] Criar a obra piloto (equipe se cadastra pelo uso, com sugestões).
- [ ] Treinamento de 30 min (gestor + equipe).
- [ ] 4 semanas com reunião e boletim pelo app.
- [ ] Medir as métricas do PRD §3; coletar ajustes.
- [ ] Decidir Q2 (peso do %) e Q4 (prestador).
