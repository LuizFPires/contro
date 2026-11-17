import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  FREQUENCIAS,
  aguardaGestor,
  checkinValido,
  frequenciaEm,
  linhasCarimbo,
  rotuloDia,
  segundaDa,
  situacaoLocal,
  textoDistancia,
  textoFrequencia,
  type Coordenada,
  type FrequenciaCheckin,
} from '@contro/core';
import { BottomSheet, Icon, useToast } from '@contro/ui';
import { enfileirar } from '../../lib/sync';
import type { PessoaAtual } from '../perfil/usePerfil';
import { Camera } from '../obras/Camera';
import { guardarFotoCarimbada, removerFotoLocal } from '../obras/foto';
import { hojeISO } from '../obras/api';
import { PAPEL, chaveCheckins, useCheckins, type Checkin, type DadosCheckin } from './api';
import styles from './CheckinAba.module.css';

const p2 = (n: number) => String(n).padStart(2, '0');
const hora = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const DL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dataLonga = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DL[dt.getDay()]}, ${p2(d)}/${p2(m)}/${a}`;
};
const ontemDe = (hoje: string) => {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

interface FotoTirada {
  localId: string;
  url: string;
  tiradaEm: string;
}

/** Aba Check-in da obra (protótipo aprovado em 17/11/2026). */
export function CheckinAba({
  obraId,
  obraNome,
  perfil,
}: {
  obraId: string;
  obraNome: string;
  perfil: PessoaAtual | null | undefined;
}) {
  const { data, isLoading, isError } = useCheckins(obraId);
  const qc = useQueryClient();
  const { showToast } = useToast();
  const hoje = hojeISO();
  const gestor = perfil?.perfil === 'gestor';
  const [etapa, setEtapa] = useState<'camera' | 'conferir' | null>(null);
  const [fotos, setFotos] = useState<FotoTirada[]>([]);
  const [obs, setObs] = useState('');
  const [local, setLocal] = useState<(Coordenada & { precisao: number }) | null>(null);
  const [semLocal, setSemLocal] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [freqAberta, setFreqAberta] = useState(false);
  const watch = useRef<number | null>(null);

  // Relógio do carimbo ao vivo e localização enquanto o check-in está aberto.
  useEffect(() => {
    if (!etapa) return;
    const t = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(t);
  }, [etapa]);
  useEffect(() => {
    if (!etapa || watch.current != null || !navigator.geolocation) {
      if (etapa && !navigator.geolocation) setSemLocal(true);
      return;
    }
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setSemLocal(false);
        setLocal((atual) =>
          !atual || p.coords.accuracy <= atual.precisao
            ? { lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }
            : atual,
        );
      },
      () => setSemLocal(true),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
  }, [etapa]);
  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    },
    [],
  );
  const pararLocal = () => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
  };

  const nomeEu = perfil?.nome ?? '';
  const carimbo = linhasCarimbo(obraNome, nomeEu, agora);

  async function capturar(file: File) {
    if (fotos.length >= 10) return;
    const quando = new Date();
    try {
      const { localId, blob } = await guardarFotoCarimbada(
        obraId,
        file,
        linhasCarimbo(obraNome, nomeEu, quando),
      );
      setFotos((fs) => [
        ...fs,
        { localId, url: URL.createObjectURL(blob), tiradaEm: quando.toISOString() },
      ]);
    } catch {
      showToast({ message: 'Não foi possível guardar a foto. Tente de novo.' });
    }
  }

  async function cancelar() {
    for (const f of fotos) {
      URL.revokeObjectURL(f.url);
      await removerFotoLocal(f.localId).catch(() => {});
    }
    setFotos([]);
    setObs('');
    setEtapa(null);
    pararLocal();
  }

  function remover(i: number) {
    const f = fotos[i];
    URL.revokeObjectURL(f.url);
    void removerFotoLocal(f.localId).catch(() => {});
    const resto = fotos.filter((_, k) => k !== i);
    setFotos(resto);
    if (!resto.length) setEtapa('camera');
  }

  const previa = situacaoLocal(data?.ponto ?? null, local);

  async function confirmar() {
    if (!fotos.length || !perfil) return;
    const id = crypto.randomUUID();
    const feitoEm = fotos[0].tiradaEm;
    const novo: Checkin = {
      id,
      obraId,
      pessoaId: perfil.id,
      pessoaNome: perfil.nome,
      papel: perfil.coordenadorContorno ? 'Coordenador' : (PAPEL[perfil.perfil] ?? 'Equipe'),
      feitoEm,
      dia: hoje,
      enviadoDepois: false,
      ajusteRelogioS: 0,
      situacao: previa.situacao,
      distanciaM: previa.distancia,
      observacao: obs.trim() || null,
      validacao: null,
      validadoPorNome: null,
      pendente: true,
      fotos: fotos.map((f, i) => ({
        fotoId: f.localId,
        ordem: i,
        tiradaEm: f.tiradaEm,
        url: null,
        localUrl: f.url,
      })),
    };
    qc.setQueryData<DadosCheckin>(chaveCheckins(obraId), (d) =>
      d ? { ...d, checkins: [novo, ...d.checkins] } : d,
    );
    await enfileirar('registrar_checkin', {
      id,
      obraId,
      feitoEm,
      lat: local?.lat ?? null,
      lng: local?.lng ?? null,
      precisao: local?.precisao ?? null,
      observacao: obs.trim() || null,
      fotos: fotos.map((f, i) => ({ localId: f.localId, tiradaEm: f.tiradaEm, ordem: i })),
    });
    setFotos([]);
    setObs('');
    setEtapa(null);
    pararLocal();
    showToast({ message: `Check-in registrado às ${hora(feitoEm)}` });
  }

  function validar(c: Checkin, valido: boolean) {
    qc.setQueryData<DadosCheckin>(chaveCheckins(obraId), (d) =>
      d
        ? {
            ...d,
            checkins: d.checkins.map((x) =>
              x.id === c.id
                ? {
                    ...x,
                    validacao: valido ? 'validado' : 'nao_validado',
                    validadoPorNome: perfil?.nome ?? null,
                  }
                : x,
            ),
          }
        : d,
    );
    void enfileirar('validar_checkin', { id: c.id, valido, obraId });
    showToast({ message: valido ? 'Check-in validado' : 'Check-in não validado' });
  }

  function definirFrequencia(pessoaId: string, frequencia: FrequenciaCheckin) {
    qc.setQueryData<DadosCheckin>(chaveCheckins(obraId), (d) =>
      d
        ? {
            ...d,
            pessoas: d.pessoas.map((p) =>
              p.pessoaId === pessoaId
                ? {
                    ...p,
                    frequencias: [
                      ...p.frequencias.filter((f) => f.desde !== hoje),
                      { desde: hoje, frequencia },
                    ],
                  }
                : p,
            ),
          }
        : d,
    );
    void enfileirar('definir_frequencia_checkin', { obraId, pessoaId, frequencia });
  }

  const checkins = useMemo(() => data?.checkins ?? [], [data?.checkins]);
  const deHoje = checkins.filter((c) => c.dia === hoje);
  const meus = deHoje.filter((c) => c.pessoaId === perfil?.id);
  const ultimoMeu = meus[0];

  // Esperados hoje: todo dia útil, ou por semana (ainda faltando na semana).
  const esperados = useMemo(() => {
    const seg = segundaDa(hoje);
    return (data?.pessoas ?? [])
      .map((p) => ({ p, f: frequenciaEm(p.frequencias, hoje) }))
      .filter(({ f }) => f !== 'nao')
      .map(({ p, f }) => {
        const validos = checkins.filter((c) => c.pessoaId === p.pessoaId && checkinValido(c));
        const fezHoje = validos.some((c) => c.dia === hoje);
        const naSemana = new Set(
          validos.filter((c) => c.dia >= seg && c.dia <= hoje).map((c) => c.dia),
        ).size;
        const diario = f === 'diario';
        return {
          id: p.pessoaId,
          nome: p.nome,
          ok: diario ? fezHoje : naSemana >= Number(f),
          extra: diario ? '' : ` · ${Math.min(naSemana, Number(f))} de ${f} na semana`,
        };
      });
  }, [data?.pessoas, checkins, hoje]);

  const dias = useMemo(() => {
    const m = new Map<string, Checkin[]>();
    for (const c of checkins) m.set(c.dia, [...(m.get(c.dia) ?? []), c]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [checkins]);
  const ontem = ontemDe(hoje);
  const tituloDia = (dia: string) =>
    (dia === hoje
      ? `Hoje · ${rotuloDia(dia)}`
      : dia === ontem
        ? `Ontem · ${rotuloDia(dia)}`
        : rotuloDia(dia)
    ).toUpperCase();

  const detalhe = checkins.find((c) => c.id === detalheId) ?? null;

  if (etapa === 'camera')
    return (
      <Camera
        kicker="Check-in"
        titulo={obraNome}
        carimbo={carimbo}
        onCapturar={(f) => void capturar(f)}
        onCancelar={() => void cancelar()}
        lote={{
          miniaturas: fotos.map((f) => f.url),
          onPronto: () => setEtapa('conferir'),
          semGaleria: true,
        }}
      />
    );

  return (
    <div className={styles.aba}>
      <section className={styles.hoje}>
        <div className={styles.hojeTopo}>
          <div>
            <span className={styles.rotulo}>Hoje na obra</span>
            <strong className={styles.data}>{dataLonga(hoje)}</strong>
          </div>
          <div className={styles.contagem}>
            <b>{deHoje.length}</b>
            <span>{deHoje.length === 1 ? 'check-in' : 'check-ins'}</span>
          </div>
        </div>

        {esperados.length || gestor ? (
          <div className={styles.esperados}>
            <div className={styles.esperadosTopo}>
              <span className={styles.rotulo}>
                {esperados.length
                  ? `Esperados hoje · ${esperados.filter((e) => e.ok).length} de ${esperados.length}`
                  : 'Ninguém com frequência definida'}
              </span>
              {gestor ? (
                <button
                  type="button"
                  className={styles.botaoPilula}
                  onClick={() => setFreqAberta(true)}
                >
                  <Icon name="calendario" size={14} />
                  Frequência
                </button>
              ) : null}
            </div>
            {esperados.length ? (
              <div className={styles.chips}>
                {esperados.map((e) => (
                  <span key={e.id} className={e.ok ? styles.chipOk : styles.chipFalta}>
                    <Icon name={e.ok ? 'check' : 'relogio'} size={13} />
                    {e.nome}
                    {e.extra}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {ultimoMeu ? (
          <p className={styles.meu}>
            <span className={styles.meuIcone}>
              <Icon name="checkGrosso" size={16} />
            </span>
            <span>
              <b>Seu check-in foi às {hora(ultimoMeu.feitoEm)}.</b>{' '}
              {ultimoMeu.fotos.length === 1
                ? '1 foto registrada.'
                : `${ultimoMeu.fotos.length} fotos registradas.`}
            </span>
          </p>
        ) : null}
        <button
          type="button"
          className={styles.fazer}
          disabled={!perfil}
          onClick={() => {
            setFotos([]);
            setEtapa('camera');
          }}
        >
          <Icon name="camera" size={22} />
          {ultimoMeu ? 'Novo check-in' : 'Fazer check-in'}
        </button>
        <p className={styles.nota}>
          <Icon name="cadeado" size={14} />
          Fotos pela câmera do app · data, hora e local do sistema
        </p>
      </section>

      {isLoading ? <p className={styles.vazio}>Carregando…</p> : null}
      {isError ? (
        <p className={styles.vazio} role="alert">
          Não foi possível carregar os check-ins.
        </p>
      ) : null}
      {!isLoading && !isError && !checkins.length ? (
        <p className={styles.vazio}>Nenhum check-in nos últimos 60 dias.</p>
      ) : null}

      {dias.map(([dia, lista]) => (
        <section key={dia} className={styles.dia} aria-label={tituloDia(dia)}>
          <div className={styles.diaTopo}>
            <span className={styles.rotulo}>{tituloDia(dia)}</span>
            <span className={styles.diaQtd}>
              {lista.length === 1 ? '1 check-in' : `${lista.length} check-ins`}
            </span>
          </div>
          {lista.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.card}
              onClick={() => setDetalheId(c.id)}
            >
              <span className={styles.miniatura}>
                {c.fotos[0]?.url || c.fotos[0]?.localUrl ? (
                  <img src={c.fotos[0].url ?? c.fotos[0].localUrl} alt="" />
                ) : (
                  <Icon name="camera" size={20} />
                )}
                {c.fotos.length > 1 ? (
                  <span className={styles.mais}>+{c.fotos.length - 1}</span>
                ) : null}
              </span>
              <span className={styles.cardTexto}>
                <span className={styles.cardLinha}>
                  <b>{c.pessoaId === perfil?.id ? `${c.pessoaNome} (você)` : c.pessoaNome}</b>
                  <b className={styles.hora}>{hora(c.feitoEm)}</b>
                </span>
                <span className={styles.suave}>
                  {c.papel} · {c.fotos.length === 1 ? '1 foto' : `${c.fotos.length} fotos`}
                </span>
                {c.observacao ? <span className={styles.obs}>{c.observacao}</span> : null}
                <Chips c={c} />
              </span>
            </button>
          ))}
        </section>
      ))}

      {/* Conferir antes de registrar */}
      <BottomSheet
        open={etapa === 'conferir'}
        title="Conferir check-in"
        onClose={() => setEtapa('camera')}
      >
        <div className={styles.conferir}>
          <div className={styles.grade}>
            {fotos.map((f, i) => (
              <div key={f.localId} className={styles.fotoConf}>
                <img src={f.url} alt={`Foto ${i + 1} do check-in`} />
                <button
                  type="button"
                  className={styles.remover}
                  aria-label={`Remover foto ${i + 1}`}
                  onClick={() => remover(i)}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
            {fotos.length < 10 ? (
              <button type="button" className={styles.maisFoto} onClick={() => setEtapa('camera')}>
                <Icon name="plus" size={22} />
                Mais uma foto
              </button>
            ) : null}
          </div>
          <dl className={styles.campos}>
            <dt>Quem</dt>
            <dd>{nomeEu}</dd>
            <dt>Quando</dt>
            <dd>{fotos[0] ? `${dataLonga(hoje)} · ${hora(fotos[0].tiradaEm)}` : ''}</dd>
            <dt>Local</dt>
            <dd>
              {!local && !semLocal
                ? 'Pegando a localização…'
                : previa.situacao === 'ponto'
                  ? 'Este check-in marca o ponto da obra'
                  : previa.situacao === 'na_obra'
                    ? `Na obra · ${textoDistancia(previa.distancia ?? 0)} do ponto`
                    : previa.situacao === 'fora'
                      ? `Fora da obra · ${textoDistancia(previa.distancia ?? 0)} · o Gestor valida`
                      : 'Sem localização · o Gestor valida'}
            </dd>
          </dl>
          <p className={styles.trava}>
            <Icon name="cadeado" size={14} />
            Data, hora e localização vêm do sistema no clique da foto e não podem ser editadas.
          </p>
          <label className={styles.campoObs}>
            O que veio fazer (opcional)
            <textarea
              rows={2}
              maxLength={500}
              value={obs}
              placeholder="Ex.: conferir o piso do estacionamento"
              onChange={(e) => setObs(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.fazer}
            disabled={!fotos.length}
            onClick={() => void confirmar()}
          >
            <Icon name="checkGrosso" size={20} />
            Confirmar check-in
          </button>
          <button type="button" className={styles.cancelar} onClick={() => void cancelar()}>
            Descartar
          </button>
        </div>
      </BottomSheet>

      {/* Detalhe */}
      <BottomSheet
        open={detalhe != null}
        title={detalhe ? `Check-in · ${detalhe.pessoaNome}` : ''}
        onClose={() => setDetalheId(null)}
      >
        {detalhe ? (
          <DetalheCheckin c={detalhe} gestor={gestor} onValidar={(v) => validar(detalhe, v)} />
        ) : null}
      </BottomSheet>

      {/* Frequência (Gestor) */}
      <BottomSheet
        open={freqAberta}
        title="Frequência de check-in"
        onClose={() => setFreqAberta(false)}
      >
        <div className={styles.freq}>
          <p className={styles.suave}>
            Quantas vezes cada pessoa precisa fazer check-in <b>nesta obra</b>. Vale a partir de
            hoje e conta no Score em Presença na obra. &quot;Não precisa&quot; não é cobrado.
          </p>
          {(data?.pessoas ?? []).map((p) => {
            const atual = frequenciaEm(p.frequencias, hoje);
            return (
              <div key={p.pessoaId} className={styles.freqPessoa}>
                <div className={styles.cardLinha}>
                  <span>
                    <b>{p.nome}</b> <span className={styles.suave}>· {p.papel}</span>
                  </span>
                  <span className={styles.suave}>{textoFrequencia(atual)}</span>
                </div>
                <div
                  className={styles.opcoes}
                  role="radiogroup"
                  aria-label={`Frequência de ${p.nome}`}
                >
                  {FREQUENCIAS.map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      role="radio"
                      aria-checked={atual === o.valor}
                      className={atual === o.valor ? styles.opcaoOn : styles.opcao}
                      onClick={() => definirFrequencia(p.pessoaId, o.valor)}
                    >
                      {o.curto}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className={styles.suave}>
            Por semana: conta até o número de dias pedido, de segunda a sexta. Todo dia útil:
            segunda a sexta.
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}

function Chips({ c }: { c: Checkin }) {
  const fora = c.situacao === 'fora' || c.situacao === 'sem_local';
  if (!fora && !c.enviadoDepois && !c.pendente && c.situacao !== 'ponto') return null;
  return (
    <span className={styles.chips}>
      {c.situacao === 'ponto' ? (
        <span className={styles.chipNeutro}>
          <Icon name="ponto" size={12} />
          Marcou o ponto da obra
        </span>
      ) : null}
      {fora ? (
        <span className={styles.chipFora}>
          <Icon name="alert" size={12} />
          {c.situacao === 'fora'
            ? `Fora da obra · ${textoDistancia(c.distanciaM ?? 0)}`
            : 'Sem localização'}
        </span>
      ) : null}
      {fora ? (
        aguardaGestor(c) ? (
          <span className={styles.chipAguarda}>
            <Icon name="relogio" size={12} />
            Aguarda o Gestor
          </span>
        ) : c.validacao === 'validado' ? (
          <span className={styles.chipOk}>
            <Icon name="check" size={12} />
            Validado pelo Gestor
          </span>
        ) : (
          <span className={styles.chipNeutro}>
            <Icon name="close" size={12} />
            Não validado · não conta
          </span>
        )
      ) : null}
      {c.enviadoDepois ? (
        <span className={styles.chipNeutro}>
          <Icon name="sync" size={12} />
          Enviado depois · hora conferida
        </span>
      ) : null}
      {c.pendente ? (
        <span className={styles.chipNeutro}>
          <Icon name="sync" size={12} />
          Enviando
        </span>
      ) : null}
    </span>
  );
}

function DetalheCheckin({
  c,
  gestor,
  onValidar,
}: {
  c: Checkin;
  gestor: boolean;
  onValidar: (valido: boolean) => void;
}) {
  const [sel, setSel] = useState(0);
  const foto = c.fotos[sel] ?? c.fotos[0];
  const src = foto?.url ?? foto?.localUrl;
  const fora = c.situacao === 'fora' || c.situacao === 'sem_local';
  return (
    <div className={styles.detalhe}>
      <div className={styles.fotoGrande}>
        {src ? <img src={src} alt={`Foto ${sel + 1} do check-in de ${c.pessoaNome}`} /> : null}
      </div>
      {c.fotos.length > 1 ? (
        <div className={styles.miniaturas}>
          {c.fotos.map((f, i) => (
            <button
              key={f.fotoId}
              type="button"
              aria-label={`Ver foto ${i + 1}`}
              aria-pressed={i === sel}
              className={i === sel ? styles.miniOn : styles.mini}
              onClick={() => setSel(i)}
            >
              <img src={f.url ?? f.localUrl} alt="" />
            </button>
          ))}
        </div>
      ) : null}
      <dl className={styles.campos}>
        <dt>Quem</dt>
        <dd>
          {c.pessoaNome} · {c.papel}
        </dd>
        <dt>Quando</dt>
        <dd>
          {dataLonga(c.dia)} · {hora(c.feitoEm)}
        </dd>
        <dt>Local</dt>
        <dd>
          {c.situacao === 'ponto'
            ? 'Marcou o ponto da obra'
            : c.situacao === 'na_obra'
              ? `Na obra · ${textoDistancia(c.distanciaM ?? 0)} do ponto`
              : c.situacao === 'fora'
                ? `A ${textoDistancia(c.distanciaM ?? 0)} do ponto da obra`
                : 'Sem localização'}
        </dd>
        <dt>Fotos</dt>
        <dd>
          {c.fotos.length === 1 ? '1 foto com carimbo' : `${c.fotos.length} fotos com carimbo`}
        </dd>
        {c.observacao ? (
          <>
            <dt>Observação</dt>
            <dd>{c.observacao}</dd>
          </>
        ) : null}
        {c.enviadoDepois ? (
          <>
            <dt>Envio</dt>
            <dd>
              Feito sem internet e enviado depois
              {c.ajusteRelogioS ? ' · hora ajustada ao relógio do servidor' : ' · hora conferida'}
            </dd>
          </>
        ) : null}
      </dl>
      {fora ? (
        <div className={styles.aviso}>
          <p>
            <b>{c.situacao === 'fora' ? 'Check-in fora da obra' : 'Check-in sem localização'}</b>
            <br />
            {c.situacao === 'fora'
              ? `As fotos foram tiradas a ${textoDistancia(c.distanciaM ?? 0)} do ponto da obra (o aceito é até 200 m).`
              : 'O aparelho não informou a localização no momento das fotos.'}
          </p>
          {aguardaGestor(c) ? (
            gestor && !c.pendente ? (
              <>
                <div className={styles.validar}>
                  <button
                    type="button"
                    className={styles.cancelar}
                    onClick={() => onValidar(false)}
                  >
                    Não validar
                  </button>
                  <button type="button" className={styles.fazer} onClick={() => onValidar(true)}>
                    Validar
                  </button>
                </div>
                <p className={styles.suave}>Enquanto isso, não conta na Presença.</p>
              </>
            ) : (
              <p className={styles.suave}>
                Aguarda a validação do Gestor. Até lá, não conta na Presença.
              </p>
            )
          ) : (
            <p className={c.validacao === 'validado' ? styles.decisaoOk : styles.decisao}>
              {c.validacao === 'validado' ? 'Validado' : 'Não validado'}
              {c.validadoPorNome ? ` por ${c.validadoPorNome}` : ''}
              {c.validacao === 'validado' ? ' · conta na Presença' : ' · não conta na Presença'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
