import React from "react";

type SecondaryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const SecondaryButton: React.FC<SecondaryButtonProps> = ({ className = "", type = "button", ...props }) => {
  return <button type={type} className={`btn-secondary ${className}`.trim()} {...props} />;
};

export default SecondaryButton;
