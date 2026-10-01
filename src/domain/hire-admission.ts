import type {DeskRecord} from './desks';
import type {JobForm} from './job-form';
import type {AgentEvent} from './agent-event';
import {localWingOverflow,cloudDeskOverflow} from './placement';
/** Admission runs before the sole storage mutation; caller confirms only on return. */
export function admitHire(input:{form:JobForm;session:number;confirmed:number;desks:readonly DeskRecord[];localEvents:Partial<Record<'cursor'|'anthropic'|'openai',AgentEvent|null>>;observed:AgentEvent|null},add:(form:JobForm)=>DeskRecord):DeskRecord {
 if(input.confirmed===input.session)throw new Error('Esta contratação já foi confirmada. O posto está reservado.');
 const tentative={id:'pending',form:input.form,createdAt:''};
 if(localWingOverflow([...input.desks,tentative],input.localEvents)||cloudDeskOverflow([...input.desks,tentative],input.observed))throw new Error('Capacidade atingida: nove postos por ala, incluindo sessões observadas. Os corredores ficam reservados.');
 return add(input.form);
}
