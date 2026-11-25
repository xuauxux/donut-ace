<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'unread' => $user->unreadNotifications()->count(),
            'items' => $user->notifications()->latest()->limit(20)->get()->map(fn (DatabaseNotification $n) => [
                'id' => $n->id,
                'kind' => $n->data['kind'] ?? 'info',
                'title' => $n->data['title'] ?? '',
                'body' => $n->data['body'] ?? '',
                'url' => $n->data['url'] ?? null,
                'read' => $n->read_at !== null,
                'created_at' => $n->created_at?->toIso8601String(),
            ]),
        ]);
    }

    /**
     * Marks notifications read. Pass {"ids": [...]} for a single row, or nothing
     * for the whole list (the bell's "Mark all read" button).
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $ids = $request->input('ids');

        if (is_array($ids)) {
            $ids = array_slice(array_values(array_filter($ids, 'is_string')), 0, 50);

            if ($ids !== []) {
                $user->unreadNotifications()->whereIn('id', $ids)->update(['read_at' => now()]);
            }
        } else {
            $user->unreadNotifications()->update(['read_at' => now()]);
        }

        return response()->json(['unread' => $user->unreadNotifications()->count()]);
    }
}
