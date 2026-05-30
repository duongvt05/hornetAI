"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCamerasClient } from '@/lib/data/cameras';
import { getDetections, Detection } from '@/lib/data/detections';
import { Camera } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  Loader2, 
  Camera as CameraIcon, 
  Shield, 
  Bell, 
  History, 
  CheckCircle, 
  AlertTriangle, 
  Bug,
  Thermometer,
  ArrowRight
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState({
    cameras: true,
    detections: true,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Load cameras
        setLoading(prev => ({ ...prev, cameras: true }));
        const camerasData = await getCamerasClient();
        setCameras(camerasData);
        setLoading(prev => ({ ...prev, cameras: false }));

        // Load detections
        setLoading(prev => ({ ...prev, detections: true }));
        const detectionsData = await getDetections();
        setDetections(detectionsData);
        setLoading(prev => ({ ...prev, detections: false }));
      } catch (err) {
        setError('Failed to load dashboard data. Please try again later.');
        console.error(err);
      }
    };

    fetchDashboardData();
  }, []);

  const isLoading = loading.cameras || loading.detections;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry Again
        </Button>
      </div>
    );
  }

  // Get total critical wasp detections
  const criticalCount = detections.filter(d => d.severity === 'critical').length;

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor agricultural IoT sensor grids and invasive wasp threat alerts.
          </p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Refreshing dashboard data...</span>
          </div>
        )}
      </div>

      {/* Top statistics widgets */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border/40 hover:border-primary/20 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CameraIcon className="h-5 w-5 text-primary" />
              IoT Camera Stations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{cameras.length}</div>
            <p className="text-muted-foreground text-sm">
              {cameras.filter(camera => camera.status === 'online').length} camera nodes online
            </p>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/settings?tab=cameras">Manage Cameras</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/40 hover:border-primary/20 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-primary" />
              Push Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3</div>
            <p className="text-muted-foreground text-sm">
              1 unread alert
            </p>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/notifications">View All</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/40 hover:border-primary/20 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              AI Detection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20">
                Active
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-2">
              Monitoring all camera streams via YOLOv8
            </p>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/ai-assistant">AI Assistant</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/40 hover:border-primary/20 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Detection History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{detections.length}</div>
            <p className="text-muted-foreground text-sm text-red-500 font-semibold flex items-center gap-1">
              <Bug className="w-3.5 h-3.5" />
              {criticalCount} Asian hornet (V. velutina) sightings
            </p>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/detection-history">View History</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Live camera stream redirection */}
      <Card className="mb-6 bg-card/50 border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CameraIcon className="h-5 w-5 text-primary" />
            Live Wasp Monitoring
          </CardTitle>
          <CardDescription>
            View real-time video footage integrated with edge AI object detection.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center">
          <p className="text-muted-foreground mb-4">
            Live camera previews have been moved to the dedicated live view page.
          </p>
          <Button asChild>
            <Link href="/dashboard/cameras/live" className="flex gap-2 items-center">
              Go to Live Camera View
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Tabs segment */}
      <Tabs defaultValue="detections" className="space-y-6">
        <TabsList>
          <TabsTrigger value="detections">Recent Wasp Threats</TabsTrigger>
          <TabsTrigger value="notifications">System Status</TabsTrigger>
        </TabsList>

        <TabsContent value="detections" className="space-y-6">
          <Card className="bg-card/50 border-border/40">
            <CardHeader>
              <CardTitle>Recent Wasp Threat Alerts</CardTitle>
              <CardDescription>
                Latest occurrences of invasive hornets detected at agricultural field nodes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading.detections ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : detections.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {detections.slice(0, 4).map((det) => (
                      <div
                        key={det.id}
                        className="flex items-center gap-3 p-3 border border-border/40 rounded-md hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0 border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={det.thumbnail} alt={det.commonName} className="object-cover h-full w-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{det.commonName}</p>
                          <p className="text-xs text-muted-foreground truncate">{det.cameraName}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <Badge variant={det.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px] font-mono">
                            {det.confidence}%
                          </Badge>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="flex items-center text-amber-500">
                              <Thermometer className="w-3 h-3" />
                              {det.temperature}°C
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/dashboard/detection-history">View Full Detection History</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-muted-foreground">No hornet detections logged yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-card/50 border-border/40">
            <CardHeader>
              <CardTitle>Recent System Logs</CardTitle>
              <CardDescription>
                System hardware logs and configuration alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 border rounded-md bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-5 w-5" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">SMS Alert Queue Delay</p>
                      <span className="text-xs text-muted-foreground">2 minutes ago</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Emergency SMS warning temporarily routed through backup gateway due to network traffic.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 border border-border/40 rounded-md">
                  <Bell className="h-5 w-5 text-blue-500" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">Station 02 - Northern Apple Orchard Online</p>
                      <span className="text-xs text-muted-foreground">1 hour ago</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Edge camera successfully connected, RTSP stream stable at 25 FPS.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 border border-border/40 rounded-md">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">Edge Node Storage Threshold Alert</p>
                      <span className="text-xs text-muted-foreground">Yesterday</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Local disk space exceeds 78%. Preparing to apply automatic video retention pruning after 30 days.</p>
                  </div>
                </div>

                <div className="mt-4">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/notifications">View All Notifications</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}