import { BadRequestException } from '@nestjs/common';

export function validatePassword(password: string): void {
  if (
    password.length < 10 ||
    password.length > 72 ||
    Buffer.byteLength(password, 'utf8') > 72 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^\p{L}\p{N}\s]/u.test(password)
  ) {
    throw new BadRequestException(
      'Mật khẩu cần 10–72 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt (tối đa 72 byte)',
    );
  }
}
