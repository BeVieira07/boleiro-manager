export function* linhasCsv(csv) {
  let linha = [], campo = '', entreAspas = false;
  for (let i = 0; i <= csv.length; i++) {
    const c = csv[i];
    if (entreAspas) {
      if (c === '"' && csv[i + 1] === '"') { campo += c; i++; }
      else if (c === '"') entreAspas = false;
      else if (c === undefined) throw new Error('Campo CSV com aspas abertas.');
      else campo += c;
    } else if (c === '"' && !campo) entreAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r' || c === undefined) {
      if (linha.length || campo) yield [...linha, campo];
      linha = []; campo = '';
      if (c === '\r' && csv[i + 1] === '\n') i++;
    } else campo += c;
  }
}
