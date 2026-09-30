<!DOCTYPE html>
{{-- brine-theme: the palette selected in Admin -> Site Settings -> Theme. It is
     rendered onto <html> server-side on purpose - a variant applied later from
     JavaScript would show the default for a frame on every navigation.

     There is no 'default' slug: the monochrome black palette is the `:root`
     block in the stylesheet, so 'black' is both a real slug and the fallback for
     a panel with nothing stored (and for one still holding the retired
     'default'). --}}
@php
    $ptThemeVariant = !empty($siteConfiguration['theme']['variant']) ? $siteConfiguration['theme']['variant'] : 'black';
    $ptThemeColors = [
        'black' => '#0b0b0d',
        'amber' => '#0c0c0c',
    ];
    $ptThemeColor = $ptThemeColors[$ptThemeVariant] ?? $ptThemeColors['black'];
@endphp
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" data-pt-theme="{{ $ptThemeVariant }}">
    <head>
        <title>{{ config('app.name', 'Pterodactyl') }}</title>

        @section('meta')
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
            <meta name="csrf-token" content="{{ csrf_token() }}">
            <meta name="robots" content="noindex">
            {{-- brine-theme: the admin-uploaded logo (Admin -> Site Settings) is the
                 favicon; stock /favicons are no longer referenced.

                 The mtime rides along as ?v= because a favicon URL that does not
                 change when the file does is a favicon URL the browser will not
                 refetch - the admin replaces the image, the disk copy changes,
                 and the previous icon stays on screen. Newest match wins rather
                 than glob order, so a stale leftover cannot take the slot. The
                 MIME type comes from the extension instead of being hardcoded to
                 image/png, which lied for every format except PNG. --}}
            @php
                $brandLogos = glob(public_path('themes/pterodactyl/images/custom-logo.*'));
                $brandLogo = null;
                if (is_array($brandLogos)) {
                    foreach ($brandLogos as $candidate) {
                        if (!is_file($candidate)) {
                            continue;
                        }
                        $candidateTime = (int) @filemtime($candidate);
                        if ($brandLogo === null || $candidateTime > $brandLogo[1]) {
                            $brandLogo = [basename($candidate), $candidateTime];
                        }
                    }
                }
                $brandLogoTypes = [
                    'png' => 'image/png',
                    'jpg' => 'image/jpeg',
                    'jpeg' => 'image/jpeg',
                    'gif' => 'image/gif',
                    'webp' => 'image/webp',
                    'svg' => 'image/svg+xml',
                    'ico' => 'image/x-icon',
                ];
                $brandLogoExt = $brandLogo ? strtolower(pathinfo($brandLogo[0], PATHINFO_EXTENSION)) : '';
                $brandLogoType = $brandLogoTypes[$brandLogoExt] ?? 'image/png';
            @endphp
            @if($brandLogo)
                <link rel="icon" type="{{ $brandLogoType }}" href="/themes/pterodactyl/images/{{ $brandLogo[0] }}?v={{ $brandLogo[1] }}">
                <link rel="apple-touch-icon" href="/themes/pterodactyl/images/{{ $brandLogo[0] }}?v={{ $brandLogo[1] }}">
            @else
                <link rel="icon" type="image/svg+xml" href="/themes/pterodactyl/images/logo.svg">
            @endif
            <meta name="theme-color" content="{{ $ptThemeColor }}">
        @show

        @section('user-data')
            @if(!is_null(Auth::user()))
                <script>
                    window.PterodactylUser = {!! json_encode(Auth::user()->toVueObject()) !!};
                </script>
            @endif
            @if(!empty($siteConfiguration))
                <script>
                    window.SiteConfiguration = {!! json_encode($siteConfiguration) !!};
                </script>
            @endif
        @show

        {{-- brine-theme: dark violet/indigo palette. Must be present before the
             React bundle paints so every Tailwind colour resolves.

             The cache-buster is the stylesheet's own mtime, not
             config('app.version'). app.version is the *panel's* version, so it
             only changes when the panel is upgraded - never when the theme is
             updated. Combined with the `max-age=14400` the web server sends for
             static files, a theme update left browsers holding the previous
             stylesheet for up to four hours with no revalidation, which is how a
             page kept rendering the old blue accent after the palette had
             already changed underneath it.

             mtime moves whenever the installer replaces the file, so the URL
             changes exactly when the content does. There is no version string
             to keep in step with anything, and a missing file degrades to the
             old behaviour instead of erroring. --}}
        <link rel="stylesheet" href="/themes/pterodactyl/css/pterodactyl-theme.css?v={{ @filemtime(public_path('themes/pterodactyl/css/pterodactyl-theme.css')) ?: config('app.version', '1.0.0') }}">


        @yield('assets')

        @include('layouts.scripts')
    </head>
    <body class="{{ $css['body'] ?? 'bg-neutral-50' }}">
        @section('content')
            @yield('above-container')
            @yield('container')
            @yield('below-container')
        @show
        @section('scripts')
            {!! $asset->js('main.js') !!}
        @show
    </body>
</html>
