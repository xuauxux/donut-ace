<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Deposits\BotDeposits;
use App\Services\Deposits\GameDeposits;
use App\Services\Withdrawals\WithdrawalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Callbacks from the Minecraft bot (see minecraft-bridge/bot.js).
 *
 * Signed with X-Timestamp (milliseconds) and
 * X-Signature = HMAC-SHA256(secret, timestamp + "." + raw body), which is what
 * the reference bot sends. The body is parsed here rather than trusted: the
 * player name is re-derived from the receipt text and must match the payload.
 */
class BotController extends Controller
{
    /** How far the bot's clock may drift from ours. */
    private const MAX_SKEW_MS = 30_000;

    public function __construct(
        private readonly BotDeposits $bot,
        private readonly GameDeposits $deposits,
        private readonly WithdrawalService $withdrawals,
    ) {}

    /** The player whispered a link code to the bot. */
    public function link(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return response()->json(['error' => 'bad signature'], 401);
        }

        $data = $request->validate([
            'eventId' => ['required', 'string', 'min:8', 'max:64'],
            'player' => ['required', 'string', 'regex:/^[A-Za-z0-9_]{3,16}$/'],
            'code' => ['required', 'string', 'regex:/^[A-Za-z0-9]{8}$/'],
        ]);

        return response()->json($this->bot->completeLink($data['eventId'], $data['player'], $data['code']));
    }

    /** "<player> paid you $1.5m" seen by the bot. */
    public function deposit(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return response()->json(['error' => 'bad signature'], 401);
        }

        if (! (bool) config('casino.deposit.enabled')) {
            return response()->json(['error' => 'deposits disabled'], 503);
        }

        $data = $request->validate([
            'eventId' => ['required', 'string', 'min:8', 'max:64'],
            'player' => ['required', 'string', 'regex:/^[A-Za-z0-9_]{3,16}$/'],
            'amount' => ['required', 'integer', 'min:1', 'max:1000000000000'],
            'raw' => ['nullable', 'string', 'max:300'],
        ]);

        // Re-parse the receipt when the bot sends the line: the payload must
        // agree with the text, so a bridge bug cannot credit a made-up amount.
        if (! empty($data['raw'])) {
            $parsed = $this->deposits->parse($data['raw']);

            if ($parsed === null
                || $parsed['player'] !== strtolower($data['player'])
                || $parsed['game_amount'] !== (int) $data['amount']) {
                return response()->json(['error' => 'receipt mismatch'], 400);
            }
        }

        return response()->json($this->bot->handleDeposit(
            $data['eventId'],
            $data['player'],
            (int) $data['amount'],
            $data['raw'] ?? null,
        ));
    }

    /** The bridge asks for the next queued payout (one at a time). */
    public function claimWithdrawal(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return response()->json(['error' => 'bad signature'], 401);
        }

        $data = $request->validate([
            'eventId' => ['required', 'string', 'min:8', 'max:64'],
        ]);

        return response()->json($this->withdrawals->claim($data['eventId']));
    }

    /** The bridge reports what happened after it typed /pay. */
    public function withdrawalResult(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return response()->json(['error' => 'bad signature'], 401);
        }

        $data = $request->validate([
            'id' => ['required', 'integer', 'min:1'],
            'status' => ['required', 'string', 'in:paid,failed,unconfirmed'],
            'receipt' => ['nullable', 'string', 'max:300'],
            'reason' => ['nullable', 'string', 'max:160'],
        ]);

        return response()->json($this->withdrawals->result(
            (int) $data['id'],
            (string) $data['status'],
            $data['receipt'] ?? null,
            $data['reason'] ?? null,
        ));
    }

    private function authorized(Request $request): bool
    {
        $secret = (string) config('services.minecraft.secret');

        if (strlen($secret) < 16) {
            return false;
        }

        // Optional IP allowlist, for when the bot has a fixed address.
        $allowed = (array) config('services.minecraft.allowed_ips', []);
        if ($allowed !== []) {
            $ip = (string) ($request->ip() ?? '');
            if (! in_array($ip, $allowed, true)) {
                return false;
            }
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
