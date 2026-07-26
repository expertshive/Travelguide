import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createProfileApi, createLocalStorageTokenStorage } from '@traveler-guide/api-client';
import { SOCIAL_PLATFORMS, type UserProfile } from '@traveler-guide/types';
import { updateProfileSchema, upsertSocialLinkSchema } from '@traveler-guide/validation';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, SmallButton, Spinner, TextArea, TextField } from '../ui';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const BIO_LIMIT = 500;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  website: 'Website',
};

export default function ProfilePage() {
  const { user } = useAuth();
  const profileApi = useMemo(
    () => createProfileApi(API_BASE, createLocalStorageTokenStorage('tg_admin_auth')),
    [],
  );

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  const [platform, setPlatform] = useState<string>(SOCIAL_PLATFORMS[0]);
  const [socialUrl, setSocialUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const applyProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    setDisplayName(next.displayName ?? '');
    setBio(next.bio ?? '');
    setLocation(next.location ?? '');
    setWebsite(next.website ?? '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyProfile(await profileApi.getMyProfile());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [applyProfile, profileApi]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<UserProfile>, successMessage: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      applyProfile(await action());
      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDetails(event: FormEvent) {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({ displayName, bio, location, website });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    await run(() => profileApi.updateProfile(parsed.data), 'Profile updated');
  }

  async function onAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await run(() => profileApi.uploadAvatar(file), 'Profile picture updated');
  }

  async function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const caption = photoCaption;
    setPhotoCaption('');
    await run(() => profileApi.addPhoto(file, caption), 'Photo added');
  }

  async function onAddSocialLink(event: FormEvent) {
    event.preventDefault();
    const parsed = upsertSocialLinkSchema.safeParse({ platform, url: socialUrl });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid social link');
      return;
    }
    await run(async () => {
      const next = await profileApi.setSocialLink(parsed.data);
      setSocialUrl('');
      return next;
    }, 'Social account linked');
  }

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading profile…" />
      </Card>
    );
  }

  const avatarSrc = profileApi.resolveMediaUrl(profile?.avatarUrl);
  const initials = (displayName || user?.name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="grid gap-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <Card className="relative overflow-hidden !p-0">
        <div className="h-32 bg-gradient-to-r from-brand-400 to-brand-600" />
        <div className="flex flex-col items-center px-6 pb-6 text-center">
          <div className="-mt-12 mb-3">
            {avatarSrc ? (
              <img
                className="size-24 rounded-full border-4 border-white object-cover shadow-soft"
                src={avatarSrc}
                alt="Profile"
              />
            ) : (
              <div className="grid size-24 place-items-center rounded-full border-4 border-white bg-gray-100 text-3xl font-bold text-gray-700 shadow-soft">
                {initials}
              </div>
            )}
          </div>

          <p className="text-xl font-bold text-brand-700">{displayName || user?.name}</p>
          <p className="text-sm text-gray-700">{user?.email}</p>
          {location ? <p className="mt-1 text-sm text-gray-700">{location}</p> : null}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <SmallButton
              type="button"
              disabled={saving}
              onClick={() => avatarInputRef.current?.click()}
            >
              {profile?.avatarUrl ? 'Change picture' : 'Upload picture'}
            </SmallButton>
            {profile?.avatarUrl ? (
              <SmallButton
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => void run(() => profileApi.removeAvatar(), 'Profile picture removed')}
              >
                Remove
              </SmallButton>
            ) : null}
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => void onAvatarSelected(event)}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-bold text-brand-700">Profile details</h3>
        <p className="mt-1 text-sm text-gray-700">Tell people who you are.</p>

        <form className="mt-5 grid gap-5" onSubmit={(event) => void onSaveDetails(event)}>
          <TextField
            label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="How your name appears to others"
          />

          <TextArea
            label="Bio"
            rows={4}
            maxLength={BIO_LIMIT}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Tell people about yourself and the trips you love."
            hint={`${bio.length}/${BIO_LIMIT}`}
          />

          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              label="Location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Riyadh, Saudi Arabia"
            />
            <TextField
              label="Website"
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="text-base font-bold text-brand-700">Social accounts</h3>
        <p className="mt-1 text-sm text-gray-700">
          Link the accounts you want shown on your profile.
        </p>

        {profile?.socialLinks.length ? (
          <ul className="mt-4 grid gap-3">
            {profile.socialLinks.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3"
              >
                <Badge>{PLATFORM_LABELS[link.platform] ?? link.platform}</Badge>
                <a
                  className="flex-1 truncate text-sm text-gray-700 hover:text-brand-500"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.url}
                </a>
                <SmallButton
                  type="button"
                  variant="danger"
                  disabled={saving}
                  onClick={() =>
                    void run(() => profileApi.removeSocialLink(link.platform), 'Social account removed')
                  }
                >
                  Unlink
                </SmallButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-gray-600">No social accounts linked yet.</p>
        )}

        <form
          className="mt-5 grid gap-3 md:grid-cols-[200px_1fr_auto] md:items-end"
          onSubmit={(event) => void onAddSocialLink(event)}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-brand-700">Platform</span>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-brand-700 outline-none focus:border-brand-500"
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
            >
              {SOCIAL_PLATFORMS.map((value) => (
                <option key={value} value={value}>
                  {PLATFORM_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Profile URL"
            type="url"
            value={socialUrl}
            placeholder="https://instagram.com/username"
            onChange={(event) => setSocialUrl(event.target.value)}
          />
          <Button type="submit" disabled={saving}>
            Link
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="text-base font-bold text-brand-700">Photos</h3>
        <p className="mt-1 text-sm text-gray-700">Upload pictures from your travels.</p>

        {profile?.photos.length ? (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {profile.photos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
              >
                <img
                  className="h-36 w-full object-cover"
                  src={profileApi.resolveMediaUrl(photo.url) ?? ''}
                  alt={photo.caption ?? 'Photo'}
                />
                <figcaption className="flex items-center justify-between gap-2 p-3 text-xs text-gray-700">
                  <span className="truncate">{photo.caption || 'No caption'}</span>
                  <SmallButton
                    type="button"
                    variant="danger"
                    disabled={saving}
                    onClick={() => void run(() => profileApi.removePhoto(photo.id), 'Photo deleted')}
                  >
                    Delete
                  </SmallButton>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-600">No photos yet.</p>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <TextField
            label="Caption"
            value={photoCaption}
            placeholder="Optional caption"
            onChange={(event) => setPhotoCaption(event.target.value)}
          />
          <Button type="button" disabled={saving} onClick={() => photoInputRef.current?.click()}>
            Add photo
          </Button>
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => void onPhotoSelected(event)}
        />
      </Card>
    </div>
  );
}
