@extends('layouts.admin')

@section('title', 'Branding')

@section('content-header')
    <h1>Branding<small>Upload your hosting logo - it replaces the login emblem and the panel favicon.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Branding</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-md-5">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Current logo</h3>
                </div>
                <div class="box-body text-center">
                    @if ($logo)
                        <img src="{{ $logo }}" alt="Custom logo" style="max-width: 128px; max-height: 128px" />
                        <p class="text-muted" style="margin-top: 10px;">Custom logo in use - shown on the login card and as the favicon everywhere.</p>
                    @else
                        <img src="/themes/pterodactyl/images/logo.svg" alt="Default emblem" width="96" height="96" />
                        <p class="text-muted" style="margin-top: 10px;">No custom logo yet - the default emblem is in use.</p>
                    @endif
                </div>
                @if ($logo)
                    <div class="box-footer text-center">
                        <form action="{{ route('admin.branding.destroy') }}" method="POST">
                            @csrf
                            @method('DELETE')
                            <button type="submit" class="btn btn-danger btn-sm">Remove custom logo</button>
                        </form>
                    </div>
                @endif
            </div>
        </div>
        <div class="col-md-7">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Upload a new logo</h3>
                </div>
                <form action="{{ route('admin.branding.update') }}" method="POST" enctype="multipart/form-data">
                    @csrf
                    <div class="box-body">
                        <div class="form-group">
                            <label class="control-label">Hosting logo</label>
                            <input type="file" name="logo" accept=".png,.svg,.jpg,.jpeg,.ico" required />
                            <p class="help-block">
                                PNG, SVG, JPG or ICO up to 4 MB. Square images look best - the same file is used as
                                the favicon, so keep it small. The web server must be able to write to
                                <code>public/themes/pterodactyl/images/</code>.
                            </p>
                            @foreach ($errors->all() as $error)
                                <p class="text-danger">{{ $error }}</p>
                            @endforeach
                        </div>
                    </div>
                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary">Save logo</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
@endsection
