import { textoPenalti } from '../core/penaltis.mjs';
import { esc } from '../core/utils.mjs';

export const DURACAO_COBRANCA = 3000;

/* A cena é montada em metros e projetada por uma câmera atrás do batedor, um pouco elevada.
   Eixos: x para a direita do batedor, y para cima, z do gol (z = 0) em direção à câmera.
   Medidas oficiais: gol 7,32 × 2,44, pequena área 5,5 m, marca do pênalti a 11 m, grande área 16,5 m. */
const W = 360, H = 196, CX = W / 2, CY = H / 2 - 2, F = 720;
const CAM = [1.6, 3.2, 25], MIRA = [0.15, 0.3, 4];
const GOL_X = 3.66, GOL_Y = 2.44, BOLA_R = 0.11, MARCA_Z = 11;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a); return a.map(v => v / l) };
const FRENTE = norm(sub(MIRA, CAM)), DIREITA = norm(cross(FRENTE, [0, 1, 0])), CIMA = cross(DIREITA, FRENTE);
const r1 = v => Math.round(v * 10) / 10;
const r3 = v => Math.round(v * 1000) / 1000;

/** Projeta um ponto em metros: [x, y na tela, px por metro naquela profundidade]. */
function proj([x, y, z]) {
  const d = sub([x, y, z], CAM), p = dot(d, FRENTE);
  return [CX + F * dot(d, DIREITA) / p, CY - F * dot(d, CIMA) / p, F / p];
}
const pt = p => { const [x, y] = proj(p); return `${r1(x)} ${r1(y)}` };
const linha = (...ps) => `M${ps.map(pt).join('L')}`;
const poligono = (...ps) => `${linha(...ps)}Z`;

/* ---------- cenário fixo (igual em todas as cobranças, montado uma vez) ---------- */
function cenario() {
  const PZ = -5, faixas = [];
  for (let z = PZ, i = 0; z < 17; z += 2.75, i++) {
    if (i % 2) faixas.push(poligono([-40, 0, z], [40, 0, z], [40, 0, z + 2.75], [-40, 0, z + 2.75]));
  }
  const PA = 20.16, PE = 9.16;
  const marcas = [
    linha([-40, 0, 0], [40, 0, 0]),                                    // linha de fundo
    linha([-PE, 0, 0], [-PE, 0, 5.5], [PE, 0, 5.5], [PE, 0, 0]),       // pequena área
    linha([-PA, 0, 0], [-PA, 0, 16.5], [PA, 0, 16.5], [PA, 0, 0])      // grande área
  ];
  const marca = proj([0, 0, MARCA_Z]);
  // rede: fundo 2 m atrás no chão, teto recua 1 m
  const T = -1, B = -2;
  const fundo = [[-GOL_X, GOL_Y, T], [GOL_X, GOL_Y, T], [GOL_X, 0, B], [-GOL_X, 0, B]];
  const malha = [];
  for (let i = 1; i < 16; i++) {
    const x = -GOL_X + (2 * GOL_X * i) / 16;
    malha.push(linha([x, GOL_Y, 0], [x, GOL_Y, T], [x, 0, B]));
  }
  for (let j = 1; j < 6; j++) {
    const t = j / 6, y = GOL_Y * (1 - t), z = T + (B - T) * t;
    malha.push(linha([-GOL_X, y, z], [GOL_X, y, z]));
    malha.push(linha([-GOL_X, y, 0], [-GOL_X, y, z]), linha([GOL_X, y, 0], [GOL_X, y, z]));
  }
  for (let j = 1; j < 3; j++) { const z = T * j / 3; malha.push(linha([-GOL_X, GOL_Y, z], [GOL_X, GOL_Y, z])) }
  const lateral = s => poligono([s * GOL_X, 0, 0], [s * GOL_X, GOL_Y, 0], [s * GOL_X, GOL_Y, T], [s * GOL_X, 0, B]);
  // placas de publicidade e arquibancada atrás do gol
  const [, placaBase] = proj([0, 0, PZ]), [, placaTopo] = proj([0, 0.9, PZ]);
  const [traveEsq] = proj([-GOL_X, 0, 0]), [traveDir] = proj([GOL_X, 0, 0]);
  const [, travessao, kGol] = proj([0, GOL_Y, 0]), [, chao] = proj([0, 0, 0]);
  const esp = r1(0.12 * kGol);
  return `
    <defs>
      <pattern id="cob-torcida" width="9" height="7" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.6" class="t1"/><circle cx="6.5" cy="5.5" r="1.6" class="t2"/><circle cx="6.5" cy="1.5" r=".9" class="t3"/>
      </pattern>
      <pattern id="cob-torcida2" width="13" height="11" patternUnits="userSpaceOnUse" patternTransform="translate(3 2)">
        <circle cx="3" cy="4" r="1.5" class="t2"/><circle cx="9.5" cy="9" r="1.4" class="t1"/><circle cx="11" cy="2" r="1" class="t3"/>
      </pattern>
      <radialGradient id="cob-luz" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <rect class="cob-arquibancada" width="${W}" height="${r1(placaTopo)}"/>
    <rect fill="url(#cob-torcida)" width="${W}" height="${r1(placaTopo)}" opacity=".45"/>
    <rect fill="url(#cob-torcida2)" width="${W}" height="${r1(placaTopo)}" opacity=".5"/>
    <rect class="cob-placas" y="${r1(placaTopo)}" width="${W}" height="${r1(placaBase - placaTopo)}"/>
    <text class="cob-placas-txt" x="${CX}" y="${r1((placaTopo + placaBase) / 2 + 2.2)}" text-anchor="middle">BOLEIRO MANAGER  ·  BOLEIRO MANAGER  ·  BOLEIRO MANAGER</text>
    <rect class="cob-gramado" y="${r1(placaBase)}" width="${W}" height="${r1(H - placaBase)}"/>
    <path class="cob-faixas" d="${faixas.join('')}"/>
    <rect fill="url(#cob-luz)" width="${W}" height="${H}"/>
    <path class="cob-linhas" d="${marcas.join('')}"/>
    <ellipse class="cob-linhas-marca" cx="${r1(marca[0])}" cy="${r1(marca[1])}" rx="${r1(0.11 * marca[2])}" ry="${r1(0.05 * marca[2])}"/>
    <g class="cobranca-rede">
      <path class="cob-rede-fundo" d="${poligono(...fundo)}${lateral(-1)}${lateral(1)}"/>
      <path class="cob-rede-malha" d="${malha.join('')}"/>
    </g>
    <path class="cob-sombra-gol" d="M${r1(traveEsq)} ${r1(chao)}h${r1(traveDir - traveEsq)}" stroke-width="${esp}"/>
    <path class="cobranca-gol" stroke-width="${esp}" d="M${r1(traveEsq)} ${r1(chao)}V${r1(travessao)}H${r1(traveDir)}V${r1(chao)}"/>`;
}
const CENARIO = cenario();
// a trave fica por cima do goleiro e da bola dentro do gol
const [TRAVE_E, TRAVE_D] = [proj([-GOL_X, 0, 0])[0], proj([GOL_X, 0, 0])[0]];
const TRAVES = `<path class="cobranca-gol" stroke-width="${r1(0.12 * proj([0, GOL_Y, 0])[2])}" d="M${r1(TRAVE_E)} ${r1(proj([0, 0, 0])[1])}V${r1(proj([0, GOL_Y, 0])[1])}H${r1(TRAVE_D)}V${r1(proj([0, 0, 0])[1])}"/>`;

/* ---------- figuras, desenhadas em centímetros (y para baixo) ---------- */
const luva = (x, y) => `<circle class="cob-luva" cx="${x}" cy="${y}" r="7"/>`;
// origem no quadril; o goleiro está de frente para a câmera
const GK_PRONTO = `<g class="cob-pose">
  <path class="cob-meiao" d="M-11 4l-15 38-4 44M11 4l15 38 4 44"/>
  <path class="cob-chuteira" d="M-36 88h12M24 88h12"/>
  <path class="cob-calcao" d="M-19-4h38l3 20H5L0 8l-5 8h-17z"/>
  <path class="cob-camisa" d="M-18-2l-4-48q22-12 44 0l-4 48z"/>
  <path class="cob-braco" d="M-19-46l-22 24-6 20M19-46l22 24 6 20"/>
  ${luva(-47, 0)}${luva(47, 0)}
  <circle class="cob-pele" cx="0" cy="-64" r="11"/><path class="cob-cabelo" d="M-11-66q0-13 11-13t11 13q-11-6-22 0z"/>
</g>`;
// corpo esticado com os braços acima da cabeça; girado, vira o mergulho. Mãos a 1,2 m do quadril.
const GK_MERGULHO = `<g class="cob-pose">
  <path class="cob-meiao" d="M-7 4l-5 46 2 42M8 4l16 34-6 46"/>
  <path class="cob-chuteira" d="M-16 93h12M12 87l10 4"/>
  <path class="cob-calcao" d="M-17-4h34l2 20H4L0 9l-4 7h-15z"/>
  <path class="cob-camisa" d="M-17-2l-3-48q20-10 40 0l-3 48z"/>
  <path class="cob-braco" d="M-15-46l-6-36 9-34M15-46l6-36-9-34"/>
  ${luva(-11, -120)}${luva(11, -120)}
  <circle class="cob-pele" cx="0" cy="-64" r="11"/><path class="cob-cabelo" d="M-11-66q0-13 11-13t11 13q-11-6-22 0z"/>
</g>`;
// fica no meio e sobe as mãos
const GK_ALTO = `<g class="cob-pose">
  <path class="cob-meiao" d="M-10 4l-8 44-2 42M10 4l8 44 2 42"/>
  <path class="cob-chuteira" d="M-26 91h12M14 91h12"/>
  <path class="cob-calcao" d="M-18-4h36l3 20H5L0 8l-5 8h-16z"/>
  <path class="cob-camisa" d="M-17-2l-3-48q20-10 40 0l-3 48z"/>
  <path class="cob-braco" d="M-17-46l-14-34 3-34M17-46l14-34-3-34"/>
  ${luva(-27, -118)}${luva(27, -118)}
  <circle class="cob-pele" cx="0" cy="-64" r="11"/><path class="cob-cabelo" d="M-11-66q0-13 11-13t11 13q-11-6-22 0z"/>
</g>`;
// batedor de costas, origem entre os pés no chão
const BT_CORRIDA = `<g class="cob-pose">
  <path class="cob-bt-meiao" d="M-6-92l-14 44 2 44M8-92l12 40 14 34"/>
  <path class="cob-chuteira" d="M-24-3h12M28 17l10 5"/>
  <path class="cob-bt-calcao" d="M-19-104h38l3 20H4l-4-7-4 7h-18z"/>
  <path class="cob-bt-camisa" d="M-19-102l-4-50q23-12 46 0l-4 50z"/>
  <path class="cob-bt-braco" d="M-20-146l-16 26 6 22M20-146l14 24-12 18"/>
  <text class="cob-bt-num" x="0" y="-116" text-anchor="middle">10</text>
  <circle class="cob-pele" cx="0" cy="-162" r="11"/><path class="cob-bt-cabelo" d="M-11-160q-1-14 11-14t11 14q-2 6-11 6t-11-6z"/>
</g>`;
const BT_CHUTE = `<g class="cob-pose">
  <path class="cob-bt-meiao" d="M-6-92l-6 46-2 44M8-92l22 30 18 6"/>
  <path class="cob-chuteira" d="M-20-3h12M46-58l12 2"/>
  <path class="cob-bt-calcao" d="M-19-104h38l4 20H4l-4-7-4 7h-18z"/>
  <path class="cob-bt-camisa" d="M-20-102l-3-50q23-12 46 0l-5 50z"/>
  <path class="cob-bt-braco" d="M-20-146l-26 14-12 14M20-146l18 18 8 18"/>
  <text class="cob-bt-num" x="0" y="-116" text-anchor="middle">10</text>
  <circle class="cob-pele" cx="0" cy="-162" r="11"/><path class="cob-bt-cabelo" d="M-11-160q-1-14 11-14t11 14q-2 6-11 6t-11-6z"/>
</g>`;

/* ---------- linha do tempo: bola parada até 18%, voo até 33%, desfecho até 55% (os % estão no CSS) ---------- */

const ALVOS = { esq: -2.85, meio: 0, dir: 2.85 };
const ALTURAS = { baixo: 0.35, alto: 1.95 };
const PULOS = { esq: -1, meio: 0, dir: 1 };
const ALVOS_VALIDOS = ['esq-alto', 'meio-alto', 'dir-alto', 'esq-baixo', 'meio-baixo', 'dir-baixo'];

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Pontos da bola em metros: o ponto de impacto (fim do voo) e três quadros do desfecho. */
function trajeto(lado, alto, x, y, res) {
  const s = Math.sign(x);
  if (res === 'gol') {
    const fundo = alto ? -1.0 : -1.6;
    return { impacto: [x, y, 0], depois: alto
      ? [[x * 0.97, y - 0.1, fundo], [x * 0.95, 0.7, -1.3], [x * 0.93, BOLA_R, -1.5]]
      : [[x * 0.98, 0.25, fundo], [x * 0.96, BOLA_R, -1.75], [x * 0.95, BOLA_R, -1.6]] };
  }
  if (res === 'defesa') {
    const impacto = [x, y, 0.25];
    if (!s) return alto
      ? { impacto, depois: [[0.2, 3.0, -0.8], [0.35, 2.4, -2.6], [0.45, BOLA_R, -3.4]] }      // espalma por cima
      : { impacto, depois: [[0.4, 0.45, 2.4], [0.9, BOLA_R, 4.6], [1.1, BOLA_R, 5.6]] };      // rebote para frente
    return { impacto, depois: [[x + s * 1.2, y * 0.6 + 0.3, 1.2], [x + s * 2.0, BOLA_R, 2.6], [x + s * 2.3, BOLA_R, 3.3]] };
  }
  if (res === 'trave') {
    if (s && !alto) {                                                    // na trave, volta cruzando a área
      const impacto = [s * (GOL_X - 0.12), 0.55, 0.05];
      return { impacto, depois: [[s * 2.6, 0.35, 2.4], [s * 1.6, BOLA_R, 4.8], [s * 1.2, BOLA_R, 5.8]] };
    }
    const impacto = [s ? s * 3.0 : 0.4, GOL_Y + 0.02, 0.05];             // no travessão, quica e sobe
    return { impacto, depois: [[impacto[0] * 0.95, BOLA_R, 1.1], [impacto[0] * 0.85, 0.9, 3.4], [impacto[0] * 0.75, BOLA_R, 5.8]] };
  }
  // fora: por cima do travessão ou ao lado da trave, até a placa de publicidade
  const impacto = alto || !s ? [x * 0.8 + (s ? 0 : 0.5), GOL_Y + 0.55, 0] : [s * (GOL_X + 0.55), y, 0];
  const dir = sub(impacto, [0, BOLA_R, MARCA_Z]);
  const em = z => { const t = (z - impacto[2]) / dir[2]; return [impacto[0] + dir[0] * t, Math.max(BOLA_R, impacto[1] + dir[1] * t * (alto ? 0.9 : 0.4)), z] };
  // por cima some na torcida; ao lado bate na placa e cai
  if (alto || !s) return { impacto, depois: [em(-3), em(-6), em(-9)] };
  return { impacto, depois: [em(-3.5), em(-6.8), [em(-6.8)[0], BOLA_R, -6.6]] };
}

/** Quadros do goleiro: { pose, q: [[x, yQuadril, z, giro], ...] } alinhados a T_GOLEIRO. */
function goleiro(lado, alto, x, y, pulo, res) {
  const inicio = [0, 0.82, 0.25, 0], balanco = [0.12, 0.8, 0.25, 0];
  // defesa: o goleiro vai na bola, mesmo que o sorteio tenha marcado o canto errado
  const ladoDefesa = res === 'defesa' ? Math.sign(x) : pulo;
  if (!ladoDefesa) {
    if (res === 'defesa' && !alto) {                         // bola rasteira no meio: fecha o corpo
      return { pose: 'pronto', q: [balanco, inicio, [0, 0.72, 0.3, 0], [0, 0.62, 0.3, 0], [0, 0.6, 0.3, 0], [0, 0.6, 0.3, 0], [0, 0.6, 0.3, 0]] };
    }
    const topo = res === 'defesa' ? 0.92 : 1.05;
    return { pose: 'alto', q: [balanco, [0, 0.78, 0.25, 0], [0, 0.98, 0.25, 0], [0, topo, 0.25, 0], [0, topo, 0.25, 0], [0, 0.92, 0.25, 0], [0, 0.92, 0.25, 0]] };
  }
  const s = ladoDefesa, R = 1.2;
  // onde as mãos chegam: na bola (defesa), um pouco antes dela (gol no canto certo) ou num ponto do canto escolhido
  let mao;
  if (res === 'defesa') mao = [x, y];
  else if (res === 'gol' && Math.sign(x) === s) mao = [x - s * 0.65, alto ? y - 0.35 : y + 0.2];
  else mao = [s * 2.4, 1.0];
  const quadrilY = Math.max(0.22, Math.min(1.25, mao[1] - R * 0.35));
  const giro = Math.acos(Math.max(-1, Math.min(1, (mao[1] - quadrilY) / R)));
  const fim = [mao[0] - s * R * Math.sin(giro), quadrilY, 0.25, s * giro * 180 / Math.PI];
  const subida = alto ? 0.25 : 0.1;
  const meio = (t, extra) => { const p = lerp([s * 0.25, 0.78, 0.25, s * 12], fim, t); p[1] += extra; return p };
  const chao = [fim[0] + s * 0.25, 0.24, 0.25, s * 90];
  return { pose: 'mergulho', q: [balanco, [s * 0.25, 0.78, 0.25, s * 12], meio(0.45, subida), meio(0.8, subida * 0.6), fim, lerp(fim, chao, 0.7), chao] };
}

const v2 = (x, y) => `${r1(x)}px,${r1(y)}px`;

/** Desenha a cobrança a partir de { alvo, pulo, res, name? }. Os nomes nas opções são textos de exibição.
 *  `decorrido` em ms mantém a animação no mesmo ponto se a tela for redesenhada. */
export function htmlCobranca(lance, { batedor = lance.name, goleiro: nomeGoleiro, clube = 'time', decorrido = 0 } = {}) {
  const { res } = lance;
  if (!['gol', 'defesa', 'trave', 'fora'].includes(res)) return '';
  const alvo = ALVOS_VALIDOS.includes(lance.alvo) ? lance.alvo : 'meio-baixo';
  const ladoPulo = Object.hasOwn(PULOS, lance.pulo) ? lance.pulo : 'meio';
  const [lado, altura] = alvo.split('-'), alto = altura === 'alto';
  const x = ALVOS[lado], y = ALTURAS[altura];

  // bola
  const { impacto, depois } = trajeto(lado, alto, x, y, res);
  const saida = [0, BOLA_R, MARCA_Z], curva = alto ? 0.28 : 0.12;
  const voo = [0, 0.25, 0.5, 0.75, 1].map(t => { const p = lerp(saida, impacto, t); p[1] += curva * 4 * t * (1 - t); return p });
  const pontos = [...voo, ...depois];
  const vars = [];
  pontos.forEach((p, i) => {
    const [sx, sy, k] = proj(p), [hx, hy, hk] = proj([p[0], 0, p[2]]);
    vars.push(`--b${i}:${v2(sx, sy)};--bs${i}:${r3(k / 100)};--h${i}:${v2(hx, hy)};--hs${i}:${r3(hk / 100)}`);
  });

  // goleiro
  const gk = goleiro(lado, alto, x, y, PULOS[ladoPulo], res);
  gk.q.forEach(([gx, gy, gz, giro], i) => {
    const [sx, sy, k] = proj([gx, gy, gz]);
    vars.push(`--g${i}:${v2(sx, sy)};--gr${i}:${r1(giro)}deg;--gs${i}:${r3(k / 100)}`);
  });

  // batedor: corre da esquerda e chega ao lado da bola no chute
  [[-2.4, 0, 13.9], [-0.8, 0, 11.45], [-0.7, 0, 11.1]].forEach((p, i) => {
    const [sx, sy, k] = proj(p);
    vars.push(`--k${i}:${v2(sx, sy)};--ks${i}:${r3(k / 100)}`);
  });

  const tempo = `--cobranca-duracao:${DURACAO_COBRANCA}ms;--cobranca-atraso:-${Math.max(0, Math.min(DURACAO_COBRANCA, decorrido))}ms`;
  const poseAcao = { mergulho: GK_MERGULHO, alto: GK_ALTO, pronto: GK_PRONTO }[gk.pose];
  const figGoleiro = gk.pose === 'pronto'
    ? `<g class="cobranca-goleiro">${GK_PRONTO}</g>`
    : `<g class="cobranca-goleiro"><g class="cob-antes">${GK_PRONTO}</g><g class="cob-depois">${poseAcao}</g></g>`;
  const [ix, iy] = proj(impacto);
  const figBola = `<ellipse class="cobranca-sombra" rx="13" ry="5"/><g class="cobranca-bola"><circle r="11"/><path d="M0-4l4 3-1.6 4.6h-4.8L-4-1zM0-4v-7M4-1l6.5-2M2.4 3.6l4 6M-2.4 3.6l-4 6M-4-1l-6.5-2"/></g>`;
  const impactoFx = res === 'trave' ? `<g class="cobranca-impacto" transform="translate(${r1(ix)} ${r1(iy)})"><path d="M-7 0h-5M7 0h5M0-7v-5M0 7v5M-5-5l-3-3M5-5l3-3M-5 5l-3 3M5 5l3 3"/></g>` : '';
  // a bola que entra (ou sai por trás) passa atrás do goleiro e da trave
  const atras = res === 'gol' || res === 'fora';
  const texto = textoPenalti({ res, name: batedor || 'O batedor' }, clube, nomeGoleiro);
  return `<figure class="cobranca-animacao" data-res="${res}" data-alvo="${alvo}" data-pulo="${ladoPulo}" style="${tempo};${vars.join(';')}">
    <svg class="cobranca-campo" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${CENARIO}
      ${atras ? figBola : ''}${figGoleiro}${TRAVES}${atras ? '' : figBola}${impactoFx}
      <g class="cobranca-batedor"><g class="cob-antes">${BT_CORRIDA}</g><g class="cob-depois">${BT_CHUTE}</g></g>
    </svg>
    <figcaption><span class="cobranca-antes" aria-hidden="true">${esc(`${batedor || 'O batedor'} na bola`)}</span><span class="cobranca-resultado">${esc(texto)}</span></figcaption>
  </figure>`;
}

