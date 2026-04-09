import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Home, LogIn, LogOut, User, Shield, Star, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getKarmaColor, getKarmaTitle } from "@/lib/constants";

// BuildTier SVG Logo — geometric trophy/tier mark with upvote arrow accent
function BuildTierLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-label="BuildTier logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Base platform / podium */}
      <rect x="4" y="26" width="24" height="3" rx="1.5" fill="hsl(38 90% 50%)" />
      {/* Center column */}
      <rect x="13" y="20" width="6" height="6" rx="0.5" fill="hsl(38 90% 50%)" opacity="0.9" />
      {/* Trophy cup body */}
      <path
        d="M10 8 H22 L20 17 Q16 20 12 17 Z"
        fill="hsl(38 90% 50%)"
        opacity="0.95"
      />
      {/* Trophy handles */}
      <path d="M10 8 Q7 8 7 12 Q7 16 10 16" stroke="hsl(38 90% 50%)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M22 8 Q25 8 25 12 Q25 16 22 16" stroke="hsl(38 90% 50%)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Upvote arrow overlay — centered in trophy */}
      <path
        d="M16 10 L13.5 13.5 H15 V16 H17 V13.5 H18.5 Z"
        fill="hsl(40 10% 8%)"
        opacity="0.85"
      />
    </svg>
  );
}

export default function Header() {
  const [location] = useLocation();
  const { user, login, register, logout, isLoggedIn, isAdmin } = useAuth();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (mode: "login" | "register") => {
    setLoading(true);
    try {
      if (mode === "login") await login(username, password);
      else await register(username, password);
      setAuthOpen(false);
      setUsername("");
      setPassword("");
      toast({ title: mode === "login" ? "Welcome back" : "Account created" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md backdrop-saturate-150">
        <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer group" data-testid="link-home">
              <div className="shrink-0 transition-transform group-hover:scale-105 duration-200">
                <BuildTierLogo size={32} />
              </div>
              <div className="flex flex-col">
                <span
                  className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors"
                  style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                >
                  BuildTier
                </span>
                <span className="text-[10px] text-muted-foreground leading-none -mt-0.5">
                  ARPG Build Rankings
                </span>
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Link href="/">
              <Button variant={location === "/" ? "secondary" : "ghost"} size="sm" data-testid="link-games">
                <Home className="w-3.5 h-3.5 mr-1.5" />
                Games
              </Button>
            </Link>

            <Link href="/submit">
              <Button variant={location === "/submit" ? "default" : "outline"} size="sm" data-testid="link-submit">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Submit Build
              </Button>
            </Link>

            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-user-menu">
                    <User className="w-3.5 h-3.5" />
                    <span className="max-w-[80px] truncate">{user!.username}</span>
                    <span className={`text-xs font-semibold ${getKarmaColor(user!.karma)}`}>
                      {user!.karma}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user!.username}</p>
                    <p className={`text-xs ${getKarmaColor(user!.karma)}`}>
                      <Star className="w-3 h-3 inline mr-0.5" />
                      {user!.karma} karma · {getKarmaTitle(user!.karma)}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <Link href={`/user/${user!.id}`}>
                    <DropdownMenuItem data-testid="link-profile">
                      <User className="w-3.5 h-3.5 mr-2" /> Profile
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/settings">
                    <DropdownMenuItem data-testid="link-settings">
                      <Settings className="w-3.5 h-3.5 mr-2" /> Settings
                    </DropdownMenuItem>
                  </Link>
                  {isAdmin && (
                    <Link href="/admin">
                      <DropdownMenuItem data-testid="link-admin-dashboard">
                        <Shield className="w-3.5 h-3.5 mr-2" /> Admin Dashboard
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} data-testid="button-logout">
                    <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)} data-testid="button-login">
                <LogIn className="w-3.5 h-3.5 mr-1.5" />
                Sign In
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Auth Dialog */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Join the Community</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="login-user">Username</Label>
                <Input id="login-user" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username" data-testid="input-login-username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-pass">Password</Label>
                <Input id="login-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" onKeyDown={e => { if (e.key === "Enter") handleAuth("login"); }} data-testid="input-login-password" />
              </div>
              <Button className="w-full" onClick={() => handleAuth("login")} disabled={loading} data-testid="button-do-login">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </TabsContent>
            <TabsContent value="register" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="reg-user">Username</Label>
                <Input id="reg-user" value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" data-testid="input-register-username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-pass">Password</Label>
                <Input id="reg-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" data-testid="input-register-password" />
              </div>
              <Button className="w-full" onClick={() => handleAuth("register")} disabled={loading} data-testid="button-do-register">
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
