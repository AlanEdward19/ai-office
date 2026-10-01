# ADR 0003 — Reuniões locais por área

Status: accepted pelo plano area-meetings aprovado em 2026-09-30.

Presença por aba autenticada usa o canal SSE existente e independe de captura de mídia.
O servidor calcula a área geométrica a partir do layout publicado pelo anfitrião;
nenhum cliente escolhe o identificador da reunião.

Sinalização WebRTC exige participantes na mesma reunião não nula. Uma conversa
privada ocupa a reunião dos dois participantes apenas após convite e aceitação
identificados pelas sessões. Convites expiram em 30 segundos e têm limites de
proximidade de 2,5 m; conversas terminam ao mudar área/andar ou afastar mais de 3,5 m.

Trancas impedem ingresso no servidor e no movimento local; quem está dentro pode
sair. A responsabilidade transfere para ocupante restante, e a área vazia destranca.

Tudo fica na memória do processo local. Desconexão remove a presença imediatamente;
a posição pode ser recuperada por 30 segundos pela mesma identidade autenticada,
sem recuperar conversa privada encerrada. Tokens nunca aparecem no roster público.

Alternativa rejeitada: filtrar áudio somente na interface, deixando sinalização
entre reuniões permitida. Não há dependências, armazenamento persistente ou TURN novo.

O stream autenticado /api/call também transporta snapshots do escritório e, só para
anfitrião, eventos locais/cloud existentes com prefixos distintos. Uma conexão SSE
por aba evita esgotar as seis conexões HTTP/1 do navegador ao abrir duas abas.
Observadores são encerrados junto com esse stream; payloads de reunião permanecem
separados dos eventos de agentes e nenhum evento local é encaminhado a colegas.
