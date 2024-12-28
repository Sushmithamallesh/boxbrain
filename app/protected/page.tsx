export default async function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">your orders</h1>
        <p className="text-sm text-muted-foreground">
          we're scanning your gmail for orders...
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
        No orders found yet. We'll notify you when we find some!
      </div>
    </div>
  );
}
