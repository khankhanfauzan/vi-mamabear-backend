import {
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterUserDto {
  @ApiProperty({ example: 'user@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 24)
  password: string;

  @ApiProperty({ example: 'Siti Rahayu' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '081234567890' })
  @IsNumberString()
  @IsNotEmpty()
  phone: string;
}
