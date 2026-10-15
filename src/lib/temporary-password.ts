import { randomInt } from "node:crypto";

const passwordAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 10) {
  return Array.from({ length }, () => passwordAlphabet[randomInt(passwordAlphabet.length)]).join("");
}
