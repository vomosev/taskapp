const {
  hashPassword,
  verifyPassword,
} = require('../utils/auth');

describe('authentication utilities', () => {
  describe('password hashing and comparison', () => {
    test('hashPassword creates a bcrypt hash rather than storing plaintext', async () => {
      const password = 'StrongPassword!123';
      const hash = await hashPassword(password);

      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    test('verifyPassword accepts the correct password and rejects an incorrect one', async () => {
      const password = 'StrongPassword!123';
      const hash = await hashPassword(password);

      await expect(verifyPassword(password, hash)).resolves.toBe(true);
      await expect(verifyPassword('IncorrectPassword!123', hash)).resolves.toBe(false);
    });

    test('hashPassword produces independently salted hashes', async () => {
      const password = 'RepeatedPassword!123';
      const firstHash = await hashPassword(password);
      const secondHash = await hashPassword(password);

      expect(firstHash).not.toBe(secondHash);
      await expect(verifyPassword(password, firstHash)).resolves.toBe(true);
      await expect(verifyPassword(password, secondHash)).resolves.toBe(true);
    });
  });
});