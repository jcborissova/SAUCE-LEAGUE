import { ArrowPathIcon } from "@heroicons/react/24/solid";

const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center py-8">
      <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-700" />
    </div>
  );
};

export default LoadingSpinner;
