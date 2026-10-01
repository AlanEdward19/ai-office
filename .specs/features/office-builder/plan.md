# Criador de escritório, andares e responsáveis

Status: proposto em 2026-10-01; pedido autoriza planejamento, sem implementação ou alteração do escritório atual.

## Problem
Hoje há somente térreo/RH, elevador e canto do CEO em coordenadas fixas. Projetos Linear viram salas automáticas; o responsável do projeto não é importado. O usuário não consegue construir um escritório coerente com sua organização, escolher onde trabalham pessoas/agentes ou decidir entre salas e andares por projeto.

## Flow
1. Anfitrião entra em “Construir”; colegas continuam vendo a última versão publicada.
2. Escolhe andar, cria/renomeia/reordena andares fixos e configura “Andar por projeto Linear” ligado/desligado para projetos selecionados.
3. Em vista isométrica de edição, usa catálogo e grade para desenhar paredes/portas/áreas e colocar elevador, móveis e postos; inspeciona primeira/terceira pessoa na prévia.
4. Define vínculos de áreas/postos com usuários, agentes locais/cloud, RH e projetos; responsável de projeto vem do Linear, CEO geral é escolhido no escritório.
5. Valida acessos, desembarques, ocupação e capacidade; desfaz/refaz e salva rascunho sem afetar pessoas ou chamadas em andamento.
6. Publica versão válida; servidor persiste e compartilha layout, recalcula circulação/reuniões e reposiciona somente ocupantes afetados em pontos seguros.

## Impact
| Front | What changes |
| --- | --- |
| Layout | Andares/objetos com IDs estáveis substituem coordenadas fixas; colisão, assento, área de call e navegação consomem a mesma geometria. |
| Linear | Leitura de líder do projeto além de ID/nome; vínculos por ID, sem escrever no Linear ou inferir responsabilidade por nome. |
| Dados | Documento local versionado, publicado e persistente; migração preserva térreo/RH, projetos, mesas, histórico e vínculos existentes. |
| Permissões | CEO/responsável é papel organizacional/visual; não concede permissões de anfitrião, administração do Linear ou acesso a conversas privadas. |

## Relations
| Entity/relation | Rule |
| --- | --- |
| Escritório → andares | Andares fixos coexistem com andares vinculados a projetos; ID não depende da posição na lista. |
| Andar → projeto | Modo por projeto: um andar por projeto selecionado; modo manual: áreas de vários projetos podem coexistir no mesmo andar. |
| Projeto → responsável/CEO do projeto | Padrão é o líder do projeto no Linear; sem líder, exibe “Responsável não definido”. Mudança de líder atualiza identificação sem mover o gabinete. |
| Escritório → CEO geral | Escolha explícita do anfitrião, independente dos líderes de projeto; mesma pessoa pode exercer ambos os papéis. |
| Andar fixo → responsável | Configuração explícita, opcional; não escolhe arbitrariamente um líder entre projetos que compartilham o andar. |
| Área/gabinete → escopo | Gabinete geral pertence ao escritório; gabinete de projeto pertence ao projeto e pode ser posicionado em seu andar ou área no modo manual. |
| Posto → ocupante | Mesa/cadeira vinculadas a usuário ou agente local/cloud; RH tem área/postos próprios, sem criar sessões de agente fictícias. |
| Elevador → paradas | Núcleo vertical compartilhado em X/Z, posição editável e paradas por andar; porta orientável com desembarque livre em todos os andares atendidos. |

## Surface
| Route | In | Out | Status |
| --- | --- | --- | --- |
| GET /api/office/layout (proposto) | Sessão | Layout publicado sanitizado e revisão | 200, 401, 503 |
| PUT /api/office/layout (proposto) | Sessão host, revisão base, documento | Nova revisão ou erros localizados | 200, 400, 401, 403, 409, 422, 503 |
| GET /api/projects (existente) | Configuração Linear no servidor | Projetos e líder conhecido; disponibilidade explícita | 200 (erros do provedor no envelope existente) |

## Landing
| Proposed door | Literal shape | Alternative |
| --- | --- | --- |
| Layout persistente | Documento v1 privado/ignorado pelo Git, revisão monotônica, escrita atômica e última versão válida recuperável; ADR antes de implementar. | Só localStorage não define layout único para colegas nem recuperação confiável. |
| Andares dinâmicos | IDs estáveis; migração mantém IDs ground/hr e vínculos de projeto/mesa, sem redefinir identidade ao reordenar. | Índices como identidade quebram presença, elevador e histórico ao inserir andar. |
| Publicação consistente | Geometria validada e troca de revisão única no servidor; conflito 409 preserva versão atual e rascunho. | Publicar movimentos parciais permite divergência entre colisão, áreas e colegas. |

## Criteria
**Acceptance Criteria**
1. WHEN anfitrião entra em Construir THEN sistema SHALL oferecer seleção, arrastar, rotação em 90°, grade de 0,5m, remover, desfazer/refazer, salvar rascunho, cancelar e publicar; colegas não editam.
2. WHEN usuário cria andar fixo THEN sistema SHALL permitir nome, dimensões, ordem e responsável opcional, com ID estável após reordenação.
3. WHEN modo por projeto é ligado THEN sistema SHALL propor um andar por projeto Linear selecionado; desligado SHALL permitir áreas de projetos em andares manuais, preservando vínculos ao alternar.
4. WHEN usuário escolhe catálogo THEN sistema SHALL oferecer paredes, portas, áreas de reunião, elevador, IA local, IA cloud, RH, mesas/cadeiras de usuários/agentes, gabinetes geral/projeto, café e estudo/pesquisa.
5. WHEN elevador é colocado/movido/rotacionado THEN validação SHALL exigir desembarque transitável e acesso à rede de circulação em todas as paradas, sem saída contra parede ou mesa.
6. WHEN layout é validado THEN sistema SHALL rejeitar sobreposições sólidas, áreas fora do andar, portas sem passagem e postos/áreas inacessíveis, exigindo corredores de pelo menos 1,2m e entrada acessível no térreo.
7. WHILE rascunho é editado layout publicado, pessoas, chamadas e tarefas reais SHALL continuar intactos; cancelar descarta mudanças somente do rascunho.
8. WHEN versão válida é publicada THEN cena, colisões, assentos, rotas de agentes/RH, elevador e limites de chamadas SHALL usar a mesma revisão do layout.
9. WHEN responsável Linear muda THEN gabinete do projeto SHALL mostrar líder atualizado; líder ausente ou consulta indisponível SHALL ter estado explícito, sem inventar responsável ou presença online.
10. WHEN CEO geral é configurado THEN seu gabinete SHALL coexistir com gabinetes dos projetos e responsáveis de andares fixos, sem coordenada global obrigatória ou permissões adicionais.
11. WHEN posto é atribuído ou movido THEN vínculo com usuário/agente, histórico e tarefas SHALL permanecer associados à identidade original, sem criar execução ou contratação fictícia.
12. WHEN publicação afeta ocupantes/reuniões THEN sistema SHALL encerrar mídia cujo escopo mudou, liberar assentos inválidos e usar ponto seguro acessível para ocupantes afetados, sem deixar pessoas presas ou enviar mídia ao novo escopo automaticamente.
13. WHEN projeto some/é arquivado ou andar ocupado é removido THEN sistema SHALL exigir destino explícito para áreas/postos/ocupantes antes da publicação; sincronização não apaga andares automaticamente.
14. WHEN limite de 20 andares ou 200 objetos por andar é excedido THEN sistema SHALL mostrar erro de capacidade, sem descartar projetos/objetos silenciosamente.
15. WHEN escritório reinicia, há corrupção ou falha de escrita THEN sistema SHALL recuperar versão válida ou informar erro sem sobrescrever dados; documento existente SHALL migrar sem apagar mesas/projetos/histórico.
16. WHILE usuário edita sistema SHALL destacar erro no objeto/andar, oferecer prévia nas três câmeras, atalhos com alternativa por botões e inspector legível em viewport de 360px.

## Out of scope
Escrever liderança/cargos no Linear, importar presença online fictícia, conceder permissões por cargo, terreno externo, escadas/simulação estrutural, editor simultâneo por colegas, novos provedores ou deploy persistente. Compartilhamento de tela tem plano separado.

## Assumptions
Grade 0,5m, rota mínima 1,2m, 20 andares/200 objetos, um núcleo de elevador alinhado verticalmente e rascunho local com publicação exclusiva do anfitrião são padrões propostos, ainda não confirmados. Líder Linear é o responsável/CEO padrão do projeto; CEO geral é escolha local. Associação com pessoa logada é explícita, sem dedução por nome.
**Open questions:** none - propostas acima aguardam revisão do plano.

## Observable
| Surface | Decision | Landing |
| --- | --- | --- |
| Editor/catalogue | Seleção/grade/rotação/undo/redo, inspector, erros e três câmeras | AC 1, AC 4, AC 16 |
| Andares/Linear/CEO | Modo de organização, líderes, gabinetes, ausência e arquivamento | AC 2, AC 3, AC 9, AC 10, AC 13 |
| Circulação/objetos | Elevador, portas, colisões, postos, capacidades e trajetos reais | AC 5, AC 6, AC 11, AC 14 |
| Rascunho/publicação | Isolamento, revisão, falhas, recuperação e migração | AC 7, AC 8, AC 15 |
| Ocupação/chamadas | Reposicionamento seguro e fim da mídia ao mudar escopo | AC 12 |
| Provas futuras | Contratos e malhas reais; visita aos andares/câmeras, usuário sentado, RH e call durante relayout | AC 1–16 |

## Sources
- Pedido do usuário: responsável por andar/projeto no Linear, CEO geral/projeto e modo de construção inspirado em The Sims.
- Código atual: `src/domain/floors.ts`, `rooms.ts`, `office-map.ts`, `src/server/linear-client.ts`; planos living-office e screen-sharing.
- [Linear Project overview](https://linear.app/docs/project-overview): projeto possui um líder, distinto de membros.
