// #373: save de antes da #28 migrado: todo clube tem caixa (antes só o do usuário, e trocar de clube dava NaN)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarJogo, clubeDaSerie } from './jogo.mjs';

test('save antigo ganha caixa em todos os clubes, e assumir outro clube não dá NaN', () => {
  const j = carregarJogo();
  j.run(`usarEstado(criarJogo('${clubeDaSerie(j)}',getData()))`);
  const r = j.run(`(()=>{const s=JSON.parse(JSON.stringify(S)),t=s.managers.local;
    Object.assign(s,{userClubId:t.clubId,balance:12,fin:[],news:[],offers:[]});delete s.managers;delete s.atual;delete s.versao;
    for(const c of s.clubs){delete c.balance;delete c.fin}
    return migrarSave(s)})()`);
  assert.ok(r.ok, r.erro);
  assert.equal(j.run('userClub().balance'), 12, 'o caixa do usuário vem do save');
  assert.equal(j.run('S.clubs.filter(c=>typeof c.balance!=="number"||isNaN(c.balance)).length'), 0);
  j.run('pedirDemissao();escolherClube(tec().propostasClube[0]);addFin("Cota de TV",1.2)');
  assert.ok(Number.isFinite(j.run('userClub().balance')));
});
