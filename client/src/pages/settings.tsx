import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Lock, Bookmark, ExternalLink } from "lucide-react";
import { getKarmaColor, getKarmaTitle, SOURCE_CONFIG } from "@/lib/constants";
import type { BuildWithSubmitter } from "@shared/schema";

const AVATAR_EMOJIS = [
  "🎮", "⚔️", "🏹", "🗡️", "🛡️", "💀", "🔥", "❄️", "⚡", "🌑",
  "🌿", "🎯", "🏆", "👑", "💎", "🐉", "🦅", "🐺", "🎲", "🔮",
];

export default function SettingsPage() {
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Profile form
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarEmoji, setAvatarEmoji] = useState((user as any)?.avatarEmoji ?? "🎮");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Bookmarks
  const { userBookmarks } = useBookmarks();

  const profileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/users/${user!.id}`, { bio, avatarEmoji });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
      if (newPassword.length < 4) throw new Error("Password must be at least 4 characters");
      const res = await apiRequest("PATCH", "/api/auth/password", {
        userId: user!.id,
        currentPassword,
        newPassword,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!isLoggedIn || !user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">You must be logged in to access settings</p>
        <Link href="/"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Home</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/">
        <Button variant="ghost" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back</Button>
      </Link>

      <div>
        <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and account settings</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="w-3.5 h-3.5 mr-1.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="password" data-testid="tab-password">
            <Lock className="w-3.5 h-3.5 mr-1.5" /> Password
          </TabsTrigger>
          <TabsTrigger value="bookmarks" data-testid="tab-bookmarks">
            <Bookmark className="w-3.5 h-3.5 mr-1.5" /> Bookmarks
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Settings</CardTitle>
              <CardDescription>Update your avatar emoji and bio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Current profile display */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  {avatarEmoji}
                </div>
                <div>
                  <p className="text-sm font-semibold">{user.username}</p>
                  <p className={`text-xs ${getKarmaColor(user.karma)}`}>{user.karma} karma · {getKarmaTitle(user.karma)}</p>
                </div>
              </div>

              {/* Emoji picker */}
              <div className="space-y-2">
                <Label>Avatar Emoji</Label>
                <div className="grid grid-cols-10 gap-1.5" data-testid="emoji-picker">
                  {AVATAR_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setAvatarEmoji(emoji)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                        avatarEmoji === emoji
                          ? "bg-primary/20 border-2 border-primary scale-110"
                          : "bg-secondary hover:bg-secondary/80 border border-transparent"
                      }`}
                      data-testid={`button-emoji-${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell the community about yourself..."
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  maxLength={300}
                  data-testid="input-bio"
                />
                <p className="text-xs text-muted-foreground">{bio.length}/300</p>
              </div>

              <Button
                onClick={() => profileMutation.mutate()}
                disabled={profileMutation.isPending}
                className="w-full"
                data-testid="button-save-profile"
              >
                {profileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-pass">Current Password</Label>
                <Input
                  id="current-pass"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Your current password"
                  data-testid="input-current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pass">New Password</Label>
                <Input
                  id="new-pass"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (4+ chars)"
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pass">Confirm New Password</Label>
                <Input
                  id="confirm-pass"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  data-testid="input-confirm-password"
                  onKeyDown={e => { if (e.key === "Enter") passwordMutation.mutate(); }}
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
              <Button
                onClick={() => passwordMutation.mutate()}
                disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                className="w-full"
                data-testid="button-change-password"
              >
                {passwordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookmarks Tab */}
        <TabsContent value="bookmarks" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saved Builds</CardTitle>
              <CardDescription>{userBookmarks.length} bookmark{userBookmarks.length !== 1 ? "s" : ""}</CardDescription>
            </CardHeader>
            <CardContent>
              {userBookmarks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No bookmarks yet. Bookmark builds from the tier list to save them here.
                </p>
              ) : (
                <div className="space-y-2">
                  {(userBookmarks as BuildWithSubmitter[]).map(build => {
                    const source = SOURCE_CONFIG[build.sourceType] || SOURCE_CONFIG.other;
                    const score = build.upvotes - build.downvotes;
                    return (
                      <div key={build.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card" data-testid={`bookmark-row-${build.id}`}>
                        <span className="text-lg shrink-0">{build.gameIcon}</span>
                        <div className="flex-1 min-w-0">
                          <Link href={`/build/${build.id}`}>
                            <p className="text-sm font-medium hover:text-primary cursor-pointer truncate">{build.name}</p>
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {build.gameName} · {build.className}
                            {build.mastery && ` · ${build.mastery}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-semibold ${score > 0 ? "text-primary" : score < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                            {score > 0 ? "+" : ""}{score}
                          </span>
                          <a href={build.guideUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className={source.color} data-testid={`link-bookmark-source-${build.id}`}>
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
