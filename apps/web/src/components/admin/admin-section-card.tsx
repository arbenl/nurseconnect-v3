import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AdminSectionCardProps = {
  title: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  testId?: string;
  children: React.ReactNode;
};

export function AdminSectionCard({
  title,
  description,
  className,
  contentClassName,
  testId,
  children,
}: AdminSectionCardProps) {
  return (
    <Card
      data-testid={testId ?? "admin-section-card"}
      className={cn("border-slate-200/80 bg-white/95 shadow-sm", className)}
    >
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl text-slate-950">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn("space-y-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
