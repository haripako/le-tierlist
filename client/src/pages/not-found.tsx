import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="text-center py-20 space-y-4">
      <h1 className="text-4xl font-bold text-primary" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        404
      </h1>
      <p className="text-muted-foreground">Page not found. Looks like you wandered off the Epoch.</p>
      <Link href="/">
        <Button variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tier List
        </Button>
      </Link>
    </div>
  );
}
