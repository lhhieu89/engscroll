import type { Account } from "./auth";

// The safe subset of account fields exposed to the client.
export function publicUser(a: Account) {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    provider: a.provider,
    isPremium: a.is_premium === 1,
    level: a.level,
    streak: a.streak,
  };
}
