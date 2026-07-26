import { Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePhotoDto, UpdateProfileDto, UpsertSocialLinkDto } from './dto/profile.dto';
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from './upload.config';

const profileInclude = {
  photos: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
  socialLinks: { orderBy: { platform: 'asc' } },
} satisfies Prisma.UserProfileInclude;

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Profiles are created lazily so a user always has one to read and edit. */
  async getProfile(userId: string) {
    const existing = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: profileInclude,
    });
    if (existing) return this.toResponse(existing);

    const created = await this.prisma.userProfile.create({
      data: { userId },
      include: profileInclude,
    });
    return this.toResponse(created);
  }

  async getPublicProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      include: profileInclude,
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return this.toResponse(profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.ensureProfile(userId);
    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        displayName: dto.displayName?.trim() || null,
        bio: dto.bio?.trim() || null,
        location: dto.location?.trim() || null,
        website: dto.website?.trim() || null,
      },
      include: profileInclude,
    });
    return this.toResponse(updated);
  }

  async setAvatar(userId: string, filename: string) {
    const profile = await this.ensureProfile(userId);
    await this.removeFile(profile.avatarUrl);

    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl: `${UPLOAD_URL_PREFIX}/${filename}` },
      include: profileInclude,
    });
    return this.toResponse(updated);
  }

  async removeAvatar(userId: string) {
    const profile = await this.ensureProfile(userId);
    await this.removeFile(profile.avatarUrl);

    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl: null },
      include: profileInclude,
    });
    return this.toResponse(updated);
  }

  async addPhoto(userId: string, filename: string, caption?: string) {
    const profile = await this.ensureProfile(userId);
    const count = await this.prisma.profilePhoto.count({ where: { profileId: profile.id } });

    await this.prisma.profilePhoto.create({
      data: {
        profileId: profile.id,
        url: `${UPLOAD_URL_PREFIX}/${filename}`,
        caption: caption?.trim() || null,
        position: count,
      },
    });
    return this.getProfile(userId);
  }

  async updatePhoto(userId: string, photoId: string, dto: UpdatePhotoDto) {
    const profile = await this.ensureProfile(userId);
    const photo = await this.prisma.profilePhoto.findFirst({
      where: { id: photoId, profileId: profile.id },
    });
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    await this.prisma.profilePhoto.update({
      where: { id: photoId },
      data: { caption: dto.caption?.trim() || null },
    });
    return this.getProfile(userId);
  }

  async removePhoto(userId: string, photoId: string) {
    const profile = await this.ensureProfile(userId);
    const photo = await this.prisma.profilePhoto.findFirst({
      where: { id: photoId, profileId: profile.id },
    });
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    await this.removeFile(photo.url);
    await this.prisma.profilePhoto.delete({ where: { id: photoId } });
    return this.getProfile(userId);
  }

  async upsertSocialLink(userId: string, dto: UpsertSocialLinkDto) {
    const profile = await this.ensureProfile(userId);
    const platform = dto.platform.toLowerCase();

    await this.prisma.socialLink.upsert({
      where: { profileId_platform: { profileId: profile.id, platform } },
      update: { url: dto.url.trim() },
      create: { profileId: profile.id, platform, url: dto.url.trim() },
    });
    return this.getProfile(userId);
  }

  async removeSocialLink(userId: string, platform: string) {
    const profile = await this.ensureProfile(userId);
    const link = await this.prisma.socialLink.findFirst({
      where: { profileId: profile.id, platform: platform.toLowerCase() },
    });
    if (!link) {
      throw new NotFoundException('Social link not found');
    }

    await this.prisma.socialLink.delete({ where: { id: link.id } });
    return this.getProfile(userId);
  }

  private async ensureProfile(userId: string) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /**
   * Best-effort cleanup of an orphaned upload. `basename` keeps a malformed stored
   * path from escaping the upload directory.
   */
  private async removeFile(url: string | null) {
    if (!url || !url.startsWith(UPLOAD_URL_PREFIX)) return;
    try {
      await unlink(join(UPLOAD_DIR, basename(url)));
    } catch {
      // File already gone — nothing to clean up.
    }
  }

  private toResponse(profile: {
    id: string;
    userId: string;
    displayName: string | null;
    bio: string | null;
    location: string | null;
    website: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    photos: { id: string; url: string; caption: string | null; position: number; createdAt: Date }[];
    socialLinks: { id: string; platform: string; url: string }[];
  }) {
    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      bio: profile.bio,
      location: profile.location,
      website: profile.website,
      avatarUrl: profile.avatarUrl,
      photos: profile.photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        position: photo.position,
        createdAt: photo.createdAt.toISOString(),
      })),
      socialLinks: profile.socialLinks.map((link) => ({
        id: link.id,
        platform: link.platform,
        url: link.url,
      })),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
