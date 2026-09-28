<!DOCTYPE html>
<html>
    <head>
        <title>Niraula EduMedia | Panel</title>

        @section('meta')
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
            <meta name="csrf-token" content="{{ csrf_token() }}">
            <meta name="robots" content="noindex">
            <meta name="description" content="Niraula EduMedia game server control panel - deploy, manage and monitor your servers.">
            <link rel="icon" type="image/svg+xml" href="/themes/pterodactyl/images/logo.svg">
            <link rel="shortcut icon" href="/themes/pterodactyl/images/logo.svg">
            <link rel="apple-touch-icon" href="/themes/pterodactyl/images/logo.svg">
            <meta name="theme-color" content="#1a3c6d">
            <meta name="msapplication-TileColor" content="#1a3c6d">
            <meta property="og:title" content="Niraula EduMedia Panel">
            <meta property="og:description" content="Niraula EduMedia game server control panel.">
            <meta property="og:type" content="website">
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

        {{-- brine-theme: apply the stored theme before first paint to avoid a
             flash of the wrong colour scheme. --}}
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

                var meta = document.querySelector('meta[name="theme-color"]');
                if (meta) {
                    meta.setAttribute('content', theme === 'light' ? '#f8f7f4' : '#1f2a3a');
                }
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
