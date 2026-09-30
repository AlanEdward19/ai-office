# Interações e acabamento do escritório
## Objetivo
Painel acionado pela mesa com atividade, conversa, cards, renomear e contratação; Codex, Claude e Cursor reais. Completar teto/relógio/fusos e espaçamento responsivo.
## Fluxo
Mesa → AgentPanel → API privada do anfitrião → sessão CLI própria ou cloud agent vinculado ao card.
Cards → quadro Linear existente → dispatch para provedor autenticado.
Perfis persistem por ID no navegador; conversas privadas em memória durante sessão do escritório.
## Critérios
1. WHEN E é pressionado junto à mesa THEN o painel SHALL abrir.
2. WHEN o anfitrião renomeia THEN o painel e o avatar SHALL exibir o nome validado.
3. WHEN uma mensagem é enviada THEN o provedor SHALL executar ou informar erro real; colegas SHALL não acessar conversas.
4. WHEN trabalho é atribuído THEN todos os três provedores autenticados SHALL aceitar cards.
5. WHILE a conversa executa THEN o painel SHALL mostrar resposta e nomes de ferramentas, sem argumentos brutos.
6. WHEN interrompido THEN um processo anterior SHALL não sobrescrever a próxima execução.
7. WHEN todas abas fecham THEN sessões gerenciadas SHALL parar e memória privada ser limpa.
8. WHILE o escritório aparece THEN teto interno e relógio SHALL usar Date da máquina.
9. WHEN um fuso de origem existe THEN outros personagens SHALL mostrar hora origem e equivalente viewer; o próprio avatar SHALL não receber etiqueta.
10. AT largura 360px THEN câmera/dock/painéis SHALL caber e preservar controles acessíveis e rolagem.
## Limites verificáveis
Avatares atuais representam agentes; não há presença 3D de humanos remotos.
CLI abre sessão própria da mesa, não toma controle das sessões observadas de terminal.
Histórico limitado a 40 mensagens/20 ações; Cursor usa histórico legado quando disponível, senão resultado do run.
Não exercitar mensagens externas, dispatch real ou permissões de câmera durante testes.
