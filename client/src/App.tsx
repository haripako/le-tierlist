import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import HomePage from "./pages/home";
import GamePage from "./pages/game";
import SubmitBuildPage from "./pages/submit-build";
import BuildDetailPage from "./pages/build-detail";
import UserProfilePage from "./pages/user-profile";
import AdminDashboardPage from "./pages/admin-dashboard";
import AdminGamesPage from "./pages/admin-games";
import AdminGameModesPage from "./pages/admin-game-modes";
import AdminClassesPage from "./pages/admin-classes";
import AdminSeasonsPage from "./pages/admin-seasons";
import AdminBuildsPage from "./pages/admin-builds";
import AdminUsersPage from "./pages/admin-users";
import AdminSocialPage from "./pages/admin-social";
import AdminCategoriesPage from "./pages/admin-categories";
import SettingsPage from "./pages/settings";
import NotFound from "./pages/not-found";
import Header from "./components/header";

function AppRouter() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-[1200px] mx-auto px-4 py-6">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/game/:slug" component={GamePage} />
          <Route path="/submit" component={SubmitBuildPage} />
          <Route path="/build/:id" component={BuildDetailPage} />
          <Route path="/user/:id" component={UserProfilePage} />
          <Route path="/admin" component={AdminDashboardPage} />
          <Route path="/admin/games" component={AdminGamesPage} />
          <Route path="/admin/game-modes" component={AdminGameModesPage} />
          <Route path="/admin/classes" component={AdminClassesPage} />
          <Route path="/admin/seasons" component={AdminSeasonsPage} />
          <Route path="/admin/builds" component={AdminBuildsPage} />
          <Route path="/admin/social" component={AdminSocialPage} />
          <Route path="/admin/users" component={AdminUsersPage} />
          <Route path="/admin/categories" component={AdminCategoriesPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AppRouter />
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
