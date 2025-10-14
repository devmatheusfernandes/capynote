export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl text-primary font-semibold">
          Você está offline
        </h1>
        <p className="text-muted-foreground">
          Sem conexão no momento. Algumas funcionalidades podem não funcionar.
          Tente novamente quando estiver conectado.
        </p>
      </div>
    </div>
  );
}
