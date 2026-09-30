<!DOCTYPE html>
{{-- brine-theme: the palette selected in Admin -> Site Settings -> Theme. It is
     rendered onto <html> server-side on purpose - a variant applied later from
     JavaScript would show the default for a frame on every navigation. --}}
@php
    $ptThemeVariant = !empty($siteConfiguration['theme']['variant']) ? $siteConfiguration['theme']['variant'] : 'default';
    $ptThemeColors = [
        'default' => '#19152e',
        'blue' => '#0d1e38',
        'black' => '#0b0b0d',
    ];
    $ptThemeColor = $ptThemeColors[$ptThemeVariant] ?? $ptThemeColors['default'];
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
            {{-- brine-theme: the admin-uploaded logo (Admin -> Branding) is the favicon;
                 stock /favicons are no longer referenced. --}}
            @php
    $brandLogo = glob(public_path('themes/pterodactyl/images/custom-logo.*'));
    $brandLogo = is_array($brandLogo) ? $brandLogo : [];
@endphp
            @if(count($brandLogo))
                <link rel="icon" type="image/png" href="/themes/pterodactyl/images/{{ basename($brandLogo[0]) }}">
                <link rel="apple-touch-icon" href="/themes/pterodactyl/images/{{ basename($brandLogo[0]) }}">
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
             React bundle paints so every Tailwind colour resolves. --}}
        <link rel="stylesheet" href="/themes/pterodactyl/css/pterodactyl-theme.css?v={{ config('app.version', '1.0.0') }}">


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
