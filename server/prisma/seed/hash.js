import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from './config.js';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
