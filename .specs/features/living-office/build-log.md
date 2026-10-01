## living-office — builder boundary 1 (2026-09-30)
- Plano completo autorizado pelo usuário; checks 23 AC e ADR-0004 escritos antes das mudanças.
- Mapa canônico: 8 salas em três colunas, corredor 1,55 m, porta de sala 1,4 m; fachada entrada 2 m; paredes redundantes internas do lobby removidas; envelope/limites ampliados ao norte.
- Recepção, Café & ideias, Ala local e Contratação agora são áreas de reunião, além das áreas existentes.
- Navegação pura officeRoute busca contra colisões e simplifica por linha de visão; regressão living office C7 percorre cada área usando malhas R3F reais em todos modos/andares.
- Exterior de área ocupado escurecido/desfocado por shader com depth→world mask; visual ainda não revisado no navegador.
- Capacidade 8 salas/9 mesas com mensagens de erro; deslocamento dos postos evita desembarque; convivência liberada com mesa lateral menor.
- Gate scripts/verify.sh --webpack exit 0: build/TS/lint/82 testes (antes das duas últimas mensagens UI de capacidade; TS/lint rechecados depois).
- Pendente: C8–23 histórico/importadores/rotinas/coreografia/encontros/APIs; revisão visual C3/4; prova dos corredores de 1,2m deve considerar largura física completa, e ala local com muitos postos ainda requer layout/capacidade.
- Não houve commit/reset do diff anterior. Próxima etapa do mesmo builder: história privada/importação real.

## living-office — builder boundary 2 (2026-09-30)
- Histórico implementado em domínio/repository injetável, filesystem server-only privado `.office-data/history.json`, v1, 500 execuções, 30 dias, resumos 12.000 caracteres, gravação temporário+rename com permissões restritas. Corrupção preservada e exposta como erro recuperável 503.
- GET /api/agents/history: 401 sem sessão, 403 colega, 400 entradas inválidas, 200 páginas20, 503 falha de store. Rota real sem cookie confirmada 401 via curl.
- Importação real: sessões JSONL Codex/Claude recentes, logs grandes head+tail limitados com indicação parcial; Cursor lista agentes com última run real e lê resultado/status quando API fornece. Payloads não vão para SSE compartilhado.
- Observadores gravam identidades reais; conversa gerenciada preserva mesma sessão/run e resumo de assistant prose, sem tool args. Datas ausentes/desconhecidas explícitas; scrub de credenciais/paths e segredos do env antes de persistir.
- Aba Histórico adicionada ao AgentPanel: carregando/vazio/erro/indisponibilidade, últimos primeiro, carregar mais, origem e resumo parcial. Registro sem vínculo recebe rótulo Arquivo do provedor/vínculo com mesa desconhecido. cloudId filtra registros do cloud agent selecionado.
- Gate scripts/verify.sh --webpack exit0: build/TS/lint/90 testes. Provas visuais permanecem pendentes. Atomic rename está implementado no adapter e concorrência/repositorio em teste; validação independente ainda deve revisar cobertura da fronteira FS.
- Próximo lote mesmo builder: C14–23 rotina física/RH/montagem/entrada/encontros/API config; terminar largura1.2m e capacidade/navegação da ala local.

## living-office — builder boundary 3 (2026-09-30)
- Rotina domain createAgentRoutines usa estados finitos, idleSince contínuo (poll observado não reinicia), padrão5min configurável, café/sono, retorno/guardar/saída pela porta, reentrada por trabalho real. Não chama provedor ou cancela tarefa.
- Fila RH chega correndo, monta móveis por2.2s, libera entrada do agente depois do posto pronto e volta pela porta. Reserva conserva colisão da mesa enquanto malha visual aguarda montagem. Feedback explícito quando tranca/obstáculo bloqueia RH.
- Porta física agora atravessável: waypoint exterior z7.0, walkBounds groundmaxZ7.2 e plataforma externa; fachada está emz6.3, entrada2m.
- AgentActors separa corpos móveis do ambiente/collision meshes; pernas/braços Avatar, copo/bolsa e inclinação de sono/guardar. Prefers-reduced-motion elimina animação de partes e usa transições discretas do corpo.
- Encontros explícitos têm rota/recalculo/cancelamento/trancas; resultado arrived somente até1.5m abre AgentPanel mensagens, sem enviar texto ao provedor. UI permite escolher outro agente e cancelar encontro; chegada entre agentes não cria tarefa/mensagem fictícia.
- API GET/POST /api/office/routines guarda configuração/commands em memória, valida host e IDs; resposta200/400/401/403/409 testada. Rotina visual pública whitelisted no snapshot officeSSE; histórico/conversa permanecem privados.
- Config idleUI1/5/10/15min; contratar mesmo formulário novamente é negado; mesas/histórico conservados quando ator sai.
- ProjectedLabel extraído para reutilizar em corpos móveis; agora oculta ancestral invisible para não mostrar label de personagem ausente.
- Gate scripts/verify.sh --webpack exit0: build/TS/lint/100tests; após feedbackRH bloqueado, TS e100tests rechecados. Último gate session60340 concluído.
- Próximo lote mesmo builder: capacidade finite/geometry Ala local, width1.2 real contra meshes comradius.6, rotas reais de todos atores/RH/porta, shader colorspace/tone pipeline e prova visual (ainda pendente).

## Boundary 4 — implementation ready for independent verification
- 8 salas, 9 postos cloud e 9 locais; Café/Laboratório movidos no mapa canônico para liberar ala local. Capacidade excedida recebe alerta, nunca sobreposição.
- C5 real: seis camera/andar com 8 salas e 18 postos; obstáculos inflados .36 + raio .24 garantem faixa de 1.2 m para todas áreas e postos. Portas 1.8 m, cadeiras de entrevistas e mobiliário da convivência realinhados.
- R3F coreografia real: RH monta todos 18 postos, chega/sai além da fachada, usuários móveis são alcançados até1.5m, café/guardar/saída verificados sem penetrar objetos. Segmentos/AABB exatos evitam cantos instáveis; conectores da grade preservam pontos reais.
- Fixtures area-meetings/phase7 alteradas apenas nas coordenadas de Café/Laboratório canônicos mantendo asserts originais; escaneamento de acesso cobre largura toda da área.
- Shader HalfFloat HDR + tone/colorspace de saída uma vez; reduced-motion montagem discreta; horário segue NPC local móvel sem inventar fuso cloud, posto mantém label breve.
- Gate final `scripts/verify.sh --webpack` exit0 após ajuste de label e teste finito de capacidade: build/TS/lint e103 testes. C3/C4 e demais UI proofs continuam não verificadas: navegador bloqueado/frozen, parent interrompeu recuperação conforme política.

## Independent finding fix — 2026-10-01
- Proximidade não permite chat através de paredes. Chegada exige segmentClear físico + <=1.5m; caminho busca alvo real e bloqueio terminal é explícito. Regressões cobrem parede com abertura e parede inacessível.
- Testes C3/C4 verificam contrato do shader usado e bounds de ativação sem GPU; não são prova visual. Pointers/provas extras em checks corrigidos mantendo obrigações e assertions.
- Gate exit0: build/TS/lint/107 testes; código congelado novamente para verifier independente.

## Scoped proof gap closure — 2026-10-01
- C18 admissão compartilhada usada pelo saveDesk e deskStore real: write failure, capacidade e repetição negadas sem snapshot/ID/notification novos. Gravação localStorage agora antecede atualização de snapshot para atomicidade visível.
- C19 funções de apresentação consumidas por componentes reais resetam gait/bob e tornam inclinação/montagem discretas; testadas com Groups Three. C22 remove interlocutor/cancela explicitamente, preservando no-arrival/no-talking.
- C13 helper server-only historyFileIO é o adapter real do repository. Processo isolado react-server executa FS nativo:700/600, troca por rename, falha de escrita por diretório sem permissão conserva antigo, arquivos corrompidos rejeitam read/append sem mutação.
- Provas extras anexadas mantendo originais. Gate scripts/verify.sh --webpack exit0: build/TS/lint/111 testes. Nenhum commit/dependência; visual ainda não verificado.

## Scoped C3 DPR fix — 2026-10-01
- Render target/depth agora usam drawing buffer físico do renderer e atualizam quando resize/DPR muda; uniforms de blur continuam em unidades CSS.
- Teste usa updater da produção com WebGLRenderTarget/DepthTexture Three reais, DPR1/1.5/2+resize, preservando dimensão física e evitando reallocação redundante.
- Gate scripts/verify.sh --webpack exit0: build/TS/lint/112 testes. Sem PASS visual, commit ou dependência.
