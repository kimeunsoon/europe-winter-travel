const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const route = new Module('chat-route');
route._compile(ts.transpileModule(fs.readFileSync('app/api/chat/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, 'chat-route.cjs');
const { POST } = route.exports;
const request = (body, origin = 'http://localhost') => new Request('http://localhost/api/chat', { method: 'POST', headers: { origin }, body: JSON.stringify(body) });

test('rejects invalid input and foreign origin before calling API', async () => {
  for (const body of [null, {}, { messages: [] }, { messages: [{ role: 'system', content: 'x' }] }, { messages: [{ role: 'user', content: 'x'.repeat(4001) }] }, { messages: Array(21).fill({role:'user',content:'x'}) }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal((await POST(request({}, 'https://other.example'))).status, 403);
});
test('missing key, sourced answer, upstream errors and timeout', async () => {
  const originalKey = process.env.CHAPT_KEY;
  const originalFetch = global.fetch;
  const body = { messages: [{ role: 'user', content: 'Portugal January, two people' }] };
  try {
    delete process.env.CHAPT_KEY;
    assert.equal((await POST(request(body))).status, 503);
    process.env.CHAPT_KEY = 'test-key';
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const sent = JSON.parse(options.body);
      assert.equal(sent.store, false);
      assert.equal(sent.tools[0].type, 'web_search');
      assert.deepEqual(sent.input, body.messages);
      return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Trip [1]', annotations: [{type:'url_citation',url:'https://example.com',title:'Tour',start_index:5,end_index:8}] }] }] });
    };
    const answer = await POST(request(body));
    assert.equal(answer.status, 200);
    const json = await answer.json();
    assert.equal(json.parts[0].annotations[0].url, 'https://example.com');
    assert.ok(!JSON.stringify(json).includes('test-key'));
    global.fetch = async () => new Response('', { status: 429 });
    assert.equal((await POST(request(body))).status, 429);
    global.fetch = async () => Response.json({output:[]});
    assert.equal((await POST(request(body))).status, 502);
    global.fetch = async () => { throw new Error('timeout'); };
    assert.equal((await POST(request(body))).status, 504);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.CHAPT_KEY; else process.env.CHAPT_KEY = originalKey;
  }
});
