import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Trophy, LogIn, LogOut, User, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getKarmaColor, getKarmaTitle } from "@/lib/constants";

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
              <Button variant={location === "/" ? "secondary" : "ghost"} size="sm" data-testid="link-tier-list">
                <Trophy className="w-3.5 h-3.5 mr-1.5" />
                Tier List
              </Button>
            </Link>

            {isLoggedIn ? (
              <>
                <Link href="/submit">
                  <Button variant={location === "/submit" ? "default" : "outline"} size="sm" data-testid="link-submit">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Submit
                  </Button>
                </Link>

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
                    {isAdmin && (
                      <Link href="/admin/seasons">
                        <DropdownMenuItem data-testid="link-admin-seasons">
                          <Shield className="w-3.5 h-3.5 mr-2" /> Manage Seasons
                        </DropdownMenuItem>
                      </Link>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} data-testid="button-logout">
                      <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
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
                <Input id="login-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" data-testid="input-login-password" />
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
