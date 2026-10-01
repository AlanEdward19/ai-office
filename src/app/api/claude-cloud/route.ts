import {canPerform} from '@/domain/office-share';
import {findSession} from '@/server/office-channel';
import {openClaudeCloudStream} from '@/server/claude-cloud-stream';
export const dynamic='force-dynamic';
export async function GET(request:Request){const session=findSession(request);if(!session||!canPerform(session.role,'publish'))return Response.json({error:'read_only'},{status:403});return openClaudeCloudStream(request);}
