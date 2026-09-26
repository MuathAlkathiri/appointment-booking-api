import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-4111-8111-111111111111',
    description: 'ID of the appointment slot to book.',
  })
  @IsUUID()
  slotId: string;

  @ApiProperty({
  example: 'Alex Morgan',
  minLength: 1,
  description:
    'Customer name. Leading and trailing whitespace is removed before validation and storage. Must not be empty after trimming.',
})
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({
    format: 'email',
    example: 'alex@example.com',
    description:
      'Customer email. Leading and trailing whitespace is removed before validation and storage.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail()
  customerEmail: string;
}