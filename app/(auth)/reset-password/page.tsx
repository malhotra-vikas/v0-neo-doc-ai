"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function ResetPasswordPage() {
    const supabase = createClientComponentClient();
    const router = useRouter();
    const search = useSearchParams();

    const [ready, setReady] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const [pw1, setPw1] = useState("");
    const [pw2, setPw2] = useState("");

    // Detect recovery type from hash or query
    const recoveryType = useMemo(() => {
        const hashParams = new URLSearchParams(
            typeof window !== "undefined" ? window.location.hash.slice(1) : ""
        );
        const hashType = hashParams.get("type");
        const queryType = search.get("type");
        return hashType ?? queryType ?? null;
    }, [search]);

    useEffect(() => {
        (async () => {
            const token = search.get("token");
            const type = search.get("type");

            if (token && type === "recovery") {
                // Exchange token (query param style link)
                const { data, error: exchError } =
                    await supabase.auth.exchangeCodeForSession(token);
                if (exchError || !data.session) {
                    setError("Reset link is invalid or has expired.");
                    return;
                }
                setReady(true);
                return;
            }

            // Fallback: hash-based link (#access_token=...)
            const { data } = await supabase.auth.getSession();
            if (recoveryType === "recovery" && data.session) {
                setReady(true);
            } else if (recoveryType === "recovery") {
                setTimeout(async () => {
                    const { data: d2 } = await supabase.auth.getSession();
                    setReady(!!d2.session);
                    if (!d2.session) setError("Reset link is invalid or has expired.");
                }, 0);
            } else {
                setError("Reset link is invalid or has expired.");
            }
        })();
    }, [recoveryType, search, supabase]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setOk(null);

        if (pw1.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (pw1 !== pw2) {
            setError("Passwords do not match.");
            return;
        }

        setUpdating(true);
        const { error: updateErr } = await supabase.auth.updateUser({ password: pw1 });
        setUpdating(false);

        if (updateErr) {
            setError("Something went wrong. Please try again.");
            return;
        }

        setOk("Password updated. Redirecting to login…");
        // Clean up URL hash without reload
        history.replaceState(null, "", window.location.pathname + window.location.search);
        setTimeout(() => router.push("/login"), 1200);
    };

    if (!ready && !error) {
        return (
            <div className="mx-auto max-w-md p-6">
                <h1 className="text-xl font-semibold mb-2">Reset Password</h1>
                <p>Validating your reset link…</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-md p-6">
            <h1 className="text-2xl font-semibold mb-4">Set a new password</h1>

            {error && (
                <div className="mb-4 rounded-md border border-red-300 p-3 text-sm">
                    {error}
                </div>
            )}
            {ok && (
                <div className="mb-4 rounded-md border border-green-300 p-3 text-sm">
                    {ok}
                </div>
            )}

            {ready && (
                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1" htmlFor="pw1">
                            New password
                        </label>
                        <input
                            id="pw1"
                            type="password"
                            className="w-full rounded-md border px-3 py-2"
                            value={pw1}
                            onChange={(e) => setPw1(e.target.value)}
                            autoComplete="new-password"
                            required
                            minLength={8}
                            disabled={updating}
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1" htmlFor="pw2">
                            Confirm new password
                        </label>
                        <input
                            id="pw2"
                            type="password"
                            className="w-full rounded-md border px-3 py-2"
                            value={pw2}
                            onChange={(e) => setPw2(e.target.value)}
                            autoComplete="new-password"
                            required
                            minLength={8}
                            disabled={updating}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={updating}
                        className="w-full rounded-md border px-3 py-2 disabled:opacity-60"
                    >
                        {updating ? "Updating…" : "Update password"}
                    </button>
                </form>
            )}

            <p className="mt-4 text-sm text-gray-600">
                If this link is expired, go back to{" "}
                <a href="/forgot-password" className="underline">
                    Forgot Password
                </a>{" "}
                and request a new one.
            </p>
        </div>
    );
}
