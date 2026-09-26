import { Controller, Get } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { SlotsService } from './slots.service.js';
import { SlotsResponseDto } from './slot-response.dto.js';

@ApiTags('slots')
@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  @ApiOperation({
    summary: 'List available appointment slots',
    description:
      'Returns only slots that do not currently have an active booking. Results are ordered by startsAt ascending, then id ascending. No authentication is required.',
  })
  @ApiOkResponse({
    description:
      'Available appointment slots. Returns {"slots":[]} when none are available.',
    type: SlotsResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error.',
    type: ErrorResponseDto,
  })
  async findAvailable() {
    const slots = await this.slotsService.findAvailable();

    return { slots };
  }
}