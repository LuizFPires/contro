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
- [ ] Aplicar as **migrations M0–M8** no Supabase (`supabase db push`).
- [ ] Ligar **pg_cron** e agendar os jobs (pauta da reunião; devolver adiadas).
- [ ] Configurar **env** na Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) e **deploy**.
- [ ] Ligar **Auth** e-mail/senha; **promover o primeiro gestor**.
- [ ] Fumaça: criar obra, concluir atividade com foto, abrir reunião e boletim.

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
- Protótipos em `prototipo/*.html` ainda citam "obdc" (snapshot aprovado, não alterado).

## Piloto (M10)
- [ ] Criar a obra piloto (equipe se cadastra pelo uso, com sugestões).
- [ ] Treinamento de 30 min (gestor + equipe).
- [ ] 4 semanas com reunião e boletim pelo app.
- [ ] Medir as métricas do PRD §3; coletar ajustes.
- [ ] Decidir Q2 (peso do %) e Q4 (prestador).
