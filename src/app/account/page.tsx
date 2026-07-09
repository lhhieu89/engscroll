"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Flame,
  Star,
  Repeat,
  LogOut,
  LogIn,
  GraduationCap,
  Check,
} from "lucide-react";
import AppShell from "@/components/AppShell";

const LEVELS: { value: string | null; label: string; hint: string }[] = [
  { value: null, label: "Tự động", hint: "Tự điều chỉnh theo tương tác của bạn" },
  { value: "basic", label: "Basic", hint: "Mới bắt đầu, câu đơn giản" },
  { value: "intermediate", label: "Intermediate", hint: "Giao tiếp thường ngày ổn" },
  { value: "advanced", label: "Advanced", hint: "Muốn tự nhiên, sâu hơn" },
];

interface Me {
  id: string;
  email: string | null;
  name: string | null;
  provider: string;
  isPremium: boolean;
  level: string | null;
  streak: number;
}

const ERROR_TEXT: Record<string, string> = {
  state: "Phiên đăng nhập Google hết hạn, thử lại nhé.",
  unverified: "Email Google chưa được xác minh.",
  google_off: "Google login chưa được cấu hình.",
  google_failed: "Đăng nhập Google thất bại, thử lại nhé.",
};

function AccountInner() {
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [level, setLevelState] = useState<string | null>(null);
  const [levelLocked, setLevelLocked] = useState(false);
  const [savingLevel, setSavingLevel] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(ERROR_TEXT[params.get("error") ?? ""] ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      setMe(d.user);
      setLevelState(d.level ?? null);
      setLevelLocked(!!d.levelLocked);
      setGoogleEnabled(d.googleEnabled);
    });
  }, []);

  async function chooseLevel(value: string | null) {
    setSavingLevel(true);
    setLevelState(value);
    setLevelLocked(value !== null);
    await fetch("/api/level", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level: value }),
    });
    setSavingLevel(false);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Có lỗi xảy ra"); return; }
    setMe(data.user);
    window.dispatchEvent(new Event("engscroll:auth-changed"));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    window.dispatchEvent(new Event("engscroll:auth-changed"));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-3 py-6">
        <h1 className="mb-5 px-1 text-xl font-bold">Tài khoản</h1>

        {/* ── Account: profile when signed in, else login / register ───────── */}
        {me ? (
          <div className="post fade-up p-6 text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-bold text-white">
              {(me.name || me.email || "?").trim()[0]?.toUpperCase()}
            </div>
            <div className="text-lg font-semibold">{me.name || me.email}</div>
            {me.name && <div className="text-sm text-[var(--muted)]">{me.email}</div>}
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
              <span className="rounded-full bg-[var(--hover)] px-2 py-1">via {me.provider}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--hover)] px-2 py-1">
                <Flame size={13} className="text-[var(--amber)]" /> {me.streak}-day
              </span>
              {me.isPremium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4d6] px-2 py-1 text-[#8a6d00]">
                  <Star size={13} /> Premium
                </span>
              )}
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Tiến độ (reactions, đã lưu, streak) đã được đồng bộ vào tài khoản.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Link href="/review" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">
                <Repeat size={16} /> Ôn thẻ đã lưu
              </Link>
              <button onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm hover:bg-[var(--hover)]">
                <LogOut size={16} /> Đăng xuất
              </button>
            </div>
          </div>
        ) : (
          <div className="post fade-up p-6">
            <h2 className="mb-1 text-xl font-bold">
              {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </h2>
            <p className="mb-5 text-sm text-[var(--muted)]">
              Không bắt buộc — chỉ để lưu tiến độ và đồng bộ giữa các thiết bị.
            </p>

            {googleEnabled && (
              <>
                <a href="/api/auth/google/start" className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 font-semibold hover:bg-[var(--hover)]">
                  <LogIn size={18} /> Tiếp tục với Google
                </a>
                <div className="mb-4 text-center text-xs text-[var(--muted)]">— hoặc dùng email —</div>
              </>
            )}

            <div className="flex flex-col gap-3">
              {mode === "register" && (
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên (tuỳ chọn)"
                  className="rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5" />
              )}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                className="rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu (≥ 6 ký tự)"
                className="rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5" />
              {error && <div className="text-sm text-[var(--red)]">{error}</div>}
              <button onClick={submit} disabled={busy}
                className="rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-50">
                {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
              </button>
            </div>

            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
              className="mt-5 w-full text-center text-sm text-[var(--accent)]">
              {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
            </button>
          </div>
        )}

        {/* ── Trình độ — a separate settings block, not part of the login form ── */}
        <div className="mt-8">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            <GraduationCap size={14} /> Trình độ học
          </div>
          <div className="post p-5">
            <p className="mb-4 text-sm text-[var(--muted)]">
              Chọn trình độ để feed lọc nội dung phù hợp. Để{" "}
              <span className="font-semibold text-[var(--fg)]">Tự động</span> nếu muốn
              hệ thống tự học theo phản hồi của bạn.
            </p>
            <div className="flex flex-col gap-2">
              {LEVELS.map((o) => {
                // In auto mode the "Tự động" row is the active one, regardless of
                // the level currently inferred.
                const activeValue = levelLocked ? level : null;
                const active = activeValue === o.value;
                const hint =
                  o.value === null && !levelLocked && level
                    ? `${o.hint} — hiện đang ở mức ${level}`
                    : o.hint;
                return (
                  <button
                    key={o.label}
                    onClick={() => chooseLevel(o.value)}
                    disabled={savingLevel}
                    className="flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition active:scale-[0.98] disabled:opacity-50"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--border)",
                      background: active ? "var(--chip)" : "white",
                    }}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{o.label}</span>
                      <span className="block text-xs text-[var(--muted)]">{hint}</span>
                    </span>
                    {active && <Check size={17} className="text-[var(--accent)]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountInner />
    </Suspense>
  );
}
