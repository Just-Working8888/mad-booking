"use client";

import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { theme } from "./theme";

dayjs.locale("ru");

export function AntdProvider({ children }: { children: ReactNode }) {
  return (
    // Registry collects antd's CSS-in-JS styles during SSR to avoid a flash of unstyled content.
    <AntdRegistry>
      <ConfigProvider locale={ruRU} theme={theme}>
        {/* <App> provides context-aware message/notification/modal via App.useApp(). */}
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
