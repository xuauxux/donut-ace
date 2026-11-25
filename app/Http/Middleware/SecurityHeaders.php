<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Baseline hardening headers for every web response.
 *
 * There is no Content-Security-Policy here on purpose: the game launch URLs and
 * the built asset pipeline are third-party, so a policy needs its own audit
 * before it can be switched on without breaking games.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $headers = $response->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'SAMEORIGIN');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

        if ($request->isSecure() && ! app()->isLocal()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // PHP banner off: the stack version is not something a visitor needs.
        $headers->remove('X-Powered-By');

        return $response;
    }
}
