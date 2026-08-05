import { signIn, signOut } from "@/auth";

export function SignInButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="bg-orange px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-white uppercase transition-opacity hover:opacity-80"
      >
        Sign in with Google
      </button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="border border-rule-s px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-mid uppercase transition-colors hover:border-orange hover:text-orange"
      >
        Sign out
      </button>
    </form>
  );
}
