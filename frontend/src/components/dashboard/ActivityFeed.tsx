import React from 'react';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  type: 'dispute_created' | 'dispute_updated' | 'resolution_suggested' | 'document_uploaded' | 'message_sent';
  title: string;
  description?: string;
  timestamp: string | Date;
  status?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start p-4 border rounded-lg hover:bg-gray-50 transition-colors">
          <div className="flex-shrink-0">
            {getActivityIcon(activity.type)}
          </div>
          <div className="ml-4 flex-1">
            <p className="font-medium text-gray-900">{activity.title}</p>
            {activity.description && (
              <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
            </p>
          </div>
          {activity.status && (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
              {activity.status}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function getActivityIcon(type: string) {
  const icons = {
    dispute_created: '📝',
    dispute_updated: '🔄',
    resolution_suggested: '✅',
    document_uploaded: '📄',
    message_sent: '💬',
  };
  
  const icon = icons[type as keyof typeof icons] || '📌';
  
  return (
    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">
      {icon}
    </div>
  );
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };
  return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
}
