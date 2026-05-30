"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Grid, Layout, Maximize2, Minimize2, Settings2, Pause, Play } from "lucide-react";

// Cấu hình URL backend Flask
const BACKEND_URL = "http://localhost:5000";

// Cập nhật cấu hình camera để trỏ tới các video thực tế trong thư mục uploads của Flask
const LIVE_CAMERAS = [
  { 
    id: "camera-1", 
    name: "Hive Entrance", 
    location: "Zone A", 
    status: "online",
    streamUrl: `${BACKEND_URL}/stream/cam2_hive.mp4`
  },
  { 
    id: "camera-2", 
    name: "Field View", 
    location: "Zone B", 
    status: "online",
    streamUrl: `${BACKEND_URL}/stream/cam3_field.mp4`
  },
  { 
    id: "camera-3", 
    name: "Test Result", 
    location: "Lab Station", 
    status: "online",
    streamUrl: `${BACKEND_URL}/stream/test_hornet_result.mp4`
  },
  { id: "camera-4", name: "Garage", location: "East Wing", status: "offline", streamUrl: "" },
];

/**
 * AI Video Camera Component
 */
const LiveVideoCamera: React.FC<{
  camera: typeof LIVE_CAMERAS[0];
  isFullscreen: boolean;
  onToggleFullscreen: (id: string) => void;
}> = ({ camera, isFullscreen, onToggleFullscreen }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  
  return (
    <Card className={`overflow-hidden border-gray-800 ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen rounded-none' : 'h-full'}`}>
      <div className="relative h-full">
        <div className="relative aspect-video h-full w-full bg-black">
          
          <div className={`absolute inset-0 transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-80 grayscale'}`}>
            {camera.status === "online" && camera.streamUrl ? (
              /* Thẻ img nhận luồng MJPEG từ Flask, hoạt động như một video thời gian thực */
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={isPlaying ? camera.streamUrl : "/placeholder.jpg"} 
                alt={camera.name} 
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-900 text-gray-500">
                Camera Offline or No Signal
              </div>
            )}
          </div>
          
          {/* Camera Status Indicator */}
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <Badge variant={camera.status === "online" ? "default" : "destructive"} className="h-5 px-2 py-0">
              {camera.status === "online" ? "LIVE AI" : "OFFLINE"}
            </Badge>
            <Badge variant="outline" className="bg-black/60 border-none text-white backdrop-blur-sm">
              {camera.location}
            </Badge>
          </div>

          {/* Camera Controls */}
          <div className="absolute bottom-2 right-2 flex gap-2">
            <Button 
              size="icon" 
              variant="outline" 
              className="h-8 w-8 rounded-full border-none bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button 
              size="icon" 
              variant="outline" 
              className="h-8 w-8 rounded-full border-none bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
              onClick={() => onToggleFullscreen(camera.id)}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
            <Button 
              size="icon" 
              variant="outline" 
              className="h-8 w-8 rounded-full border-none bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
            >
              <Settings2 size={16} />
            </Button>
          </div>
          
          {/* Camera Name */}
          <div className="absolute bottom-2 left-2">
            <h4 className="rounded bg-black/50 px-2 py-1 text-sm font-medium text-white backdrop-blur-sm">
              {camera.name}
            </h4>
          </div>
          
          {!isPlaying && camera.status === "online" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
              <span className="rounded-md bg-black/60 px-4 py-2 text-sm font-medium text-white">
                AI Detection Paused
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

/**
 * LiveView Page Component
 */
export default function LiveViewPage() {
  const [gridLayout, setGridLayout] = useState<"2x2" | "3x3">("2x2");
  const [fullscreenCamera, setFullscreenCamera] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const toggleFullscreen = (cameraId: string) => {
    setFullscreenCamera(fullscreenCamera === cameraId ? null : cameraId);
  };

  const visibleCameras = fullscreenCamera 
    ? LIVE_CAMERAS.filter(cam => cam.id === fullscreenCamera)
    : LIVE_CAMERAS.slice(0, gridLayout === "2x2" ? 4 : 9);

  return (
    <div className="flex h-full w-full flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Live Detection</h1>
          <p className="text-muted-foreground">
            Monitor hornet invasion threats in real-time
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs defaultValue="all" className="w-[300px]">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="indoor">Hive</TabsTrigger>
              <TabsTrigger value="outdoor">Field</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button
            variant={gridLayout === "2x2" ? "secondary" : "outline"}
            size="icon"
            onClick={() => setGridLayout("2x2")}
          >
            <Grid size={18} />
          </Button>
          
          <Button
            variant={gridLayout === "3x3" ? "secondary" : "outline"}
            size="icon"
            onClick={() => setGridLayout("3x3")}
          >
            <Layout size={18} />
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex h-[500px] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm font-medium text-muted-foreground">Initializing YOLOv8 AI Models...</p>
          </div>
        </div>
      ) : (
        <div 
          className={`grid h-full gap-4 ${
            fullscreenCamera 
              ? 'grid-cols-1' 
              : gridLayout === "2x2" 
                ? 'grid-cols-1 xl:grid-cols-2'
                : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {visibleCameras.map((camera) => (
            <LiveVideoCamera
              key={camera.id}
              camera={camera}
              isFullscreen={fullscreenCamera === camera.id}
              onToggleFullscreen={toggleFullscreen}
            />
          ))}
        </div>
      )}
      
      <Card className="mt-auto border-gray-200 shadow-sm">
        <CardHeader className="py-3 bg-gray-50/50">
          <CardTitle className="text-sm font-medium">System Health & AI Status</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-4 py-4 text-center">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Nodes</p>
            <p className="text-2xl font-bold mt-1 text-primary">{LIVE_CAMERAS.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Processing</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{LIVE_CAMERAS.filter(c => c.status === "online").length}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Offline Nodes</p>
            <p className="text-2xl font-bold mt-1 text-red-500">{LIVE_CAMERAS.filter(c => c.status === "offline").length}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model Version</p>
            <p className="text-xl font-bold mt-1">YOLOv8 best.pt</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}