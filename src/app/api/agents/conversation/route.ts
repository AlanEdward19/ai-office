import {conversationInput,record} from '@/domain/agent-conversation';
import {findSession} from '@/server/office-channel';
import {ConversationError,readAgentConversation,startAgentConversation,stopAgentConversation} from '@/server/agent-conversation';
export const runtime='nodejs';
async function handle(request:Request,send:boolean){
  const session=findSession(request);
  if(!session||session.role!=='host')return Response.json({error:'Somente o anfitrião pode conversar com os agentes.'},{status:403});
  try{
    if(send && Number(request.headers.get('content-length'))>16000)return Response.json({error:'Mensagem muito grande.'},{status:413});
    const text=send?await request.text():'';
    if(text.length>16000)return Response.json({error:'Mensagem muito grande.'},{status:413});
    const raw=send?record(JSON.parse(text)):Object.fromEntries(new URL(request.url).searchParams);
    const input=conversationInput(raw);
    if(!input)return Response.json({error:'Mesa ou provedor inválido.'},{status:400});
    const scoped={...input,hostToken:session.token};
    const result=send?(raw.action==='stop'?await stopAgentConversation(scoped):await startAgentConversation({...scoped,message:raw.message as string})):await readAgentConversation(scoped);
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error instanceof ConversationError?error.message:'Não foi possível acessar a conversa.'},{status:error instanceof ConversationError?error.status:error instanceof SyntaxError?400:503});}
}
export async function GET(request:Request){return handle(request,false);}
export async function POST(request:Request){return handle(request,true);}
