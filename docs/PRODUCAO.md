# Preparação para produção

## Estado atual

A autenticação individual, sessões JWT validadas contra o estado atual do utilizador, troca obrigatória de senha, escopo de loja nas APIs principais e CRUD administrativo de lojas/utilizadores estão implementados. O endpoint de provisionamento inicial está disponível; o deploy ainda exige validação em staging e os itens pendentes abaixo.

## Pendências antes de liberar

- O painel/API MASTER_ADMIN permite criar, editar e excluir lojas e utilizadores, resetar senha e impedir autoexclusão. Exclusão de loja é bloqueada quando há qualquer registo dependente.
- O provisionamento inicial é feito uma única vez por `POST /api/setup`, público por necessidade operacional, mas limitado ao banco vazio: a primeira consulta conta utilizadores; qualquer utilizador existente resulta em 403. O endpoint exige `ADMIN_PASSWORD` configurada com 12 a 128 caracteres, grava apenas o hash bcrypt e cria `admin` sem troca obrigatória. A mesma senha pode ser usada nos logins seguintes; o valor não é retornado pela API. Depois do setup, o endpoint permanece exposto, mas não provisiona novamente.
- A interface do painel ainda não oferece seletor para MASTER_ADMIN navegar entre lojas, embora as APIs de leitura aceitem filtro explícito e os exports permitam consulta global.
- Configure limites de tentativa no provedor para login e endpoints públicos, e monitore erros de autenticação e banco. Não há rate limit distribuído na aplicação.
- O LDAP e o nome do autoatendimento continuam sendo informados pelo usuário, sem validação em diretório corporativo.
- Teste em staging o primeiro login, troca obrigatória, logout, acesso de STORE_ADMIN a dados de outra loja, operações MASTER_ADMIN, solicitação pública por código de loja e rollback.

O endpoint público `/api/requests/public` mostra um seletor quando há mais de uma loja. A URL por unidade é `/solicitar?loja=CODIGO`; compartilhe o endereço da unidade, e não um link genérico que dependa da loja mais antiga.

## Migration e dados existentes

A migration `20261014185052_add_multi_store` preenche `UniformVariant.storeId` e `RequestItem.storeId` para instalações legadas com no máximo uma loja. Ela aborta se encontrar mais de uma loja ou variantes sem loja. Mesmo que o backfill já tenha sido aplicado no banco do usuário, confirme o histórico em `prisma migrate status` e não reaplique SQL manualmente.

Antes de qualquer alteração no banco de produção:

1. Faça backup consistente do PostgreSQL e confirme que a restauração foi testada.
2. Reproduza o deploy em staging usando uma cópia representativa dos dados.
3. Confira lojas, usuários, vínculos, saldos, movimentos e solicitações após a migration.
4. Faça a liberação em janela aprovada e tenha plano de rollback da aplicação e restauração do banco.

Não rode `npm run db:seed` em produção: ele apaga as tabelas de negócio e cria credenciais de demonstração (`admin` / `admin123`). A trava do script é proteção adicional, não procedimento de provisionamento.

## Verificações executadas

- `npm run lint` — passou.
- `npm run build` — passou.
- A migration e os endpoints não foram executados contra o banco de produção neste trabalho.

## Checklist de release

- Configure `ADMIN_PASSWORD` como segredo do ambiente de produção. Após publicar, chame `POST /api/setup` uma única vez num banco totalmente vazio; o login inicial será `admin` e a senha será o valor de `ADMIN_PASSWORD`. Não execute esse passo num banco que já contenha utilizadores ou dados de negócio.
- Para uma base já provisionada, configure o valor escolhido em `ADMIN_PASSWORD` e execute `npm run admin:set-password` uma vez, apontando `DATABASE_URL` ao banco correto. O comando redefine o hash da conta `admin` MASTER_ADMIN e marca a troca obrigatória como concluída; não execute contra o banco errado.
- Configurar `DATABASE_URL`, `DIRECT_URL` e `ADMIN_SESSION_SECRET` como segredos do ambiente de produção; o segredo de sessão deve ter pelo menos 32 bytes aleatórios.
- Confirmar HTTPS, domínio e cookie de sessão Secure/HTTP-only.
- Aplicar migrations somente após backup e aprovação da janela de manutenção; não usar `db:push`.
- Publicar e validar login, troca de senha, isolamento cruzado entre duas lojas, aprovação de solicitação e exportações com perfis STORE_ADMIN e MASTER_ADMIN.
- Validar CRUD de MASTER_ADMIN, exclusão de loja com e sem registos vinculados, reset de senha e bloqueio do endpoint de setup após a criação do primeiro utilizador.
- Configurar alertas, rate limits/WAF e revisar vulnerabilidades de dependências antes de exposição ampla.
