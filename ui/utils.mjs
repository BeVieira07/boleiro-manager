/* ================= utilidades ================= */
export const SAVE_KEY='brasfoot_save_v1', DATA_KEY='brasfoot_data_v1', APIKEY_KEY='brasfoot_apikey'; // APIKEY_KEY e DATA_KEY: só para apagar o que versões antigas guardaram (#52, #187)
export const store={
  get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
