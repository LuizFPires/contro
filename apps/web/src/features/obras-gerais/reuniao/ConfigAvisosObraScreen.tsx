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
import { formatarDataCurta } from '../../../lib/datas';
import { Aviso, HoraEPara, Opcoes, PrazoPendencia } from '../../avisos/ConfigAvisosScreen';
import styles from '../../avisos/ConfigAvisosScreen.module.css';
import { hojeISO } from '../../obras/api';
import {
  PADRAO_AVISOS_OBRA,
  useConfigAvisosObra,
  type ConfigAvisosObra,
} from './useConfigAvisosObra';

const HORAS_MANHA = ['07:00', '08:00', '09:00'];

/**
 * Reunião e avisos da obra geral (C13): a mesma tela da Contorno, para uma obra. Quem
 * planeja a obra (Coordenador, Administrador) altera. Sem "Providências para começar":
 * nas obras gerais as providências já entram nas ações do dia.
 */
export function ConfigAvisosObraScreen({
  obraId,
  obraNome,
  onVoltar,
}: {
  obraId: string;
  obraNome: string;
  onVoltar: () => void;
}) {
  const { query, salvar, salvando } = useConfigAvisosObra(obraId);
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<ConfigAvisosObra>(PADRAO_AVISOS_OBRA);

  // Sincroniza o formulário com o que veio do servidor.
  useEffect(() => {
    if (query.data) setCfg(query.data);
  }, [query.data]);

  function set<K extends keyof ConfigAvisosObra>(k: K, v: ConfigAvisosObra[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }

  async function onSalvar() {
    if (cfg.manhaAtivo && minutosDoDia(cfg.manhaHora) >= minutosDoDia(cfg.reuniaoHora)) {
      showToast({ message: 'O aviso da manhã precisa ser antes do horário da reunião.' });
      return;
    }
    const anterior = query.data ?? PADRAO_AVISOS_OBRA;
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
          <div className={styles.sub}>{obraNome} · vale para esta obra</div>
        </div>
      </div>

      {query.isLoading ? (
        <p className={styles.carregando}>Carregando…</p>
      ) : query.isError ? (
        <p className={styles.carregando}>Não foi possível carregar. Tente de novo.</p>
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

          <h2 className={styles.secao}>Lembretes da reunião · para a obra</h2>
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
              titulo="Ações do dia"
              desc="Cada um recebe as suas atrasadas e as de hoje; o Coordenador recebe a obra inteira"
              ligado={cfg.acoesAtivo}
              onLigar={(v) => set('acoesAtivo', v)}
            >
              <HoraEPara hora={cfg.acoesHora} onHora={(v) => set('acoesHora', v)} />
            </Aviso>
            {/* Fora do aviso: o prazo vale para as listas e o Check list, mesmo com o push
                desligado. */}
            <div className={styles.prazoBloco}>
              <div className={styles.prazoTitulo}>Prazo da pendência (dias úteis)</div>
              <PrazoPendencia
                rotulo="Alta"
                valor={cfg.pendAltaDu}
                onEscolher={(v) => set('pendAltaDu', v)}
              />
              <PrazoPendencia
                rotulo="Média"
                valor={cfg.pendMediaDu}
                onEscolher={(v) => set('pendMediaDu', v)}
              />
              <PrazoPendencia
                rotulo="Baixa"
                valor={cfg.pendBaixaDu}
                onEscolher={(v) => set('pendBaixaDu', v)}
              />
            </div>
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
