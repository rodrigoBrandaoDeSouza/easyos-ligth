import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { aoMudarBanco, gravarMeta, lerMeta, limparBancoLocal } from '@/db/database';
import { empresa as lerEmpresa, Empresa, perfil as lerPerfil, Perfil } from '@/db/repos';
import { contarPendentes, sincronizar } from '@/sync/sync';
import { situacaoAssinatura, Situacao } from '@/assinatura/situacao';

interface AuthCtx {
  carregando: boolean;
  session: Session | null;
  usuarioId: string | null;
  perfil: Perfil | null;
  empresa: Empresa | null;
  assinatura: Situacao;
  /** admin ou atendente: vê a agenda de todos e agenda para qualquer técnico */
  equipeInterna: boolean;
  admin: boolean;
  entrar(email: string, senha: string): Promise<void>;
  /** retorna true se precisa confirmar o e-mail antes de entrar */
  cadastrar(nome: string, email: string, senha: string): Promise<boolean>;
  sair(forcar?: boolean): Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

/** Garante que os dados locais pertencem ao usuário logado. */
async function prepararBancoParaUsuario(userId: string) {
  const anterior = await lerMeta('usuario_id');
  if (anterior && anterior !== userId) await limparBancoLocal();
  await gravarMeta('usuario_id', userId);
}

function traduzirErroAuth(msg: string): string {
  if (msg === 'Invalid login credentials') return 'E-mail ou senha inválidos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (msg.includes('already registered')) return 'Este e-mail já tem cadastro. Use "Entrar".';
  if (msg.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/network|fetch/i.test(msg)) return 'Sem conexão. O primeiro acesso precisa de internet.';
  return msg;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const usuarioId = session?.user.id ?? null;

  useEffect(() => {
    // getSession lê a sessão salva no aparelho: funciona offline
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await prepararBancoParaUsuario(data.session.user.id);
      setSession(data.session);
      setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      if (s) void prepararBancoParaUsuario(s.user.id);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // perfil e empresa vêm do banco local (sincronizado): funcionam offline
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  useEffect(() => {
    if (!usuarioId) {
      setPerfil(null);
      setEmpresa(null);
      return;
    }
    const carregar = async () => {
      setPerfil((await lerPerfil(usuarioId)) ?? null);
      setEmpresa((await lerEmpresa()) ?? null);
    };
    void carregar();
    return aoMudarBanco(() => void carregar());
  }, [usuarioId]);

  async function entrar(email: string, senha: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) throw new Error(traduzirErroAuth(error.message));
    await prepararBancoParaUsuario(data.user.id);
    await sincronizar(); // carga inicial
  }

  async function cadastrar(nome: string, email: string, senha: string) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim() } },
    });
    if (error) throw new Error(traduzirErroAuth(error.message));
    if (!data.session) return true; // confirmação de e-mail ligada no Supabase
    await prepararBancoParaUsuario(data.session.user.id);
    await sincronizar();
    return false;
  }

  async function sair(forcar = false) {
    if (!forcar && (await contarPendentes()) > 0) {
      throw new Error('PENDENTES');
    }
    await supabase.auth.signOut({ scope: 'local' });
    await limparBancoLocal();
  }

  return (
    <Ctx.Provider
      value={{
        carregando,
        session,
        usuarioId,
        perfil,
        empresa,
        assinatura: situacaoAssinatura(empresa),
        equipeInterna: perfil?.papel === 'admin' || perfil?.papel === 'atendente',
        admin: perfil?.papel === 'admin',
        entrar,
        cadastrar,
        sair,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
