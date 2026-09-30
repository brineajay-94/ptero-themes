<?php

namespace Pterodactyl\Support;

/**
 * Key a white background out of an uploaded illustration.
 *
 * Why this has to happen at all: the auth hero is #141417, and artwork that
 * arrives on an opaque white plate reads as a pasted rectangle rather than as
 * artwork. CSS cannot fix it - `screen` leaves white as white, and `multiply`
 * keys the background out but takes the dark server racks with it.
 *
 * Two passes, because one is not enough:
 *
 *  1. A flood fill from the border. Not a brightness threshold: the artwork has
 *     genuinely light pixels that must survive - the pale slab top, the clouds,
 *     the glowing panels - and any global "make bright pixels transparent" eats
 *     them. Only background *connected to the edge* is background.
 *
 *  2. A second pass for large *enclosed* near-white regions. The blue glow ring
 *     in this artwork is a closed ellipse, so the white inside it is cut off
 *     from the page edge and pass 1 can never reach it - it would survive as a
 *     white lens floating on the dark hero. Regions above a minimum area are
 *     cleared; smaller ones are kept, so a white specular highlight on a rack
 *     survives while the ring's interior does not.
 *
 * Then the cut edge is feathered, because a correct alpha file can still leave a
 * ring of white speckle against a dark background, and the result is cropped to
 * what is left so the layout does not reserve space for a transparent margin.
 *
 * The namespace is declared above the class on purpose and has to stay there.
 * This file shipped once with no `namespace` statement at all, so the class
 * landed in the global namespace and every call to
 * `Pterodactyl\Support\IllustrationProcessor` was a 500. `php -l` passes on a
 * file that declares a class in the wrong namespace, which is why there is a
 * check for that now - see check-namespaces.php in the project scripts.
 *
 * @param string $sourcePath  path to the uploaded file
 * @param string $targetPath  where to write the processed PNG
 * @param int    $threshold   0-255, how close to white counts as background
 *
 * @return array{written:bool, message:string, width?:int, height?:int, cleared?:int, sourceWidth?:int, sourceHeight?:int, cropX?:int, cropY?:int}
 */
final class IllustrationProcessor
{
    /** How much a pixel may differ across its channels and still be "neutral". */
    private const CHROMA = 14;

    /** Feather width, in levels below the threshold, for the cut edge. */
    private const FEATHER = 46;

    public static function key(string $sourcePath, string $targetPath, int $threshold = 240): array
    {
        $info = @getimagesize($sourcePath);
        if ($info === false) {
            return ['written' => false, 'message' => 'That file could not be read as an image.'];
        }

        $image = self::open($sourcePath, $info[2]);
        if ($image === null) {
            return ['written' => false, 'message' => 'GD on this server cannot decode that image format.'];
        }

        $width = imagesx($image);
        $height = imagesy($image);
        if ($width < 2 || $height < 2) {
            imagedestroy($image);

            return ['written' => false, 'message' => 'That image is too small to use.'];
        }

        $true = imagecreatetruecolor($width, $height);
        imagealphablending($true, false);
        imagesavealpha($true, true);
        imagecopy($true, $image, 0, 0, 0, 0, $width, $height);
        imagedestroy($image);

        $cleared = self::clearBackground($true, $width, $height, $threshold);

        $box = self::contentBounds($true, $width, $height);
        if ($box === null) {
            imagedestroy($true);

            return [
                'written' => false,
                'message' => 'Almost the whole image was treated as background, so there is nothing left to show. '
                    . 'If it really is a light illustration, try an image with more contrast against its background.',
            ];
        }

        [$x0, $y0, $x1, $y1] = $box;
        $pad = 2;
        $x0 = max(0, $x0 - $pad);
        $y0 = max(0, $y0 - $pad);
        $x1 = min($width - 1, $x1 + $pad);
        $y1 = min($height - 1, $y1 + $pad);
        $cw = $x1 - $x0 + 1;
        $ch = $y1 - $y0 + 1;

        $cropped = imagecreatetruecolor($cw, $ch);
        imagealphablending($cropped, false);
        imagesavealpha($cropped, true);
        imagecopy($cropped, $true, 0, 0, $x0, $y0, $cw, $ch);
        imagedestroy($true);

        $ok = imagepng($cropped, $targetPath, 6);
        imagedestroy($cropped);

        if (!$ok) {
            return ['written' => false, 'message' => 'The processed image could not be written to disk.'];
        }

        return [
            'written' => true,
            'message' => 'Background removed.',
            'width' => $cw,
            'height' => $ch,
            'cleared' => $cleared,
            'sourceWidth' => $width,
            'sourceHeight' => $height,
            // Where the crop started, so a caller (or a test) can map a
            // coordinate in the original onto the saved file.
            'cropX' => $x0,
            'cropY' => $y0,
        ];
    }

    /** Decode whatever GD can read, as a truecolour image. */
    private static function open(string $path, int $type)
    {
        switch ($type) {
            case IMAGETYPE_PNG:
                return @imagecreatefrompng($path);
            case IMAGETYPE_JPEG:
                return @imagecreatefromjpeg($path);
            case IMAGETYPE_WEBP:
                return function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : null;
            case IMAGETYPE_GIF:
                return @imagecreatefromgif($path);
            default:
                return null;
        }
    }

    /**
     * @param resource|\GdImage $im
     */
    private static function clearBackground($im, int $width, int $height, int $threshold): int
    {
        $total = $width * $height;

        // 0 = not background, 1 = candidate, 2 = confirmed background,
        // 3 = near-white kept because the region is small.
        $state = array_fill(0, $total, 0);

        for ($i = 0; $i < $total; $i++) {
            $rgba = imagecolorat($im, $i % $width, intdiv($i, $width));
            $a = ($rgba >> 24) & 0x7F;
            $r = ($rgba >> 16) & 0xFF;
            $g = ($rgba >> 8) & 0xFF;
            $b = $rgba & 0xFF;
            $mn = min($r, $g, $b);
            $chroma = max($r, $g, $b) - $mn;

            if ($a === 127 || ($mn >= $threshold && $chroma <= self::CHROMA)) {
                $state[$i] = 1;
            }
        }

        // Pass 1: flood inward from the border.
        $stack = [];
        for ($x = 0; $x < $width; $x++) {
            self::seed($state, $stack, $x, 0, $width);
            self::seed($state, $stack, $x, $height - 1, $width);
        }
        for ($y = 0; $y < $height; $y++) {
            self::seed($state, $stack, 0, $y, $width);
            self::seed($state, $stack, $width - 1, $y, $width);
        }

        while ($stack) {
            $i = array_pop($stack);
            $x = $i % $width;
            $y = intdiv($i, $width);
            if ($x > 0) {
                self::seed($state, $stack, $x - 1, $y, $width);
            }
            if ($x < $width - 1) {
                self::seed($state, $stack, $x + 1, $y, $width);
            }
            if ($y > 0) {
                self::seed($state, $stack, $x, $y - 1, $width);
            }
            if ($y < $height - 1) {
                self::seed($state, $stack, $x, $y + 1, $width);
            }
        }

        $cleared = 0;
        for ($i = 0; $i < $total; $i++) {
            if ($state[$i] === 2) {
                self::clearPixel($im, $i % $width, intdiv($i, $width));
                $cleared++;
            }
        }

        // Pass 2: large enclosed near-white regions. See the note above.
        $minArea = max(1500, (int) round($total * 0.0015));
        $seen = array_fill(0, $total, false);

        for ($start = 0; $start < $total; $start++) {
            if ($seen[$start] || $state[$start] === 2) {
                continue;
            }
            if (!self::isNearWhite($im, $start % $width, intdiv($start, $width), $threshold)) {
                $seen[$start] = true;

                continue;
            }

            $comp = [$start];
            $seen[$start] = true;
            for ($h = 0; $h < count($comp); $h++) {
                $i = $comp[$h];
                $x = $i % $width;
                $y = intdiv($i, $width);
                foreach ([[$x - 1, $y], [$x + 1, $y], [$x, $y - 1], [$x, $y + 1]] as [$nx, $ny]) {
                    if ($nx < 0 || $ny < 0 || $nx >= $width || $ny >= $height) {
                        continue;
                    }
                    $j = $ny * $width + $nx;
                    if ($seen[$j] || $state[$j] === 2) {
                        continue;
                    }
                    if (!self::isNearWhite($im, $nx, $ny, $threshold)) {
                        continue;
                    }
                    $seen[$j] = true;
                    $comp[] = $j;
                }
            }

            if (count($comp) >= $minArea) {
                foreach ($comp as $i) {
                    self::clearPixel($im, $i % $width, intdiv($i, $width));
                    $cleared++;
                }
            } else {
                foreach ($comp as $i) {
                    $state[$i] = 3;
                }
            }
        }

        // Feather the cut edge, so the anti-aliased boundary does not leave a
        // ring of white speckle against the dark hero.
        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $i = $y * $width + $x;
                if ($state[$i] === 2 || $state[$i] === 3) {
                    continue;
                }
                $rgba = imagecolorat($im, $x, $y);
                $a = ($rgba >> 24) & 0x7F;
                $r = ($rgba >> 16) & 0xFF;
                $g = ($rgba >> 8) & 0xFF;
                $b = $rgba & 0xFF;
                if ((max($r, $g, $b) - min($r, $g, $b)) > self::CHROMA) {
                    continue; // coloured: never feather
                }
                $soft = ($threshold - min($r, $g, $b)) / self::FEATHER;
                if ($soft <= 0) {
                    continue;
                }
                $touches = false;
                for ($dy = -1; $dy <= 1 && !$touches; $dy++) {
                    for ($dx = -1; $dx <= 1; $dx++) {
                        $nx = $x + $dx;
                        $ny = $y + $dy;
                        if ($nx < 0 || $ny < 0 || $nx >= $width || $ny >= $height) {
                            continue;
                        }
                        if ($state[$ny * $width + $nx] === 2) {
                            $touches = true;
                            break;
                        }
                    }
                }
                if (!$touches) {
                    continue;
                }
                $newA = (int) max(0, min(127, round(127 * (1 - min(1, $soft)))));
                $newA = min($a, $newA);
                imagesetpixel($im, $x, $y, ($newA << 24) | ($r << 16) | ($g << 8) | $b);
            }
        }

        return $cleared;
    }

    /** @param array<int,int> $state */
    private static function seed(array &$state, array &$stack, int $x, int $y, int $width): void
    {
        if ($x < 0 || $y < 0) {
            return;
        }
        $i = $y * $width + $x;
        // `!== 1`, not a falsy test: 2 means "already queued" and letting it
        // through re-queues the pixel from every neighbour it has.
        if ($state[$i] !== 1) {
            return;
        }
        $state[$i] = 2;
        $stack[] = $i;
    }

    /** @param resource|\GdImage $im */
    private static function isNearWhite($im, int $x, int $y, int $threshold): bool
    {
        $rgba = imagecolorat($im, $x, $y);
        $a = ($rgba >> 24) & 0x7F;
        if ($a === 127) {
            return true;
        }
        $r = ($rgba >> 16) & 0xFF;
        $g = ($rgba >> 8) & 0xFF;
        $b = $rgba & 0xFF;

        return min($r, $g, $b) >= $threshold && (max($r, $g, $b) - min($r, $g, $b)) <= self::CHROMA;
    }

    /** @param resource|\GdImage $im */
    private static function clearPixel($im, int $x, int $y): void
    {
        imagesetpixel($im, $x, $y, (127 << 24));
    }

    /**
     * Bounding box of what is left, or null if nothing is.
     *
     * @param  resource|\GdImage $im
     * @return array{0:int,1:int,2:int,3:int}|null
     */
    private static function contentBounds($im, int $width, int $height): ?array
    {
        $minX = $width;
        $minY = $height;
        $maxX = -1;
        $maxY = -1;

        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $a = (imagecolorat($im, $x, $y) >> 24) & 0x7F;
                if ($a < 121) { // GD alpha: 0 opaque, 127 transparent
                    if ($x < $minX) {
                        $minX = $x;
                    }
                    if ($x > $maxX) {
                        $maxX = $x;
                    }
                    if ($y < $minY) {
                        $minY = $y;
                    }
                    if ($y > $maxY) {
                        $maxY = $y;
                    }
                }
            }
        }

        return $maxX < 0 ? null : [$minX, $minY, $maxX, $maxY];
    }
}
