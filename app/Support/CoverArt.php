<?php

namespace App\Support;

/**
 * Cover art lookup for lobby cards and game boards.
 *
 * Covers are shipped as WebP (crisper gradients, ~40% smaller than JPEG) with a
 * JPEG kept alongside as a fallback, so a missing WebP never breaks a card.
 */
class CoverArt
{
    /** Path for a game id, preferring the WebP once it exists. */
    public static function url(string $id): ?string
    {
        foreach (['webp', 'jpg'] as $ext) {
            $path = "images/games/{$id}.{$ext}";

            if (is_file(public_path($path))) {
                return "/{$path}";
            }
        }

        return null;
    }

    /** Upgrade a configured .jpg cover path to its .webp twin when present. */
    public static function prefer(?string $path): ?string
    {
        if ($path === null || ! str_ends_with($path, '.jpg')) {
            return $path;
        }

        $webp = preg_replace('/\.jpg$/', '.webp', $path);
        $file = public_path(ltrim($webp, '/'));

        return is_file($file) ? $webp : $path;
    }
}
