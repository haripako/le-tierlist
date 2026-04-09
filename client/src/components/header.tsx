import { Link, useLocation } from "wouter";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer group" data-testid="link-home">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                LE TIER LIST
              </span>
              <span className="text-[10px] text-muted-foreground leading-none -mt-0.5">
                Community Rankings
              </span>
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/">
            <Button
              variant={location === "/" ? "secondary" : "ghost"}
              size="sm"
              data-testid="link-tier-list"
            >
              <Trophy className="w-3.5 h-3.5 mr-1.5" />
              Tier List
            </Button>
          </Link>
          <Link href="/submit">
            <Button
              variant={location === "/submit" ? "default" : "outline"}
              size="sm"
              data-testid="link-submit-build"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Submit Build
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
