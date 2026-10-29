import { useEffect, useState } from 'react';
import {
  proximoDisparo,
  validarConfigBoletim,
  type ConfigBoletim,
  type DiaSemana,
} from '@contro/core';
import { Button, Icon, useToast } from '@contro/ui';
import { formatarDataCurta } from '../../lib/datas';
import { useConfigBoletim } from './useConfigBoletim';
import { usePush } from '../../lib/usePush';
import styles from './ConfigBoletimScreen.module.css';

const DIAS: { v: DiaSemana; abrev: string }[] = [
  { v: 1, abrev: 'Seg' },
  { v: 2, abrev: 'Ter' },
  { v: 3, abrev: 'Qua' },
  { v: 4, abrev: 'Qui' },
  { v: 5, abrev: 'Sex' },
  { v: 6, abrev: 'Sáb' },
  { v: 7, abrev: 'Dom' },
];

const PADRAO: ConfigBoletim = {
  ativo: true,
  diaSemana: 1,
  hora: '06:30',
  fechamentoAtivo: false,
  fechamentoDia: 5,
  fechamentoHora: '17:00',
};

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ConfigBoletimScreen({ onVoltar }: { onVoltar: () => void }) {
  const { query, salvar, salvando } = useConfigBoletim();
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<ConfigBoletim>(PADRAO);

  // Sincroniza o formulário com o que veio do servidor (uma vez por carga).
  useEffect(() => {
    if (query.data) setCfg(query.data);
  }, [query.data]);

  function set<K extends keyof ConfigBoletim>(k: K, v: ConfigBoletim[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }

  async function onSalvar() {
    const erro = validarConfigBoletim(cfg);
    if (erro) {
      showToast({ message: erro });
      return;
    }
    const anterior = query.data ?? PADRAO;
    try {
      await salvar(cfg);
      showToast({
        message: 'Agendamento salvo.',
        onUndo: () => {
          setCfg(anterior);
          void salvar(anterior);
        },
      });
    } catch {
      showToast({ message: 'Não foi possível salvar. Tente de novo.' });
    }
  }

  const proximo = proximoDisparo(cfg, new Date());
  const proximoTexto = proximo
    ? `${formatarDataCurta(isoLocal(proximo.quando))} às ${
        proximo.edicao === 'principal' ? cfg.hora : cfg.fechamentoHora
      }${proximo.edicao === 'fechamento' ? ' (fechamento)' : ''}`
    : null;

  return (
    <div className={styles.screen}>
      <div className={styles.barra}>
        <button type="button" className={styles.voltar} aria-label="Voltar" onClick={onVoltar}>
          <Icon name="chevronRight" size={22} />
        </button>
        <span className={styles.titulo}>Boletim automático</span>
      </div>

      <p className={styles.intro}>
        No horário escolhido, o boletim de cada obra ativa é gerado e você recebe um aviso para
        enviar pelo WhatsApp. Vale para todas as obras.
      </p>

      {query.isLoading ? (
        <p className={styles.carregando}>Carregando…</p>
      ) : (
        <div className={styles.form}>
          <Switch
            label="Gerar boletim automaticamente"
            checked={cfg.ativo}
            onChange={(v) => set('ativo', v)}
          />

          <fieldset className={styles.bloco} disabled={!cfg.ativo}>
            <legend className={styles.rotulo}>Dia da semana</legend>
            <DiaPicker
              value={cfg.diaSemana}
              onChange={(v) => set('diaSemana', v)}
              ariaLabel="Dia"
            />

            <label className={styles.rotulo} htmlFor="hora-boletim">
              Horário
            </label>
            <input
              id="hora-boletim"
              type="time"
              className={styles.hora}
              value={cfg.hora}
              onChange={(e) => set('hora', e.target.value)}
            />
          </fieldset>

          <Switch
            label="Também enviar no fechamento da semana"
            checked={cfg.fechamentoAtivo}
            disabled={!cfg.ativo}
            onChange={(v) => set('fechamentoAtivo', v)}
          />

          {cfg.ativo && cfg.fechamentoAtivo ? (
            <fieldset className={styles.bloco}>
              <legend className={styles.rotulo}>Dia do fechamento</legend>
              <DiaPicker
                value={cfg.fechamentoDia}
                onChange={(v) => set('fechamentoDia', v)}
                ariaLabel="Dia do fechamento"
              />
              <label className={styles.rotulo} htmlFor="hora-fechamento">
                Horário do fechamento
              </label>
              <input
                id="hora-fechamento"
                type="time"
                className={styles.hora}
                value={cfg.fechamentoHora}
                onChange={(e) => set('fechamentoHora', e.target.value)}
              />
            </fieldset>
          ) : null}

          {proximoTexto ? (
            <p className={styles.proximo}>
              <Icon name="boletim" size={18} />
              Próximo envio: <strong>{proximoTexto}</strong>
            </p>
          ) : (
            <p className={styles.proximo}>
              <Icon name="alert" size={18} />
              Envio automático desligado.
            </p>
          )}

          <Button full onClick={onSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>

          <PushBloco />
        </div>
      )}
    </div>
  );
}

function PushBloco() {
  const { disponivel, inscrito, ocupado, erro, inscrever, cancelar } = usePush();
  if (!disponivel) return null;
  return (
    <div className={styles.push}>
      <Switch
        label="Receber aviso por push neste aparelho"
        checked={inscrito}
        disabled={ocupado}
        onChange={(v) => void (v ? inscrever() : cancelar())}
      />
      <p className={styles.pushNota}>
        No iPhone, o push só funciona com o app instalado na tela inicial. O aviso vale só para este
        aparelho.
      </p>
      {erro ? (
        <p className={styles.erroPush}>
          <Icon name="alert" size={16} />
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.switchLabel}>{label}</span>
      <span className={`${styles.track} ${checked ? styles.trackOn : ''}`}>
        <span className={styles.knob} />
      </span>
    </button>
  );
}

function DiaPicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: DiaSemana;
  onChange: (v: DiaSemana) => void;
  ariaLabel: string;
}) {
  return (
    <div className={styles.dias} role="radiogroup" aria-label={ariaLabel}>
      {DIAS.map((d) => {
        const sel = d.v === value;
        return (
          <button
            key={d.v}
            type="button"
            role="radio"
            aria-checked={sel}
            className={`${styles.dia} ${sel ? styles.diaSel : ''}`}
            onClick={() => onChange(d.v)}
          >
            {d.abrev}
          </button>
        );
      })}
    </div>
  );
}
