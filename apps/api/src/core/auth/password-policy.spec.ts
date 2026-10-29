import { validatePassword } from './password-policy';

describe('New password policy', () => {
  it.each([
    'Short@1',
    'alllowercase123!',
    'ALLUPPERCASE123!',
    'NoDigitsHere!',
    'NoSymbols1234',
    'MậtKhẩuStrong123',
    'A'.repeat(73) + 'a1!',
    'À'.repeat(32) + 'Strong@123',
  ])(
    'rejects invalid passwords including excessive UTF-8 byte length',
    (password) => {
      expect(() => validatePassword(password)).toThrow();
    },
  );
  it('accepts strong ASCII and Unicode passwords within the bcrypt limit', () => {
    expect(() => validatePassword('ValidPassword@123')).not.toThrow();
    expect(() => validatePassword('MậtKhẩuStrong@123')).not.toThrow();
  });
});
