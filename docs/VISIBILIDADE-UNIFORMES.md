# Visibilidade de uniformes nas solicitações

O estoque e sua exportação CSV são ordenados por nome, classificação (Feminino, Masculino, Não informado) e tamanho. Tamanhos numéricos seguem ordem numérica; letras seguem PP, P, M, G, GG, XG, XGG, EXG, EXGG.

Na aba Estoque, cada item/SKU possui o botão de visibilidade nas solicitações. O gestor altera somente a própria loja. O master pode selecionar uma loja no painel ou usar a loja da linha na visão consolidada, e escolher entre essa loja e todas as lojas no diálogo.

O bloqueio global prevalece sobre a configuração local e vale também para lojas futuras. Liberar globalmente preserva os ocultamentos individuais. O mesmo diálogo permite liberar novamente a exibição. A visibilidade independe do saldo; o catálogo de solicitações continua exigindo saldo disponível para exibir um item.

Itens ocultos continuam no estoque, nas movimentações e no histórico. Novas solicitações e substituições de itens verificam a visibilidade no servidor. Pedidos anteriores podem ser aprovados ou recusados normalmente.

## Implantação

Antes de iniciar a versão atualizada, aplique a migração `20261110000000_uniform_request_visibility` no banco do ambiente de destino com `npm run db:deploy`. Ela adiciona duas colunas booleanas com padrão `false`, preservando a visibilidade atual. A migração não é executada pelo build.

Validação local: `npm run verify`. Teste de interface específico: `npm run test:ui -- tests/browser/shared-catalog.spec.ts --grep visibilidade`.
