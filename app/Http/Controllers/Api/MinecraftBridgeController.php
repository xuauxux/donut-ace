<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Services\Deposits\GameDeposits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Chat mirror + presence for the Minecraft bridge (minecraft-bridge/bridge.js).
 *
 * Deposits and account linking use the same signature scheme on /api/bot/*.
 * Every call here is server-to-server: no session, no CSRF, HMAC or 401.
 */
class MinecraftBridgeController extends Controller
{
    /** How far the bot's clock may drift from ours. */
    private const MAX_SKEW_MS = 30_000;

    private const MAX_BATCH = 200;

    public function __construct(private readonly GameDeposits $deposits) {}

    public function chat(Request $request): JsonResponse
    {
        if (! $this->signed($request)) {
            return response()->json(['ok' => false, 'error' => 'bad_signature'], 401);
        }

        $data = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:'.self::MAX_BATCH],
            'messages.*.player' => ['required', 'string', 'min:1', 'max:32'],
            'messages.*.message' => ['required', 'string', 'max:1000'],
            'messages.*.uuid' => ['nullable', 'string', 'max:36'],
            'messages.*.at' => ['nullable', 'integer'],
        ]);

        $now = now();
        $rows = [];

        foreach ($data['messages'] as $line) {
            // Control characters (section signs aside) would break the panel and
            // let a player smuggle terminal or RTL tricks into it.
            $text = trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $line['message']));

            if ($text === '') {
                continue;
            }

            $player = mb_substr($line['player'], 0, 32);
            $at = isset($line['at'])
                ? Carbon::createFromTimestampMs((int) $line['at'])
                : $now->copy();

            // Clock skew on the game host is normal; a wild timestamp is not.
            if ($at->lt($now->copy()->subDay()) || $at->gt($now->copy()->addMinutes(5))) {
                $at = $now->copy();
            }

            $rows[] = [
                'player' => $player,
                'uuid' => $line['uuid'] ?? null,
                'message' => mb_substr($text, 0, 400),
                'source' => 'game',
                'hash' => hash('sha256', $player."\x1F".$text."\x1F".(isset($line['at']) ? (int) $line['at'] : '')),
                'sent_at' => $at,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $stored = $rows === [] ? 0 : ChatMessage::query()->insertOrIgnore($rows);

        return response()->json(['ok' => true, 'accepted' => count($rows), 'stored' => $stored]);
    }

    public function heartbeat(Request $request): JsonResponse
    {
        if (! $this->signed($request)) {
            return response()->json(['ok' => false, 'error' => 'bad_signature'], 401);
        }

        $data = $request->validate([
            'state' => ['required', 'string', 'in:online,connecting,offline'],
            'bot' => ['nullable', 'string', 'min:3', 'max:16'],
            'host' => ['nullable', 'string', 'max:120'],
            'version' => ['nullable', 'string', 'max:40'],
            'players' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'detail' => ['nullable', 'string', 'max:200'],
        ]);

        // The logged-in account is the deposit address, so the page can show it
        // as soon as the bot connects instead of waiting for the first payment.
        if (! empty($data['bot'])) {
            $this->deposits->rememberBot($data['bot']);
        }

        Cache::put('mc:bridge', [
            'state' => $data['state'],
            'host' => $data['host'] ?? null,
            'version' => $data['version'] ?? null,
            'players' => $data['players'] ?? null,
            'detail' => $data['detail'] ?? null,
            'at' => now()->toIso8601String(),
        ], now()->addMinutes(10));

        return response()->json(['ok' => true]);
    }

    /**
     * HMAC-SHA256 over "timestamp.raw body" with a millisecond timestamp, the
     * scheme the reference bot and BotController share.
     */
    private function signed(Request $request): bool
    {
        $secret = (string) config('services.minecraft.secret');

        if (strlen($secret) < 16) {
            return false;
        }

        $stamp = (string) $request->header('X-Timestamp', '');
        $signature = (string) $request->header('X-Signature', '');

        if ($stamp === '' || $signature === '' || ! ctype_digit($stamp)) {
            return false;
        }

        if (abs((int) (microtime(true) * 1000) - (int) $stamp) > self::MAX_SKEW_MS) {
            return false;
        }

        $expected = hash_hmac('sha256', $stamp.'.'.$request->getContent(), $secret);

        return hash_equals($expected, $signature);
    }
}
