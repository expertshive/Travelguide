import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class SendRegisterOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: '+966501234567' })
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'Mobile number must be 8-15 digits' })
  mobile!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}

export class VerifyRegisterOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '0000' })
  @IsString()
  @MinLength(4)
  otp!: string;
}
