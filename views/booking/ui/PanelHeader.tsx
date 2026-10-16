import { useEffect, useRef } from "react";
import { Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import styles from "./BookingPage.module.scss";

type PanelHeaderProps = {
  title: string;
  onClose: () => void;
};

export function PanelHeader({ title, onClose }: PanelHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <header className={styles.panelHeader}>
      <h3 ref={headingRef} tabIndex={-1} className={styles.panelTitle}>
        {title}
      </h3>
      <Button type="text" icon={<CloseOutlined />} aria-label="Закрыть" onClick={onClose} />
    </header>
  );
}
