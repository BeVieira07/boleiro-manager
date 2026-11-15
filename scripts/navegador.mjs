// Abre uma página num Chrome sem janela e roda uma expressão JavaScript nela (Chrome DevTools Protocol).
// Serve para o que o Node não mostra: tempo de desenho das telas, o fluxo real de um botão, captura de imagens.
// Uso: node scripts/navegador.mjs <url> <arquivo-com-a-expressão.js>   (a expressão pode ser async; o resultado vai em JSON)
// Largura da janela: LARGURA=390 (celular) ou LARGURA=1920; padrão 1366 x 768. FOTO=arquivo.png salva uma foto da tela.
// Rode o jogo antes (npm start). Chrome em outro lugar: variável CHROME com o caminho.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , url, arquivo] = process.argv;
if (!url || !arquivo) { console.error('Uso: node scripts/navegador.mjs <url> <arquivo.js>'); process.exit(1) }
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', PORTA = 9333;
const perfil = mkdtempSync(join(tmpdir(), 'boleiro-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
const fim = c => { chrome.kill(); setTimeout(() => { try { rmSync(perfil, { recursive: true, force: true }) } catch { /* Chrome ainda soltando */ } process.exit(c) }, 300) };
try {
  let pronto = false;
  for (let i = 0; i < 40 && !pronto; i++) { try { pronto = (await fetch(`http://127.0.0.1:${PORTA}/json/version`)).ok } catch { await new Promise(r => setTimeout(r, 250)) } }
  if (!pronto) throw new Error('O Chrome não abriu a porta de depuração.');
  const alvo = await (await fetch(`http://127.0.0.1:${PORTA}/json/new?${url}`, { method: 'PUT' })).json();
  const ws = new WebSocket(alvo.webSocketDebuggerUrl), pend = {}, logs = []; let id = 0;
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })) });
  ws.onmessage = e => {
    const m = JSON.parse(e.data); if (m.id && pend[m.id]) pend[m.id](m.result || { erro: m.error });
    if (m.method === 'Runtime.consoleAPICalled') logs.push(`${m.params.type}: ${m.params.args.map(a => a.value ?? a.description).join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEÇÃO: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  };
  await new Promise(r => { ws.onopen = r });
  await cmd('Runtime.enable');
  // LARGURA=390 node scripts/navegador.mjs ...: tamanho da janela (padrão 1366 x 768), para medir telas no celular
  const largura = +process.env.LARGURA || 1366, altura = +process.env.ALTURA || 768;
  await cmd('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: largura < 600 });
  await cmd('Page.reload');
  await new Promise(r => setTimeout(r, 2500)); // a página carrega os módulos
  const r = await cmd('Runtime.evaluate', { expression: readFileSync(arquivo, 'utf8'), awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result?.value ?? r.exceptionDetails?.exception?.description ?? r, null, 1));
  // FOTO=arquivo.png: foto da página depois da expressão (para conferir o desenho de uma tela)
  if (process.env.FOTO) { await new Promise(res => setTimeout(res, 400)); const f = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(process.env.FOTO, Buffer.from(f.data, 'base64')) }
  if (logs.length) console.log(logs.join('\n'));
  fim(0);
} catch (e) { console.error(e.message); fim(1) }
