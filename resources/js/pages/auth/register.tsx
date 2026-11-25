import { Form, Head } from '@inertiajs/react';
import { Field } from '@/components/casino/form-fields';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    passwordRules: string;
};

export default function Register({ passwordRules }: Props) {
    return (
        <>
            <Head title="Register" />
            <Form
                action="/register"
                method="post"
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        <Field label="Username" htmlFor="username" error={errors.username}>
                            <Input
                                id="username"
                                name="username"
                                required
                                autoFocus
                                autoComplete="username"
                                placeholder="youri67"
                                maxLength={16}
                            />
                            <p className="mt-1.5 text-xs text-dim">
                                This is how you log in. Your Minecraft name works fine — or pick anything else.
                            </p>
                        </Field>

                        <Field label="Minecraft username (optional)" htmlFor="minecraft_ign" error={errors.minecraft_ign}>
                            <Input
                                id="minecraft_ign"
                                name="minecraft_ign"
                                autoComplete="off"
                                placeholder="youri67"
                                maxLength={16}
                                className="font-mono"
                            />
                            <p className="mt-1.5 text-xs text-dim">
                                Only needed to deposit. We confirm it with a code in game before any coins move — we never
                                ask for your Minecraft password.
                            </p>
                        </Field>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Password" htmlFor="password" error={errors.password}>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    autoComplete="new-password"
                                    placeholder="Password"
                                    passwordrules={passwordRules}
                                />
                            </Field>
                            <Field label="Confirm password" htmlFor="password_confirmation" error={errors.password_confirmation}>
                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    required
                                    autoComplete="new-password"
                                    placeholder="Repeat password"
                                    passwordrules={passwordRules}
                                />
                            </Field>
                        </div>

                        <label className="mt-1 flex items-start gap-3 rounded-xl bg-surface-2/60 p-3.5 text-[13px] leading-snug text-white/85 ring-1 ring-line/60">
                            <Checkbox id="terms" name="terms" value="1" required className="mt-0.5" />
                            <span>
                                I am 18 or older and accept the{' '}
                                <TextLink href="/legal/terms" target="_blank">
                                    Terms of Service
                                </TextLink>
                                .
                            </span>
                        </label>
                        <InputError message={errors.terms} className="-mt-3" />

                        <Button type="submit" size="lg" className="w-full" data-test="register-user-button">
                            {processing && <Spinner />}
                            Create account &amp; get bonus
                        </Button>

                        <div className="text-center text-sm text-muted-foreground">
                            Already have an account? <TextLink href="/login">Log in</TextLink>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}

Register.layout = {
    title: 'Create your account',
    description: 'Pick a username and a password — that is all we need.',
};
