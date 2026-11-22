// seta de tendência para o elenco: variação desde o início da temporada
export function tendenciaTag(p){const d=p.ovr-(p.o0??p.ovr);return d>0?`<span class="tend ok" title="Subiu ${d} desde o início da temporada">▲ +${d}</span>`:d<0?`<span class="tend bad" title="Caiu ${-d} desde o início da temporada">▼ ${d}</span>`:'<span class="tend muted" title="Sem variação">—</span>'}
