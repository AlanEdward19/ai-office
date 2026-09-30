import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationInput,parseConversationEvent,cursorConversation} from './agent-conversation';
test('conversation input validates desk provider and cloud identifiers', () => {
  assert.ok(conversationInput({deskId:'local-observed:openai',provider:'openai'}));
  assert.ok(conversationInput({deskId:'local:uuid',provider:'anthropic'}));
  assert.equal(conversationInput({deskId:'../secret',provider:'openai'}),null);
  assert.equal(conversationInput({deskId:'desk',provider:'shell'}),null);
  assert.equal(conversationInput({deskId:'desk',provider:'cursor',cursorAgentId:'a/b'}),null);
  assert.deepEqual(conversationInput({deskId:'desk',provider:'openai'}),{deskId:'desk',provider:'openai',cursorAgentId:undefined});
});
test('conversation parser exposes only assistant text and tool names', () => {
  assert.deepEqual(parseConversationEvent('openai',{type:'item.completed',item:{type:'agent_message',text:'Hello'}}),{text:'Hello'});
  assert.deepEqual(parseConversationEvent('openai',{type:'item.started',item:{type:'command_execution',command:'SECRET',args:{token:'SECRET'}}}),{tool:'command_execution'});
  assert.deepEqual(parseConversationEvent('anthropic',{type:'assistant',message:{content:[{type:'text',text:'Done'},{type:'tool_use',name:'Read',input:{path:'SECRET'}}]}}),{text:'Done',tool:'Read'});
  assert.deepEqual(parseConversationEvent('anthropic',{type:'user',message:{content:'SECRET'}}),{});
  assert.deepEqual(parseConversationEvent('openai',{type:'item.completed',item:{type:'reasoning',text:'SECRET'}}),{});
  assert.deepEqual(parseConversationEvent('openai',{type:'thread.started',thread_id:'thread'}),{sessionId:'thread'});
});
test('cursor conversation excludes tools and bounds history', () => {
  assert.deepEqual(cursorConversation({messages:[{type:'tool_call',text:'SECRET'},{type:'assistant_message',text:'Hi',args:'SECRET'}]}),[{role:'assistant',text:'Hi'}]);
  assert.equal(cursorConversation({messages:Array.from({length:50},()=>({type:'user_message',text:'a'.repeat(13000)}))}).length,40);
  assert.equal(cursorConversation({messages:[{type:'user_message',text:'a'.repeat(13000)}]})[0].text.length,12000);
});
