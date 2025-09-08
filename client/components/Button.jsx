export default function Button({ icon, children, onClick, className, variant = "primary", type = "button", ...props }) {
  const baseClasses = "flex items-center gap-1";
  const variantClasses = variant === "ghost"
    ? "bg-transparent text-gray-600 p-0 hover:text-gray-700"
    : "bg-gray-800 text-white rounded-full p-4 hover:opacity-90";

  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses} ${className || ""}`}
      onClick={onClick}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
