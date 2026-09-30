export type ConversationProvider = 'openai' | 'anthropic' | 'cursor';
export type ConversationMessage = { role: 'user' | 'assistant'; text: string };
export type ConversationSnapshot = { status: 'idle' | 'running' | 'error' | 'stopped'; messages: ConversationMessage[]; activity: string[]; error?: string };
export function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function conversationInput(value: unknown) {
  const v = record(value);
  if (typeof v.deskId !== 'string' || !/^[\w:-]{1,100}$/.test(v.deskId) || !['openai','anthropic','cursor'].includes(String(v.provider))) return null;
  if (v.cursorAgentId != null && (typeof v.cursorAgentId !== 'string' || !/^[\w-]{1,120}$/.test(v.cursorAgentId))) return null;
  return { deskId: v.deskId, provider: v.provider as ConversationProvider, cursorAgentId: v.cursorAgentId as string | undefined };
}
export function parseConversationEvent(provider: ConversationProvider, value: unknown): { text?: string; tool?: string; sessionId?: string } {
  const v = record(value);
  if (provider === 'openai') {
    if (v.type === 'thread.started' && typeof v.thread_id === 'string') return {sessionId:v.thread_id};
    const item = record(v.item);
    if (v.type === 'item.completed' && item.type === 'agent_message' && typeof item.text === 'string') return {text:item.text};
    if (v.type === 'item.started' && ['command_execution','mcp_tool_call','file_change','web_search'].includes(String(item.type))) return {tool: typeof item.tool === 'string' ? item.tool.slice(0,80) : String(item.type)};
  }
  if (provider === 'anthropic') {
    if (v.type === 'system' && typeof v.session_id === 'string') return {sessionId:v.session_id};
    if (v.type === 'assistant') {
      const content = record(v.message).content;
      if (Array.isArray(content)) {
        const text = content.map(record).filter(c => c.type === 'text' && typeof c.text === 'string').map(c => c.text).join('\n');
        const tool = content.map(record).find(c => c.type === 'tool_use' && typeof c.name === 'string');
        return { ...(text ? {text} : {}), ...(tool ? {tool:String(tool.name).slice(0,80)} : {}) };
      }
    }
  }
  return {};
}
export function cursorConversation(value: unknown): ConversationMessage[] {
  const messages = record(value).messages;
  return Array.isArray(messages) ? messages.map(record).filter(m => ['user_message','assistant_message'].includes(String(m.type)) && typeof m.text === 'string').slice(-40).map(m => ({role:m.type === 'user_message' ? 'user' : 'assistant',text:String(m.text).slice(0,12000)})) : [];
}
