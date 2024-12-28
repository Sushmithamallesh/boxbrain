export default function Header() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-5">
        <h1 className="text-4xl font-bold text-[hsl(var(--blood-red))]">boxbrain</h1>
        <p className="text-xl mt-4 text-muted-foreground">keep tabs on your orders</p>
      </div>
      <div className="grid grid-cols-1 gap-8 mt-12 max-w-3xl w-full">
        <div>
          <h2 className="font-semibold mb-4">how it works</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• connect your gmail account</li>
            <li>• boxbrain will automatically detect and track your orders</li>
            <li>• view your orders, returns, and invoices in a single place</li>
            <li>• search and filter your orders by status, vendor</li>
            <li>• ask questions about your orders, invoices, returns and your spending</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
