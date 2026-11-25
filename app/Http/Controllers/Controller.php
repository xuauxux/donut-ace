<?php

namespace App\Http\Controllers;

abstract class Controller
{
    /**
     * Bet validation: any whole amount between the smallest and the largest
     * preset is allowed (the preset ladder is a shortcut in the UI, not the
     * only legal bet). Amounts are minor units, the same as the wallet.
     *
     * @param  array<int, int>  $ladder
     * @return array<int, string>
     */
    protected static function betRules(array $ladder): array
    {
        $ladder = array_values(array_filter(array_map('intval', $ladder)));

        if ($ladder === []) {
            return ['required', 'integer', 'min:1'];
        }

        return ['required', 'integer', 'min:'.min($ladder), 'max:'.max($ladder)];
    }
}
