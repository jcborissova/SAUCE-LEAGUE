import React from "react";

type PanelProps = {
  children: React.ReactNode;
  className?: string;
};

const Panel: React.FC<PanelProps> = ({ children, className = "" }) => {
  return <section className={`app-panel p-4 sm:p-5 ${className}`.trim()}>{children}</section>;
};

export default Panel;
