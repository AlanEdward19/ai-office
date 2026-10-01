# Reuniões por área e presença
## Problem
A chamada atual conecta o escritório inteiro e só registra usuários depois de obter câmera/microfone. As áreas do mapa devem delimitar mini reuniões privadas, permitir trancar entradas e mostrar usuários presentes e sua localização. Também há chegada do elevador bloqueada por mobiliário; conversas por proximidade devem exigir consentimento das duas pessoas.
## Flow
- OfficeApp (exists): posição/andar → localização em área → presença autenticada no servidor.
- OfficeCall (exists): um SSE autenticado por aba agrega snapshots do escritório e observadores locais/cloud só para anfitrião; presença e participantes autorizados → conexões WebRTC somente da reunião atual.
- OfficePlayer (exists): limites das áreas trancadas → colisão/entrada recusada para quem está fora.
- OfficeHud (exists): lista de pessoas e mapa → nomes, andar, área e estado da reunião.
- OfficeScene/OfficePlayer (exists): personagem remoto clicável → convite confirmado → aceitação do destinatário → reunião privada de duas pessoas.
- Elevator/arrivalPose (exists): orientação, posição de chegada e corredor reservado → desembarque e movimento sem colisão com móveis.
## Impact
| Front | What changes |
| --- | --- |
| domain | Área: limites geométricos estáveis; reunião: participantes autorizados dentro da área |
| domain | chamada global existente passa a ser isolada por área; presença independe de mídia |
| domain | conversa por proximidade: reunião privada temporária com exatamente dois participantes confirmados |
| stored data | nenhuma migração; presença/trancas apenas em memória enquanto abas estão conectadas |
## Relations
Participante pertence a uma sessão autenticada e ocupa no máximo uma área. Área contém zero ou muitos participantes e no máximo uma tranca. Reunião vazia não mantém tranca. Convite liga solicitante e destinatário; cada participante pertence a no máximo uma reunião ativa, de área ou privada. A conversa privada substitui a reunião da área enquanto durar.
## Surface
| Route | In | Out | Status |
| --- | --- | --- | --- |
| GET /api/call | peer | SSE presença/roster/sinal, snapshot; observadores só para host | 200, 400, 401 |
| POST /api/call | peer, posição/andar, tranca, convite/aceitação/recusa/saída ou sinal | resultado/localização autorizada | 200, 400, 401, 403, 409 |
## Landing
| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| protocolo de chamada | roster inclui área, presença e estado das trancas; sinal exige mesma reunião autorizada não nula (área ou privada confirmada) | filtrar só na UI: não impede sinalização entre áreas |
| stream por aba | /api/call agrega snapshot e observação com prefixos; mantém APIs antigas | quatro SSE por aba: duas abas esgotam conexões HTTP/1 e impedem chamadas |
| presença | fuso IANA e posição/andar publicados por participante autenticado | depender de getUserMedia: omite quem não concede câmera/microfone |
## Criteria
### S1: reunião e presença por área (P1)
**Acceptance Criteria**
1. WHEN participante entra em área livre THEN o sistema SHALL admitir sua mini reunião automaticamente.
2. WHILE participantes estão em reuniões diferentes ou sem reunião autorizada o servidor SHALL recusar oferta/resposta/ICE/mídia entre eles.
3. WHEN participante sai ou troca de área THEN o cliente SHALL fechar conexões antigas e remover reprodução de mídia imediatamente.
4. WHEN participante dentro de área tranca a reunião THEN o sistema SHALL impedir novas entradas físicas e na reunião, mantendo a saída livre.
5. WHEN quem trancou ou anfitrião destranca THEN o sistema SHALL liberar novas entradas; quando a área esvazia SHALL liberar a tranca automaticamente.
6. WHEN responsável pela tranca sai mas outros permanecem THEN o sistema SHALL transferir controle ao próximo participante presente.
7. WHILE a aba autenticada está conectada o escritório SHALL mostrar nome, andar, área e posição no mapa, mesmo sem permissão de mídia.
8. WHEN uma aba desconecta THEN o sistema SHALL remover sua presença e atualizar participantes/trancas; reconexão SHALL recuperar presença sem duplicata pelo mesmo peer.
9. WHEN uma pessoa ativa microfone/câmera THEN o cliente SHALL solicitar permissões; mídia SHALL iniciar desligada e nunca ser capturada fora de ação explícita.
10. WHEN não há parceiros, está reconectando, permissão é recusada ou área está trancada THEN o painel SHALL informar esse estado e a ação disponível.
11. The system SHALL aplicar as áreas do estudo, estúdio, café, pesquisa, CEO, convivência, RH e salas de projetos conforme o mapa atual, sem incluir corredores em reunião global.
### S2: conversa por proximidade com consentimento (P1)
**Acceptance Criteria**
12. WHEN uma pessoa clica no personagem de outra conectada no mesmo andar a até 2,5 m THEN o sistema SHALL mostrar confirmação antes de enviar convite à pessoa escolhida.
13. WHEN o solicitante confirma THEN o destinatário SHALL receber convite com nome, aceitar e recusar; nenhuma mídia SHALL circular antes de aceitar.
14. WHEN o destinatário aceita convite ainda válido THEN ambas as pessoas SHALL entrar na mesma reunião privada, isolada de todas as outras áreas/pessoas.
15. WHEN o convite é recusado, cancelado, não respondido por 30 segundos ou perde proximidade/andar THEN o sistema SHALL encerrá-lo sem iniciar reunião, informando o solicitante.
16. WHEN qualquer participante encerra, desconecta, troca de andar/área ou se afasta mais de 3,5 m THEN a conversa privada SHALL terminar para ambos, voltando à reunião permitida na localização atual.
17. IF um participante já está em conversa privada ou o convite tenta atravessar limite de área trancada THEN o servidor SHALL recusar novo convite; consentimento SHALL pertencer às duas sessões autenticadas.
### S3: desembarque seguro do elevador (P1)
**Acceptance Criteria**
18. WHEN a pessoa chega pelo elevador no térreo ou RH THEN seu avatar SHALL nascer fora de qualquer colisão, diante da porta, com caminho contínuo de pelo menos 2 m e largura livre de 1 m para o interior do andar.
19. The system SHALL manter mobiliário, paredes e áreas trancáveis fora do corredor reservado do elevador em ambos os andares; câmera e ponto de interação SHALL acompanhar a orientação real da porta.
20. WHEN a pessoa alterna térreo/RH repetidamente e anda para fora da cabine THEN o sistema SHALL permitir desembarque e retorno sem ficar preso; um teste SHALL verificar chegada e trajeto usando os obstáculos reais do layout.
## Out of scope
| Excluded | Why |
| --- | --- |
| gravação, transcrição, chat persistente e convites externos | feature local de reunião/presença; não exige serviços nem armazenamento novo |
| servidores TURN/SFU e acesso público pela internet | mantém WebRTC local existente; conectividade segue limitada à rede atual |
## Assumptions
| Assumption | Chosen default | Rationale | Confirmed? |
| localização física | limites geométricos da decoração; nomes e IDs estáveis | reunião acompanha o andar/cena existente | n |
| múltiplas abas da mesma sessão | presença por aba, indicando duplicatas no mesmo nome | cada aba tem posição e conexão próprias | n |
| conversa próxima | áudio/vídeo temporário como reunião; sem chat textual persistente | segue a equivalência com área pedida pelo usuário | n |
| participantes leitores | colegas podem caminhar e participar de áudio; restrição de cards/agentes permanece | reunião envolve todos os usuários presentes | n |
| profile | light | gate de domínio + revisão independente; sem simular aprovação de câmera | n |
**Open questions:** none - defaults acima propostos para confirmação.

## Observable
| Surface | Decision | Landing |
| painel reunião | parceiros/solo, reconexão, bloqueio, permissão negada | AC 10 |
| painel usuários/mapa | quem está conectado e localização | AC 7, AC 8 |
| tranca | controle autenticado, saída livre, limpeza | AC 4, AC 5, AC 6 |
| API call | isolamento e recusas autenticadas | AC 2, AC 4, AC 14, AC 17 |
| convite próximo | confirmação de envio, pendente/aceitar/recusar, expiração e ocupado | AC 12, AC 13, AC 15, AC 17 |
| conversa privada | encerrar, afastamento e retorno ao contexto permitido | AC 14, AC 16 |
| elevador nos dois andares | chegada, caminho livre e retorno testados | AC 18, AC 19, AC 20 |
| todas APIs | versionamento/limites | n/a - protocolo interno local, validação/limites de sinal existentes mantidos |
## Sources
- Pedido do usuário: mini reuniões por área, lock e usuários presentes/localizados, semelhantes ao Gather.
- Pedido adicional do usuário: elevador ainda preso por mesa; clicar em pessoa próxima e ambas confirmarem conversa.
- src/domain/call.ts, src/server/call-channel.ts e OfficeCall: WebRTC/SSE local existente.
