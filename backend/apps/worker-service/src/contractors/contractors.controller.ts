import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ContractorIdParams, ContractorNameDto } from './contractors.dto';
import { ContractorsService } from './contractors.service';

@Controller('contractors')
export class ContractorsController {
  constructor(private readonly contractors: ContractorsService) {}

  @Post()
  create(@Body() body: ContractorNameDto) {
    return this.contractors.create(body.name);
  }

  @Get()
  list() {
    return this.contractors.list();
  }

  @Get(':id')
  get(@Param() { id }: ContractorIdParams) {
    return this.contractors.get(id);
  }

  @Patch(':id')
  rename(@Param() { id }: ContractorIdParams, @Body() body: ContractorNameDto) {
    return this.contractors.rename(id, body.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param() { id }: ContractorIdParams) {
    return this.contractors.archive(id);
  }
}
