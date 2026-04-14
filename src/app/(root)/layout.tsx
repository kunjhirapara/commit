import StreamClientProvider from "@/components/providers/StreamClientProvider";

function layout({ children }: { children: React.ReactNode }) {
  return <StreamClientProvider>{children}</StreamClientProvider>;
}

export default layout;
