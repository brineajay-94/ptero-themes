<!DOCTYPE html>
<html>
    <head>
        <title>{{ config('app.name', 'Pterodactyl') }}</title>

        @section('meta')
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
            <meta name="csrf-token" content="{{ csrf_token() }}">
            <meta name="robots" content="noindex">
            <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
            <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png" sizes="32x32">
            <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png" sizes="16x16">
            <link rel="manifest" href="/favicons/manifest.json">
            <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#bc6e3c">
            <link rel="shortcut icon" href="/favicons/favicon.ico">
            <meta name="msapplication-config" content="/favicons/browserconfig.xml">
            <meta name="theme-color" content="#0e4688">
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

        {{-- brine-theme: palette tokens. Must be present before the React bundle
             paints so the CSS variables behind every Tailwind colour resolve. --}}
        <link rel="stylesheet" href="/themes/pterodactyl/css/pterodactyl-theme.css?v={{ config('app.version', '1.0.0') }}">

        {{-- brine-theme: apply the stored light/dark choice before first paint
             to avoid a flash of the wrong colour scheme. --}}
        <script>
            (function () {
                var stored = null;
                try {
                    stored = localStorage.getItem('ptero-theme');
                } catch (e) {
                    stored = null;
                }

                var theme = stored === 'dark' || stored === 'light' ? stored : null;
                if (!theme) {
                    theme =
                        window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
                            ? 'light'
                            : 'dark';
                }

                document.documentElement.setAttribute('data-theme', theme);
            })();
        </script>

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
