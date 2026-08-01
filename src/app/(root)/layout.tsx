import StreamClientProvider from "@/components/providers/StreamClientProvider";
import AppShell from "@/components/layout/AppShell";

function layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <StreamClientProvider>{children}</StreamClientProvider>
    </AppShell>
  );
}

export default layout;
