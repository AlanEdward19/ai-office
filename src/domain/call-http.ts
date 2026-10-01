import { isPeerId, type CallResult } from './call';
export function callStreamStatus(authenticated: boolean, peer: string): 200 | 400 | 401 {
  return !authenticated ? 401 : !isPeerId(peer) ? 400 : 200;
}
/** Shared HTTP boundary: the route supplies authenticated identity and the in-memory command. */
export async function callCommandResponse(request: Request, session: { token: string } | null, command: (input: {token:string;from:string;to:string;signal:unknown;action:unknown})=>CallResult): Promise<Response> {
  if (!session) return Response.json({error:'signed_out'},{status:401});
  let body: unknown;
  try { body=await request.json(); } catch { return Response.json({error:'invalid'},{status:400}); }
  if (!body || typeof body!=='object') return Response.json({error:'invalid'},{status:400});
  const r=body as Record<string,unknown>;
  if (typeof r.from!=='string'||!isPeerId(r.from)) return Response.json({error:'invalid'},{status:400});
  const result=command({token:session.token,from:r.from,to:typeof r.to==='string'?r.to:'',signal:r.signal,action:r.action});
  if (result.ok) return Response.json(result);
  const status=result.reason==='invalid'?400:result.reason==='forbidden'||result.reason==='locked'?403:409;
  return Response.json({error:result.reason},{status});
}

/** The route delegates its response boundary here; invalid/auth failures never open a stream. */
export function callStreamResponse<T>(request: Request, session: T | null, open: (peer: string, session: T) => Response): Response {
  const peer = new URL(request.url).searchParams.get('peer') ?? '';
  const status = callStreamStatus(Boolean(session), peer);
  if (status !== 200 || session === null) return Response.json({error:status===401?'signed_out':'invalid'},{status});
  return open(peer,session);
}
