-- Só leitura, sem alterar nada. Mostra o(s) usuário(s) cadastrado(s) e o perfil salvo.
select usuario, nome, perfil, ativo, criado_em from public.profiles order by criado_em desc;
