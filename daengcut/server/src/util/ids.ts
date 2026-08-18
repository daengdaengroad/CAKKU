import { customAlphabet } from 'nanoid';

// 파일명/URL에 그대로 쓰므로 헷갈리는 글자(0/O, 1/l)는 뺀다.
const alphabet = '23456789abcdefghijkmnpqrstuvwxyz';

export const newId = customAlphabet(alphabet, 12);
export const newShortId = customAlphabet(alphabet, 6);
