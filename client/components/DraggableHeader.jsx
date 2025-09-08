import { useNavigate, useLocation } from "react-router-dom";
import { Settings } from "react-feather";
import logo from "/assets/openai-logomark.svg";
import Button from "./Button";

export default function DraggableHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsPage = location.pathname === "/settings";

  return (
    <nav className="draggable-header absolute top-0 left-0 right-0 h-16 flex items-center">
      <div className="flex items-center justify-between w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
        <div className="flex items-center gap-4">
          <img style={{ width: "24px" }} src={logo} />
          <h1>OpenAI Realtime Console</h1>
        </div>
        {!isSettingsPage && (
          <Button
            onClick={() => navigate("/settings")}
            className="text-gray-600 hover:text-gray-700"
            variant="ghost"
            title="Settings"
          >
            <Settings size={18} />
          </Button>
        )}
      </div>
    </nav>
  );
}