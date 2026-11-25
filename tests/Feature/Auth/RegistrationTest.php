<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Fortify\Features;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->skipUnlessFortifyHas(Features::registration());
    }

    public function test_registration_screen_can_be_rendered()
    {
        $response = $this->get(route('register'));

        $response->assertOk();
    }

    /** @return array<string, string> */
    private function validRegistration(array $overrides = []): array
    {
        return [
            'username' => 'youri67',
            'minecraft_ign' => 'youri67',
            'password' => 'password',
            'password_confirmation' => 'password',
            'terms' => '1',
            ...$overrides,
        ];
    }

    public function test_new_users_can_register()
    {
        $response = $this->post(route('register.store'), $this->validRegistration());

        $this->assertAuthenticated();
        $response->assertRedirect(route('home', absolute: false));

        $user = User::firstWhere('username', 'youri67');
        $this->assertSame('youri67', $user->name);
        $this->assertNull($user->email);
        $this->assertSame('youri67', $user->minecraft_ign_claim);
        $this->assertNull($user->minecraft_verified_at);
        $this->assertNotNull($user->terms_accepted_at);
    }

    public function test_registration_needs_a_username_and_terms()
    {
        $this->post(route('register.store'), $this->validRegistration(['username' => '']))->assertSessionHasErrors('username');
        $this->post(route('register.store'), $this->validRegistration(['terms' => '']))->assertSessionHasErrors('terms');
        $this->assertGuest();
    }

    public function test_username_must_be_unique()
    {
        User::factory()->create(['username' => 'youri67']);

        $this->post(route('register.store'), $this->validRegistration())->assertSessionHasErrors('username');
        $this->assertGuest();
    }
}
