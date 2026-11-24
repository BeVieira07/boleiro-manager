import { deflateSync, inflateSync, strFromU8, strToU8 } from './vendor/fflate.mjs';

/* ================= utilidades ================= */
export const SAVE_KEY='brasfoot_save_v1', DATA_KEY='brasfoot_data_v1', APIKEY_KEY='brasfoot_apikey'; // APIKEY_KEY e DATA_KEY: só para apagar o que versões antigas guardaram (#52, #187)
const COMPACTADO='deflate1:';
export const store={
  get(k){
    try{
      const dado=localStorage.getItem(k);
      const json=dado?.startsWith(COMPACTADO)
        ? strFromU8(inflateSync(strToU8(atob(dado.slice(COMPACTADO.length)),true))) : dado;
      return JSON.parse(json);
    }catch(e){return null}
  },
  set(k,v,compactar=false){
    try{
      const json=JSON.stringify(v);
      const dado=compactar
        ? COMPACTADO+btoa(strFromU8(deflateSync(strToU8(json),{level:1}),true)) : json;
      localStorage.setItem(k,dado);
      return true;
    }catch(e){return false}
  },
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
