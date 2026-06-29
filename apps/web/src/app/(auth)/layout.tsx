export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">SaleSense</h1>
        <p className="text-muted-foreground mt-2">AI-Powered Retail Intelligence Platform</p>
      </div>
      {children}
    </div>
  );
}
