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

        console.log("[ResetPasswordPage] Detected hashType:", hashType);
        console.log("[ResetPasswordPage] Detected queryType:", queryType);

        return hashType ?? queryType ?? null;
    }, [search]);

    useEffect(() => {
        (async () => {
            try {
                const token = search.get("token");
                const type = search.get("type");
                const hashParams = new URLSearchParams(
                    typeof window !== "undefined" ? window.location.hash.slice(1) : ""
                );
                const accessToken = hashParams.get("access_token");
                const refreshToken = hashParams.get("refresh_token");

                console.log("[ResetPasswordPage] useEffect start");
                console.log("[ResetPasswordPage] token param:", token);
                console.log("[ResetPasswordPage] type param:", type);
                console.log("[ResetPasswordPage] recoveryType (memo):", recoveryType);

                if (token && type === "recovery") {
                    console.log("[ResetPasswordPage] Detected query-param style recovery link. Exchanging code…");
                    const { data, error: exchError } =
                        await supabase.auth.exchangeCodeForSession(token);

                    console.log("[ResetPasswordPage] exchangeCodeForSession result:", {
                        data,
                        exchError,
                    });

                    if (exchError) {
                        console.error("[ResetPasswordPage] exchangeCodeForSession error:", exchError);
                        setError("Reset link is invalid or has expired.");
                        return;
                    }
                    if (!data.session) {
                        console.error("[ResetPasswordPage] No session returned after exchange.");
                        setError("Reset link is invalid or has expired.");
                        return;
                    }
                    console.log("[ResetPasswordPage] Session established via exchangeCodeForSession.");
                    setReady(true);
                    return;
                }

                if (accessToken && refreshToken) {
                    console.log("[ResetPasswordPage] Found hash-based tokens. Establishing session via setSession…");
                    const { data, error: setSessError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });

                    console.log("[ResetPasswordPage] setSession result:", {
                        data,
                        setSessError,
                    });

                    if (setSessError) {
                        console.error("[ResetPasswordPage] setSession error:", setSessError);
                        setError("Reset link is invalid or has expired.");
                        return;
                    }
                    if (!data.session) {
                        console.error("[ResetPasswordPage] No session returned after setSession.");
                        setError("Reset link is invalid or has expired.");
                        return;
                    }

                    console.log("[ResetPasswordPage] Session established via setSession.");
                    setReady(true);
                    return;
                }

                console.log("[ResetPasswordPage] Falling back to getSession check…");
                const { data, error: sessError } = await supabase.auth.getSession();
                console.log("[ResetPasswordPage] getSession result:", { data, sessError });

                if (recoveryType === "recovery" && data.session) {
                    console.log("[ResetPasswordPage] Session found via getSession.");
                    setReady(true);
                } else if (recoveryType === "recovery") {
                    console.log("[ResetPasswordPage] No session yet, retrying after tick…");
                    setTimeout(async () => {
                        const { data: d2, error: retryError } = await supabase.auth.getSession();
                        console.log("[ResetPasswordPage] Retry getSession result:", { d2, retryError });
                        setReady(!!d2.session);
                        if (!d2.session) {
                            console.error("[ResetPasswordPage] Retry also failed. No session.");
                            setError("Reset link is invalid or has expired.");
                        }
                    }, 0);
                } else {
                    console.error("[ResetPasswordPage] Not a recovery link.");
                    setError("Reset link is invalid or has expired.");
                }
            } catch (err) {
                console.error("[ResetPasswordPage] Unexpected error in useEffect:", err);
                setError("Unexpected error occurred.");
            }
        })();
    }, [recoveryType, search, supabase]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setOk(null);

        console.log("[ResetPasswordPage] onSubmit start. pw1 length:", pw1.length);

        if (pw1.length < 8) {
            console.warn("[ResetPasswordPage] Password too short.");
            setError("Password must be at least 8 characters.");
            return;
        }
        if (pw1 !== pw2) {
            console.warn("[ResetPasswordPage] Passwords do not match.");
            setError("Passwords do not match.");
            return;
        }

        setUpdating(true);
        console.log("[ResetPasswordPage] Calling updateUser…");
        const { error: updateErr } = await supabase.auth.updateUser({ password: pw1 });
        setUpdating(false);

        console.log("[ResetPasswordPage] updateUser result:", { updateErr });

        if (updateErr) {
            console.error("[ResetPasswordPage] updateUser error:", updateErr);
            setError("Something went wrong. Please try again.");
            return;
        }

        console.log("[ResetPasswordPage] Password update successful.");
        setOk("Password updated. Redirecting to login…");

        // Clean up URL hash without reload
        history.replaceState(null, "", window.location.pathname + window.location.search);

        setTimeout(() => {
            console.log("[ResetPasswordPage] Redirecting to /login …");
            router.push("/login");
        }, 1200);
    };

    if (!ready && !error) {
        console.log("[ResetPasswordPage] Rendering validating state.");
        return (
            <div className="mx-auto max-w-md p-6">
                <h1 className="text-xl font-semibold mb-2">Reset Password</h1>
                <p>Validating your reset link…</p>
            </div>
        );
    }

    console.log("[ResetPasswordPage] Rendering main form. Ready:", ready, "Error:", error);

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
