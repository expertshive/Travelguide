import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { UpdatePhotoDto, UpdateProfileDto, UpsertSocialLinkDto } from './dto/profile.dto';
import { ProfileService } from './profile.service';
import { SOCIAL_PLATFORMS } from './social-platforms';
import { imageUploadOptions } from './upload.config';

type UploadedImage = { filename: string } | undefined;

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('users')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Public()
  @Get('profile/social-platforms')
  @ApiOperation({ summary: 'List supported social platforms' })
  socialPlatforms() {
    return { platforms: SOCIAL_PLATFORMS };
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get the current user profile' })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.profileService.getProfile(user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update bio and profile details' })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(user.userId, dto);
  }

  @Post('profile/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a profile picture' })
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedImage) {
    if (!file) {
      throw new BadRequestException('No image uploaded');
    }
    return this.profileService.setAvatar(user.userId, file.filename);
  }

  @Delete('profile/avatar')
  @ApiOperation({ summary: 'Remove the profile picture' })
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.profileService.removeAvatar(user.userId);
  }

  @Post('profile/photos')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a photo to the profile gallery' })
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  addPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedImage,
    @Body('caption') caption?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No image uploaded');
    }
    return this.profileService.addPhoto(user.userId, file.filename, caption);
  }

  @Patch('profile/photos/:photoId')
  @ApiOperation({ summary: 'Update a gallery photo caption' })
  updatePhoto(
    @CurrentUser() user: AuthUser,
    @Param('photoId') photoId: string,
    @Body() dto: UpdatePhotoDto,
  ) {
    return this.profileService.updatePhoto(user.userId, photoId, dto);
  }

  @Delete('profile/photos/:photoId')
  @ApiOperation({ summary: 'Delete a gallery photo' })
  removePhoto(@CurrentUser() user: AuthUser, @Param('photoId') photoId: string) {
    return this.profileService.removePhoto(user.userId, photoId);
  }

  @Put('profile/social-links')
  @ApiOperation({ summary: 'Add or update a linked social account' })
  upsertSocialLink(@CurrentUser() user: AuthUser, @Body() dto: UpsertSocialLinkDto) {
    return this.profileService.upsertSocialLink(user.userId, dto);
  }

  @Delete('profile/social-links/:platform')
  @ApiOperation({ summary: 'Unlink a social account' })
  removeSocialLink(@CurrentUser() user: AuthUser, @Param('platform') platform: string) {
    return this.profileService.removeSocialLink(user.userId, platform);
  }

  @Get(':userId/profile')
  @ApiOperation({ summary: 'Get another user profile' })
  getPublicProfile(@Param('userId') userId: string) {
    return this.profileService.getPublicProfile(userId);
  }
}
