# Compartilhamento de tela — plano para revisão

Status: proposto em 2026-10-01. Pedido autoriza planejamento; captura e implementação ainda não executadas.

## Problem
Participantes de uma reunião de área ou conversa privada não conseguem mostrar uma janela, aba ou tela aos colegas presentes. Hoje a chamada oferece somente câmera e microfone.

## Flow
1. Participante entra em reunião existente e clica em “Compartilhar tela”.
2. Navegador abre seu seletor nativo; cancelamento mantém a reunião intacta.
3. Tela escolhida é transmitida apenas aos participantes da mesma reunião; câmera e microfone continuam independentes.
4. Painel destaca apresentação, identifica quem compartilha e permite expandir/recolher mantendo controles acessíveis.
5. “Parar compartilhamento”, botão nativo do navegador, saída da área, troca de andar, desconexão ou fechamento da aba encerram captura e transmissão.

## Impact
- Mídia: reutiliza presença, isolamento por reunião e sinalização WebRTC existentes, adicionando vídeo independente de tela.
- Dados: não grava tela, não envia imagens a agentes e não persiste conteúdo; histórico de tarefas permanece privado e independente da chamada.

## Relations
| Relação | Regra |
| --- | --- |
| Participante → reunião | Servidor determina reunião vigente; nenhum destinatário externo recebe sinalização. |
| Participante → apresentação | Um fluxo de tela por participante, iniciado somente por gesto explícito. |
| Apresentação → mídia | Vídeo de tela separado da câmera; microfone existente permanece independente. |

## Surface
| Route | In | Out | Status |
| --- | --- | --- | --- |
| GET /api/call existente | Identidade de peer autenticada | Roster e sinalização da reunião vigente | 200, 400, 401 |
| POST /api/call existente | Sinalização com metadados de tela aditivos | Confirmação ou erro, guardas existentes | 200, 400, 401, 403, 409 |

## Landing
| Decisão proposta | Alternativa |
| --- | --- |
| Terceiro transceiver pré-alocado antes da oferta inicial: áudio, câmera, tela; anúncio de mídia com `screen:boolean`, ausência interpretada como false | Substituir câmera pela tela impediria mostrar ambas; criar track somente depois da conexão exigiria renegociação adicional. |
| Sem áudio do sistema na primeira entrega | Captura de áudio de aba/sistema varia por navegador e exigiria fluxo/controles adicionais. |
| Múltiplos apresentadores permitidos, foco selecionável | Exclusividade exigiria arbitragem nova no servidor. |
| Mesh WebRTC existente, sem dependência/infra nova | SFU/TURN entra em proposta separada se houver necessidade de escala/rede externa. |

## Criteria
**Acceptance Criteria**
1. WHEN participante clica em compartilhar dentro de reunião THEN sistema SHALL solicitar seleção nativa uma vez; entrar em área sozinho não solicita captura.
2. WHEN seleção é cancelada/negada THEN câmera, microfone e reunião SHALL conservar estados e interface explicar resultado.
3. WHILE compartilhamento está ativo somente membros da mesma reunião SHALL receber tela; câmera e microfone podem permanecer ativos simultaneamente.
4. WHEN outro membro chega à mesma reunião THEN ele SHALL receber apresentações já ativas sem nova captura do apresentador.
5. WHEN apresentação para pelo painel ou navegador THEN todas as tracks de tela SHALL terminar e colegas deixar de exibi-la, preservando câmera/microfone.
6. WHEN participante muda reunião/andar, sai, desconecta ou fecha aba THEN tela SHALL terminar imediatamente; resposta tardia do seletor não reativa captura no novo contexto.
7. WHILE duas apresentações estão ativas usuário SHALL conseguir escolher foco, expandir e recolher, com nome visível e controles acessíveis em viewport de 360px.
8. IF API compatível não existe THEN botão SHALL explicar indisponibilidade; sinalização inválida ou entre reuniões continua rejeitada.

## Out of scope
Gravação, controle remoto, envio automático a agentes, áudio do sistema, gravações no histórico, novos servidores de mídia.

## Assumptions
Decisões de transceiver, múltiplos apresentadores e ausência de áudio do sistema são propostas para revisão, ainda não confirmadas pelo usuário. O ambiente mantém as limitações de conectividade do WebRTC local atual.
**Open questions:** none - padrões propostos aguardam revisão do plano.

## Observable
| Surface | Decision | Landing |
| --- | --- | --- |
| Painel da chamada | Compartilhar/parar, indicador ativo e nome do apresentador | AC 1, AC 5 |
| Apresentação | Foco selecionável, expandir/recolher em viewport de 360px | AC 7 |
| Navegador | Seletor nativo, cancelamento, permissão negada e incompatibilidade | AC 1, AC 2, AC 8 |
| Mídia e sinalização | Isolamento, câmera independente e participantes novos | AC 3, AC 4, AC 8 |
| Lifecycle | Track ended, saída, desconexão e seleção tardia | AC 5, AC 6 |
| Provas futuras | Duas sessões reais e inspeção audiovisual; simulação não substitui captura nativa | AC 1–8 |

## Sources
- Pedido do usuário: “queria abrir um plan para compartilhar tela também”.
- [ADR 0003](../../../../docs/adr/ADR-0003-area-meetings.md) e chamada existente em `src/components/office/office-call.tsx`.
- [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia): seleção exige gesto do usuário, permissão não reutilizável e áudio é opcional.
