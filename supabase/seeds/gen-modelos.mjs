// Gera supabase/seeds/modelos.sql (Modelos 1, 2 e 3 do Anexo A) com UUIDs fixos.
// Reexecutar regenera os UUIDs; o SQL usa ON CONFLICT DO NOTHING (idempotente por id).
//   node supabase/seeds/gen-modelos.mjs > supabase/seeds/modelos.sql
import { randomUUID } from 'node:crypto';

const FASES = [
  'Mobilização',
  'Infraestrutura',
  'Fechamentos',
  'Acabamentos',
  'Instalações finais',
  'Entrega',
];

// tipo: l=locacao, c=contratacao, p=compra
const prov = (tipo, descricao, antecedencia_du) => ({ tipo, descricao, antecedencia_du });
const L = (d, a) => prov('locacao', d, a);
const C = (d, a) => prov('contratacao', d, a);
const P = (d, a) => prov('compra', d, a);

// Modelo 1 · CDC completo (Anexo A). fase = índice 1..6.
const MODELO_1 = [
  {
    id: '1',
    fase: 1,
    nome: 'Mobilização e tapumes',
    dur: 2,
    preds: [],
    provs: [
      L('Tapumes e container de obra', 3),
      C('Empreiteiro civil (contrato global MO+material)', 20),
      L('Banheiro químico', 3),
      L('Betoneira', 3),
    ],
  },
  {
    id: '2',
    fase: 1,
    nome: 'Demolições e retiradas',
    dur: 5,
    preds: ['1'],
    subs: [
      { id: '2.1', nome: 'Demolição de alvenaria', dur: 2, seq: true },
      { id: '2.2', nome: 'Demolição de forro', dur: 2, seq: false },
      { id: '2.3', nome: 'Demolição de piso', dur: 3, seq: true },
    ],
    provs: [
      L('Caçambas de entulho', 2),
      C('Equipe de demolição', 5),
      L('Martelete / rompedor', 2),
    ],
  },
  { id: '3', fase: 1, nome: 'Limpeza e bota-fora', dur: 2, preds: ['2'] },
  {
    id: '4',
    fase: 2,
    nome: 'Alvenarias e novos fechamentos',
    dur: 6,
    preds: ['3'],
    provs: [
      C('Pedreiro (alvenaria)', 5),
      P('Blocos e argamassa', 5),
      L('Caçamba (limpeza permanente)', 2),
    ],
  },
  {
    id: '5',
    fase: 2,
    nome: 'Infra de elétrica',
    dur: 8,
    preds: ['3'],
    provs: [C('Eletricista', 7), P('Cabos, eletrodutos e quadros', 7)],
  },
  {
    id: '6',
    fase: 2,
    nome: 'Infra de ar-condicionado',
    dur: 6,
    preds: ['3'],
    provs: [
      C('Instaladora de ar-condicionado', 10),
      P('Tubulação frigorígena e drenos', 7),
      P('Equipamentos de ar-condicionado (evaporadoras/condensadoras)', 30),
    ],
  },
  {
    id: '7',
    fase: 2,
    nome: 'Água fria e esgoto',
    dur: 6,
    preds: ['3'],
    provs: [C('Encanador', 5), P('Tubos e conexões', 5)],
  },
  { id: '8', fase: 2, nome: 'Infra de dados, CFTV e som', dur: 4, preds: ['5'] },
  {
    id: '9',
    fase: 2,
    nome: 'Infra de incêndio',
    dur: 5,
    preds: ['3'],
    provs: [
      C('Empresa de incêndio (sprinkler)', 10),
      P('Materiais de incêndio (sprinklers e tubulação)', 10),
    ],
  },
  { id: '10', fase: 3, nome: 'Impermeabilização dos vestiários', dur: 3, preds: ['7'] },
  {
    id: '11',
    fase: 3,
    nome: 'Contrapiso e regularização',
    dur: 4,
    preds: ['7', '10'],
    provs: [P('Areia, brita e cimento', 3)],
  },
  {
    id: '12',
    fase: 3,
    nome: 'Forro de gesso',
    dur: 8,
    preds: ['5', '6', '8', '9'],
    provs: [C('Empreiteiro de forro', 7), P('Placas de gesso, perfis e tirantes', 7)],
  },
  {
    id: '13',
    fase: 3,
    nome: 'Revestimento cerâmico vestiários',
    dur: 6,
    preds: ['11'],
    provs: [C('Azulejista', 5), P('Porcelanato e argamassa', 10)],
  },
  {
    id: '14',
    fase: 3,
    nome: 'Fechamento em drywall',
    dur: 4,
    preds: ['4', '5'],
    provs: [P('Placas de drywall', 7)],
  },
  {
    id: '15',
    fase: 4,
    nome: 'Emassamento',
    dur: 6,
    preds: ['12', '14'],
    provs: [C('Pintor (massa e pintura)', 7), P('Massa corrida e lixas', 3)],
  },
  { id: '16', fase: 4, nome: 'Pintura', dur: 6, preds: ['15'], provs: [P('Tintas', 5)] },
  {
    id: '17',
    fase: 4,
    nome: 'Piso emborrachado e vinílico',
    dur: 5,
    preds: ['11', '16'],
    provs: [C('Instalador de piso', 7), P('Piso emborrachado e vinílico', 15)],
  },
  { id: '18', fase: 4, nome: 'Louças e metais', dur: 3, preds: ['13'] },
  {
    id: '19',
    fase: 4,
    nome: 'Bancadas e divisórias',
    dur: 3,
    preds: ['13'],
    provs: [C('Marmoraria (granito e pedras)', 25), P('Granito e pedras (corte sob medida)', 25)],
  },
  {
    id: '20',
    fase: 4,
    nome: 'Esquadrias, vidros e espelhos',
    dur: 4,
    preds: ['16'],
    provs: [C('Esquadrias de alumínio e vidraçaria', 30)],
  },
  {
    id: '21',
    fase: 5,
    nome: 'Luminárias e acabamento elétrico',
    dur: 4,
    preds: ['16'],
    provs: [P('Luminárias', 20)],
  },
  {
    id: '22',
    fase: 5,
    nome: 'Evaporadoras e start-up do ar',
    dur: 3,
    preds: ['12', '16'],
    provs: [C('Start-up e instalação do ar-condicionado', 7)],
  },
  {
    id: '23',
    fase: 5,
    nome: 'Comunicação visual e fachada',
    dur: 4,
    preds: ['16'],
    provs: [C('Comunicação visual', 15), C('Paisagismo', 10)],
  },
  { id: '24', fase: 5, nome: 'Catraca, CFTV e som', dur: 3, preds: ['21'] },
  {
    id: '25',
    fase: 6,
    nome: 'Equipamentos de academia',
    dur: 3,
    preds: ['17'],
    provs: [L('Caminhão munck', 5), P('Enxoval CDC — equipamentos e mobiliário', 30)],
  },
  {
    id: '26',
    fase: 6,
    nome: 'Limpeza fina',
    dur: 2,
    preds: ['18', '19', '20', '21', '22', '23', '24', '25'],
  },
  { id: '27', fase: 6, nome: 'Vistoria e punch list', dur: 2, preds: ['26'] },
  { id: '28', fase: 6, nome: 'Entrega à operação', dur: 1, preds: ['27'] },
];

// Deriva um modelo removendo atividades; quem dependia herda as predecessoras.
function derivar(base, remover, overrides = {}) {
  const rem = new Set(remover);
  const byId = new Map(base.map((a) => [a.id, a]));
  const preds = (id) => {
    const out = [];
    for (const p of byId.get(id)?.preds ?? []) {
      if (rem.has(p)) out.push(...preds(p));
      else out.push(p);
    }
    return [...new Set(out)];
  };
  return base
    .filter((a) => !rem.has(a.id))
    .map((a) => {
      let na = { ...a, preds: preds(a.id) };
      if (overrides[a.id]) na = { ...na, ...overrides[a.id] };
      return na;
    });
}

const MODELO_2 = derivar(MODELO_1, ['10', '13', '18', '19']);
const MODELO_3 = derivar(MODELO_1, ['4', '9', '10', '11', '13', '18', '19'], {
  2: { nome: 'Retiradas pontuais', dur: 2, subs: undefined },
});

const esc = (s) => s.replace(/'/g, "''");

function emitModelo(nome, subtitulo, ordem, atividades) {
  const mid = randomUUID();
  const faseIds = {}; // índice -> uuid (só as fases usadas)
  for (const a of atividades) if (!faseIds[a.fase]) faseIds[a.fase] = randomUUID();
  const atvId = {}; // ext -> uuid (atividades de topo)
  for (const a of atividades) atvId[a.id] = randomUUID();

  const out = [];
  out.push(`-- ${nome}`);
  out.push(
    `insert into modelo (id, nome, subtitulo, ordem) values ('${mid}', '${esc(nome)}', '${esc(subtitulo)}', ${ordem}) on conflict (id) do nothing;`,
  );
  const fasesUsadas = [...new Set(atividades.map((a) => a.fase))].sort((x, y) => x - y);
  for (const f of fasesUsadas) {
    out.push(
      `insert into modelo_fase (id, modelo_id, ordem, titulo) values ('${faseIds[f]}', '${mid}', ${f}, '${esc(FASES[f - 1])}') on conflict (id) do nothing;`,
    );
  }
  let ordem_atv = 0;
  for (const a of atividades) {
    ordem_atv += 1;
    out.push(
      `insert into modelo_atividade (id, modelo_id, fase_id, ordem, nome, duracao_du) values ('${atvId[a.id]}', '${mid}', '${faseIds[a.fase]}', ${ordem_atv}, '${esc(a.nome)}', ${a.dur}) on conflict (id) do nothing;`,
    );
    let os = 0;
    for (const s of a.subs ?? []) {
      os += 1;
      const sid = randomUUID();
      out.push(
        `insert into modelo_atividade (id, modelo_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia) values ('${sid}', '${mid}', '${faseIds[a.fase]}', ${os}, '${esc(s.nome)}', ${s.dur}, '${atvId[a.id]}', ${s.seq}) on conflict (id) do nothing;`,
      );
    }
  }
  for (const a of atividades) {
    for (const p of a.preds ?? []) {
      if (!atvId[p]) continue;
      out.push(
        `insert into modelo_dependencia (modelo_id, atividade_id, predecessora_id) values ('${mid}', '${atvId[a.id]}', '${atvId[p]}') on conflict do nothing;`,
      );
    }
    for (const pr of a.provs ?? []) {
      out.push(
        `insert into modelo_providencia (id, modelo_id, atividade_id, tipo, descricao, antecedencia_du) values ('${randomUUID()}', '${mid}', '${atvId[a.id]}', '${pr.tipo}', '${esc(pr.descricao)}', ${pr.antecedencia_du}) on conflict (id) do nothing;`,
      );
    }
  }
  out.push('');
  return out.join('\n');
}

const sql = [
  '-- Seed de HOMOLOGAÇÃO dos modelos de obra (Anexo A). Gerado por gen-modelos.mjs.',
  '-- Modelos 1 (CDC completo), 2 (CDC sem vestiários) e 3 (Retrofit leve).',
  '',
  emitModelo('Modelo 1 · CDC completo', 'reforma pesada', 1, MODELO_1),
  emitModelo('Modelo 2 · CDC sem vestiários', 'reforma média', 2, MODELO_2),
  emitModelo('Modelo 3 · Retrofit leve', 'retrofit', 3, MODELO_3),
].join('\n');

process.stdout.write(sql);
