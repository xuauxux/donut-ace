<?php

namespace App\Http\Controllers\Casino;

use App\Http\Controllers\Controller;
use App\Services\Games\Arcade\ArcadeCatalog;
use App\Services\Games\GameLibrary;
use App\Services\Games\Originals;
use App\Services\SpinKit\SpinKitClient;
use App\Support\GamePresenter;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LobbyController extends Controller
{
    public function __construct(
        private readonly SpinKitClient $spinKit,
        private readonly GameLibrary $library,
        private readonly Originals $originals,
        private readonly ArcadeCatalog $arcade,
    ) {}

    /** SpinKit games when the RGS is connected, otherwise our built-in games. */
    private function catalogue(): array
    {
        return $this->spinKit->games() ?: [
            ...$this->originals->cards(),
            ...$this->arcade->cards(),
            ...$this->library->catalog(),
        ];
    }

    public function home(): Response
    {
        $games = $this->catalogue();

        return Inertia::render('casino/home', [
            'games' => GamePresenter::cards($games),
            'welcomeBonus' => (int) config('casino.welcome_bonus'),
            'spinKitOnline' => $games !== [],
        ]);
    }

    public function games(Request $request): Response
    {
        return Inertia::render('casino/games', [
            'games' => GamePresenter::cards($this->catalogue()),
            'filter' => $request->string('filter')->toString() ?: 'all',
            'search' => $request->string('q')->toString(),
            'theme' => $request->string('theme')->toString() ?: 'all',
        ]);
    }
}
