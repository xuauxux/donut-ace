<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'spinkit' => [
        'url' => rtrim((string) env('SPINKIT_URL', 'http://localhost:3000'), '/'),
        'token' => env('SPINKIT_TOKEN'),
        // Optional: only when request signing is enabled for the merchant.
        'signing_secret' => env('SPINKIT_SIGNING_SECRET'),
        'timeout' => (int) env('SPINKIT_TIMEOUT', 10),
    ],

    'minecraft' => [
        // Shared secret with minecraft-bridge; empty means the bridge is off.
        'secret' => env('MC_BRIDGE_SECRET'),
        'server_name' => env('MC_SERVER_NAME', 'DonutSMP'),
        'server_host' => env('MC_SERVER_HOST', 'play.donutsmp.net'),
        // Optional comma-separated IP allowlist for bot callbacks.
        'allowed_ips' => array_values(array_filter(array_map('trim', explode(',', (string) env('MC_BOT_ALLOWED_IPS', ''))))),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
