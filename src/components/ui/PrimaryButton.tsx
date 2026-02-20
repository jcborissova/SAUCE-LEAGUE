import React from "react";

type PrimaryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
};

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ className = "", type = "button", ...props }) => {
  return <button type={type} className={`btn-primary ${className}`.trim()} {...props} />;
};

export default PrimaryButton;
