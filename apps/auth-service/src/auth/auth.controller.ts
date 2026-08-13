import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser, type AuthUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SendRegisterOtpDto, VerifyRegisterOtpDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register/send-otp')
  @ApiOperation({ summary: 'Send OTP for registration' })
  sendRegisterOtp(@Body() dto: SendRegisterOtpDto) {
    return this.authService.sendRegisterOtp(dto);
  }

  @Public()
  @Post('register/verify-otp')
  @ApiOperation({ summary: 'Verify OTP and complete registration' })
  verifyRegisterOtp(@Body() dto: VerifyRegisterOtpDto) {
    return this.authService.verifyRegisterOtp(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using a valid reset token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh tokens' })
  logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    return this.authService.logout(user.userId, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.userId);
  }
}
