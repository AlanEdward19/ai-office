# Escritório vivo: áreas, circulação e agentes
## Problem
Áreas mobiliadas não ativam reunião de maneira consistente; paredes, móveis, limites e corredores vêm de geometrias independentes. Corredores de 0,35 m não comportam o avatar de 0,48 m e a fachada não tem entrada. Agentes permanecem estáticos e o painel conserva apenas atividade parcial em memória. O usuário pede circulação coerente, isolamento visual, histórico real e animações de rotina, contratação e conversa.
## Flow
Reutiliza chamada autenticada, observadores e conversa privada existentes; aparência nunca inventa trabalho ou respostas.
- OfficeApp/OfficeScene/OfficePlayer (exists): mapa canônico → geometria, áreas, colisões e rotas → pessoas entram por porta e circulam.
- meetingAreas/call-channel/OfficeCall (exists): mesma área física → reunião autorizada e destaque visual → exterior escurecido/desfocado.
- observe-local/observe-cursor/agent-conversation (exists): eventos reais e sessões/execuções anteriores acessíveis por leitura do provedor → histórico limitado no servidor (door 1) → AgentPanel (exists), privado ao anfitrião.
- AgentRoutine (new, no door - domínio e cena): estado real, relógio e destinos → trajetória transitável → trabalhar, café, dormir, guardar pertences e saída visual.
- desk-store/OfficeApp (exists): contratação confirmada → RH pela entrada → montar mesa/cadeira → novo agente pela entrada → posto reservado.
- AgentRoutine/AgentPanel (exists/new, no door - domínio e UI): ação de conversar ou evento real de mensagem → rota contra colisões reais e áreas trancadas → aproximar interlocutor → diálogo privado na aba Conversa com compositor e resposta existente.
## Impact
| Front | What changes |
| --- | --- |
| domain | layout único passa a definir sala, área de reunião, passagem, entrada, mesa e destino; roomSlot e meetingAreas deixam coordenadas independentes |
| domain | agente lógico continua observável; presença visual pode estar trabalhando, em pausa, chegando, saindo ou ausente |
| stored data | novo histórico local versionado, sem importar dados inexistentes nem modificar hooks; posições antigas de salas são recalculadas preservando IDs e vínculos |
## Relations
Escritório contém andares; andar contém áreas e caminhos. Agente tem uma mesa e várias execuções observadas; execução pertence a provedor local/cloud real. Rotina usa uma rota e no máximo um interlocutor. Contratação reserva uma mesa antes da chegada. Histórico e conteúdo de conversa pertencem ao anfitrião da máquina; colegas recebem só presença e animações sanitizadas.
## Surface
| Route | In | Out | Status |
| --- | --- | --- | --- |
| GET /api/agents/history | agente, cursor de paginação | execuções, próximo cursor, disponibilidade histórica | 200, 400, 401, 403, 503 |
| GET/POST /api/office/routines | configurações ou ação de aproximação/destino | rotina sanitizada; erro legível | 200, 400, 401, 403, 409 |
| GET /api/call | peer existente | snapshot com layout/área e presença visual sanitizada | 200, 400, 401 |
## Landing
| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1: histórico local | arquivo privado versionado v1 em diretório local ignorado pelo Git; até 500 execuções por máquina, 30 dias; até 12.000 caracteres de resumo por execução; gravação atômica | memória apenas: perde histórico ao reiniciar; banco/dependência nova: desnecessário para escritório local |
| 2: layout compartilhado | IDs estáveis de área/mesa/porta e geometria única consumida por cena, reunião e navegação | inferir áreas de malhas separadas: recria corredores inacessíveis e reuniões inconsistentes |
- ADR registrará retenção, privacidade e layout antes da implementação; nada altera contratos de hooks locais.
## Criteria
### S1: ambiente e reuniões coerentes (P1)
**Acceptance Criteria**
1. The system SHALL definir todas as áreas mobiliadas de térreo/RH/projetos no mapa canônico, com nome, limites e entrada transitável; corredores SHALL permanecer fora das reuniões.
2. WHEN pessoa cruza entrada de área livre THEN o sistema SHALL ativar a reunião correspondente usando os mesmos limites na cena e servidor.
3. WHILE pessoa ocupa área o cenário exterior SHALL ficar escurecido sem preto opaco e desfocado; interior, avatar e controles SHALL permanecer nítidos, sem ocultar nomes/ações da reunião.
4. WHEN pessoa sai ou muda área/andar THEN o efeito SHALL acompanhar a área atual e desaparecer fora das áreas, preservando isolamento, trancas e consentimento existentes.
5. The system SHALL fornecer porta de entrada na fachada ligada a recepção, todas as salas, café, mesas e elevador por corredores livres de pelo menos 1,2 m, sem rotas através de paredes/móveis.
6. WHEN layout recebe novas salas/mesas THEN o sistema SHALL reservar caminhos e desembarque do elevador, posicionar somente em espaços válidos e informar capacidade atingida sem sobreposição.
7. WHERE câmera é primeira/terceira/isométrica o sistema SHALL manter circulação e acessos equivalentes; isométrica SHALL manter paredes e omitir teto.
**Independent test:** visitar cada área nos dois andares e três câmeras; verificar reunião, máscara e caminho de entrada/saída com colisões reais.
### S2: histórico honesto de tarefas (P1)
**Acceptance Criteria**
8. WHEN anfitrião abre histórico ou observador registra trabalho THEN o sistema SHALL importar por leitura execuções/sessões locais/cloud anteriores acessíveis pelo provedor e conservar novas execuções reais com identidade, título conhecido, provedor/origem, início/fim conhecidos, estado e resumo disponível, sem duplicar a mesma execução; campos não fornecidos SHALL indicar desconhecido.
9. WHEN anfitrião abre histórico do agente THEN o painel SHALL mostrar execuções mais recentes primeiro com paginação e estados carregando, vazio, erro e indisponibilidade histórica explícitos.
10. IF execução anterior não foi observada nem recuperada pelo provedor THEN o sistema SHALL informar histórico indisponível, sem inventar tarefa, conclusão ou conteúdo.
11. The system SHALL negar histórico/conversas a colegas e excluir segredos, tokens, paths sensíveis e argumentos brutos de ferramentas de histórico e eventos compartilhados.
12. WHEN processo do escritório reinicia THEN o histórico válido SHALL continuar disponível; arquivo corrompido SHALL gerar erro recuperável e não ser sobrescrito silenciosamente.
13. The system SHALL aplicar limites de 500 execuções por máquina e 30 dias, com gravação atômica e truncamento explícito de resumos acima de 12.000 caracteres.
**Independent test:** observar execuções reais/injetadas pelo adaptador de teste, reiniciar armazenamento e conferir ordenação, retenção, duplicatas e negativa a colega.
### S3: rotina e contratação animadas (P1)
**Acceptance Criteria**
14. WHEN agente termina trabalho THEN sua presença visual SHALL permanecer no escritório, alternando pausa no café ou sono na mesa enquanto ocioso, sem apresentar nova tarefa fictícia.
15. WHEN ociosidade contínua atinge prazo ajustável de 5 minutos por padrão THEN agente SHALL voltar à própria mesa, guardar pertences e sair pela porta por rota transitável; a saída visual SHALL preservar mesa e histórico, sem cancelar processo ou tarefa real.
16. WHEN agente recebe trabalho durante pausa/saída ou está ausente THEN ele SHALL cancelar a saída, voltar ou entrar pela porta e chegar à mesa por caminho válido; estado real SHALL prevalecer sobre a animação.
17. WHEN contratação é confirmada e há capacidade THEN RH SHALL entrar correndo pela porta, chegar ao posto reservado e animar montagem de mesa/cadeira antes da entrada e caminhada do novo agente ao posto.
18. IF contratação falha, é repetida ou não há capacidade THEN o sistema SHALL evitar agentes/mesas duplicados, manter caminhos livres e mostrar motivo sem simular contratação concluída.
19. WHILE personagem se move o sistema SHALL animar pernas/braços, direção e transições suaves com duração finita, sem teletransporte, passagem por colisões ou oscilação infinita; movimento reduzido SHALL usar transições discretas acessíveis.
**Independent test:** relógio controlado para pausa/saída/retorno; contratação duas vezes e mapa cheio; observar trajetos e montagem nos três modos.
### S4: conversa presencial (P1)
**Acceptance Criteria**
20. WHEN anfitrião solicita conversar com agente THEN agente SHALL dirigir-se até a posição atual do usuário e abrir AgentPanel na aba Conversa privada ao chegar a até 1,5 m, oferecendo histórico, compositor, envio, resposta em andamento e erro no estilo de chat existente.
21. WHEN há solicitação explícita de encontro entre agentes ou mensagem real endereçada a interlocutor conhecido THEN personagem emissor SHALL aproximar-se do destinatário por rota válida antes da indicação visual de conversa, sem criar mensagens/execuções reais fictícias.
22. IF usuário/destinatário muda andar, desaparece, cancela encontro ou não há rota THEN aproximação SHALL cancelar ou recalcular com estado legível; envio ao provedor SHALL ocorrer somente por ação autorizada de conversa.
23. WHILE conversa presencial acontece o sistema SHALL respeitar reunião/tranca e privacidade existentes; conversa de agente SHALL continuar disponível apenas ao anfitrião.
**Independent test:** pedir encontro, mover usuário, bloquear rota e cancelar; conferir abertura na chegada e ausência de mensagem automática ao provedor.
## Out of scope
| Excluded | Why |
| --- | --- |
| inventar históricos anteriores ou recuperar conteúdo não exposto pelo provedor | não existe fonte verificável |
| agentes iniciarem tarefas/mensagens por decisão da animação | aparência não autoriza execução real |
| áudio sintético, gravação, TURN/SFU, deploy permanente | mantém escritório local e integrações existentes |
## Assumptions
| Assumption | Chosen default | Rationale | Confirmed? |
| café ou sono | alternância determinística por agente, sem RNG por frame | rotina agradável e verificável | n |
| encontro entre agentes | ação explícita no painel; evento real quando adaptador trouxer destinatário | fonte atual não garante destinatário de mensagens entre agentes | n |
| profile | ui | efeitos, corredores e coreografia precisam de revisão visual além de testes | n |
**Open questions:** none - defaults acima aguardam confirmação do plano completo.
## Observable
| Surface | Decision | Landing |
| cena/reunião | área, máscara, tranca, acessos e três câmeras | AC 1–7 |
| histórico | estados, ordem, paginação, truncamento e acesso | AC 8–13 |
| rotina/configuração | prazo padrão, pausas, retorno e movimento reduzido | AC 14–16, AC 19 |
| contratação | montagem, chegada, capacidade e falha | AC 17–19 |
| conversa presencial | chegada, compositor, progresso, erro e cancelamento | AC 20–23 |
| novas APIs | erro JSON legível, autenticação e conflitos | AC 9, AC 11, AC 18, AC 22 |
| novas APIs | versão e limite de chamadas | n/a - protocolo interno local, entradas limitadas e paginação; não API pública |
## Sources
- Pedido do usuário: áreas sem call, exterior desfocado/escuro, layout coerente, histórico local/cloud e agentes com rotina, chegada RH e conversa presencial.
- Plano aprovado area-meetings: isolamento por área, trancas, confirmação e desembarque seguro permanecem obrigatórios.
