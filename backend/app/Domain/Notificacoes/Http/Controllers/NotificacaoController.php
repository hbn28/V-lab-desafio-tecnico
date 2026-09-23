<?php

namespace App\Domain\Notificacoes\Http\Controllers;

use App\Domain\Notificacoes\Http\Resources\NotificacaoResource;
use App\Models\NotificacaoOperacional;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificacaoController
{
    public function index(Request $request): JsonResponse
    {
        $own = NotificacaoOperacional::query()->where('user_id', $request->user()->id);
        $notifications = (clone $own)->latest()->orderByDesc('id')->paginate(20);

        return response()->json([
            'data' => NotificacaoResource::collection($notifications->getCollection())->resolve(),
            'unread_count' => (clone $own)->whereNull('read_at')->count(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
            ],
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $notification = NotificacaoOperacional::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);
        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return (new NotificacaoResource($notification))->response();
    }
}
