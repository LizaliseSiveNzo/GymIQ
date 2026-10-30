export const DEEPSEEK_MODELS = ['deepseek-flash', 'deepseek-v4-pro'];
export function deepseekPayload(messages, options = {}) {
  const model = options.model || 'deepseek-flash';
  if (!DEEPSEEK_MODELS.includes(model)) throw Error('Unsupported DeepSeek model.');
  return {model, messages, thinking:{type:'disabled'}, stream:false,
    max_tokens:options.maxTokens || 768,
    ...(options.tools ? {tools:options.tools} : {response_format:{type:'json_object'}})};
}
export async function callDeepSeek(key, payload, fetcher = fetch) {
  const response = await fetcher('https://api.deepseek.com/chat/completions', {
    method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify(payload), signal:AbortSignal.timeout(45000),
  });
  if (!response.ok) throw Error(response.status === 402 ? 'DeepSeek balance is empty. Add credit in your DeepSeek account.' : response.status === 429 ? 'DeepSeek is busy. Try again shortly.' : 'DeepSeek is temporarily unavailable.');
  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice || !['stop','tool_calls'].includes(choice.finish_reason)) throw Error('DeepSeek could not finish this response. Try a shorter request.');
  return {message:choice.message, tokens:Number(data.usage?.total_tokens)||0};
}
