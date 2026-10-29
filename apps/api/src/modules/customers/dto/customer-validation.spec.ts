import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCustomerDto } from './customer.dto';
import {
  CreateContactDto,
  UpdateContactDto,
} from './customer-relationship.dto';

describe('Mandatory customer relationship values', () => {
  it.each(['status', 'taxPeriod'])(
    'rejects null %s before reaching Prisma',
    async (field) => {
      const dto = plainToInstance(CreateCustomerDto, {
        name: 'Customer',
        taxCode: '0012345678',
        [field]: null,
      });
      expect((await validate(dto)).map((error) => error.property)).toContain(
        field,
      );
    },
  );
  it('rejects a null primary flag on creation', async () => {
    const dto = plainToInstance(CreateContactDto, {
      fullName: 'Contact',
      isPrimary: null,
    });
    expect((await validate(dto)).map((error) => error.property)).toContain(
      'isPrimary',
    );
  });
  it('rejects a null primary flag on update', async () => {
    const dto = plainToInstance(UpdateContactDto, { isPrimary: null });
    expect((await validate(dto)).map((error) => error.property)).toContain(
      'isPrimary',
    );
  });
});
