import { textoPenalti } from '../core/penaltis.mjs';
import { esc } from '../core/utils.mjs';

export const DURACAO_COBRANCA = 3000;

const ALVOS = [
  ['esq-alto', 101, 47], ['meio-alto', 180, 47], ['dir-alto', 259, 47],
  ['esq-baixo', 101, 89], ['meio-baixo', 180, 89], ['dir-baixo', 259, 89]
];
const PULOS = { esq: -1, meio: 0, dir: 1 };

function bola(alvo, res) {
  const [nome, x, y] = alvo, lado = Math.sign(x - 180), alto = nome.endsWith('-alto');
  if (res === 'trave') {
    const poste = lado !== 0 && !alto;
    return { impacto: [poste ? 180 + 102 * lado : x, poste ? y : 30], fim: [180 + 43 * lado, 127], escala: 0.86 };
  }
  if (res === 'fora') {
    const fim = alto || !lado ? [x + 10 * lado, 10] : [180 + 126 * lado, 103];
    return { impacto: fim, fim, escala: 0.63 };
  }
  if (res === 'defesa') return { impacto: [x, y], fim: [x, y], escala: 0.72 };
  return { impacto: [x, y], fim: [x - 7 * lado, 95], escala: 0.64 };
}

function goleiroNoAlvo(alvo, pulo, res) {
  const [, x, y] = alvo;
  if (res === 'defesa') {
    // Os deslocamentos alinham a luva do goleiro com a bola.
    const lado = Math.sign(x - 180);
    if (!lado) return { x: pulo === 1 ? -18 : 18, y: y - 90 + 13, giro: 0 };
    return { x: x - 180 - 20 * lado, y: y - 90 - 9, giro: 60 * lado };
  }
  return { x: 55 * pulo, y: y < 60 ? -12 : 3, giro: 60 * pulo };
}

/** Desenha a cobrança a partir de { alvo, pulo, res, name? }. Os nomes nas opções são textos de exibição.
 *  `decorrido` em ms mantém a animação no mesmo ponto se a tela for redesenhada. */
export function htmlCobranca(lance, { batedor = lance.name, goleiro, clube = 'time', decorrido = 0 } = {}) {
  const { res } = lance;
  if (!['gol', 'defesa', 'trave', 'fora'].includes(res)) return '';
  const alvo = ALVOS.find(([nome]) => nome === lance.alvo) ?? ALVOS[4];
  const ladoPulo = Object.hasOwn(PULOS, lance.pulo) ? lance.pulo : 'meio';
  const pulo = PULOS[ladoPulo];
  const { impacto: [ix, iy], fim: [fx, fy], escala } = bola(alvo, res);
  const gk = goleiroNoAlvo(alvo, pulo, res);
  const tempo = `--cobranca-duracao:${DURACAO_COBRANCA}ms;--cobranca-atraso:-${Math.max(0, Math.min(DURACAO_COBRANCA, decorrido))}ms`;
  const trajeto = `--bola-impacto:${ix}px,${iy}px;--bola-fim:${fx}px,${fy}px;--bola-escala:${escala}`;
  const mergulho = `--goleiro-impulso:${22 * pulo}px;--goleiro-giro-inicial:${27 * pulo}deg;--goleiro-fim:${gk.x}px,${gk.y}px;--goleiro-giro:${gk.giro}deg`;
  const texto = textoPenalti({ res, name: batedor || 'O batedor' }, clube, goleiro);
  return `<figure class="cobranca-animacao" data-res="${res}" data-alvo="${alvo[0]}" data-pulo="${ladoPulo}" style="${tempo};${trajeto};${mergulho}">
    <svg class="cobranca-campo" viewBox="0 0 360 160" aria-hidden="true" focusable="false">
      <path class="cobranca-linhas" d="M0 105h360M66 105l-18 21h264l-18-21M32 105L5 155h350l-27-50M122 155q58-30 116 0"/>
      <g class="cobranca-rede">
        <path d="M78 30l13-11h178l13 11v75l-13-14H91l-13 14z"/>
        <path d="M78 43h204m-204 13h204m-204 13h204m-204 13h204M91 91V19m18 0v74m18-74v74m18-74v74m18-74v74m17-74v74m17-74v74m18-74v74m18-74v74m18-74v74m18-74v72"/>
      </g>
      <path class="cobranca-gol" d="M78 105V30h204v75"/>
      ${ALVOS.map(([nome, x, y]) => `<circle class="cobranca-alvo${nome === alvo[0] ? ' selecionado' : ''}" cx="${x}" cy="${y}" r="8"/>`).join('')}
      <circle class="cobranca-marca" cx="180" cy="140" r="2.5"/>
      <g transform="translate(180 90)">
        <g class="cobranca-goleiro" stroke-linecap="round" stroke-linejoin="round">
          <path d="M-12 12l6-9h12l6 9M-6-4l-7-3-5-6m24 9 7-3 5-6"/>
          <path d="M-7-8h14v11q-7 4-14 0z"/>
          <circle cx="0" cy="-14" r="4"/>
          <g class="cobranca-luvas"><circle cx="-18" cy="-13" r="2.5"/><circle cx="18" cy="-13" r="2.5"/></g>
        </g>
      </g>
      ${res === 'trave' ? `<circle class="cobranca-impacto" cx="${ix}" cy="${iy}" r="8"/>` : ''}
      <g class="cobranca-bola">
        <circle r="5.5"/>
        <path d="M0-2l2.3 1.6-.9 2.6h-2.8l-.9-2.6zM0-2v-3.5M2.3-.4l3-.9M1.4 2.2l2 2M-1.4 2.2l-2 2M-2.3-.4l-3-.9"/>
      </g>
    </svg>
    <figcaption>${esc(texto)}</figcaption>
  </figure>`;
}
