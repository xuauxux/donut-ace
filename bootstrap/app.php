<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SettleGameSession;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // Only the canonical host (plus loopback for local development) may
        // serve the app. This keeps a forged Host header out of generated
        // password-reset, verification and signed URLs.
        $middleware->trustHosts(at: ['donutace.alwaysdata.net', 'localhost', '127.0.0.1']);

        // Nothing sits in front of this app on alwaysdata: TLS is terminated by
        // the host and HTTPS is already set, so the real client address is in
        // REMOTE_ADDR. Trusting X-Forwarded-* by default would let anyone spoof
        // their IP and walk around the throttle and the bot IP allowlist, so
        // proxies are trusted only when explicitly listed in TRUSTED_PROXIES.
        $proxies = array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('TRUSTED_PROXIES', '')),
        )));

        $middleware->trustProxies(at: $proxies === [] ? null : $proxies);

        // Server-to-server callers have no session: the Minecraft bot and the
        // bridge authenticate with their own HMAC signatures instead.
        $middleware->validateCsrfTokens(except: ['api/mc/*', 'api/bot/*']);

        $middleware->web(append: [
            HandleAppearance::class,
            SettleGameSession::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            \App\Http\Middleware\SecurityHeaders::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Branded error pages. In local debug, 500s keep Laravel's detailed page.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            $status = $response->getStatusCode();

            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                return $response;
            }

            if ($status === 419) {
                return back()->with('status', 'The page expired, please try again.');
            }

            if (in_array($status, [403, 404, 429, 503], true)
                || ($status === 500 && ! app()->hasDebugModeEnabled())) {
                return Inertia::render('errors/error', ['status' => $status])
                    ->toResponse($request)
                    ->setStatusCode($status);
            }

            return $response;
        });
    })->create();
