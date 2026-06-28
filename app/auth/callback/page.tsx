"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { handleOAuthCallback } from "@/lib/swiggy-auth";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      return;
    }

    handleOAuthCallback(code).then((success) => {
      if (success) {
        setStatus("success");
        setTimeout(() => router.push("/"), 1500);
      } else {
        setStatus("error");
      }
    });
  }, [searchParams, router]);

  return (
    <main className="min-h-screen bg-swiggy-light-gray flex items-center justify-center px-8">
      <div className="text-center">
        {status === "loading" && (
          <>
            <div className="w-10 h-10 border-2 border-swiggy-orange border-t-transparent rounded-full animate-spin mx-auto mb-5" />
            <p className="text-sm font-extrabold text-swiggy-dark">
              Connecting Swiggy...
            </p>
            <p className="text-xs text-swiggy-gray mt-1">
              Exchanging your token
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <p className="text-base font-extrabold text-swiggy-dark">
              Swiggy connected!
            </p>
            <p className="text-xs text-swiggy-gray mt-2">Redirecting...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-base font-extrabold text-swiggy-dark">
              Connection failed
            </p>
            <p className="text-xs text-swiggy-gray mt-2 mb-8">
              Could not connect your Swiggy account. Try again.
            </p>
            <button
              onClick={() => router.push("/")}
              className="bg-swiggy-orange text-white px-8 py-3.5 rounded-2xl font-extrabold text-sm"
            >
              Go back
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-swiggy-light-gray flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-swiggy-orange border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
