import 'server-only';
import {mkdir,readFile,rename,writeFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import type {HistoryIO} from '@/domain/agent-history';
/** Native private persistence shared by the server repository and filesystem proofs. */
export function historyFileIO(directory:string):HistoryIO {
 const file=join(directory,'history.json');
 return {
  async read(){try{return await readFile(file,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}},
  async writeAtomic(raw){await mkdir(directory,{recursive:true,mode:0o700});const temporary=join(directory,`history-${crypto.randomUUID()}.tmp`);try{await writeFile(temporary,raw,{mode:0o600,flag:'wx'});await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}},
 };
}
