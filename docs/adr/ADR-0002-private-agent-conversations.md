# ADR-0002 — Conversas privadas por mesa

Status: aceito para implementação local solicitada.

As conversas pertencem ao anfitrião e à mesa (Cursor também ao cloud agent selecionado); não entram no SharedScene nem nos observadores de ferramentas. GET lê estado sem iniciar trabalho. POST inicia somente por mensagem explícita do anfitrião.

Codex exec JSON e Claude print stream-json criam sessões próprias e retomam seu identificador. Spawn usa shell false e permissões normais, sem bypass. O parser expõe apenas textos de assistant e nomes de ferramentas, nunca argumentos, raciocínio ou stderr.

Estado in-memory limita 100 mesas, 40 mensagens de 12k caracteres, 20 atividades e 2MB de saída por execução. Só um processo local por mesa; stop de Cursor descobre o latest run mesmo quando iniciado pelo dispatch; timeout de cinco minutos e ausência de viewers encerram processos. Nenhuma dependência nova.

Cursor usa Basic server-side, POST v1 runs e GET run result; histórico completo usa GET v0 conversation quando disponível. Não há endpoint conversation v1 documentado. A indisponibilidade do histórico legado deixa visível o histórico local e o resultado final v1.

Alternativa rejeitada: capturar stdout ou sessões de observadores existentes, pois mistura propriedade e dados privados.

Referências: https://prod.cursor.com/docs/cloud-agent/api/endpoints e https://prod.cursor.com/docs/cloud-agent/api/v0 .

SharedScene também permite apenas displayName validado (60 caracteres) e hostTimeZone IANA validado para apresentação de nomes/fusos. O timezone é o do navegador anfitrião; cloud agents não recebem um fuso humano presumido.
