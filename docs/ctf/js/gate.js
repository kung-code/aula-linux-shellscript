// Senha de acesso ao CTF (divulgada pelo professor na aula).
// Aqui fica só o hash SHA-256: a senha em si aparece apenas no slide do CTF.
// Para trocar a senha: node tools/senha.js NOVA_SENHA  (atualiza este arquivo e o slide)

import { sha256 } from './shell/util.js';

export const ACCESS_HASH = '311a8c385ab224950248b9e7ffb24d2620c72fdec2c943a5bd75bccd700c4092';
export const ACCESS_KEY = 'pinguim-ctf-acesso';

// Aceita maiúsculas/minúsculas e espaços sobrando (facilita para quem digita no celular).
export function normalizeAccess(text) {
  return String(text || '').replace(/\s+/g, '').toUpperCase();
}

export function accessHash(text) {
  return sha256('pinguimcorp-acesso:' + normalizeAccess(text));
}

export function checkAccess(text, hash = ACCESS_HASH) {
  return normalizeAccess(text) !== '' && accessHash(text) === hash;
}

// O desbloqueio salvo vale só para a senha atual: trocar a senha bloqueia todo mundo de novo.
export function isUnlocked(stored, hash = ACCESS_HASH) {
  return stored === hash;
}
