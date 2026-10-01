# Correções de interação

Escopo autorizado pelo usuário em2026-10-01: tela sólida azul em área de call, orientação de cadeiras, sentar/levantar usuário, agentes sentados com atividades visuais, histórico local acessível. Continuidade de living-office, sem dependências/commits.

- AC1 Quando entra em área de call, a cena permanece visível com efeito exterior; shader não usa nomes GLSL reservados nem quad sujeito a clipping/depth.
- AC2 Quando uma cadeira é colocada junto à mesa, sua frente e o ocupante apontam para a mesa.
- AC3 Quando usuário clica cadeira próxima livre com acesso livre, senta; movimento/Espaço, troca de andar ou correção servidor fazem levantar. A presença sanitizada informa postura a colegas.
- AC4 Quando agente trabalha/descansa na mesa, senta na cadeira após rota por trás; digitando/café/conversa têm poses. Café reserva quatro lugares, excedentes descansam no posto, sem sobreposição.
- AC5 Quando usuário clica agente ou interage com local próximo, abre perfil/histórico diretamente; conversa continua ação explícita.
- AC6 Histórico conserva dados reais/origem/autorização; nenhum teste novo substitui dados, gates prévios ou revisão visual indisponível.

Interação usa identidade de cadeira extraída da malha. Sentar é ajuste de pose de até0.7m junto ao assento; obstáculos externos nunca são excluídos. Reuniões/rotas/histórico mantêm contratos anteriores, com seated boolean opcional sanitizado no roster.
