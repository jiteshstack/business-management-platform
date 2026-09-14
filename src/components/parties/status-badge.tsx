import { Badge } from "@/components/ui/badge";

export function PartyStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "success" : "neutral"}>
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
