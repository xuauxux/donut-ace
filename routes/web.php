<?php

use App\Http\Controllers\Api\BotController;
use App\Http\Controllers\Api\MinecraftBridgeController;
use App\Http\Controllers\Casino\BonusController;
use App\Http\Controllers\Casino\ChatController;
use App\Http\Controllers\Casino\DepositController;
use App\Http\Controllers\Casino\ArcadeController;
use App\Http\Controllers\Casino\LobbyController;
use App\Http\Controllers\Casino\LotteryController;
use App\Http\Controllers\Casino\OriginalController;
use App\Http\Controllers\Casino\PlayController;
use App\Http\Controllers\Casino\TopupController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Casino\VipController;
use App\Http\Controllers\Casino\WithdrawController;
use App\Http\Controllers\LegalController;
use Illuminate\Support\Facades\Route;

Route::get('/', [LobbyController::class, 'home'])->name('home');
Route::get('games', [LobbyController::class, 'games'])->name('games');
Route::get('legal/{page}', [LegalController::class, 'show'])->name('legal');
Route::get('vip', [VipController::class, 'show'])->name('vip');
Route::get('lottery', [LotteryController::class, 'show'])->name('lottery');
Route::get('topup', [TopupController::class, 'index'])->name('topup');
Route::get('chat', [ChatController::class, 'show'])->name('chat');
Route::get('deposit', [DepositController::class, 'show'])->name('deposit');
Route::get('withdraw', [WithdrawController::class, 'show'])->name('withdraw');
Route::get('chat/messages', [ChatController::class, 'messages'])->name('chat.messages')->middleware('throttle:120,1');

// Minecraft bridge: HMAC-signed, no session and no CSRF (see MinecraftBridgeController).
Route::post('api/mc/chat', [MinecraftBridgeController::class, 'chat'])
    ->name('bridge.chat')
    ->middleware('throttle:180,1')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class]);
Route::post('api/mc/heartbeat', [MinecraftBridgeController::class, 'heartbeat'])
    ->name('bridge.heartbeat')
    ->middleware('throttle:60,1')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class]);

// Bot callbacks: link a whispered code, report a payment receipt (HMAC-signed).
Route::post('api/bot/link', [BotController::class, 'link'])
    ->name('bot.link')
    ->middleware('throttle:120,1');
Route::post('api/bot/deposit', [BotController::class, 'deposit'])
    ->name('bot.deposit')
    ->middleware('throttle:120,1');
Route::post('api/bot/withdrawals/claim', [BotController::class, 'claimWithdrawal'])
    ->name('bot.withdrawals.claim')
    ->middleware('throttle:120,1');
Route::post('api/bot/withdrawals/result', [BotController::class, 'withdrawalResult'])
    ->name('bot.withdrawals.result')
    ->middleware('throttle:120,1');

Route::middleware('auth')->group(function () {
    Route::get('play/{gameId}', [PlayController::class, 'show'])->name('play.show')
        ->where('gameId', '[A-Za-z0-9_\-]+');
    Route::post('play/{gameId}/spin', [PlayController::class, 'spin'])->name('play.spin')
        ->where('gameId', '[A-Za-z0-9_\-]+')->middleware('throttle:240,1');

    Route::get('originals/{game}', [OriginalController::class, 'show'])
        ->name('originals.show')
        ->whereIn('game', ['dice', 'plinko', 'keno']);
    Route::post('originals/{game}/play', [OriginalController::class, 'play'])
        ->name('originals.play')
        ->whereIn('game', ['dice', 'plinko', 'keno'])
        ->middleware('throttle:240,1');

    // HiLo streak: deal, then guess or cash out on the open round.
    Route::post('arcade/hilo/start', [ArcadeController::class, 'hiloStart'])
        ->name('arcade.hilo.start')->middleware('throttle:120,1');
    Route::post('arcade/hilo/guess', [ArcadeController::class, 'hiloGuess'])
        ->name('arcade.hilo.guess')->middleware('throttle:240,1');
    Route::post('arcade/hilo/cashout', [ArcadeController::class, 'hiloCashout'])
        ->name('arcade.hilo.cashout')->middleware('throttle:120,1');

    // Connect 4: start a board, then drop a disc per turn until it settles.
    Route::post('arcade/connect-4/start', [ArcadeController::class, 'connectFourStart'])
        ->name('arcade.connect-4.start')->middleware('throttle:120,1');
    Route::post('arcade/connect-4/drop', [ArcadeController::class, 'connectFourDrop'])
        ->name('arcade.connect-4.drop')->middleware('throttle:240,1');

    // Blackjack: deal, then hit, stand or double the open hand.
    Route::post('arcade/blackjack/deal', [ArcadeController::class, 'blackjackDeal'])
        ->name('arcade.blackjack.deal')->middleware('throttle:120,1');
    Route::post('arcade/blackjack/hit', [ArcadeController::class, 'blackjackHit'])
        ->name('arcade.blackjack.hit')->middleware('throttle:240,1');
    Route::post('arcade/blackjack/stand', [ArcadeController::class, 'blackjackStand'])
        ->name('arcade.blackjack.stand')->middleware('throttle:240,1');
    Route::post('arcade/blackjack/double', [ArcadeController::class, 'blackjackDouble'])
        ->name('arcade.blackjack.double')->middleware('throttle:120,1');

    // Video poker: five cards, then one draw with the held ones kept.
    Route::post('arcade/video-poker/deal', [ArcadeController::class, 'videoPokerDeal'])
        ->name('arcade.video-poker.deal')->middleware('throttle:120,1');
    Route::post('arcade/video-poker/draw', [ArcadeController::class, 'videoPokerDraw'])
        ->name('arcade.video-poker.draw')->middleware('throttle:240,1');

    // Arcade suite: draw / case / crash games plus the cash-out ladder rounds.
    Route::get('arcade/{game}', [ArcadeController::class, 'show'])
        ->name('arcade.show')
        ->where('game', '[A-Za-z0-9_\-]+');
    Route::post('arcade/{game}/play', [ArcadeController::class, 'play'])
        ->name('arcade.play')
        ->where('game', '[A-Za-z0-9_\-]+')
        ->middleware('throttle:240,1');
    Route::post('arcade/{game}/start', [ArcadeController::class, 'start'])
        ->name('arcade.start')
        ->where('game', '[A-Za-z0-9_\-]+')
        ->middleware('throttle:120,1');
    Route::post('arcade/{game}/reveal', [ArcadeController::class, 'reveal'])
        ->name('arcade.reveal')
        ->where('game', '[A-Za-z0-9_\-]+')
        ->middleware('throttle:240,1');
    Route::post('arcade/{game}/cashout', [ArcadeController::class, 'cashout'])
        ->name('arcade.cashout')
        ->where('game', '[A-Za-z0-9_\-]+')
        ->middleware('throttle:120,1');
    Route::post('chat', [ChatController::class, 'send'])->name('chat.send')->middleware('throttle:10,1');
    Route::post('deposit/link', [DepositController::class, 'startLink'])->name('deposit.link')->middleware('throttle:6,1');
    Route::post('deposit/create', [DepositController::class, 'create'])->name('deposit.create')->middleware('throttle:20,1');
    Route::get('deposit/status', [DepositController::class, 'status'])->name('deposit.status')->middleware('throttle:240,1');
    Route::post('withdraw/create', [WithdrawController::class, 'create'])->name('withdraw.create')->middleware('throttle:10,1');
    Route::post('withdraw/cancel', [WithdrawController::class, 'cancel'])->name('withdraw.cancel')->middleware('throttle:10,1');
    Route::get('withdraw/status', [WithdrawController::class, 'status'])->name('withdraw.status')->middleware('throttle:240,1');
    Route::post('play/leave', [PlayController::class, 'leave'])->name('play.leave');
    Route::get('wallet/balance', [PlayController::class, 'balance'])->name('wallet.balance');
    Route::post('bonus/daily', [BonusController::class, 'daily'])->name('bonus.daily')->middleware('throttle:6,1');
    Route::post('vip/missions/{mission}', [VipController::class, 'claimMission'])->name('vip.mission')
        ->whereIn('mission', ['daily_wager', 'weekly_activity'])->middleware('throttle:20,1');
    Route::post('vip/levels/{level}', [VipController::class, 'claimLevel'])->name('vip.level')->whereNumber('level');
    Route::post('lottery/tickets', [LotteryController::class, 'buy'])->name('lottery.buy')->middleware('throttle:30,1');

    Route::post('topup', [TopupController::class, 'store'])->name('topup.store')->middleware('throttle:10,1');

    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('notifications/read', [NotificationController::class, 'markAllRead'])->name('notifications.read');

    Route::redirect('dashboard', '/')->name('dashboard');
});

require __DIR__.'/settings.php';
