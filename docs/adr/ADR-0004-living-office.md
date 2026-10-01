# ADR-0004 — Escritório vivo

Status: aceito no plano living-office pelo usuário em 2026-09-30.

Layout canônico usa oito salas com corredores de 1,55 m, portas de sala de 1,8 m e porta frontal de 2 m. Cena, reunião e navegação consomem suas coordenadas; caminhos são calculados contra colisões extraídas das malhas reais. Há nove postos cloud e nove locais, com capacidade explícita e áreas Café/Laboratório ao norte da ala local. Limites de capacidade impedem sobreposição e preservam acesso ao elevador.

Histórico privado v1 fica em `.office-data/history.json`, ignorado pelo Git, com gravação atômica, no máximo 500 execuções/30 dias e resumo de 12.000 caracteres. Somente o anfitrião lê histórico ou pede encontros. Importadores apenas leem fontes existentes; ausência de conteúdo é explicitada, nunca preenchida com trabalho fictício.

Rotina visual não inicia/cancela tarefas. Trabalho real tem precedência sobre café, sono e saída. Contratação reserva posição antes da montagem de RH. Encontros são ações explícitas e a chegada abre conversa sem enviar mensagem.

Alternativas rejeitadas: coordenadas independentes recriam áreas e corredores inconsistentes; memória perde histórico; banco ou dependência nova não é necessário para a aplicação local.

O efeito de área usa render target HDR HalfFloat, máscara depth→world e saída com os chunks Three de tone mapping/colorspace uma única vez. Dentro da área conserva a cor linear da cena; revisão visual de GPU permanece necessária. Navegação usa segmentos/AABB analíticos e conecta pontos reais à grade antes da simplificação, evitando amostragem instável nos cantos.
