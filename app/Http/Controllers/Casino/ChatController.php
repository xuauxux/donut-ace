<?php

namespace App\Http\Controllers\Casino;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Live Chat page: in-game lines relayed by the bridge plus messages players
 * type here. Every write goes through the server; the page only polls for new
 * lines and for bridge health.
 */
class ChatController extends Controller
{
    private const PAGE_SIZE = 60;

    public function show(): Response
    {
        return Inertia::render('casino/chat', [
            'messages' => $this->lines(
                ChatMessage::query()->orderByDesc('id')->limit(self::PAGE_SIZE)->get()->reverse()->values()
            ),
            'bridge' => $this->bridge(),
            'server' => [
                'name' => (string) config('services.minecraft.server_name'),
                'host' => (string) config('services.minecraft.server_host'),
                'configured' => (string) config('services.minecraft.secret') !== '',
            ],
        ]);
    }

    public function messages(Request $request): JsonResponse
    {
        $after = $request->integer('after');

        $query = ChatMessage::query()->orderBy('id');

        if ($after > 0) {
            // A long-absent tab asks for everything after its last id, so cap it.
            $query->where('id', '>', $after)->limit(200);
        } else {
            $query->orderByDesc('id')->limit(self::PAGE_SIZE)->reorder('id');
        }

        return response()->json([
            'messages' => $this->lines($query->get()),
            'bridge' => $this->bridge(),
        ]);
    }

    public function send(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'min:1', 'max:200'],
        ]);

        $user = $request->user();

        $text = trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $data['message']));

        if ($text === '') {
            return response()->json(['ok' => false, 'error' => 'empty'], 422);
        }

        $now = now();

        $line = ChatMessage::create([
            'player' => mb_substr($user->name, 0, 32),
            'uuid' => null,
            'message' => mb_substr($text, 0, 200),
            'source' => 'site',
            'user_id' => $user->id,
            'hash' => hash('sha256', $user->id."\x1F".$text."\x1F".$now->getTimestampMs()),
            'sent_at' => $now,
        ]);

        return response()->json([
            'ok' => true,
            'message' => $this->lines(collect([$line]))[0],
        ], 201);
    }

    /** @param  \Illuminate\Support\Collection<int, ChatMessage>  $rows */
    private function lines($rows): array
    {
        $me = auth()->id();

        return $rows->map(fn (ChatMessage $m) => [
            'id' => $m->id,
            'player' => $m->player,
            'message' => $m->message,
            'source' => $m->source,
            'mine' => $m->user_id !== null && $m->user_id === $me,
            // A stable hue per player, so the same name keeps the same colour.
            'hue' => hexdec(substr(hash('sha256', strtolower($m->uuid ?: $m->player)), 0, 4)) % 360,
            'at' => $m->sent_at->toIso8601String(),
        ])->values()->all();
    }

    private function bridge(): array
    {
        $beat = Cache::get('mc:bridge');

        if (! is_array($beat) || ! isset($beat['at'])) {
            return ['state' => 'offline', 'host' => null, 'version' => null, 'players' => null, 'detail' => 'no heartbeat yet'];
        }

        // The bridge beacons every 30s; two missed beats means it is gone.
        $stale = Carbon::parse($beat['at'])->lt(now()->subSeconds(90));

        return [
            'state' => $stale ? 'offline' : $beat['state'],
            'host' => $beat['host'] ?? null,
            'version' => $beat['version'] ?? null,
            'players' => $beat['players'] ?? null,
            'detail' => $stale ? 'last heartbeat '.Carbon::parse($beat['at'])->diffForHumans() : ($beat['detail'] ?? null),
        ];
    }
}
