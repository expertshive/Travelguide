import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SendRegisterOtpDto, VerifyRegisterOtpDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { DEFAULT_OTP, OTP_EXPIRY_MS } from './otp.constants';
import { hashPassword, parseDurationMs, verifyPassword } from './password.util';

type UserWithRoles = Awaited<ReturnType<AuthService['findUserWithRoles']>>;

const TRAVELER_ROLE = 'traveler';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async sendRegisterOtp(dto: SendRegisterOtpDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const email = dto.email.trim().toLowerCase();
    const mobile = dto.mobile.trim();

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingMobile = await this.prisma.user.findUnique({ where: { mobile } });
    if (existingMobile) {
      throw new ConflictException('Mobile number already registered');
    }

    const otp = this.config.get<string>('DEFAULT_OTP', DEFAULT_OTP);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await this.prisma.registrationOtp.upsert({
      where: { email },
      update: {
        name: dto.name.trim(),
        mobile,
        passwordHash: hashPassword(dto.password),
        otp,
        expiresAt,
      },
      create: {
        email,
        name: dto.name.trim(),
        mobile,
        passwordHash: hashPassword(dto.password),
        otp,
        expiresAt,
      },
    });

    const isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';
    return {
      message: 'OTP sent successfully. Use the code to complete registration.',
      ...(isDev ? { otpHint: otp } : {}),
    };
  }

  async verifyRegisterOtp(dto: VerifyRegisterOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const pending = await this.prisma.registrationOtp.findUnique({ where: { email } });

    if (!pending || pending.expiresAt < new Date()) {
      if (pending) {
        await this.prisma.registrationOtp.delete({ where: { email } });
      }
      throw new UnauthorizedException('OTP expired or not found. Request a new code.');
    }

    const defaultOtp = this.config.get<string>('DEFAULT_OTP', DEFAULT_OTP);
    const otpValid = dto.otp === pending.otp || dto.otp === defaultOtp;
    if (!otpValid) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Self-service signup always produces a plain traveler; elevated roles are granted by an admin.
    const travelerRole = await this.prisma.role.findUnique({ where: { name: TRAVELER_ROLE } });
    if (!travelerRole) {
      throw new InternalServerErrorException(
        `Default "${TRAVELER_ROLE}" role is missing. Run the auth-service seed.`,
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: pending.email,
          name: pending.name,
          mobile: pending.mobile,
          passwordHash: pending.passwordHash,
        },
      });

      await tx.userRole.create({
        data: { userId: created.id, roleId: travelerRole.id },
      });

      await tx.registrationOtp.delete({ where: { email } });
      return created;
    });

    const userWithRoles = await this.findUserWithRoles(user.id);
    if (!userWithRoles) {
      throw new UnauthorizedException('Registration failed');
    }

    const { roles, permissions } = this.extractRolesAndPermissions(userWithRoles);
    return this.issueTokens(user.id, user.email, roles, permissions);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: this.userRolesInclude(),
    });

    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const { roles, permissions } = this.extractRolesAndPermissions(user);
    return this.issueTokens(user.id, user.email, roles, permissions);
  }

  async refresh(dto: RefreshDto) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: { include: this.userRolesInclude() } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const { roles, permissions } = this.extractRolesAndPermissions(stored.user);
    return this.issueTokens(stored.user.id, stored.user.email, roles, permissions);
  }

  async logout(userId: string, dto: LogoutDto) {
    if (dto.refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { token: dto.refreshToken, userId },
      });
      return { success: true };
    }

    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const message = 'If the email exists, a password reset link has been sent.';

    if (!user) {
      return { message };
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + parseDurationMs('1h'));

    await this.prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const adminResetBase = this.config.get<string>('ADMIN_RESET_URL', 'http://localhost:3002/reset-password');
    const resetUrl = `${adminResetBase}?token=${token}`;
    const isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';

    return {
      message,
      ...(isDev ? { resetToken: token, resetUrl } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashPassword(dto.password) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    return { success: true, message: 'Password updated successfully' };
  }

  async getMe(userId: string) {
    const user = await this.findUserWithRoles(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { roles, permissions } = this.extractRolesAndPermissions(user);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      isActive: user.isActive,
      roles,
      permissions,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private findUserWithRoles(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userRolesInclude(),
    });
  }

  private userRolesInclude() {
    return {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
        },
      },
    } as const;
  }

  private extractRolesAndPermissions(user: NonNullable<UserWithRoles>) {
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.name)),
      ),
    ];
    return { roles, permissions };
  }

  private async issueTokens(userId: string, email: string, roles: string[], permissions: string[]) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, roles, permissions },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      },
    );

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshExpires = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date(Date.now() + parseDurationMs(refreshExpires));

    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt },
    });

    return { accessToken, refreshToken, tokenType: 'Bearer' as const };
  }
}
