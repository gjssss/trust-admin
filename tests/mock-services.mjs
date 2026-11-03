import { createServer } from 'node:http'

// Local contract fixtures for browser verification; never used by the application.
const fakeResult = { predicted_class: 0, confidence: 0.8, probabilities: { real: 0.8, fake: 0.2 }, label: '非谣言' }
const botResult = { label: 'human', prediction: 0, confidence: 0.9, probabilities: { human: 0.9, bot: 0.1 }, analysis: { status: 'success', summary: '测试账号分析', risk_level: 'low' } }
const model = { id: 'test-model', name: '接口契约测试模型', path: '/models/test' }
function launch(port, handler) {
  createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString()
    try { const result = handler(new URL(req.url, 'http://localhost'), req, body); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)) }
    catch (error) { res.statusCode = 400; res.end(JSON.stringify({ error: error.message })) }
  }).listen(port, '127.0.0.1', () => console.log(`Contract fixture listening on ${port}`))
}
launch(30101, (url, req, body) => {
  if (url.pathname === '/api/health') return { success: true, status: 'healthy', timestamp: new Date().toISOString(), model_loaded: true, device: 'cpu' }
  if (url.pathname === '/api/models') return { success: true, models: [model] }
  if (url.pathname === '/api/models/test-model/load') return { success: true, model }
  if (url.pathname === '/api/detect/single') { const data = JSON.parse(body); if (!data.text && !data.image) throw Error('Missing input'); return { success: true, result: fakeResult } }
  if (url.pathname === '/api/detect/batch') { const data = JSON.parse(body); return { success: true, results: data.items.map((_, index) => ({ index, success: true, ...fakeResult })), summary: { total: data.items.length, success: data.items.length, error: 0 } } }
  if (url.pathname === '/api/analyze/ai') return { success: true, llm_analysis: { overall_assessment: { summary: '接口契约测试分析', overall_risk_level: 'low' } } }
  throw Error('Unknown fake-news contract path')
})
launch(30102, (url, req, body) => {
  if (url.pathname === '/health') return { success: true, message: 'ok', data: { status: 'healthy', model: 'test', device: 'cpu' } }
  if (url.pathname === '/bot') { if (!JSON.parse(body).user) throw Error('Missing user wrapper'); return { success: true, message: 'ok', data: botResult } }
  if (url.pathname === '/bot/batch') { const { items } = JSON.parse(body); return { success: true, message: 'ok', data: { total: items.length, success_count: items.length, failed_count: 0, results: items.map((_, index) => ({ index, ...botResult })), errors: null } } }
  throw Error('Unknown bot contract path')
})
launch(30103, (url, req, body) => {
  if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) throw Error('Expected form encoding')
  const text = new URLSearchParams(body).get('textarea'); if (!text) throw Error('Missing textarea')
  if (/^\/(cn|en)_detect$/.test(url.pathname)) return { res: text, preds: [0.85, 0.15], jud: 'human' }
  if (/^\/(cn|en)_source$/.test(url.pathname)) return { res: [['human', 0.85], ['test-model', 0.15]], model_list: ['human', 'test-model'], model_name: 'human' }
  throw Error('Unknown AIGT contract path')
})
