<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class LegalController extends Controller
{
    /* The arcade publishes its FAQ, Terms of Service, Code of Ethics and Privacy Policy. */
    public const PAGES = [
        'faq' => 'FAQ',
        'terms' => 'Terms of Service',
        'code-of-ethics' => 'Code of Ethics',
        'privacy' => 'Privacy Policy',
    ];

    public function show(string $page): Response
    {
        abort_unless(array_key_exists($page, self::PAGES), 404);

        return Inertia::render('legal/show', [
            'page' => $page,
            'title' => self::PAGES[$page],
            'updatedAt' => '2026-11-21',
        ]);
    }
}
