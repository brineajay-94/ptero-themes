<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class RegisterController extends Controller
{
    public function __construct(private SettingsRepositoryInterface $settings)
    {
    }

    /**
     * Render the base authentication view for /auth/register. React takes over
     * from here exactly like it does for the login screen. Registration is a
     * brine-theme feature - when the admin has not enabled it the visitor is
     * simply sent back to the login page.
     */
    public function index(): View|\Illuminate\Http\RedirectResponse
    {
        if (!$this->enabled()) {
            return redirect()->route('auth.login');
        }

        return view('templates/auth.core');
    }

    /**
     * Create a new panel user through the Application API
     * (POST /api/application/users) using the Application API key the admin
     * saved under Admin -> Registration. The key never leaves the server and
     * the password is hashed by the API, never here.
     */
    public function register(Request $request): JsonResponse
    {
        if (!$this->enabled()) {
            abort(404);
        }

        try {
            $data = $request->validate([
                'email' => 'required|email|max:255',
                'first_name' => 'required|string|max:60',
                'last_name' => 'required|string|max:60',
                'username' => 'required|alpha_dash|min:3|max:60',
                'password' => 'required|string|min:8|confirmed',
            ]);
        } catch (ValidationException $exception) {
            return response()->json([
                'errors' => collect($exception->errors())
                    ->flatten()
                    ->map(fn ($message) => ['code' => 'ValidationFailed', 'detail' => $message])
                    ->values()
                    ->all(),
            ], 422);
        }

        $key = $this->apiKey();
        if ($key === '') {
            return response()->json([
                'errors' => [[
                    'code' => 'RegistrationNotConfigured',
                    'detail' => 'Registration is enabled but no Application API key is configured. An administrator must save one under Admin -> Registration.',
                ]],
            ], 500);
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $key,
                'Accept' => 'application/json',
            ])->asJson()->timeout(20)->post(rtrim(config('app.url'), '/') . '/api/application/users', [
                'email' => $data['email'],
                'username' => $data['username'],
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'password' => $data['password'],
                'root_admin' => false,
                'language' => config('app.locale') ?: 'en',
            ]);
        } catch (\Throwable $exception) {
            Log::error('brine-theme: registration API call failed: ' . $exception->getMessage());

            return response()->json([
                'errors' => [[
                    'code' => 'RegistrationUnreachable',
                    'detail' => 'The panel API could not be reached - check that the Application API key and APP_URL are correct.',
                ]],
            ], 502);
        }

        if ($response->failed()) {
            $detail = $response->json('errors.0.detail');
            if (!is_string($detail) || $detail === '') {
                $detail = 'The panel rejected the request (HTTP ' . $response->status() . ').';
            }

            return response()->json([
                'errors' => [['code' => 'RegistrationFailed', 'detail' => $detail]],
            ], 422);
        }

        return response()->json(['data' => ['registered' => true]]);
    }

    private function enabled(): bool
    {
        return $this->settings->get('Brine::registration_enabled') === '1';
    }

    /**
     * The stored Application API key, with an optional pasted "Bearer "
     * prefix stripped.
     */
    private function apiKey(): string
    {
        $key = trim((string) $this->settings->get('Brine::registration_api_key', ''));

        return (string) preg_replace('/^Bearer\s+/i', '', $key);
    }
}
