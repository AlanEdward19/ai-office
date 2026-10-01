# STATE — continuidade

## Histórico preservado
- Visual/câmera/acabamento: `docs/state-visual-history.md`.
- Area meetings: `.specs/features/area-meetings/build-log.md`.
- Living office: `.specs/features/living-office/build-log.md`.

## Living office (2026-09-30)
- Plano inteiro autorizado; um builder implementou mapa, áreas, efeito exterior, histórico local/cloud privado, rotinas/RH/encontros e controles privados.
- Provas reais R3F incluem 8 salas + 18 postos, seis câmera/andar, faixa de corredor 1.2m, coreografia física contra malhas e travessia da porta.
- Sem commit/reset/dependência nova; diff prévio area-meetings preservado.
- Gate final e verifier independente `scripts/verify.sh --webpack` exit0: build/TS/lint e112 testes verdes.
- Provas UI/visuais pendentes: navegador congelado e recuperação proibida pela política da ferramenta. Nenhum PASS visual declarado.

## Verifier fix (2026-10-01)
- Encontro exige proximidade + segmento físico livre; desvio por porta funciona, parede fechada gera blocked legível. Duas regressões C20/C22.
- C3/C4 agora têm testes GPU-free de shader/bounds; C7 ponteiro corrigido e provas reais C5/C17/C19/C20 acrescentadas sem substituir originais.
- Gate após fix `scripts/verify.sh --webpack` exit0, build/TS/lint/107 testes; revisão visual continua pendente.

## Provas complementares (2026-10-01)
- C18 usa admissão real da UI + deskStore: falha/full/duplicado preservam postos e confirmação. publish agora grava antes de alterar snapshot.
- C19 testa funções de apresentação usadas por Avatar/AgentActors: sem gait/bob e montagem discreta em reduced motion. C22 cobre cancel explícito e destinatário removido.
- C13 usa adapter nativo de produção em tmpdir real: modo700/600, rename, erro de escrita preserva arquivo, corrupção não é sobrescrita.
- Gate final exit0: build/TS/lint/111 testes. Código congelado para verifier; revisão visual pendente permanece sem PASS.

## DPR focus fix (2026-10-01)
- AreaFocus atualiza target/depth nas dimensões físicas obtidas por getDrawingBufferSize a cada frame ativo; reage a resize/DPR sem reduzir pixels internos.
- Blur conserva raio em CSS; helper de produção testado com target/depth Three em DPR1/1.5/2 e resize, sem realocação redundante.
- Gate final exit0: build/TS/lint/112 testes; revisão visual continua pendente e sem PASS.

## Verificação independente final (2026-10-01)
- Round3: 16/23 critérios integralmente comprovados; sete dependem de aceitação visual renderizada, impedida pelo navegador/política da ferramenta.
- Build/TS/lint/112 testes passaram; mutação DPR detectada, dez mutações anteriores preservadas no relatório com proveniência.
- Validator de conclusão permanece FAIL pela evidência visual ausente; implementação não declarada integralmente aceita.
- Prévia reiniciada na sessão35876; HTTP200 em http://127.0.0.1:3847/.

## Office interactions — correções (2026-10-01)
- Shader tinha uniform active reservado em GLSL; maskEnabled corrige compilação. Quad fullscreen sem depth/culling; GPU/visual não verificados.
- Cadeiras orientadas à mesa, sentar usuário limitado0.7m e liberado por movimento/Espaço/andar/correção. Exclusão de colisão somente identidade de cadeira; postura opcional sanitizada na presença.
- Agente aproxima por trás da cadeira sem atravessar mesa, senta/digita/descansa; café tem4reservas, copo acompanha braço; gestos conversa.
- Clique NPC abre Histórico diretamente; E próximo local também. Conversa continua ação separada, histórico real/autorização preservados.
- Gate verify --webpack exit0: build/TS/lint/119 testes, incluindo4assentos café contra malhas. Checks novo perfilui validator0errors6selectorwarnings.
- Limitação: sentar usa ajuste local de pose de até0.7m, não nova simulação esquelética. Inspeção e efeito/poses têm prova fonte/domínio, não revisão visual; nenhuma afirmação de PASS UI. Sem commit/dependência.

## Human seat occupancy verifier fix (2026-10-01)
- Coffee reservations include ground seated peers + immediate user pose, reallocate when human takes chair; own desk remains standing beside chair while occupied, readable waiting caption and automatic resume.
- Colleague presentation uses same human occupancy guard, so stale shared actor snapshot cannot overlap current seated person. Task/provider state unchanged.
- Three regressions preserve previous119 assertions; gate exit0 build/TS/lint/122 tests. Code frozen for verifier, visual still pending.

## Office interactions — revisão final (2026-10-01)
- Verifier independente: build/TS/lint/122 testes exit0; cinco regressões isoladas detectadas pelos testes. Nenhum defeito computacional adicional encontrado.
- Relatório office-interactions mantém FAIL: C1–C5 exigem renderização/interação UI sem evidência disponível; C6 PASS. Validator exit1 exclusivamente pelo verdict visual pendente.
- Lição: reservas de assento devem excluir também pessoas sentadas; presença sanitizada e pose imediata evitam sobreposição enquanto o snapshot compartilhado atualiza.
- Prévia HTTP200, processo confirmado nesta worktree; plano screen-sharing proposto e validator0errors/0warnings. Sem implementação de captura ou commit.

## Office builder — plano (2026-10-01)
- Nova orientação do usuário: gabinete/responsável por projeto/andar vem do Linear; CEO geral pode coexistir, sem canto global fixo obrigatório.
- Plano office-builder cobre editor, andares fixos/projeto, elevador/portas/acessos, áreas IA local/cloud/RH e mesas de pessoas/agentes, rascunho/publicação e migração.
- Documento89linhas, validate_plan exit0 sem erros/avisos; propostas de persistência/contratos/limites aguardam revisão. Apenas planejamento, sem alterar código/runtime ou commitar.
