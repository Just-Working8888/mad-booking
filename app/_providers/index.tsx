import type { ReactNode } from "react";
import { AntdProvider } from "./AntdProvider";
import { StoreProvider } from "./StoreProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <AntdProvider>{children}</AntdProvider>
    </StoreProvider>
  );
}
