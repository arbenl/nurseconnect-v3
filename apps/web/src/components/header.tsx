import Link from "next/link";

import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="px-4 lg:px-6 h-14 flex items-center border-b">
      <Link
        href="/"
        className="flex items-center justify-center"
        prefetch={false}
      >
        <span className="font-semibold">NurseConnect</span>
      </Link>
      <nav className="ml-auto flex gap-4 sm:gap-6">
        <Button asChild variant="ghost">
          <Link href="/login">Sign In</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign Up</Link>
        </Button>
      </nav>
    </header>
  );
}
