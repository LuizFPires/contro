# CONTRO — Design System v1.0

**Produto:** CONTRO — Obras da Contorno  
**Objetivo:** gestão e acompanhamento das obras das unidades Contorno do Corpo.  
**Fonte visual:** captura de tela da marca Contorno do Corpo enviada pelo usuário em 24/10/2026.

## 1. Princípios
1. Identidade fiel à Contorno: somente turquesa, preto e branco.
2. Clareza em campo: interfaces legíveis em telas pequenas e ambientes externos.
3. Controle rápido: unidades, obras, vistorias, projetos e pendências em poucos toques.
4. Consistência: mesmos padrões de navegação, status e ações em todas as telas.

## 2. Cores oficiais de interface
As amostras abaixo foram extraídas diretamente dos pixels dominantes da imagem de referência, e **não** de um manual institucional. Confirmar com a marca antes de produção final.

| Token | HEX | RGB | Aplicação |
|---|---|---|---|
| `brand.turquoise` | `#54B4B0` | 84, 180, 176 | Ações primárias, seleção, progresso |
| `brand.black` | `#181818` | 24, 24, 24 | Cabeçalhos, fundo escuro, textos |
| `brand.white` | `#FFFFFF` | 255, 255, 255 | Superfícies, textos sobre preto |

**Regra absoluta:** não introduzir azul ou outras cores no logotipo, no ícone, nos gráficos, nas telas ou nos indicadores. Variações de opacidade das três cores são permitidas para estados de interface.

### Tokens semânticos
- `background.default`: branco
- `background.inverse`: preto
- `surface.default`: branco
- `surface.selected`: turquesa com 12% de opacidade sobre branco
- `text.primary`: preto
- `text.inverse`: branco
- `text.muted`: preto com 60% de opacidade
- `border.default`: preto com 14% de opacidade
- `action.primary.bg`: turquesa
- `action.primary.text`: preto
- `action.inverse.bg`: preto
- `action.inverse.text`: branco
- `focus.ring`: turquesa
- `progress.track`: preto com 12% de opacidade
- `progress.fill`: turquesa

## 3. Identidade CONTRO
- Nome sempre em maiúsculas: **CONTRO**.
- Descritivo: **obras da contorno**.
- Monograma: preservar geometria contínua do símbolo aprovado pelo usuário, originalmente mostrado em fundo azul. **A geometria é aprovada; as cores originais não são.**
- Ícone oficial adaptado: quadrado preto de cantos arredondados, símbolo branco com segmento turquesa.
- Versão principal: lettering branco com detalhe turquesa em fundo preto.
- Versão clara: lettering preto com detalhe turquesa em fundo branco.
- Não esticar, rotacionar, sombrear, recolorir fora da paleta ou adicionar gradientes azuis.
- O arquivo de referência aprovado é uma imagem raster; vetorizar manualmente para garantir fidelidade geométrica antes de gerar o SVG mestre.

## 4. Tipografia
- Interface: **Nunito Sans** (sugestão, a confirmar em protótipo).
- Títulos: 700–800; corpo: 400–600; números de indicadores: 800.
- Escala: display 32/38, h1 24/30, h2 20/26, h3 17/24, body 16/24, body-sm 14/20, caption 12/16.
- Evitar textos de interface menores que 12 px.

## 5. Espaçamento, formas e ícones
- Unidade base: 4 px; escala: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Cantos: campo 12 px, card 16 px, modal 20 px, ícone do app 24% do lado.
- Botões: mínimo 48 px de altura; alvos de toque de pelo menos 44×44 px.
- Ícones: estilo linear arredondado, traço de 1.8–2 px, grade 24×24 px.
- Sombras discretas apenas com preto translúcido.

## 6. Componentes
### Botões
- Primário: fundo turquesa, texto preto, peso 700.
- Secundário: fundo preto, texto branco.
- Terciário: fundo transparente, texto preto, borda preta translúcida.
- Desabilitado: preto 8% sobre branco, texto preto 35%; nunca depender só da cor.

### Campos e filtros
- Altura mínima 48 px; rótulo acima do campo; texto de ajuda opcional.
- Busca global por unidade, obra, disciplina, documento e responsável.
- Filtro de unidades em seletor destacado no topo.

### Cards
- Branco, borda preta 10%, raio 16 px; título, etapa, progresso, data e responsável.
- Card principal pode conter fotografia real da unidade; sobreposição preta para legibilidade.

### Indicadores
- Exibir valor + legenda + período; progresso em barra turquesa com percentual numérico.
- Situações: **Planejada**, **Em execução**, **Em vistoria**, **Pendente**, **Concluída**, **Paralisada**.
- Distinguir estados com texto, ícone e padrão; não apenas pela cor.

### Feedback
- Sucesso: ícone de check e texto explícito, usando turquesa.
- Atenção: ícone de alerta e texto em preto, sem amarelo.
- Erro: ícone de erro e texto explicativo, sem vermelho.
- Carregamento: indicador turquesa e skeleton em preto translúcido.

## 7. Navegação
Barra inferior móvel com até cinco destinos: **Início**, **Obras**, **Vistorias**, **Projetos**, **Mais**. No desktop, converter para menu lateral. A seleção ativa usa turquesa + rótulo.

## 8. Telas principais
1. **Login:** ícone aprovado, acesso institucional e recuperação de senha.
2. **Início:** seletor de unidade, indicadores, andamento, pendências e atalhos.
3. **Obras:** lista e filtros por unidade, cidade, etapa, responsável e situação.
4. **Detalhe da obra:** fotos, cronograma, marcos, responsáveis, histórico e documentos.
5. **Vistorias:** checklist, fotos, observações, responsáveis e assinatura.
6. **Não conformidades:** registro, criticidade textual, prazo, evidências e resolução.
7. **Projetos:** disciplinas, revisões, visualização e compartilhamento controlado.
8. **Medições:** evolução física, quantitativos e registros de aprovação.
9. **Relatórios:** consolidados por unidade, período, equipe e status.
10. **Mais:** usuários, permissões, notificações e configurações.

## 9. Acessibilidade
- Contraste mínimo WCAG AA para textos (4,5:1 em texto normal, 3:1 em texto grande).
- Não usar branco sobre turquesa para textos pequenos sem validação; preferir preto.
- Estados de erro, alerta e conclusão sempre com rótulo e ícone.
- Respeitar aumento de fonte e navegação por teclado.
- Testar em iPhone e Android sob luminosidade externa.

## 10. Tokens CSS de referência
```css
:root {
  --obdc-turquoise: #54B4B0;
  --obdc-black: #181818;
  --obdc-white: #FFFFFF;
  --obdc-text: var(--obdc-black);
  --obdc-bg: var(--obdc-white);
  --obdc-border: rgb(24 24 24 / 14%);
  --obdc-muted: rgb(24 24 24 / 60%);
  --obdc-selected: rgb(84 180 176 / 12%);
  --obdc-radius-field: 12px;
  --obdc-radius-card: 16px;
  --obdc-space-unit: 4px;
  --obdc-font: 'Nunito Sans', sans-serif;
}
```

## 11. Critérios de aceite
- [ ] Apenas turquesa, preto e branco no sistema e na marca.
- [ ] Ícone usa geometria do símbolo aprovado, sem fundo azul.
- [ ] Tipografia em maiúsculas no logotipo.
- [ ] Componentes consistentes em mobile e desktop.
- [ ] Todos os indicadores têm rótulos e valores legíveis.
- [ ] Fluxos de obra e vistoria funcionam com poucos toques.
- [ ] Contraste e estados de interação testados.

**Nota:** valores de cores obtidos da captura de tela são aproximados e podem variar em relação aos arquivos oficiais da Contorno do Corpo.
