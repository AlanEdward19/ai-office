# Evidências
- scripts/verify.sh --webpack: build Next, lint e testes domínio.
- agent-profile.test: validação/persistência de nomes.
- agent-conversation.test: IDs reais, filtragem de transcripts/argumentos, limites histórico.
- phase2.test: dispatch para os três providers.
- office-time.test: conversão São Paulo/Tóquio, fuso inválido rejeitado na publicação.
- walker.test: entrada de sala com colisão.
- UI: browser conferido 1280x720 e 360x800, criador com rolagem; sem envio externo.
- Revisão independente agent_profile: três gaps de Cursor/cancel/process lifecycle corrigidos por verify_social.
- Não validado contra execução paga/autenticada de provedores; erros reais ficam visíveis no painel.
