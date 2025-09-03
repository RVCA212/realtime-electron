import { useAuth } from '../contexts/AuthContext';
import Button from './Button';

export default function UserInfo() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const usagePercentage = user.usage ? 
    Math.round((user.usage.requests / user.limits.requestsPerDay) * 100) : 0;

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Account</h3>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>
        <Button
          onClick={logout}
          className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800"
        >
          Sign out
        </Button>
      </div>
      
      {user.usage && (
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Daily Usage</span>
            <span className="text-xs text-gray-600">
              {user.usage.requests} / {user.limits.requestsPerDay} requests
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
          {usagePercentage > 90 && (
            <p className="text-xs text-orange-600 mt-1">
              You're approaching your daily limit
            </p>
          )}
        </div>
      )}
    </div>
  );
}