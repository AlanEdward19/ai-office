import {routinesResponse} from '@/domain/routines-http';
import {findSession,officeSceneSnapshot} from '@/server/office-channel';
import {routineControl} from '@/server/office-routines';
export const runtime='nodejs';
export async function GET(request:Request){return routinesResponse(request,findSession(request),routineControl,officeSceneSnapshot()?.agents??[]);}
export async function POST(request:Request){return routinesResponse(request,findSession(request),routineControl,officeSceneSnapshot()?.agents??[]);}
