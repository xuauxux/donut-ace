/** Laravel sets the XSRF-TOKEN cookie; fetch needs it back in a header. */
export function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

export const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
            message?: string;
        };
        throw new Error(payload.message ?? 'Request failed. Please try again.');
    }

    return (await response.json()) as T;
}
