<?php

namespace App\Http\Controllers\Casino;

use App\Http\Controllers\Controller;
use App\Services\Wallet\BonusService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BonusController extends Controller
{
    public function daily(Request $request, BonusService $bonuses): RedirectResponse
    {
        $claimed = $bonuses->claimDaily($request->user());

        Inertia::flash('toast', $claimed
            ? ['type' => 'success', 'message' => 'Daily bonus credited!']
            : ['type' => 'error', 'message' => 'Daily bonus is already claimed. Come back later.']);

        return back();
    }
}
