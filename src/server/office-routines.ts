import 'server-only';
import {createRoutineControl} from '@/domain/routines-http';
const globalRoutines=globalThis as typeof globalThis & {__officeRoutineControl?:ReturnType<typeof createRoutineControl>};
export const routineControl=globalRoutines.__officeRoutineControl??=createRoutineControl();
