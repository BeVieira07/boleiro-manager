import { mudarTatica } from '../../core/taticas.mjs';
import { save } from '../estado.mjs';
import { render } from '../telas.mjs';

/* ---------- controles de estilo e modo (chips) ---------- */
export function tvPainel(c,v){mudarTatica(c,v);save();render()}
