import React from "react";

type PanelProps = {
  children: React.ReactNode;
  className?: string;
};

const Panel: React.FC<PanelProps> = ({ children, className = "" }) => {
  return <section className={`app-panel px-4 py-3 sm:px-5 sm:py-4 ${className}`.trim()}>{children}</section>;
};

export default Panel;
