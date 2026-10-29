import { useEffect, useState } from 'react';
import {
  ANTECEDENCIAS_REUNIAO,
  DIAS_REUNIAO,
  horaLembreteAntes,
  minutosDoDia,
  proximaDataReuniao,
  textoAntecedencia,
} from '@contro/core';
import { Button, Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { hojeISO } from '../obras/api';
import { PADRAO_AVISOS, useConfigAvisos, type ConfigAvisos, type Para } from './useConfigAvisos';
import styles from './ConfigAvisosScreen.module.css';

const HORAS_MANHA = ['07:00', '08:00', '09:00'];

/** Reunião e avisos (gestor): dia/horário da reunião e os avisos por push. */
export function ConfigAvisosScreen({ onVoltar }: { onVoltar: () => void }) {
  const { query, salvar, salvando } = useConfigAvisos();
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<ConfigAvisos>(PADRAO_AVISOS);

  // Sincroniza o formulário com o que veio do servidor.
  useEffect(() => {
    if (query.data) setCfg(query.data);
  }, [query.data]);

  function set<K extends keyof ConfigAvisos>(k: K, v: ConfigAvisos[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }

  async function onSalvar() {
    if (cfg.manhaAtivo && minutosDoDia(cfg.manhaHora) >= minutosDoDia(cfg.reuniaoHora)) {
      showToast({ message: 'O aviso da manhã precisa ser antes do horário da reunião.' });
      return;
    }
    const anterior = query.data ?? PADRAO_AVISOS;
    try {
      await salvar(cfg);
      showToast({
        message: 'Reunião e avisos salvos',
        onUndo: () => {
          setCfg(anterior);
          void salvar(anterior);
        },
      });
    } catch {
      showToast({ message: 'Não foi possível salvar. Tente de novo.' });
    }
  }

  const agora = new Date();
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  const proxima = proximaDataReuniao(hojeISO(), hora, cfg.reuniaoDia, cfg.reuniaoHora);
  const lembretes = [
    cfg.manhaAtivo ? cfg.manhaHora : null,
    cfg.antesAtivo ? horaLembreteAntes(cfg.reuniaoHora, cfg.antesMin) : null,
  ].filter(Boolean);

  return (
    <div className={styles.screen}>
      <div className={styles.barra}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronLeft" size={22} />
        </button>
        <div>
          <div className={styles.titulo}>Reunião e avisos</div>
          <div className={styles.sub}>Só o gestor altera · vale para todas as obras</div>
        </div>
      </div>

      {query.isLoading ? (
        <p className={styles.carregando}>Carregando…</p>
      ) : (
        <div className={styles.form}>
          <h2 className={styles.secao}>Reunião semanal</h2>
          <div className={styles.cartao}>
            <div className={styles.linha}>
              <span className={styles.rotulo}>
                <Icon name="calendario" size={18} /> Dia
              </span>
              <div className={styles.dias} role="radiogroup" aria-label="Dia da reunião">
                {DIAS_REUNIAO.map((d) => (
                  <button
                    key={d.dia}
                    type="button"
                    role="radio"
                    aria-checked={cfg.reuniaoDia === d.dia}
                    className={`${styles.dia} ${cfg.reuniaoDia === d.dia ? styles.on : ''}`}
                    onClick={() => set('reuniaoDia', d.dia)}
                  >
                    {d.curto}
                  </button>
                ))}
              </div>
            </div>
            <label className={styles.linhaHora}>
              <span className={styles.rotulo}>
                <Icon name="relogio" size={18} /> Horário
              </span>
              <input
                type="time"
                className={styles.hora}
                value={cfg.reuniaoHora}
                onChange={(e) => set('reuniaoHora', e.target.value)}
              />
            </label>
          </div>

          <h2 className={styles.secao}>Lembretes da reunião · para todos</h2>
          <div className={styles.cartao}>
            <Aviso
              titulo="No dia, de manhã"
              desc={`às ${cfg.manhaHora} · "Reunião hoje às ${cfg.reuniaoHora}"`}
              ligado={cfg.manhaAtivo}
              onLigar={(v) => set('manhaAtivo', v)}
            >
              <Opcoes
                opcoes={HORAS_MANHA.map((h) => ({ v: h, t: h }))}
                valor={cfg.manhaHora}
                onEscolher={(v) => set('manhaHora', v)}
              />
            </Aviso>
            <Aviso
              titulo="Antes de começar"
              desc={`às ${horaLembreteAntes(cfg.reuniaoHora, cfg.antesMin)} · "Começa em ${textoAntecedencia(cfg.antesMin)}"`}
              ligado={cfg.antesAtivo}
              onLigar={(v) => set('antesAtivo', v)}
            >
              <Opcoes
                opcoes={ANTECEDENCIAS_REUNIAO.map((m) => ({
                  v: String(m),
                  t: textoAntecedencia(m),
                }))}
                valor={String(cfg.antesMin)}
                onEscolher={(v) => set('antesMin', Number(v))}
              />
            </Aviso>
          </div>
          <p className={styles.proxima}>
            Próxima reunião:{' '}
            <b>
              {formatarDataCurta(proxima)} às {cfg.reuniaoHora}
            </b>
            {lembretes.length ? ` · avisos às ${lembretes.join(' e ')}` : ' · sem lembretes'}
          </p>

          <h2 className={styles.secao}>Avisos do dia · seg a sex</h2>
          <div className={styles.cartao}>
            <Aviso
              titulo="Resumo da manhã"
              desc="Obras em andamento e tarefas atrasadas"
              ligado={cfg.resumoAtivo}
              onLigar={(v) => set('resumoAtivo', v)}
            >
              <HoraEPara
                hora={cfg.resumoHora}
                onHora={(v) => set('resumoHora', v)}
                para={cfg.resumoPara}
                onPara={(v) => set('resumoPara', v)}
              />
            </Aviso>
            <Aviso
              titulo="Tarefas que vencem hoje"
              desc="Cada pessoa recebe só as suas"
              ligado={cfg.tarefasAtivo}
              onLigar={(v) => set('tarefasAtivo', v)}
            >
              <HoraEPara hora={cfg.tarefasHora} onHora={(v) => set('tarefasHora', v)} />
            </Aviso>
            <Aviso
              titulo="Providências para começar"
              desc="Lembra de conferir o que contratar, alugar ou comprar"
              ligado={cfg.providAtivo}
              onLigar={(v) => set('providAtivo', v)}
            >
              <HoraEPara
                hora={cfg.providHora}
                onHora={(v) => set('providHora', v)}
                para={cfg.providPara}
                onPara={(v) => set('providPara', v)}
              />
            </Aviso>
          </div>
          <p className={styles.nota}>
            Os avisos chegam no celular de quem ativou "Avisos neste celular" no menu do perfil.
          </p>

          <Button full onClick={onSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Aviso({
  titulo,
  desc,
  ligado,
  onLigar,
  children,
}: {
  titulo: string;
  desc: string;
  ligado: boolean;
  onLigar: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.aviso}>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        className={styles.avisoTopo}
        onClick={() => onLigar(!ligado)}
      >
        <span className={styles.avisoIcone} aria-hidden="true">
          <Icon name="sino" size={18} />
        </span>
        <span className={styles.avisoTexto}>
          <span className={styles.avisoTitulo}>{titulo}</span>
          <span className={styles.avisoDesc}>{desc}</span>
        </span>
        <span className={styles.chave}>
          <span className={`${styles.track} ${ligado ? styles.trackOn : ''}`}>
            <span className={styles.knob} />
          </span>
          <span className={ligado ? styles.estadoOn : styles.estado}>
            {ligado ? 'Ligado' : 'Desligado'}
          </span>
        </span>
      </button>
      {ligado ? <div className={styles.avisoCorpo}>{children}</div> : null}
    </div>
  );
}

function Opcoes({
  opcoes,
  valor,
  onEscolher,
}: {
  opcoes: { v: string; t: string }[];
  valor: string;
  onEscolher: (v: string) => void;
}) {
  return (
    <div className={styles.opcoes} role="radiogroup">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={o.v === valor}
          className={`${styles.opcao} ${o.v === valor ? styles.on : ''}`}
          onClick={() => onEscolher(o.v)}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

function HoraEPara({
  hora,
  onHora,
  para,
  onPara,
}: {
  hora: string;
  onHora: (v: string) => void;
  para?: Para;
  onPara?: (v: Para) => void;
}) {
  return (
    <div className={styles.horaPara}>
      <input
        type="time"
        className={styles.horaPeq}
        value={hora}
        aria-label="Horário do aviso"
        onChange={(e) => onHora(e.target.value)}
      />
      {para && onPara ? (
        <Opcoes
          opcoes={[
            { v: 'todos', t: 'Todos' },
            { v: 'gestores', t: 'Só gestores' },
          ]}
          valor={para}
          onEscolher={(v) => onPara(v as Para)}
        />
      ) : null}
    </div>
  );
}
