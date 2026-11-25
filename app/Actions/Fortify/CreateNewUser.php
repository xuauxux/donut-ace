<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

/**
 * Signup asks for a username and a password, nothing else.
 *
 * Players who want to deposit type their Minecraft name too: it is only a hint
 * until the deposit page makes them whisper a code to the bot, because that is
 * the only proof the IGN is theirs. No Minecraft password is ever collected.
 */
class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            'username' => ['required', 'string', 'min:3', 'max:16', 'regex:/^[A-Za-z0-9_.-]+$/', 'unique:users,username'],
            'minecraft_ign' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_]{3,16}$/'],
            'password' => $this->passwordRules(),
            'terms' => ['accepted'],
        ], [
            'username.regex' => 'Use 3–16 letters, numbers, dots, dashes or underscores.',
            'username.unique' => 'That username is taken.',
            'minecraft_ign.regex' => 'A Minecraft name is 3–16 letters, numbers or underscores.',
            'terms.accepted' => 'Please accept the Terms & Conditions and Privacy Policy.',
        ])->validate();

        $username = Str::of($input['username'])->trim()->toString();

        $user = new User;
        $user->forceFill([
            'name' => $username,
            'username' => $username,
            'email' => null,
            'email_verified_at' => now(),
            'minecraft_ign_claim' => filled($input['minecraft_ign'] ?? null)
                ? strtolower(trim((string) $input['minecraft_ign']))
                : null,
            'password' => $input['password'],
            'terms_accepted_at' => now(),
        ])->save();

        return $user;
    }
}
