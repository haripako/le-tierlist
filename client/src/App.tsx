import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import HomePage from "./pages/home";
import SubmitBuildPage from "./pages/submit-build";
import BuildDetailPage from "./pages/build-detail";
import UserProfilePage from "./pages/user-profile";
import AdminSeasonsPage from "./pages/admin-seasons";
import NotFound from "./pages/not-found";
import Header from "./components/header";

function AppRouter() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-[1200px] mx-auto px-4 py-6">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/submit" component={SubmitBuildPage} />
          <Route path="/build/:id" component={BuildDetailPage} />
          <Route path="/user/:id" component={UserProfilePage} />
          <Route path="/admin/seasons" component={AdminSeasonsPage} />
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
