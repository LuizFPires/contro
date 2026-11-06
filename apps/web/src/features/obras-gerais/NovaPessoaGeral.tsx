import { useEffect, useState } from 'react';
import { BottomSheet, Button, Input, Segmented, useToast } from '@contro/ui';
import type { PapelGeral } from '@contro/core';
import type { ObraGeral } from './api';
import { ChavesObras } from './ChavesObras';
import { mensagemErroAcesso } from './mensagemErroAcesso';
import { useAcessoGeral } from './usePessoasGerais';
import styles from './PessoasAcessos.module.css';

const PAPEIS: { value: PapelGeral; label: string }[] = [
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'membro', label: 'Equipe' },
];

/** Dar acesso a uma pessoa por e-mail; sem conta ainda, vira convite. */
export function NovaPessoaGeral({
  aberto,
  obras,
  carregando,
  erro: erroObras,
  onFechar,
}: {
  aberto: boolean;
  obras: ObraGeral[];
  carregando: boolean;
  erro: boolean;
  onFechar: () => void;
}) {
  const { showToast } = useToast();
  const { salvar } = useAcessoGeral();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<PapelGeral>('membro');
  const [obraIds, setObraIds] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setNome('');
      setEmail('');
      setPapel('membro');
      setObraIds([]);
      setSalvando(false);
      setErro('');
    }
  }, [aberto]);

  async function dar() {
    if (salvando) return;
    const n = nome.trim().replace(/\s+/g, ' ');
    const e = email.trim().toLowerCase();
    if (!n) return setErro('Informe o nome.');
    if (!e) return setErro('Informe o e-mail.');
    if (!e.includes('@')) return setErro('O e-mail precisa ter @.');
    setSalvando(true);
    setErro('');
    try {
      await salvar(e, n, papel, obraIds);
    } catch (err) {
      setSalvando(false);
      setErro(mensagemErroAcesso(err));
      return;
    }
    onFechar();
    showToast({ message: 'Acesso dado.' });
  }

  return (
    <BottomSheet open={aberto} title="Nova pessoa" onClose={onFechar}>
      <div className={styles.campos}>
        <div>
          <Input label="Nome" value={nome} autoFocus onChange={(e) => setNome(e.target.value)} />
          <p className={styles.nota}>O nome é o que aparece no app.</p>
        </div>
        <Input
          label="E-mail"
          type="email"
          value={email}
          autoCapitalize="none"
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <p className={styles.rotulo}>Papel</p>
          <Segmented ariaLabel="Papel" options={PAPEIS} value={papel} onChange={setPapel} />
        </div>
        <div>
          <p className={styles.rotulo}>Em quais obras</p>
          <ChavesObras
            obras={obras}
            marcadas={obraIds}
            carregando={carregando}
            erro={erroObras}
            onAlternar={(id) =>
              setObraIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
            }
          />
        </div>
      </div>
      {erro ? (
        <p role="alert" className={styles.erro}>
          {erro}
        </p>
      ) : null}
      <div style={{ marginTop: 16 }}>
        <Button onClick={() => void dar()} disabled={salvando}>
          Dar acesso
        </Button>
      </div>
      <p className={styles.nota} style={{ marginTop: 12 }}>
        Se ainda não tem conta, ao se cadastrar com esse e-mail já entra nas obras marcadas.
      </p>
    </BottomSheet>
  );
}
