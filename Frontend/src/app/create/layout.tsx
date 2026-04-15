import { CreateFlowChrome } from "@/components/create/create-flow-chrome";

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <CreateFlowChrome />
      {children}
    </div>
  );
}
