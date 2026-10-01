import {historyResponse} from '@/domain/agent-history';
import {findSession} from '@/server/office-channel';
import {readAgentHistory} from '@/server/agent-history';
export const runtime='nodejs';
export async function GET(request:Request){return historyResponse(request,findSession(request),readAgentHistory);}
