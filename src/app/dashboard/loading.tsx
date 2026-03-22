import { Logo } from "@/components/Logo";
export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Logo size={40} className="animate-pulse" />
    </div>
  );
}
