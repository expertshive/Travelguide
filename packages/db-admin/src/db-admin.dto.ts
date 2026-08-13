import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class CreateRowDto {
  @ApiProperty({ type: Object, description: 'Column values for the new row.' })
  @IsObject()
  data!: Record<string, unknown>;
}

export class UpdateRowDto {
  @ApiProperty({ type: Object, description: 'Primary-key values identifying the row.' })
  @IsObject()
  where!: Record<string, string>;

  @ApiProperty({ type: Object, description: 'Editable column values to write.' })
  @IsObject()
  data!: Record<string, unknown>;
}

export class DeleteRowDto {
  @ApiProperty({ type: Object, description: 'Primary-key values identifying the row.' })
  @IsObject()
  where!: Record<string, string>;
}
