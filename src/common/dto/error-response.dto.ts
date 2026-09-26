import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailDto {
  @ApiProperty({
    example: 'SLOT_UNAVAILABLE',
  })
  code: string;

  @ApiProperty({
    example: 'This slot already has an active booking.',
  })
  message: string;
}

export class ErrorResponseDto {
  @ApiProperty({
    type: ErrorDetailDto,
  })
  error: ErrorDetailDto;
}