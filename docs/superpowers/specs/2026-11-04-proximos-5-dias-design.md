# Próximos 5 dias nas listas de ações

Data: 04/11/2026 · Estado: aprovado pelo usuário em 04/11/2026

## Intenção e por quê
A seção "Próximos dias" de Tarefas da equipe listava todas as ações futuras (351 na obra real): pouco produtivo. O usuário quer (04/11/2026) **só os próximos 5 dias** (amanhã + 4 dias úteis), **sem** linha "Mais adiante".

## Decisões do usuário
1. Janela de 5 dias úteis a partir de amanhã.
2. O que vence depois não aparece em lugar nenhum da lista.

## Como fica
- Core `acoes.ts`: `classificarAcoes(acoes, hoje, { proximosDU: 5 })` passa a devolver em `proximas` só as abertas com `hoje < prazo <= addDU(hoje, 5)`; o que fica além vai para `depois` (nova chave, não renderizada). Padrão da opção = 5 para não quebrar outros usos; teste com fim de semana (sexta → próximos 5 = seg a sex seguinte).
- `textoResumoSecoes` passa a dizer "N nos próximos 5 dias" no lugar de "N próximas".
- Telas Tarefas da equipe e Minhas ações: seção **"Próximos 5 dias · N"**, mesmo ícone de calendário. Os chips por pessoa continuam contando só atrasadas.
- Push do gestor e tela inicial não mudam (não usam "próximas").
- PRD §5.11, SPEC e PLAN (Decisões).

## Não objetivos
- Sem configuração da janela pelo gestor.
- Sem linha "Mais adiante" nem botão "ver tudo".
