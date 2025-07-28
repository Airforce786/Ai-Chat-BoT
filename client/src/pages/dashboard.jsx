import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Users, 
  MessageSquare, 
  Database, 
  Zap, 
  TrendingUp,
  Clock,
  Server,
  RefreshCw,
  AlertTriangle
} from "lucide-react";

export default function Dashboard() {
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ["/api/analytics/dashboard"],
    refetchInterval: 30000,
  });

  const { data: memoryStats, isLoading: memoryLoading } = useQuery({
    queryKey: ["/api/memory/stats"],
    refetchInterval: 10000,
  });

  const { data: systemHealth } = useQuery({
    queryKey: ["/api/admin/system-health"],
    refetchInterval: 30000,
  });

  const getConnectionStatus = () => {
    if (!systemHealth) return { status: "connecting", color: "var(--discord-warning)" };
    
    const dbHealthy = (systemHealth).database?.status === "healthy";
    const aiHealthy = (systemHealth).aiServices?.status === "healthy";
    const memoryHealthy = (systemHealth).memorySystem?.status === "healthy";
    
    if (dbHealthy && aiHealthy && memoryHealthy) {
      return { status: "Online", color: "var(--discord-success)" };
    } else if (dbHealthy) {
      return { status: "Degraded", color: "var(--discord-warning)" };
    } else {
      return { status: "Offline", color: "var(--discord-error)" };
    }
  };

  const connectionStatus = getConnectionStatus();

  if (dashboardLoading || memoryLoading) {
    return (
      <div className="min-h-screen bg-[var(--discord-bg-primary)] text-[var(--discord-text-primary)] p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--discord-bg-primary)] text-[var(--discord-text-primary)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--discord-text-primary)]">
              Discord Bot Dashboard
            </h1>
            <p className="text-[var(--discord-text-secondary)] mt-1">
              Memory management and analytics for your AI assistant
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge 
              variant="outline" 
              className="border-current"
              style={{ color: connectionStatus.color, borderColor: connectionStatus.color }}
            >
              <Activity className="h-3 w-3 mr-1" />
              {connectionStatus.status}
            </Badge>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* System Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-[var(--discord-bg-secondary)] border-[var(--discord-border)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[var(--discord-text-secondary)]">
                Memory Usage
              </CardTitle>
              <Database className="h-4 w-4 text-[var(--discord-text-secondary)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[var(--discord-text-primary)]">
                {dashboardData?.memoryUsage || "0.0 GB"}
              </div>
              <div className="text-xs text-[var(--discord-text-secondary)] mt-1">
                {memoryStats?.totalMemoryUsage ? 
                  `${memoryStats.conversationCount} conversations` : 
                  "No active conversations"
                }
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[var(--discord-bg-secondary)] border-[var(--discord-border)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[var(--discord-text-secondary)]">
                Active Users
              </CardTitle>
              <Users className="h-4 w-4 text-[var(--discord-text-secondary)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[var(--discord-text-primary)]">
                {dashboardData?.totalUsers || 0}
              </div>
              <div className="text-xs text-[var(--discord-text-secondary)] mt-1">
                {memoryStats?.activeUsers || 0} online now
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[var(--discord-bg-secondary)] border-[var(--discord-border)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[var(--discord-text-secondary)]">
                Conversations
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-[var(--discord-text-secondary)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[var(--discord-text-primary)]">
                {dashboardData?.activeConversations || 0}
              </div>
              <div className="text-xs text-[var(--discord-text-secondary)] mt-1">
                {memoryStats?.chunksCount || 0} memory chunks
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[var(--discord-bg-secondary)] border-[var(--discord-border)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[var(--discord-text-secondary)]">
                API Calls
              </CardTitle>
              <Zap className="h-4 w-4 text-[var(--discord-text-secondary)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[var(--discord-text-primary)]">
                {dashboardData?.apiCalls || 0}
              </div>
              <div className="text-xs text-[var(--discord-text-secondary)] mt-1">
                Last 24 hours
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Memory Management Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-[var(--discord-bg-secondary)] border-[var(--discord-border)]">
            <CardHeader>
              <CardTitle className="text-[var(--discord-text-primary)] flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Memory Management
              </CardTitle>
              <CardDescription className="text-[var(--discord-text-secondary)]">
                System memory usage and optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--discord-text-secondary)]">Memory Efficiency</span>
                  <span className="text-[var(--discord-text-primary)]">
                    {dashboardData?.memoryEfficiency || "0%"}
                  </span>
                </div>
                <Progress 
                  value={parseFloat(dashboardData?.memoryEfficiency) || 0} 
                  className="h-2"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--discord-text-secondary)]">Compression Ratio</span>
                  <span className="text-[var(--discord-text-primary)]">
                    {dashboardData?.compressionRatio || 0}%
                  </span>
                </div>
                <Progress 
                  value={dashboardData?.compressionRatio || 0} 
                  className="h-2"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Optimize
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Database className="h-3 w-3 mr-1" />
                  Cleanup
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[var(--discord-bg-secondary)] border-[var(--discord-border)]">
            <CardHeader>
              <CardTitle className="text-[var(--discord-text-primary)] flex items-center">
                <Server className="h-5 w-5 mr-2" />
                System Health
              </CardTitle>
              <CardDescription className="text-[var(--discord-text-secondary)]">
                Component status and uptime
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--discord-text-secondary)]">Database</span>
                  <Badge 
                    variant="outline" 
                    className="text-xs border-[var(--discord-success)] text-[var(--discord-success)]"
                  >
                    Healthy
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--discord-text-secondary)]">AI Services</span>
                  <Badge 
                    variant="outline" 
                    className="text-xs border-[var(--discord-success)] text-[var(--discord-success)]"
                  >
                    Healthy
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--discord-text-secondary)]">Memory System</span>
                  <Badge 
                    variant="outline" 
                    className="text-xs border-[var(--discord-success)] text-[var(--discord-success)]"
                  >
                    Healthy
                  </Badge>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--discord-border)]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--discord-text-secondary)] flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Uptime
                  </span>
                  <span className="text-[var(--discord-text-primary)]">
                    {dashboardData?.uptime || 0}h
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Trends */}
        <Card className="bg-[var(--discord-bg-secondary)] border-[var(--discord-border)]">
          <CardHeader>
            <CardTitle className="text-[var(--discord-text-primary)] flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Performance Trends
            </CardTitle>
            <CardDescription className="text-[var(--discord-text-secondary)]">
              System performance over the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-[var(--discord-text-secondary)]">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Performance charts will be displayed here</p>
                <p className="text-sm mt-1">Data visualization in development</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-[var(--discord-bg-secondary)] border-[var(--discord-border)]">
          <CardHeader>
            <CardTitle className="text-[var(--discord-text-primary)]">Quick Actions</CardTitle>
            <CardDescription className="text-[var(--discord-text-secondary)]">
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <RefreshCw className="h-6 w-6" />
                <span className="text-xs">Optimize Memory</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <Users className="h-6 w-6" />
                <span className="text-xs">Manage Users</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <MessageSquare className="h-6 w-6" />
                <span className="text-xs">View Conversations</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <AlertTriangle className="h-6 w-6" />
                <span className="text-xs">System Logs</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}